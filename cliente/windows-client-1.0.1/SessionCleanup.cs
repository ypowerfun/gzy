using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.Threading;
using System.Runtime.InteropServices;
using System.ComponentModel;
using System.Web.Script.Serialization;

public class CleanupProcess {
 public int pid,parent;public long started;public string name;public bool visible;
 public string Key {get{return pid+":"+started;}}
}
// 2.0.59: o Windows nao deixa o GameZoney fechar este processo (anticheat como o EasyAntiCheat, ou processo de administrador).
public class ProcessProtectedException : Exception {public ProcessProtectedException(string message):base(message){}}
public class CleanupState {
 public string session;public long beganUtcTicks;public List<string> baseline=new List<string>();public List<CleanupProcess> processes=new List<CleanupProcess>();public List<string> processNames=new List<string>();
}
// Registra somente os aplicativos da sessao. Nenhum perfil, cookie, historico ou arquivo de navegador e apagado.
// O marcador persistente permite concluir o fechamento mesmo se o cliente/Windows reiniciar no meio da limpeza.
public class SessionCleanup {
 readonly string directory;readonly Func<List<CleanupProcess>> snapshot;readonly Action<CleanupProcess> terminate;
 readonly object sync=new object(); // 2.0.21: Observe roda fora da thread da interface
 CleanupState state;readonly HashSet<string> baseline=new HashSet<string>();readonly JavaScriptSerializer json=new JavaScriptSerializer();
 public string Session {get{return state==null?null:state.session;}}
 public bool Pending {get{return state!=null;}}
 string Marker {get{return Path.Combine(directory,"session-cleanup.json");}}
 public SessionCleanup(string dir,string localPath,string roamingPath,Func<List<CleanupProcess>> read,Action<CleanupProcess> kill){directory=dir;snapshot=read;terminate=kill;if(File.Exists(Marker)){state=json.Deserialize<CleanupState>(File.ReadAllText(Marker));if(state==null||String.IsNullOrEmpty(state.session))throw new IOException("Registro de limpeza inválido. Procure a recepção.");if(state.baseline==null)state.baseline=new List<string>();if(state.processes==null)state.processes=new List<CleanupProcess>();if(state.processNames==null)state.processNames=new List<string>();foreach(string key in state.baseline)baseline.Add(key);if(state.beganUtcTicks<=0){long oldest=0;foreach(var p in state.processes)if(p.started>0&&(oldest==0||p.started<oldest))oldest=p.started;state.beganUtcTicks=oldest>0?oldest:DateTime.UtcNow.Ticks;}foreach(var p in state.processes)RememberName(p.name);}}
 public static SessionCleanup Create(string dir){return new SessionCleanup(dir,Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),ReadProcesses,Terminate);}
 void Save(){Directory.CreateDirectory(directory);string tmp=Marker+".tmp";File.WriteAllText(tmp,json.Serialize(state));if(File.Exists(Marker))File.Replace(tmp,Marker,null);else File.Move(tmp,Marker);}
 static bool Protected(string name){return new HashSet<string>(StringComparer.OrdinalIgnoreCase){"GameZoneyCliente","MonitorGZ","GameZoneyMonitor","explorer","dwm","winlogon","csrss","services","lsass","svchost","sihost","fontdrvhost","ShellExperienceHost","StartMenuExperienceHost","SearchApp","SearchHost","ApplicationFrameHost","RuntimeBroker","ctfmon","taskhostw","smartscreen"}.Contains(name??"");}
 // Launchers e helpers sem janela precisam ser reconhecidos quando NASCEM durante a sessao.
 // A lista nao significa "fechar sempre": um processo que ja existia antes do login pertence a linha de base e e preservado.
 static bool SessionAgent(string name){return new HashSet<string>(StringComparer.OrdinalIgnoreCase){
  "steam","steamwebhelper","gameoverlayui","streaming_client","steamerrorreporter",
  "epicgameslauncher","epicwebhelper","battle.net","agent","riotclientservices","riotclientux","riotclientuxrender",
  "ubisoftconnect","upc","eadesktop","origin","goggalaxy","galaxyclient","chatgpt","discord"
 }.Contains(name??"");}
 void RememberName(string name){if(String.IsNullOrEmpty(name)||Protected(name))return;foreach(string n in state.processNames)if(String.Equals(n,name,StringComparison.OrdinalIgnoreCase))return;state.processNames.Add(name);}
 bool KnownName(string name){if(state==null||state.processNames==null)return false;foreach(string n in state.processNames)if(String.Equals(n,name,StringComparison.OrdinalIgnoreCase))return true;return false;}
 public void Begin(string session){lock(sync){BeginLocked(session);}}
 void BeginLocked(string session){if(state!=null){if(state.session==session)return;throw new IOException("A limpeza anterior ainda não terminou.");}baseline.Clear();foreach(var p in snapshot())baseline.Add(p.Key);state=new CleanupState{session=session,beganUtcTicks=DateTime.UtcNow.Ticks,baseline=new List<string>(baseline)};Save();Observe();}
 public void Observe(){lock(sync){ObserveLocked();}}
 void ObserveLocked(){if(state==null)return;bool changed=false;var list=snapshot();var tracked=new HashSet<string>();foreach(var p in state.processes)tracked.Add(p.Key);
  // A linha de base foi tirada no instante em que o login iniciou a sessao. Tudo que ja estava aberto naquele momento e preservado.
  // Depois do login, registra janelas novas e launchers/helpers conhecidos mesmo que estejam apenas na bandeja.
  foreach(var p in list){if(Protected(p.name)||baseline.Contains(p.Key))continue;if((p.visible||SessionAgent(p.name))&&tracked.Add(p.Key)){state.processes.Add(p);RememberName(p.name);changed=true;}}
  // Filhos dos aplicativos registrados tambem pertencem a sessao, mesmo sem janela (tray/Electron/helpers).
  for(int pass=0;pass<list.Count;pass++){bool added=false;foreach(var p in list){if(Protected(p.name)||baseline.Contains(p.Key)||tracked.Contains(p.Key))continue;bool child=false;foreach(var parent in state.processes)if(parent.pid==p.parent&&parent.started<=p.started){child=true;break;}if(child&&tracked.Add(p.Key)){state.processes.Add(p);RememberName(p.name);changed=true;added=true;}}if(!added)break;}
  // Aplicativos Electron/launchers podem reiniciar um processo com outro PID. Se o nome ja pertenceu a sessao,
  // a nova instancia tambem pertence, desde que tenha nascido depois do login e nao faca parte da linha de base.
  foreach(var p in list)if(!Protected(p.name)&&!baseline.Contains(p.Key)&&!tracked.Contains(p.Key)&&p.started>=state.beganUtcTicks&&KnownName(p.name)){state.processes.Add(p);tracked.Add(p.Key);changed=true;}
  if(changed)Save();
 }
 bool Selected(CleanupProcess p){if(state==null||Protected(p.name)||baseline.Contains(p.Key))return false;foreach(var old in state.processes)if(old.Key==p.Key)return true;return KnownName(p.name);}
 public void Clean(){lock(sync){CleanLocked();}}
 // 2.0.59: programas que o Windows NAO deixa o GameZoney fechar ("Acesso negado": anticheat como o EasyAntiCheat do Fortnite,
 // processo de servico ou de administrador) recebem o pedido de fechar a janela e o cliente espera ate 10 s. Se continuarem
 // abertos SEM janela (processo de fundo), a limpeza termina e o PC e liberado (fica anotado no session-cleanup.log).
 // Com janela aberta (o jogo do cliente anterior na tela) o PC continua bloqueado ate ela fechar, como antes.
 public int ProtectedWaitMs=10000;public Action<CleanupProcess> CloseWindows=CloseProcessWindows;
 void CleanLocked(){if(state==null)return;var errors=new List<string>();var denied=new HashSet<string>();
  for(int attempt=0;attempt<4;attempt++){Observe();var current=snapshot();foreach(var p in current){if(!Selected(p))continue;try{terminate(p);}catch(ProcessProtectedException){denied.Add(p.Key);}catch(Exception e){if(attempt==3)errors.Add(p.name+": "+e.Message);}}if(attempt<3)Thread.Sleep(350);}
  Observe();var left=Remaining();
  if(left.Exists(p=>denied.Contains(p.Key))){
   foreach(var p in left)if(denied.Contains(p.Key)){try{CloseWindows(p);}catch{}}
   var clock=Stopwatch.StartNew();
   while(clock.ElapsedMilliseconds<ProtectedWaitMs){Thread.Sleep(Math.Min(500,Math.Max(1,ProtectedWaitMs)));left=Remaining();if(!left.Exists(p=>denied.Contains(p.Key)))break;}
  }
  var ignored=new List<string>();
  foreach(var p in left){if(denied.Contains(p.Key)&&!p.visible){ignored.Add(p.name);continue;}errors.Add(denied.Contains(p.Key)?"o Windows não deixa o GameZoney fechar "+p.name+" (proteção anticheat/administrador); feche esse programa na tela":"Programa ainda aberto: "+p.name);}
  if(errors.Count>0)throw new IOException(String.Join("; ",errors.ToArray()));
  if(ignored.Count>0)Note("Limpeza concluída. Processos protegidos sem janela, que o Windows não deixou fechar, ficaram abertos: "+String.Join(", ",ignored.ToArray())+".");
  if(File.Exists(Marker))File.Delete(Marker);state=null;baseline.Clear();
 }
 List<CleanupProcess> Remaining(){var result=new List<CleanupProcess>();foreach(var p in snapshot())if(Selected(p))result.Add(p);return result;}
 void Note(string message){try{Directory.CreateDirectory(directory);string file=Path.Combine(directory,"session-cleanup.log");if(File.Exists(file)&&new FileInfo(file).Length>262144)File.Delete(file);File.AppendAllText(file,DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")+" "+message+Environment.NewLine);}catch{}}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Auto)]struct ProcessEntry {public uint size,usage,pid;public IntPtr heap;public uint module,threads,parent;public int priority;public uint flags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string exe;}
 [DllImport("kernel32.dll")]static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
 [DllImport("kernel32.dll",CharSet=CharSet.Auto)]static extern bool Process32First(IntPtr snap,ref ProcessEntry entry);
 [DllImport("kernel32.dll",CharSet=CharSet.Auto)]static extern bool Process32Next(IntPtr snap,ref ProcessEntry entry);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 public static List<CleanupProcess> ReadProcesses(){var parents=new Dictionary<int,int>();IntPtr h=CreateToolhelp32Snapshot(2,0);if(h!=(IntPtr)(-1)){try{var entry=new ProcessEntry();entry.size=(uint)Marshal.SizeOf(entry);if(Process32First(h,ref entry))do{parents[(int)entry.pid]=(int)entry.parent;}while(Process32Next(h,ref entry));}finally{CloseHandle(h);}}var result=new List<CleanupProcess>();using(var self=Process.GetCurrentProcess()){foreach(var p in Process.GetProcesses())using(p){try{if(p.Id==self.Id||p.SessionId!=self.SessionId)continue;int parent;parents.TryGetValue(p.Id,out parent);result.Add(new CleanupProcess{pid=p.Id,parent=parent,started=p.StartTime.ToUniversalTime().Ticks,name=p.ProcessName,visible=p.MainWindowHandle!=IntPtr.Zero});}catch{}}}return result;}
 static void Terminate(CleanupProcess item){try{using(var p=Process.GetProcessById(item.pid)){if(p.StartTime.ToUniversalTime().Ticks!=item.started)return;try{p.Kill();}catch(Win32Exception e){if(e.NativeErrorCode==5)throw new ProcessProtectedException(e.Message);throw;}if(!p.WaitForExit(3000))throw new IOException("O processo não encerrou.");}}catch(ArgumentException){}}
 // 2.0.59: pedido normal de fechar (como clicar no X) para o programa que o Windows nao deixa encerrar a forca.
 static void CloseProcessWindows(CleanupProcess item){try{using(var p=Process.GetProcessById(item.pid)){if(p.StartTime.ToUniversalTime().Ticks!=item.started)return;p.CloseMainWindow();}}catch{}}
}
