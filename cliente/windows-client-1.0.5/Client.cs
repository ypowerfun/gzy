using System;
using System.IO;
using System.Text;
using System.Net;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using System.Reflection;
[assembly: AssemblyTitle("GameZoney Cliente")]
[assembly: AssemblyVersion("1.0.5.0")]

public class Settings {
 public string server, fingerprint, token, stationName, device, maintenance,offlineAdminUsername,offlineAdminHash;
 public string setupDevice,setupSecret,layoutRevision,layoutPosition;
 public bool policyCaptured, policyPresent;public int policyValue;
 public bool panelCaptured,panelPresent;public int panelValue;
 public MachineOptions machinePolicy;public Dictionary<string,PolicyOriginal> securityOriginals;
}
public class LocalSessionState {
 public string id,memberName,stationName;public double remainingSeconds;public long savedUtcTicks;public ulong savedSystemUptimeMs;
}
public static class Files {
 public static string DirectoryPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"GameZoneyCliente");
 public static string ConfigPath {get{return Path.Combine(DirectoryPath,"client.dat");}}
 public static string SessionPath {get{return Path.Combine(DirectoryPath,"active-session.dat");}}
 public static JavaScriptSerializer Json=new JavaScriptSerializer{MaxJsonLength=4000000};
 [DllImport("kernel32.dll")]static extern ulong GetTickCount64();
 public static ulong SystemUptimeMs(){try{return GetTickCount64();}catch{return 0;}}
 public static Settings Load(){return Json.Deserialize<Settings>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(ConfigPath),null,DataProtectionScope.CurrentUser)));}
 public static void Save(Settings s){Directory.CreateDirectory(DirectoryPath);var data=ProtectedData.Protect(Encoding.UTF8.GetBytes(Json.Serialize(s)),null,DataProtectionScope.CurrentUser);File.WriteAllBytes(ConfigPath+".tmp",data);if(File.Exists(ConfigPath))File.Replace(ConfigPath+".tmp",ConfigPath,null);else File.Move(ConfigPath+".tmp",ConfigPath);}
 public static void SaveSession(LocalSessionState s){Directory.CreateDirectory(DirectoryPath);var data=ProtectedData.Protect(Encoding.UTF8.GetBytes(Json.Serialize(s)),null,DataProtectionScope.CurrentUser);File.WriteAllBytes(SessionPath+".tmp",data);if(File.Exists(SessionPath))File.Replace(SessionPath+".tmp",SessionPath,null);else File.Move(SessionPath+".tmp",SessionPath);}
 public static LocalSessionState LoadSession(){try{return File.Exists(SessionPath)?Json.Deserialize<LocalSessionState>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(SessionPath),null,DataProtectionScope.CurrentUser))):null;}catch{return null;}}
 public static void ClearSession(){try{if(File.Exists(SessionPath))File.Delete(SessionPath);}catch{}}
 public static void LogFullscreen(string message){try{Directory.CreateDirectory(DirectoryPath);string file=Path.Combine(DirectoryPath,"fullscreen.log");if(File.Exists(file)&&new FileInfo(file).Length>524288)File.Delete(file);File.AppendAllText(file,DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")+" "+message+Environment.NewLine);}catch{}}
public static void LogConnection(string message){try{Directory.CreateDirectory(DirectoryPath);string file=Path.Combine(DirectoryPath,"connection.log");if(File.Exists(file)&&new FileInfo(file).Length>524288)File.Delete(file);File.AppendAllText(file,DateTime.UtcNow.ToString("o")+" "+message+Environment.NewLine);}catch{}}
 public static string Hash(string password,string salt=null){if(password.Length<8||password.Length>128)throw new Exception("A senha deve ter de 8 a 128 caracteres.");if(salt==null){var bytes=new byte[24];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(bytes);salt=Convert.ToBase64String(bytes);}using(var k=new Rfc2898DeriveBytes(password,Convert.FromBase64String(salt),150000,HashAlgorithmName.SHA256))return salt+":"+Convert.ToBase64String(k.GetBytes(32));}
 public static bool Verify(string password,string saved){try{string actual=Hash(password,saved.Split(':')[0]);if(actual.Length!=saved.Length)return false;int diff=0;for(int i=0;i<actual.Length;i++)diff|=actual[i]^saved[i];return diff==0;}catch{return false;}}
 public static void Validate(Settings s){Uri uri;if(!Uri.TryCreate(s.server,UriKind.Absolute,out uri)||uri.Scheme!="https"||uri.AbsolutePath!="/"||!String.IsNullOrEmpty(uri.UserInfo)||!String.IsNullOrEmpty(uri.Query))throw new Exception("Endereço HTTPS do servidor inválido.");if(!System.Text.RegularExpressions.Regex.IsMatch(s.fingerprint??"","^[A-Fa-f0-9]{64}$")||!System.Text.RegularExpressions.Regex.IsMatch(s.token??"","^[a-f0-9]{64}$"))throw new Exception("Arquivo de associação inválido.");}
}
public class ConnectionFailure : Exception {public int Status;public ConnectionFailure(string message,int status):base(message){Status=status;}}
// 2.0.57: o servidor respondeu, mas este PC nao conseguiu aplicar as restricoes do Windows (ex.: acesso negado ao Registro).
// Antes a tela dizia "Sem conexao com o servidor"; agora diz o que aconteceu e onde esta o reparo.
public class PolicyFailure : Exception {public PolicyFailure(string detail,Exception inner):base(Text(detail),inner){}
 public static string Text(string detail){return "Este PC não conseguiu aplicar as restrições do Windows ("+(detail??"").TrimEnd('.',' ')+"). Na recepção: entre como administrador e use menu Iniciar > GameZoney Cliente > Reparar restrições do Windows.";}}
// 2.0.55: diagnostico da conexao com o servidor. O motivo real aparece na tela do PC e no connection.log (antes a tela
// mostrava so "Sem conexao com o servidor"). Se o servidor mudou de endereco (IP novo depois de reiniciar/atualizar), o cliente
// procura na rede (3444/UDP) e so aceita o servidor com a MESMA impressao digital ja associada a este PC.
public static class ConnectionDoctor {
 public static string Host(string server){Uri u;return Uri.TryCreate(server??"",UriKind.Absolute,out u)?u.Host+":"+u.Port:(server??"");}
 static bool Has(string text,params string[] words){text=text??"";foreach(var w in words)if(text.IndexOf(w,StringComparison.OrdinalIgnoreCase)>=0)return true;return false;}
 public static bool IdentityProblem(Exception e){return e!=null&&Has(e.Message,"Identidade do servidor diferente");}
 // falha de rede (servidor desligado, fora do endereco, IP mudou) ou identidade diferente no endereco: vale procurar o servidor na rede
 public static bool NetworkProblem(Exception e){if(e==null)return false;var f=e as ConnectionFailure;if(f!=null&&f.Status>0)return false;return IdentityProblem(e)||Has(e.Message,"ECONNREFUSED","ETIMEDOUT","EHOSTUNREACH","ENETUNREACH","ECONNRESET","EADDRNOTAVAIL","ENOTFOUND","Sem resposta do servidor","Tempo de conexão esgotado","socket hang up");}
 public static string Describe(Exception e,string server){
  string host=Host(server),m=e==null?"":(e.Message??"").Trim();var f=e as ConnectionFailure;int status=f!=null?f.Status:0;
  if(status==401)return "este PC não está mais autorizado no servidor. Aprove a nova associação na recepção (Computadores > solicitações).";
  if(status>=500)return "o servidor respondeu com erro ("+status+"): "+m;
  if(status>0)return m;
  if(IdentityProblem(e))return "o endereço "+host+" respondeu com outra identidade (certificado diferente). Procurando o servidor certo na rede…";
  if(Has(m,"ECONNREFUSED"))return "o PC "+host+" recusou a conexão (o GameZoney Servidor está aberto?). Procurando o servidor na rede…";
  if(Has(m,"ETIMEDOUT","EHOSTUNREACH","ENETUNREACH","EADDRNOTAVAIL","ENOTFOUND","Sem resposta do servidor","Tempo de conexão esgotado"))return "o servidor ("+host+") não respondeu. Procurando o servidor na rede…";
  if(Has(m,"ECONNRESET","socket hang up"))return "a conexão com "+host+" caiu. Tentando de novo…";
  return m.Length>0?m:"motivo desconhecido.";
 }
 // Resposta da busca na rede (transport.js "discover"): lista de (endereco, impressao digital).
 public static List<KeyValuePair<string,string>> Servers(Dictionary<string,object> r){var found=new List<KeyValuePair<string,string>>();var list=r!=null&&r.ContainsKey("servers")?r["servers"] as System.Collections.IEnumerable:null;if(list!=null)foreach(var item in list){var d=item as Dictionary<string,object>;if(d!=null&&d.ContainsKey("server")&&d.ContainsKey("fingerprint"))found.Add(new KeyValuePair<string,string>(Convert.ToString(d["server"]),Convert.ToString(d["fingerprint"])));}return found;}
 // Servidores achados na rede (endereco, impressao digital): so aceita o que tem a MESMA identidade ja associada a este PC.
 public static string PickServer(string current,string fingerprint,IList<KeyValuePair<string,string>> found,out string problem){
  problem=null;
  if(found==null||found.Count==0){problem="nenhum GameZoney Servidor respondeu na rede (3444/UDP). Confira se o servidor está aberto e na mesma rede deste PC.";return null;}
  foreach(var s in found)if(!String.IsNullOrEmpty(fingerprint)&&String.Equals(s.Value,fingerprint,StringComparison.OrdinalIgnoreCase)){
   if(String.Equals(s.Key,current,StringComparison.OrdinalIgnoreCase)){problem="o servidor responde na rede em "+Host(current)+", mas a conexão 3443/TCP falhou. Na recepção, rode \"Reparar conexão de rede\" do GameZoney Servidor.";return null;}
   return s.Key;}
  problem="o servidor encontrado na rede tem outra identidade (certificado novo). Refaça a associação: menu Iniciar > GameZoney Cliente > Reconfigurar conexão com o servidor.";return null;
 }
 public static void SelfTest(){
  const string fp="ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789";string problem;
  var lista=new List<KeyValuePair<string,string>>{new KeyValuePair<string,string>("https://192.168.0.20:3443",fp.ToLowerInvariant())};
  if(PickServer("https://192.168.0.10:3443",fp,lista,out problem)!="https://192.168.0.20:3443"||problem!=null)throw new Exception("Falha: servidor com a mesma identidade em novo IP deve ser aceito");
  if(PickServer("https://192.168.0.10:3443",fp,new List<KeyValuePair<string,string>>{new KeyValuePair<string,string>("https://192.168.0.20:3443",new string('0',64))},out problem)!=null||problem==null||problem.IndexOf("outra identidade")<0)throw new Exception("Falha: servidor com outra identidade nunca pode ser aceito");
  if(PickServer("https://192.168.0.20:3443",fp,lista,out problem)!=null||problem==null||problem.IndexOf("3443/TCP")<0)throw new Exception("Falha: mesmo endereco e identidade = problema de firewall");
  if(PickServer("https://192.168.0.10:3443",fp,new List<KeyValuePair<string,string>>(),out problem)!=null||problem==null)throw new Exception("Falha: nenhum servidor na rede");
  if(!NetworkProblem(new ConnectionFailure("connect ECONNREFUSED 192.168.0.10:3443",0))||!NetworkProblem(new ConnectionFailure("Sem resposta do servidor.",0))||!NetworkProblem(new ConnectionFailure("Identidade do servidor diferente. Solicite nova associação à recepção.",0))||NetworkProblem(new ConnectionFailure("Computador não autorizado.",401))||NetworkProblem(new ConnectionFailure("falha no componente de conexão do cliente (código 1).",0)))throw new Exception("Falha: classificacao dos erros de rede");
  if(Describe(new ConnectionFailure("x",401),"https://192.168.0.10:3443").IndexOf("não está mais autorizado")<0||Describe(new ConnectionFailure("connect ETIMEDOUT 192.168.0.10:3443",0),"https://192.168.0.10:3443").IndexOf("192.168.0.10:3443")<0)throw new Exception("Falha: motivo da falta de conexao");
 }
}
public class Transport {
 Settings settings;public Transport(Settings s){Files.Validate(s);settings=s;}
 // 2.0.55: o componente de conexao (runtime\node.exe + transport.js) nunca mais pode travar o cliente: tempo-limite proprio
 // (o processo e encerrado se nao terminar), a mensagem de erro do componente e guardada e o runtime e conferido antes.
 // Antes, um node.exe preso (ex.: antivirus) deixava a consulta parada para sempre e o PC ficava "Sem conexao" ate reiniciar.
 public static int StateTimeoutMs=12000,ActionTimeoutMs=20000,DiscoverTimeoutMs=8000;
 public virtual Dictionary<string,object> Post(string action,object body){
  string root=AppDomain.CurrentDomain.BaseDirectory,node=Path.Combine(root,"runtime","node.exe");
  if(!File.Exists(node))throw new ConnectionFailure("o componente de conexão não foi encontrado (runtime\\node.exe). Reinstale o GameZoney Cliente.",0);
  var info=new ProcessStartInfo(node,"transport.js"){WorkingDirectory=root,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8};
  int limit=action=="discover"?DiscoverTimeoutMs:action=="state"||action=="heartbeat"?StateTimeoutMs:ActionTimeoutMs;
  using(var process=new Process()){
   process.StartInfo=info;
   try{process.Start();}catch(Exception e){throw new ConnectionFailure("não foi possível abrir o componente de conexão (runtime\\node.exe): "+e.Message+". Confira o antivírus ou reinstale o cliente.",0);}
   var stdout=process.StandardOutput.ReadToEndAsync();var stderr=process.StandardError.ReadToEndAsync();
   byte[] payload=Encoding.UTF8.GetBytes(Files.Json.Serialize(new {settings=settings,action=action,body=body}));
   try{process.StandardInput.BaseStream.Write(payload,0,payload.Length);process.StandardInput.Close();}catch(IOException){/* o componente terminou antes de ler: o codigo de saida explica */}
   if(!process.WaitForExit(limit)){try{process.Kill();}catch{}throw new ConnectionFailure("o componente de conexão não respondeu em "+(limit/1000)+" s e foi encerrado (antivírus ou PC lento?).",0);}
   process.WaitForExit();
   if(!Task.WaitAll(new Task[]{stdout,stderr},5000))throw new ConnectionFailure("o componente de conexão não devolveu a resposta.",0);
   string output=stdout.Result,error=(stderr.Result??"").Trim();
   if(process.ExitCode!=0){string first=error.Length>0?error.Split('\n')[0].Trim():"";if(first.Length>160)first=first.Substring(0,160);throw new ConnectionFailure("falha no componente de conexão do cliente (código "+process.ExitCode+(first.Length>0?": "+first:"")+").",0);}
   Dictionary<string,object> envelope;
   try{envelope=Files.Json.Deserialize<Dictionary<string,object>>(output);}catch{envelope=null;}
   if(envelope==null||!envelope.ContainsKey("ok"))throw new ConnectionFailure("o componente de conexão devolveu uma resposta inválida.",0);
   if(!Convert.ToBoolean(envelope["ok"]))throw new ConnectionFailure(Convert.ToString(envelope["error"]),envelope.ContainsKey("status")?Convert.ToInt32(envelope["status"]):0);
   return (Dictionary<string,object>)envelope["data"];
  }
 }
}
public static class TaskManagerPolicy {
 const string Key="Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System";
 public static void Apply(Settings s){using(var key=Registry.CurrentUser.CreateSubKey(Key)){if(!s.policyCaptured){object value=key.GetValue("DisableTaskMgr");s.policyCaptured=true;s.policyPresent=value!=null;s.policyValue=value==null?0:Convert.ToInt32(value);Files.Save(s);}key.SetValue("DisableTaskMgr",1,RegistryValueKind.DWord);}}
 public static void Restore(Settings s){if(!s.policyCaptured)return;using(var key=Registry.CurrentUser.CreateSubKey(Key)){if(s.policyPresent)key.SetValue("DisableTaskMgr",s.policyValue,RegistryValueKind.DWord);else key.DeleteValue("DisableTaskMgr",false);}}
}
public static class ControlPanelPolicy {
 const string Key="Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer";
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr SendMessageTimeout(IntPtr h,uint m,IntPtr w,string l,uint flags,uint timeout,out IntPtr result);
 public static void NotifyPolicy(){IntPtr result;SendMessageTimeout((IntPtr)0xffff,0x1a,IntPtr.Zero,"Policy",2,1000,out result);}
 public static void CaptureAndApply(Settings s,Func<object> read,Action save,Action<int> write){if(!s.panelCaptured){object old=read();s.panelPresent=old!=null;s.panelValue=old==null?0:Convert.ToInt32(old);s.panelCaptured=true;try{save();}catch{s.panelCaptured=false;throw;}}write(1);}
 public static void RestoreValue(Settings s,Action<int> write,Action remove){if(!s.panelCaptured)return;if(s.panelPresent)write(s.panelValue);else remove();}
 public static void Apply(Settings s){using(var key=Registry.CurrentUser.CreateSubKey(Key)){CaptureAndApply(s,()=>key.GetValue("NoControlPanel"),()=>Files.Save(s),v=>key.SetValue("NoControlPanel",v,RegistryValueKind.DWord));}NotifyPolicy();}
 public static void Restore(Settings s){if(!s.panelCaptured)return;using(var key=Registry.CurrentUser.CreateSubKey(Key)){RestoreValue(s,v=>key.SetValue("NoControlPanel",v,RegistryValueKind.DWord),()=>key.DeleteValue("NoControlPanel",false));}NotifyPolicy();}
 public static void SelfTest(){foreach(object original in new object[]{null,0,1}){var s=new Settings();object value=original;int saves=0;CaptureAndApply(s,()=>value,()=>{saves++;},v=>value=v);CaptureAndApply(s,()=>value,()=>{saves++;},v=>value=v);if(saves!=1||!Object.Equals(value,1))throw new Exception("Falha na aplicação da política");RestoreValue(s,v=>value=v,()=>value=null);if(!Object.Equals(value,original))throw new Exception("Falha ao restaurar política");}var failed=new Settings();bool wrote=false;try{CaptureAndApply(failed,()=>null,()=>{throw new IOException("Teste");},v=>wrote=true);}catch(IOException){}if(failed.panelCaptured||wrote)throw new Exception("Política aplicada sem salvar recuperação");}
}
public class MachineOptions {
 public bool taskManager=true,controlPanel=true,securityOptions=true,dateTime=true;public int revision=0;
 public bool Same(MachineOptions other){return other!=null&&taskManager==other.taskManager&&controlPanel==other.controlPanel&&securityOptions==other.securityOptions&&dateTime==other.dateTime&&revision==other.revision;}
}
public class PolicyOriginal {public bool present;public int value;}
public static class MachinePolicies {
 static string[] Names={"DisableLockWorkstation","DisableChangePassword","NoLogoff"};
 static string PathFor(string name){return "Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\"+(name=="NoLogoff"?"Explorer":"System");}
 public static void CaptureSecurity(Settings s,string name,Func<object> read,Action save,Action<int> write){if(s.securityOriginals==null)s.securityOriginals=new Dictionary<string,PolicyOriginal>();if(!s.securityOriginals.ContainsKey(name)){object old=read();s.securityOriginals[name]=new PolicyOriginal{present=old!=null,value=old==null?0:Convert.ToInt32(old)};try{save();}catch{s.securityOriginals.Remove(name);throw;}}write(1);}
 public static void RestoreSecurity(Settings s,string name,Action<int> write,Action remove){if(s.securityOriginals==null||!s.securityOriginals.ContainsKey(name))return;var old=s.securityOriginals[name];if(old.present)write(old.value);else remove();}
 static void Security(Settings s,bool enable){foreach(string name in Names){if(!enable&&(s.securityOriginals==null||!s.securityOriginals.ContainsKey(name)))continue;using(var key=Registry.CurrentUser.CreateSubKey(PathFor(name))){if(enable)CaptureSecurity(s,name,()=>key.GetValue(name),()=>Files.Save(s),v=>key.SetValue(name,v,RegistryValueKind.DWord));else RestoreSecurity(s,name,v=>key.SetValue(name,v,RegistryValueKind.DWord),()=>key.DeleteValue(name,false));}}ControlPanelPolicy.NotifyPolicy();}
 public static void ApplyPlan(MachineOptions p,Action<bool> task,Action<bool> panel,Action<bool> security){var errors=new List<string>();try{task(p.taskManager);}catch(Exception e){errors.Add("Gerenciador de Tarefas: "+e.Message);}try{panel(p.controlPanel);}catch(Exception e){errors.Add("Painel de Controle: "+e.Message);}try{security(p.securityOptions);}catch(Exception e){errors.Add("Opções de segurança: "+e.Message);}if(errors.Count>0)throw new Exception(String.Join("; ",errors.ToArray()));}
 public static void Apply(Settings s){ApplyPlan(s.machinePolicy??new MachineOptions(),enabled=>{if(enabled)TaskManagerPolicy.Apply(s);else TaskManagerPolicy.Restore(s);},enabled=>{if(enabled)ControlPanelPolicy.Apply(s);else ControlPanelPolicy.Restore(s);},enabled=>Security(s,enabled));}
 public static void Restore(Settings s){Exception failure=null;foreach(Action action in new Action[]{()=>TaskManagerPolicy.Restore(s),()=>ControlPanelPolicy.Restore(s),()=>Security(s,false)})try{action();}catch(Exception e){failure=e;}if(failure!=null)throw failure;}
 public static void SelfTest(){for(int mask=0;mask<8;mask++){var options=new MachineOptions{taskManager=(mask&1)!=0,controlPanel=(mask&2)!=0,securityOptions=(mask&4)!=0};int observed=0;ApplyPlan(options,b=>{if(b)observed|=1;},b=>{if(b)observed|=2;},b=>{if(b)observed|=4;});if(mask!=observed)throw new Exception("Falha ao aplicar as opções de restrição");}foreach(string name in Names)foreach(object original in new object[]{null,0,1}){var s=new Settings();object current=original;int saves=0;CaptureSecurity(s,name,()=>current,()=>{saves++;},v=>current=v);CaptureSecurity(s,name,()=>current,()=>{saves++;},v=>current=v);s=Files.Json.Deserialize<Settings>(Files.Json.Serialize(s));RestoreSecurity(s,name,v=>current=v,()=>current=null);if(saves!=1||!Object.Equals(current,original))throw new Exception("Falha ao preservar opções do Windows");}var migrated=Files.Json.Deserialize<Settings>("{\"policyCaptured\":true,\"policyPresent\":false,\"panelCaptured\":true}");if(migrated.machinePolicy!=null||migrated.securityOriginals!=null||!migrated.policyCaptured)throw new Exception("Falha na migração do cliente");var defaults=new MachineOptions();if(!defaults.taskManager||!defaults.controlPanel||!defaults.securityOptions||!defaults.dateTime)throw new Exception("Padrão inválido");if(Files.Json.Deserialize<MachineOptions>("{\"taskManager\":true,\"revision\":3}").dateTime!=true||Files.Json.Deserialize<MachineOptions>("{\"dateTime\":false}").dateTime)throw new Exception("Falha na opção de data e hora");var off=Files.Json.Deserialize<MachineOptions>("{\"taskManager\":false,\"controlPanel\":false,\"securityOptions\":false,\"revision\":8}");if(off.taskManager||off.controlPanel||off.securityOptions||off.revision!=8||off.Same(defaults))throw new Exception("Configuração desmarcada inválida");}
}
public static class LoginKeys {
 public static bool Block(int key,bool alt,bool ctrl,bool shift){
  if(ctrl&&alt&&key==0x2e)return false; // Secure attention is handled by Windows, never claimed as intercepted.
  if(key==0x5b||key==0x5c||key==0x5d||key==27||key==0x2c||(key>=0x70&&key<=0x87))return true;
  if(key==16||key==17||key==18||(key>=0xa0&&key<=0xa5))return false;
  if(alt){return !(ctrl&&((key>=0x30&&key<=0x5a)||(key>=0xba&&key<=0xe2)));}
  if(ctrl)return !(key==65||key==67||key==86||key==88||key==90||key==89||key==8||key==0x2e||(key>=0x23&&key<=0x28));
  return false;
 }
 public static void SelfTest(){if(!Block(9,true,false,false)||!Block(0x73,true,false,false)||!Block(27,false,true,true)||!Block(0x5b,false,false,false)||Block(65,false,false,false)||Block(9,false,false,false)||Block(13,false,false,false)||Block(86,false,true,false)||Block(81,true,true,false)||Block(0x2e,true,true,false))throw new Exception("Falha nos atalhos da tela de login");}
}
public class SummaryWindow {
 string sessionId;double until;
 public void Update(string id,double finishedAt,double serverNow,long localNow){double candidate=localNow+Math.Max(0,Math.Min(30000,30000-(serverNow-finishedAt)));if(id!=sessionId){sessionId=id;until=candidate;}else until=Math.Min(until,candidate);}
 public bool Visible(long now){return sessionId!=null&&now<until;}
 public static void SelfTest(){var w=new SummaryWindow();w.Update("one",1000,1000,0);if(!w.Visible(29999)||w.Visible(30000))throw new Exception("Resumo deve durar 30 segundos");w.Update("one",1000,31000,30000);if(w.Visible(30000))throw new Exception("Consulta repetida reabriu resumo");w.Update("one",1000,1000,40000);if(w.Visible(40000))throw new Exception("Relogio alterado estendeu resumo");w.Update("old",1000,61000,50000);if(w.Visible(50000))throw new Exception("Sessao antiga apareceu");w.Update("new",70000,75000,60000);if(!w.Visible(84999)||w.Visible(85000))throw new Exception("Resumo ignorou tempo decorrido no servidor");}
}
public static class FullscreenDetector {
 [StructLayout(LayoutKind.Sequential)]struct WinRect {public int left,top,right,bottom;}
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr hWnd,out WinRect rect);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr hWnd);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr hWnd,out uint processId);
 [DllImport("user32.dll",EntryPoint="GetWindowLongW")]static extern int GetWindowLong(IntPtr hWnd,int index);
 [DllImport("user32.dll")]static extern IntPtr GetShellWindow();
 [DllImport("user32.dll")]static extern IntPtr GetDesktopWindow();
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr hWnd);
 [DllImport("user32.dll")]static extern bool IsZoomed(IntPtr hWnd);
 [StructLayout(LayoutKind.Sequential)]struct WinPoint {public int x,y;}
 [DllImport("user32.dll")]static extern bool GetClientRect(IntPtr hWnd,out WinRect rect);
 [DllImport("user32.dll")]static extern bool ClientToScreen(IntPtr hWnd,ref WinPoint point);
 [DllImport("shell32.dll")]static extern int SHQueryUserNotificationState(out int state);
 // 2 = QUNS_BUSY (aplicativo em tela cheia), 3 = QUNS_RUNNING_D3D_FULL_SCREEN (jogo DirectX exclusivo), 4 = apresentacao.
 public static volatile bool ShellHint; // ABN_FULLSCREENAPP recebido pela barra (aviso do proprio Windows)
 // 2.0.26: somente o estado 3 (jogo DirectX em tela cheia EXCLUSIVA) conta sozinho. Os avisos genericos (2/4 e ABN_FULLSCREENAPP)
 // continuavam ativos com outras janelas em primeiro plano e escondiam a barra sem jogo em tela cheia.
 public static bool WindowsReportsFullscreen(){try{int q;return SHQueryUserNotificationState(out q)==0&&q==3;}catch{return false;}}
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr hWnd,StringBuilder name,int max);
 const int GWL_STYLE=-16,WS_CAPTION=0x00C00000;
 // 2.0.21: a area de trabalho (Progman/WorkerW) ocupa a tela inteira e nao tem barra de titulo.
 // Antes ela era tratada como "aplicativo em tela cheia": ao clicar no desktop a barra liberava a
 // reserva do AppBar, os icones eram reorganizados e a tela parecia estar "atualizando".
 static readonly HashSet<string> ShellClasses=new HashSet<string>(StringComparer.OrdinalIgnoreCase){"Progman","WorkerW","Shell_TrayWnd","Shell_SecondaryTrayWnd","Windows.UI.Core.CoreWindow","MultitaskingViewFrame","XamlExplorerHostIslandWindow","TaskSwitcherWnd","ForegroundStaging","NotifyIconOverflowWindow","TopLevelWindowForOverflowXamlIsland","#32769"};
 static readonly HashSet<string> ShellProcesses=new HashSet<string>(StringComparer.OrdinalIgnoreCase){"explorer","ShellExperienceHost","StartMenuExperienceHost","SearchHost","SearchApp","SearchUI","LockApp","TextInputHost","ShellHost"};
 public static bool IsShellClass(string className){return !String.IsNullOrEmpty(className)&&ShellClasses.Contains(className);}
 // 2.0.51: aba recolhida NA BARRA DE TAREFAS do Windows, a esquerda dos icones da bandeja (relogio/wi-fi/som).
 // So quando a barra de tarefas esta embaixo, na largura da tela e visivel (ocultar automaticamente ou barra de lado = aba no topo, como na 2.0.50).
 [DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="FindWindowW")]static extern IntPtr FindWindowNamed(string cls,string title);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="FindWindowExW")]static extern IntPtr FindChildWindow(IntPtr parent,IntPtr after,string cls,string title);
 public static Rectangle? TaskbarSlot(Rectangle screen,int width){try{IntPtr bar=FindWindowNamed("Shell_TrayWnd",null);WinRect r;if(bar==IntPtr.Zero||!IsWindowVisible(bar)||!GetWindowRect(bar,out r))return null;IntPtr tray=FindChildWindow(bar,IntPtr.Zero,"TrayNotifyWnd",null);WinRect t=new WinRect();bool hasTray=tray!=IntPtr.Zero&&IsWindowVisible(tray)&&GetWindowRect(tray,out t);return TabSlot(screen,Rectangle.FromLTRB(r.left,r.top,r.right,r.bottom),hasTray?Rectangle.FromLTRB(t.left,t.top,t.right,t.bottom):Rectangle.Empty,width);}catch{return null;}}
 public static Rectangle? TabSlot(Rectangle screen,Rectangle taskbar,Rectangle tray,int width){
  if(taskbar.Width<screen.Width*9/10||taskbar.Height<24||taskbar.Height>120)return null;
  if(Math.Abs(taskbar.Bottom-screen.Bottom)>4||taskbar.Top>screen.Bottom-20)return null;
  int right=tray.Width>0&&tray.Left>taskbar.Left+width+40&&tray.Left<=taskbar.Right?tray.Left-8:taskbar.Right-340;
  int h=Math.Max(24,Math.Min(36,taskbar.Height-8));
  return new Rectangle(right-width,taskbar.Top+(taskbar.Height-h)/2,width,h);}
 static string ClassOf(IntPtr h){var b=new StringBuilder(256);return GetClassName(h,b,b.Capacity)>0?b.ToString():"";}
 static uint cachedPid;static string cachedName="";
 static string ProcessNameOf(uint pid){if(pid==cachedPid)return cachedName;string name="";try{using(var p=Process.GetProcessById((int)pid))name=p.ProcessName??"";}catch{}cachedPid=pid;cachedName=name;return name;}
 static bool Near(Rectangle a,Rectangle b,int t=4){return Math.Abs(a.Left-b.Left)<=t&&Math.Abs(a.Top-b.Top)<=t&&Math.Abs(a.Right-b.Right)<=t&&Math.Abs(a.Bottom-b.Bottom)<=t;}
 // 2.0.26: tela cheia = janela cobrindo o monitor inteiro (tela cheia exclusiva ou "janela sem bordas/tela cheia em janela").
 // Janela MAXIMIZADA comum (Steam, Discord, navegador, launcher) ocupa so a area de trabalho e NAO esconde a barra.
 // Janela sem bordas e nao maximizada que cobre quase toda a tela (jogo empurrado pela faixa da barra) continua contando.
 public static bool IsFullscreenGeometry(Rectangle window,Rectangle bounds,Rectangle working,bool hasCaption,bool zoomed){if(window.Width<=0||window.Height<=0)return false;if(Near(window,bounds)||(window.Contains(bounds)&&!hasCaption))return true;if(zoomed||hasCaption)return false;double coverage=(window.Width*(double)window.Height)/(bounds.Width*(double)bounds.Height);bool horizontal=Math.Abs(window.Left-bounds.Left)<=4&&Math.Abs(window.Right-bounds.Right)<=4;bool vertical=Math.Abs(window.Top-bounds.Top)<=4||Math.Abs(window.Bottom-bounds.Bottom)<=4;return coverage>=.90&&horizontal&&vertical;}
 // 2.0.38: jogos em "tela cheia em janela" (ex.: CS2) que mantem estilo de janela ou ficam maiores que o monitor
 // nao eram reconhecidos pelo retangulo da janela. Agora tambem conta: a AREA UTIL (cliente) cobrindo o monitor inteiro,
 // ou o proprio Windows informando aplicativo em tela cheia (QUNS_BUSY) com a janela em primeiro plano cobrindo o monitor.
 // Janela MAXIMIZADA comum com barra de titulo continua NAO escondendo a barra.
 public static bool IsClientFullscreen(Rectangle client,Rectangle bounds,bool hasCaption,bool zoomed){if(client.Width<=0||client.Height<=0)return false;if(zoomed&&hasCaption)return false;return Near(client,bounds)||client.Contains(bounds);}
 public static double Coverage(Rectangle window,Rectangle bounds){var i=Rectangle.Intersect(window,bounds);if(i.Width<=0||i.Height<=0||bounds.Width<=0||bounds.Height<=0)return 0;return (i.Width*(double)i.Height)/(bounds.Width*(double)bounds.Height);}
 static int ShellState(){try{int q;return SHQueryUserNotificationState(out q)==0?q:0;}catch{return 0;}}
 static Rectangle ClientOf(IntPtr h){WinRect c;if(!GetClientRect(h,out c))return Rectangle.Empty;var p=new WinPoint{x=c.left,y=c.top};if(!ClientToScreen(h,ref p))return Rectangle.Empty;return new Rectangle(p.x,p.y,c.right-c.left,c.bottom-c.top);}
 // 2.0.39: resolucoes aceitas em "tela cheia em janela" (jogo sem bordas com resolucao menor que a do monitor),
 // com o monitor entre 60 Hz e 240 Hz. A janela precisa estar sem barra de titulo, nao maximizada e dentro do monitor.
 public static readonly int[][] WindowedModes=new int[][]{new[]{1920,1080},new[]{1600,900},new[]{1536,864},new[]{1360,768},new[]{1366,768},new[]{800,600},new[]{1024,768},new[]{1280,800},new[]{1440,900},new[]{1680,1050},new[]{1920,1200},new[]{2560,1600},new[]{1280,1024},new[]{640,800}};
 public const int MinHz=60,MaxHz=240;
 public static bool IsAllowedMode(int width,int height){foreach(var m in WindowedModes)if(Math.Abs(width-m[0])<=2&&Math.Abs(height-m[1])<=2)return true;return false;}
 public static bool HzAllowed(int hz){return hz<=1||(hz>=MinHz&&hz<=MaxHz);} // 0/1 = padrao do hardware (valor nao informado pelo driver)
 public static bool IsWindowedFullscreenMode(Rectangle window,Rectangle client,Rectangle bounds,bool hasCaption,bool zoomed,int hz){if(hasCaption||zoomed||!HzAllowed(hz))return false;Rectangle area=client.Width>0&&client.Height>0?client:window;if(area.Width<=0||area.Height<=0)return false;if(!IsAllowedMode(area.Width,area.Height)&&!IsAllowedMode(window.Width,window.Height))return false;var inside=Rectangle.Intersect(area,bounds);return inside.Width*(double)inside.Height>=area.Width*(double)area.Height*.95;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct DevMode {[MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)]public string dmDeviceName;public short dmSpecVersion,dmDriverVersion,dmSize,dmDriverExtra;public int dmFields,dmPositionX,dmPositionY,dmDisplayOrientation,dmDisplayFixedOutput;public short dmColor,dmDuplex,dmYResolution,dmTTOption,dmCollate;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)]public string dmFormName;public short dmLogPixels;public int dmBitsPerPel,dmPelsWidth,dmPelsHeight,dmDisplayFlags,dmDisplayFrequency,dmICMMethod,dmICMIntent,dmMediaType,dmDitherType,dmReserved1,dmReserved2,dmPanningWidth,dmPanningHeight;}
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern bool EnumDisplaySettings(string deviceName,int modeNum,ref DevMode devMode);
 static string hzDevice="";static int hzValue;static DateTime hzAt=DateTime.MinValue;
 public static int RefreshRate(string device){try{if(device==hzDevice&&(DateTime.UtcNow-hzAt).TotalSeconds<5)return hzValue;var mode=new DevMode();mode.dmSize=(short)Marshal.SizeOf(typeof(DevMode));int hz=EnumDisplaySettings(device,-1,ref mode)?mode.dmDisplayFrequency:0;hzDevice=device;hzValue=hz;hzAt=DateTime.UtcNow;return hz;}catch{return 0;}}
 // 2.0.40: navegadores e gerenciadores/lancadores de jogos (Steam, Epic, Riot, EA, Ubisoft, Battle.net, GOG...) SEMPRE mantem
 // a barra visivel, mesmo em tela cheia (no log do PC o Windows chegou a informar "tela cheia" com a Steam/Riot Client na frente).
 static readonly HashSet<string> KeepBarProcesses=new HashSet<string>(StringComparer.OrdinalIgnoreCase){
  "chrome","msedge","firefox","brave","opera","opera_gx","vivaldi","iexplore","chromium","yandex","waterfox","librewolf","thorium","arc","browser",
  "steam","steamwebhelper","EpicGamesLauncher","EpicWebHelper","Riot Client","RiotClientServices","RiotClientUx","RiotClientUxRender","LeagueClient","LeagueClientUx","LeagueClientUxRender",
  "Battle.net","Battle.net Launcher","EADesktop","EALauncher","EABackgroundService","EAAntiCheat.GameServiceLauncher","Origin","UbisoftConnect","upc","UplayWebCore","GalaxyClient","GOG Galaxy",
  "RockstarLauncher","XboxPcApp","XboxApp","Discord","Overwolf","Amazon Games UI","itch","Playnite.DesktopApp","Playnite.FullscreenApp","Medal","GeForceNOW","NVIDIA app","FACEIT","GamersClub","GCLauncher"};
 public static bool KeepsBar(string process){return !String.IsNullOrEmpty(process)&&KeepBarProcesses.Contains(process);}
 // 2.0.53: MESMA LOGICA DA BARRA DE TAREFAS DO WINDOWS: ela so some quando a janela em primeiro plano cobre o monitor INTEIRO
 // (F11 do navegador, video do YouTube em tela cheia, Steam Big Picture). Navegadores e lancadores da lista acima continuam com a
 // barra em janela ou maximizados (janela maximizada nao cobre a barra de tarefas), mas em tela cheia de verdade a barra some junto.
 public static bool CoversMonitorLikeTaskbar(Rectangle window,Rectangle bounds,bool hasCaption,bool zoomed){if(window.Width<=0||window.Height<=0||bounds.Width<=0||bounds.Height<=0)return false;if(zoomed&&hasCaption)return false;return Near(window,bounds)||(window.Contains(bounds)&&!hasCaption);}
 // 2.0.40: jogos que, em tela cheia exclusiva, deixam a janela com 1x1 pixel (League of Legends no log do PC).
 static readonly HashSet<string> TinyWindowGames=new HashSet<string>(StringComparer.OrdinalIgnoreCase){"League of Legends","VALORANT-Win64-Shipping","cs2","dota2"};
 public static bool IsTinyFullscreenWindow(Rectangle window,Rectangle bounds,int state,string process){if(window.Width>16||window.Height>16)return false;if(Math.Abs(window.Left-bounds.Left)>4||window.Top<bounds.Top-4||window.Top>bounds.Top+64)return false;return state==2||state==3||(!String.IsNullOrEmpty(process)&&TinyWindowGames.Contains(process));}
 // 2.0.40: area util com o tamanho exato do monitor, deslocada poucos pixels (CS2 em -8,-8 no log), janela nao maximizada.
 public static bool IsClientMonitorSized(Rectangle client,Rectangle bounds,bool zoomed){if(zoomed||client.Width<=0||client.Height<=0)return false;return Math.Abs(client.Width-bounds.Width)<=4&&Math.Abs(client.Height-bounds.Height)<=4&&Coverage(client,bounds)>=.98;}
 // 2.0.41: TOLERANCIA AUTOMATICA DE ATE 128 PIXELS. Jogo sem bordas (sem barra de titulo visivel), nao maximizado, cuja
 // area fica a no maximo 128 px de cada borda do monitor conta como tela cheia (LoL, CS2, Dota 2 e qualquer outro jogo
 // com diferenca de pixels). Janela com barra de titulo visivel (jogo em janela comum) continua com a barra.
 public const int AutoTolerance=128;
 public static bool HasVisibleFrame(Rectangle window,Rectangle client,bool hasCaption){if(!hasCaption)return false;if(client.Width<=0||client.Height<=0)return true;return client.Top-window.Top>=16;}
 public static bool WithinTolerance(Rectangle area,Rectangle bounds,int tolerance){if(area.Width<=0||area.Height<=0)return false;return Math.Abs(area.Left-bounds.Left)<=tolerance&&Math.Abs(area.Top-bounds.Top)<=tolerance&&Math.Abs(area.Right-bounds.Right)<=tolerance&&Math.Abs(area.Bottom-bounds.Bottom)<=tolerance;}
 public static bool IsAutoTolerance(Rectangle window,Rectangle client,Rectangle bounds,bool hasCaption,bool zoomed){if(zoomed||HasVisibleFrame(window,client,hasCaption))return false;Rectangle area=client.Width>16&&client.Height>16?client:window;if(area.Width<=16||area.Height<=16)return false;return WithinTolerance(area,bounds,AutoTolerance);}
 // 2.0.41: AJUSTE AUTOMATICO. Com a barra escondida, o jogo sem bordas que ficou deslocado (ex.: em Y=48 por causa da faixa
 // da barra, ou em -8,-8) e alinhado ao monitor, para a area do jogo ocupar exatamente a tela. No maximo 3 ajustes por janela.
 [DllImport("user32.dll",EntryPoint="SetWindowPos")]static extern bool MoveGameWindow(IntPtr hWnd,IntPtr after,int x,int y,int cx,int cy,uint flags);
 static IntPtr adjustWindow=IntPtr.Zero;static Rectangle adjustTarget;static readonly Dictionary<IntPtr,int> adjustCount=new Dictionary<IntPtr,int>();
 public static Rectangle AdjustTarget(Rectangle window,Rectangle client,Rectangle bounds){if(client.Width<=0||client.Height<=0)return bounds;return Rectangle.FromLTRB(bounds.Left-(client.Left-window.Left),bounds.Top-(client.Top-window.Top),bounds.Right+(window.Right-client.Right),bounds.Bottom+(window.Bottom-client.Bottom));}
 // 2.0.46: as 3 tentativas valem a cada ENTRADA no jogo (zeram quando a barra volta), com intervalo minimo de 300 ms.
 static DateTime lastAdjustAt=DateTime.MinValue;
 public static void ResetAdjust(){if(adjustCount.Count>0)adjustCount.Clear();adjustWindow=IntPtr.Zero;}
 public static void AdjustPending(){try{IntPtr h=adjustWindow;adjustWindow=IntPtr.Zero;if(h==IntPtr.Zero||h!=GetForegroundWindow())return;if((DateTime.UtcNow-lastAdjustAt).TotalMilliseconds<300)return;int n;adjustCount.TryGetValue(h,out n);if(n>=3)return;adjustCount[h]=n+1;lastAdjustAt=DateTime.UtcNow;if(adjustCount.Count>64)adjustCount.Clear();var t=adjustTarget;MoveGameWindow(h,IntPtr.Zero,t.X,t.Y,t.Width,t.Height,0x0004|0x0010|0x0200|0x4000);Files.LogFullscreen("Ajuste automatico: janela do jogo alinhada ao monitor em "+t+" (tentativa "+(n+1)+")");}catch{}}
 // 2.0.42: TELA CHEIA EXCLUSIVA = Windows informa jogo DirectX exclusivo (estado 3) ou janela 1x1 (LoL). So nesse caso a barra some.
 public static bool LastExclusive;
 // 2.0.47: janela do jogo que escondeu a barra. Quando ela fecha, a barra volta na hora (sem esperar 1 s).
 public static IntPtr LastGameWindow=IntPtr.Zero;
 [DllImport("user32.dll")]static extern bool IsWindow(IntPtr hWnd);
 public static bool GameWindowClosed(){IntPtr h=LastGameWindow;return h==IntPtr.Zero||!IsWindow(h)||!IsWindowVisible(h)||IsIconic(h);}
 // 2.0.49: TROCA DE RESOLUCAO. A lista de monitores do .NET (Screen) fica em memoria e pode ficar desatualizada quando o jogo
 // muda a resolucao da tela e o cliente da Alt+Tab. Com o tamanho antigo, janelas comuns pareciam "cobrir a tela" e a barra
 // continuava escondida. Agora o tamanho do monitor e lido direto do Windows a cada verificacao.
 public class MonitorArea {public Rectangle Bounds,WorkingArea;public string DeviceName;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct MonitorInfoEx {public int cbSize;public WinRect rcMonitor;public WinRect rcWork;public uint dwFlags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)]public string szDevice;}
 [DllImport("user32.dll")]static extern IntPtr MonitorFromWindow(IntPtr hWnd,uint flags);
 [DllImport("user32.dll")]static extern IntPtr MonitorFromPoint(WinPoint point,uint flags);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern bool GetMonitorInfo(IntPtr monitor,ref MonitorInfoEx info);
 static MonitorArea Read(IntPtr monitor){var info=new MonitorInfoEx();info.cbSize=Marshal.SizeOf(typeof(MonitorInfoEx));if(monitor==IntPtr.Zero||!GetMonitorInfo(monitor,ref info))return null;return new MonitorArea{Bounds=Rectangle.FromLTRB(info.rcMonitor.left,info.rcMonitor.top,info.rcMonitor.right,info.rcMonitor.bottom),WorkingArea=Rectangle.FromLTRB(info.rcWork.left,info.rcWork.top,info.rcWork.right,info.rcWork.bottom),DeviceName=info.szDevice};}
 public static MonitorArea MonitorOf(IntPtr h){try{var m=Read(MonitorFromWindow(h,2));if(m!=null)return m;}catch{}var sc=Screen.FromHandle(h);return new MonitorArea{Bounds=sc.Bounds,WorkingArea=sc.WorkingArea,DeviceName=sc.DeviceName};}
 public static Rectangle PrimaryBounds(){try{var m=Read(MonitorFromPoint(new WinPoint{x=0,y=0},1));if(m!=null&&m.Bounds.Width>0)return m.Bounds;}catch{}return Screen.PrimaryScreen.Bounds;}
 static string lastDiagnostic="";
 static void Diagnose(string text){if(text==lastDiagnostic)return;lastDiagnostic=text;Files.LogFullscreen(text);}
 public static bool IsForegroundFullscreen(params IntPtr[] ignored){LastExclusive=false;try{IntPtr h=GetForegroundWindow();if(h==IntPtr.Zero||!IsWindowVisible(h)||IsIconic(h))return false;string cls=ClassOf(h);if(h==GetShellWindow()||h==GetDesktopWindow()||IsShellClass(cls))return false;foreach(var x in ignored)if(x!=IntPtr.Zero&&h==x)return false;uint pid;GetWindowThreadProcessId(h,out pid);if(pid==(uint)Process.GetCurrentProcess().Id)return false;string proc=ProcessNameOf(pid);if(ShellProcesses.Contains(proc))return false;int state=ShellState();WinRect raw;if(!GetWindowRect(h,out raw))return false;Rectangle r=Rectangle.FromLTRB(raw.left,raw.top,raw.right,raw.bottom);MonitorArea screen=MonitorOf(h);bool caption=(GetWindowLong(h,GWL_STYLE)&WS_CAPTION)==WS_CAPTION;bool zoomed=IsZoomed(h);Rectangle client=ClientOf(h);/* 2.0.47: o aviso do Windows (estado 3 = exclusiva / 2 = tela cheia) pode ficar "preso" depois que o jogo fecha. Antes, so o aviso ja escondia a barra
 e ela nao voltava ao sair do jogo. Agora o aviso so vale se a janela em primeiro plano realmente cobre o monitor (ou e a janela 1x1 do LoL). */bool exclusive=state==3&&Coverage(r,screen.Bounds)>=.90,geometry=IsFullscreenGeometry(r,screen.Bounds,screen.WorkingArea,caption,zoomed),clientCovers=IsClientFullscreen(client,screen.Bounds,caption,zoomed),shellBusy=state==2&&Coverage(r,screen.Bounds)>=.90&&!zoomed&&!HasVisibleFrame(r,ClientOf(h),caption);int hz=RefreshRate(screen.DeviceName);bool windowedMode=IsWindowedFullscreenMode(r,client,screen.Bounds,caption,zoomed,hz);bool tiny=IsTinyFullscreenWindow(r,screen.Bounds,state,proc),monitorSized=IsClientMonitorSized(client,screen.Bounds,zoomed),keep=KeepsBar(proc),tolerance=IsAutoTolerance(r,client,screen.Bounds,caption,zoomed);bool keepFullscreen=keep&&CoversMonitorLikeTaskbar(r,screen.Bounds,caption,zoomed);bool result=keep?keepFullscreen:(exclusive||geometry||clientCovers||shellBusy||windowedMode||tiny||monitorSized||tolerance);LastExclusive=result&&(exclusive||tiny);if(result)LastGameWindow=h;adjustWindow=IntPtr.Zero;if(result&&!keep&&!exclusive&&!tiny&&!zoomed&&!HasVisibleFrame(r,client,caption)){Rectangle area=client.Width>16&&client.Height>16?client:r;if(!Near(area,screen.Bounds,1)&&WithinTolerance(area,screen.Bounds,AutoTolerance)){adjustWindow=h;adjustTarget=AdjustTarget(r,client,screen.Bounds);}}Diagnose(proc+" ["+cls+"] janela="+r+" cliente="+client+" monitor="+screen.Bounds+" util="+screen.WorkingArea+" titulo="+caption+" maximizada="+zoomed+" windows="+state+" hz="+hz+" resolucaoJanela="+windowedMode+" janela1x1="+tiny+" tamanhoMonitor="+monitorSized+" tolerancia128="+tolerance+(adjustWindow!=IntPtr.Zero?" ajuste="+adjustTarget:"")+" => "+(result?(keep?"NAVEGADOR/GERENCIADOR EM TELA CHEIA (barra some, igual a barra de tarefas)":LastExclusive?"TELA CHEIA EXCLUSIVA (barra some)":"JOGO SEM BORDA (barra some)"):keep?"normal (barra fica: navegador/gerenciador de jogos em janela)":"normal (barra fica)"));return result;}catch{return false;}}
 public static void SelfTest(){Rectangle b=new Rectangle(0,0,1920,1080);Rectangle w=new Rectangle(0,48,1920,1032);Rectangle maxCaption=new Rectangle(-8,40,1936,1048);if(!IsFullscreenGeometry(b,b,w,false,false)||!IsFullscreenGeometry(b,b,w,true,false)||!IsFullscreenGeometry(b,b,w,false,true)||!IsFullscreenGeometry(w,b,w,false,false)||IsFullscreenGeometry(w,b,w,false,true)||IsFullscreenGeometry(maxCaption,b,w,true,true)||IsFullscreenGeometry(new Rectangle(100,100,800,600),b,w,false,false)||IsFullscreenGeometry(w,b,w,true,false))throw new Exception("Falha na detecção de tela cheia (janela maximizada não pode esconder a barra)");if(!IsClientFullscreen(b,b,true,false)||!IsClientFullscreen(new Rectangle(-1,-1,1922,1082),b,false,true)||IsClientFullscreen(b,b,true,true)||IsClientFullscreen(new Rectangle(0,79,1920,1001),b,true,true)||IsClientFullscreen(w,b,false,false)||Coverage(b,b)<.99||Coverage(new Rectangle(100,100,800,600),b)>.5)throw new Exception("Falha na detecção de tela cheia em janela (área útil)");if(!IsWindowedFullscreenMode(new Rectangle(320,28,1280,1024),new Rectangle(320,28,1280,1024),b,false,false,144)||!IsWindowedFullscreenMode(new Rectangle(560,140,800,600),new Rectangle(560,140,800,600),b,false,false,0)||!IsWindowedFullscreenMode(new Rectangle(0,0,1366,768),Rectangle.Empty,b,false,false,60)||IsWindowedFullscreenMode(new Rectangle(320,28,1280,1024),new Rectangle(320,51,1280,1001),b,true,false,144)||IsWindowedFullscreenMode(new Rectangle(320,28,1280,1024),new Rectangle(320,28,1280,1024),b,false,false,30)||IsWindowedFullscreenMode(new Rectangle(320,28,1280,1024),new Rectangle(320,28,1280,1024),b,false,false,360)||IsWindowedFullscreenMode(new Rectangle(100,100,1000,700),new Rectangle(100,100,1000,700),b,false,false,144)||IsWindowedFullscreenMode(new Rectangle(1500,500,1280,1024),new Rectangle(1500,500,1280,1024),b,false,false,144)||IsWindowedFullscreenMode(new Rectangle(0,0,1024,768),new Rectangle(0,0,1024,768),b,false,true,144)||!IsAllowedMode(640,800)||!IsAllowedMode(2560,1600)||IsAllowedMode(1280,720))throw new Exception("Falha na detecção de resolução em tela cheia em janela");if(!CoversMonitorLikeTaskbar(new Rectangle(0,0,1920,1080),new Rectangle(0,0,1920,1080),false,false)||!CoversMonitorLikeTaskbar(new Rectangle(-1,-1,1922,1082),new Rectangle(0,0,1920,1080),false,false)||CoversMonitorLikeTaskbar(new Rectangle(-8,-8,1936,1048),new Rectangle(0,0,1920,1080),true,true)||CoversMonitorLikeTaskbar(new Rectangle(-8,-8,1936,1096),new Rectangle(0,0,1920,1080),true,true)||CoversMonitorLikeTaskbar(new Rectangle(320,180,1280,720),new Rectangle(0,0,1920,1080),false,false)||CoversMonitorLikeTaskbar(new Rectangle(0,0,1920,1040),new Rectangle(0,0,1920,1080),false,false)||!CoversMonitorLikeTaskbar(new Rectangle(1920,0,2560,1440),new Rectangle(1920,0,2560,1440),false,false))throw new Exception("Falha: navegador/gerenciador em tela cheia (F11) deve esconder a barra igual a barra de tarefas");if(!KeepsBar("steamwebhelper")||!KeepsBar("LeagueClientUx")||!KeepsBar("Riot Client")||!KeepsBar("BRAVE")||!KeepsBar("EpicGamesLauncher")||KeepsBar("League of Legends")||KeepsBar("cs2")||KeepsBar("VALORANT-Win64-Shipping")||KeepsBar("")||!IsTinyFullscreenWindow(new Rectangle(0,0,1,1),b,2,"x")||!IsTinyFullscreenWindow(new Rectangle(0,48,1,1),b,5,"League of Legends")||IsTinyFullscreenWindow(new Rectangle(0,0,1,1),b,5,"notepad")||IsTinyFullscreenWindow(new Rectangle(500,500,1,1),b,3,"League of Legends")||IsTinyFullscreenWindow(new Rectangle(0,0,300,200),b,3,"League of Legends")||!IsClientMonitorSized(new Rectangle(-8,-8,1920,1080),b,false)||IsClientMonitorSized(new Rectangle(-8,-8,1920,1080),b,true)||IsClientMonitorSized(new Rectangle(0,48,1920,992),b,false)||IsClientMonitorSized(new Rectangle(400,0,1920,1080),b,false))throw new Exception("Falha nas regras 2.0.40 (navegador/gerenciador, janela 1x1, área do tamanho do monitor)");if(!IsAutoTolerance(new Rectangle(0,48,1920,1080),new Rectangle(0,48,1920,1080),b,false,false)||!IsAutoTolerance(new Rectangle(-8,-8,1936,1096),new Rectangle(-8,-8,1920,1080),b,true,false)||!IsAutoTolerance(new Rectangle(0,0,1800,1000),new Rectangle(0,0,1800,1000),b,false,false)||IsAutoTolerance(new Rectangle(0,0,1760,990),new Rectangle(0,0,1760,990),b,false,false)||IsAutoTolerance(new Rectangle(0,48,1920,992),new Rectangle(8,79,1904,953),b,true,false)||IsAutoTolerance(new Rectangle(-8,40,1936,1008),new Rectangle(0,48,1920,992),b,true,true)||IsAutoTolerance(new Rectangle(330,130,1280,800),new Rectangle(330,130,1280,800),b,true,false)||IsAutoTolerance(new Rectangle(0,0,1,1),new Rectangle(0,0,1,1),b,false,false)||IsAutoTolerance(new Rectangle(0,0,1700,900),new Rectangle(0,0,1700,900),b,false,false)||AdjustTarget(new Rectangle(-8,-8,1936,1096),new Rectangle(-8,-8,1920,1080),b)!=new Rectangle(0,0,1936,1096)||AdjustTarget(new Rectangle(0,48,1920,1080),new Rectangle(0,48,1920,1080),b)!=b)throw new Exception("Falha na regra de tolerância de 128 pixels");if(!IsShellClass("WorkerW")||!IsShellClass("Progman")||!IsShellClass("Shell_TrayWnd")||IsShellClass("UnityWndClass")||IsShellClass(""))throw new Exception("Falha: área de trabalho tratada como tela cheia");{var tb=new Rectangle(0,1032,1920,48);if(TabSlot(b,tb,new Rectangle(1600,1032,320,48),212)!=new Rectangle(1380,1038,212,36)||TabSlot(b,tb,Rectangle.Empty,212)!=new Rectangle(1368,1038,212,36)||TabSlot(b,new Rectangle(0,1078,1920,48),Rectangle.Empty,212)!=null||TabSlot(b,new Rectangle(0,0,1920,48),Rectangle.Empty,212)!=null||TabSlot(b,new Rectangle(0,0,62,1080),Rectangle.Empty,212)!=null)throw new Exception("Falha: posicao da aba na barra de tarefas");}var d=new FullscreenDebounce();if(!d.Update(true,0)||!d.Suppressed||d.Update(true,500)||!d.Update(false,1000)||d.Suppressed||d.Update(false,1001)||!d.Update(true,1002)||!d.Suppressed)throw new Exception("Falha: a barra deve sumir e voltar na hora (Alt+Tab/fechar o jogo)");}
}
// Evita alternar a barra a cada troca rapida de janela (Alt+Tab, telas de carregamento):
// a mudanca so e aplicada quando o estado detectado se mantem estavel.
public class FullscreenDebounce {
 public bool Suppressed;long candidateSince=-1;
 // 2.0.26: entra no jogo = barra sai na hora; volta para a area de trabalho = barra reaparece fixa apos 1 s.
 // 2.0.54 (pedido do cliente): a barra VOLTA NA HORA tambem (Alt+Tab, fechar o jogo/aplicativo em tela cheia ou tela cheia em janela).
 public const int EnterMs=0,LeaveMs=0;
 public bool Update(bool detected,long now){if(detected==Suppressed){candidateSince=-1;return false;}candidateSince=-1;Suppressed=detected;return true;}
 public void Reset(){candidateSince=-1;Suppressed=false;}
}
public class SessionBar : Form {
 public Label TimeLabel,MemberLabel,MemberDetail;public Button FinishButton,ReceptionButton,ExitButton,PasswordButton;TableLayoutPanel sessionGrid;bool fullscreenSuppressed;readonly FullscreenDebounce fullscreenDebounce=new FullscreenDebounce();
 [DllImport("user32.dll")]static extern bool SetWindowPos(IntPtr hWnd,IntPtr after,int x,int y,int cx,int cy,uint flags);
 [DllImport("user32.dll",EntryPoint="GetWindowLongW")]static extern int GetWindowLongBar(IntPtr hWnd,int index);
 // 2.0.52: sem aplicativo em tela cheia a barra fica POR CIMA (inclusive Explorer, navegador e jogo em janela), como na 2.0.49.
 // Com jogo/aplicativo em tela cheia ou tela cheia em janela (sem borda) em primeiro plano (estado estavel): a barra sai da tela.
 public void UpdateFullscreen(bool detected,long now){if(fullscreenDebounce.Update(detected,now))SetFullscreenSuppressed(fullscreenDebounce.Suppressed);if(!fullscreenSuppressed)EnsureTopMost();}
 // 2.0.23: a propriedade Form.TopMost chama SetWindowPos SEM SWP_NOACTIVATE e sem verificar se mudou.
 // Ela era chamada a cada 500 ms com o jogo em tela cheia: a barra ativava a si mesma, roubava o foco
 // e o jogo em tela cheia exclusiva (ex.: League of Legends) minimizava, mostrando a area de trabalho.
 // Agora a ordem das janelas e alterada somente por SetWindowPos com SWP_NOACTIVATE e apenas quando muda.
 public bool Suppressed {get{return fullscreenSuppressed;}}
 const uint SWP_NOSIZE=0x0001,SWP_NOMOVE=0x0002,SWP_NOACTIVATE=0x0010,SWP_NOOWNERZORDER=0x0200;
 // 2.0.52: VOLTA a regra da 2.0.49 (a 2.0.50/2.0.51 deixava a barra ATRAS dos aplicativos e trocava a camada conforme a janela
 // em primeiro plano: a barra sumia atras do Explorer e a tela piscava ao clicar nos campos). Agora: barra visivel = sempre por cima;
 // em tela cheia/tela cheia em janela = fora da tela e no fundo. A camada so muda quando precisa (SWP_NOACTIVATE, sem roubar o foco).
 public delegate bool ZOrderCall(IntPtr after);
 public ZOrderCall ZCall;
 static readonly Stopwatch layerClock=Stopwatch.StartNew();
 public Func<long> Clock=()=>layerClock.ElapsedMilliseconds;
 static readonly IntPtr HWND_BOTTOM=new IntPtr(1),HWND_TOPMOST=new IntPtr(-1);
 bool Z(IntPtr after){var z=ZCall;if(z!=null)return z(after);return IsHandleCreated&&SetWindowPos(Handle,after,0,0,0,0,SWP_NOSIZE|SWP_NOMOVE|SWP_NOACTIVATE|SWP_NOOWNERZORDER);}
 public void EnsureTopMost(){if(!IsHandleCreated||!Visible||(fullscreenSuppressed&&!Peeking))return;if((GetWindowLongBar(Handle,-20)&0x8)==0)Z(HWND_TOPMOST);}
 protected override bool ShowWithoutActivation {get{return true;}}
 public SessionBar(bool reserveSpace=true){/* 2.0.50: BARRA FLUTUANTE. Nao reserva mais a faixa do topo (sem AppBar com area reservada): nada de reajustar
  a area de trabalho/resolucao a cada Alt+Tab ou ao fechar jogos. A barra ocupa o topo inteiro, por cima das janelas (2.0.52), com uma seta para
  recolher (vira uma aba pequena com o tempo) e abrir de novo. O registro no Windows (ABM_NEW, sem ABM_SETPOS) continua apenas
  para receber o aviso de aplicativo em tela cheia. Em jogo (tela cheia/sem borda) a barra continua saindo da frente (2.0.44). */notifyEnabled=reserveSpace;Text="GameZoney • Tempo";FormBorderStyle=FormBorderStyle.None;TopMost=true;ShowInTaskbar=false;StartPosition=FormStartPosition.Manual;AutoScaleMode=AutoScaleMode.None;BackColor=GzTheme.Bg;ForeColor=Color.White;Font=new Font("Segoe UI",10);Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);
  // 2.0.30: novo visual (logo oficial, tempo em destaque, faixa de progresso, botoes chanfrados e linha vermelha na base).
  var grid=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=8,RowCount=1,Padding=new Padding(14,0,8,3),Margin=Padding.Empty,BackColor=BackColor};
  foreach(float w in new float[]{62,200,170,100,0,190,0,44})grid.ColumnStyles.Add(new ColumnStyle(grid.ColumnStyles.Count==3?SizeType.Percent:SizeType.Absolute,w));sessionGrid=grid;grid.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  var brand=new PictureBox{Image=GzTheme.Mark,SizeMode=PictureBoxSizeMode.Zoom,Dock=DockStyle.Fill,Margin=new Padding(0,6,14,6),BackColor=BackColor};
  var timeBox=new Panel{Dock=DockStyle.Fill,Margin=Padding.Empty,BackColor=BackColor};
  TimeCaption=new Label{Text="TEMPO RESTANTE",Font=GzTheme.Mono(7.5f,FontStyle.Regular),ForeColor=GzTheme.Muted,Dock=DockStyle.Top,Height=15,TextAlign=ContentAlignment.BottomLeft,Margin=Padding.Empty,Padding=new Padding(2,0,0,0)};
  TimeLabel=new Label{Text="00:00:00",Font=new Font("Consolas",17,FontStyle.Bold),TextAlign=ContentAlignment.TopLeft,Dock=DockStyle.Fill,ForeColor=Color.White,Margin=Padding.Empty};
  timeBox.Controls.Add(TimeLabel);timeBox.Controls.Add(TimeCaption);
  Progress=new GzProgress{Dock=DockStyle.Fill,Margin=new Padding(0,0,18,0),BackColor=BackColor};
  /* 2.0.34: nick em cima; maquina e medalhas de fidelidade embaixo */var memberBox=new Panel{Dock=DockStyle.Fill,Margin=new Padding(10,0,8,0),Padding=new Padding(14,0,0,0),BackColor=BackColor};memberBox.Paint+=(a,e)=>{using(var pen=new Pen(Color.FromArgb(52,54,62)))e.Graphics.DrawLine(pen,0,10,0,memberBox.Height-12);};MemberLabel=new Label{Text="",TextAlign=ContentAlignment.BottomLeft,AutoEllipsis=true,Dock=DockStyle.Top,Height=24,ForeColor=Color.White,Font=new Font("Segoe UI",10,FontStyle.Bold),Margin=Padding.Empty,BackColor=BackColor};MemberDetail=new Label{Text="",TextAlign=ContentAlignment.TopLeft,AutoEllipsis=true,Dock=DockStyle.Fill,ForeColor=GzTheme.Muted,Font=GzTheme.Mono(7.5f,FontStyle.Regular),Margin=Padding.Empty,Padding=new Padding(0,2,0,0),BackColor=BackColor};memberBox.Controls.Add(MemberDetail);memberBox.Controls.Add(MemberLabel);/* 2.0.35: premio fidelidade ao lado do nome (titulo maior, detalhe menor) */rewardBox=new Panel{Dock=DockStyle.Right,Width=0,Visible=false,Margin=Padding.Empty,Padding=new Padding(16,0,0,0),BackColor=BackColor};rewardBox.Paint+=(a,e)=>{using(var pen=new Pen(Color.FromArgb(52,54,62)))e.Graphics.DrawLine(pen,0,10,0,rewardBox.Height-12);};RewardTitle=new Label{Text="",TextAlign=ContentAlignment.BottomLeft,AutoEllipsis=true,Dock=DockStyle.Top,Height=24,ForeColor=GzTheme.Amber,Font=new Font("Segoe UI",10.5f,FontStyle.Bold),Margin=Padding.Empty,BackColor=BackColor};RewardDetail=new Label{Text="",TextAlign=ContentAlignment.TopLeft,AutoEllipsis=true,Dock=DockStyle.Fill,ForeColor=Color.FromArgb(214,216,222),Font=GzTheme.Mono(7.5f,FontStyle.Regular),Margin=Padding.Empty,Padding=new Padding(0,2,0,0),BackColor=BackColor};rewardBox.Controls.Add(RewardDetail);rewardBox.Controls.Add(RewardTitle);memberBox.Controls.Add(rewardBox);memberBox.Resize+=(a,e)=>SizeReward();
  FinishButton=MakeButton("Encerrar sessão",GzButtonKind.Danger);ReceptionButton=MakeButton("Recepção",GzButtonKind.Ghost);ReceptionButton.Visible=false;/* 2.0.33: sem manutencao local pela barra */PasswordButton=MakeButton("Alterar senha",GzButtonKind.Ghost);PasswordButton.Visible=false;/* 2.0.36 */ExitButton=MakeButton("Fechar aplicativo",GzButtonKind.Neutral);ExitButton.Visible=false;grid.Controls.Add(ExitButton,6,0);
  grid.Controls.Add(brand,0,0);grid.Controls.Add(timeBox,1,0);grid.Controls.Add(Progress,2,0);grid.Controls.Add(memberBox,3,0);grid.Controls.Add(PasswordButton,4,0);grid.Controls.Add(FinishButton,5,0);
  /* 2.0.50: seta para recolher a barra */CollapseButton=new BarChevron(true){Dock=DockStyle.Fill,Margin=new Padding(4,8,0,9)};CollapseButton.Click+=(a,e)=>Collapse();new ToolTip().SetToolTip(CollapseButton,"Esconder a barra");grid.Controls.Add(CollapseButton,7,0);
  /* 2.0.50: aba recolhida (tempo + seta para abrir) */Tab=new CollapsedTab(this){Dock=DockStyle.Fill,Visible=false};Tab.Click+=(a,e)=>Expand();new ToolTip().SetToolTip(Tab,"Mostrar a barra");
  TimeLabel.TextChanged+=(a,e)=>{if(Tab.Visible)Tab.Invalidate();};
  Controls.Add(grid);Controls.Add(Tab);mainGrid=grid;
  grid.Paint+=(a,e)=>GzTheme.AccentLine(e.Graphics,grid.Width,grid.Height-2);PositionBar();
 }
 // 2.0.34: so altera o texto quando muda (evita redesenhar a barra a cada atualizacao).
 public Label RewardTitle,RewardDetail;Panel rewardBox;DateTime rewardUntil=DateTime.MinValue;
 void SizeReward(){if(rewardBox==null||rewardBox.Parent==null)return;int width=Math.Max(0,rewardBox.Parent.Width-230);if(rewardBox.Width!=width)rewardBox.Width=width;}
 // 2.0.35: mostra a mensagem do premio fidelidade por alguns minutos (padrao 30) ao lado do nome.
 public void ShowReward(string title,string detail,int seconds){if(collapsed&&!dockedNow)Expand();RewardTitle.Text=title??"";RewardDetail.Text=detail??"";rewardUntil=DateTime.UtcNow.AddSeconds(Math.Max(10,Math.Min(14400,seconds)));SizeReward();if(!rewardBox.Visible)rewardBox.Visible=true;}
 public void TickReward(bool sessionActive){if(rewardBox==null||!rewardBox.Visible)return;if(!sessionActive||DateTime.UtcNow>=rewardUntil){rewardBox.Visible=false;RewardTitle.Text="";RewardDetail.Text="";}}
 public void SetMember(string name,string detail){name=name??"";detail=(detail??"").ToUpperInvariant();if(MemberLabel.Text!=name)MemberLabel.Text=name;if(MemberDetail.Text!=detail)MemberDetail.Text=detail;}
 public Label TimeCaption;public GzProgress Progress;int barMode=-1;double barPeak;string barSession;
 // 0 = normal, 1 = ultimos 5 minutos (vermelho, sem piscar), 2 = administrador (ambar). So altera quando muda.
 public void SetMode(bool admin,double left,string sessionId){int mode=admin?2:left<=300?1:0;if(sessionId!=barSession){barSession=sessionId;barPeak=0;/* 2.0.50: cada sessao nova comeca com a barra aberta */if(sessionId!=null&&collapsed)Expand();}if(mode==1&&barMode==0&&fullscreenSuppressed){/* 2.0.52: ultimos 5 minutos com jogo/aplicativo em tela cheia ou tela cheia em janela: a barra PEQUENA (so o tempo) aparece por 4 s no lugar da barra de tarefas. Fora da tela cheia a barra/aba ja esta visivel e fica vermelha. */StartPeek(Clock(),FiveMinutesPeekMs,"ultimos 5 minutos");}if(!admin&&left>barPeak)barPeak=left;if(Progress!=null){if(Progress.Visible==admin)Progress.Visible=!admin;if(!admin)Progress.SetValue(barPeak>0?left/barPeak:0,mode==1);}if(mode==barMode)return;barMode=mode;TimeCaption.Text=mode==2?"MODO ADMINISTRADOR":mode==1?"ÚLTIMOS 5 MINUTOS":"TEMPO RESTANTE";TimeCaption.ForeColor=mode==2?GzTheme.Amber:mode==1?GzTheme.Alert:GzTheme.Muted;TimeLabel.ForeColor=mode==1?GzTheme.Red2:Color.White;if(Tab.Visible)Tab.Invalidate();}
 // 2.0.36: botao Alterar senha ao lado de Encerrar sessao (somente cliente em sessao).
 public void SetPasswordAction(bool enabled){if(PasswordButton.Visible!=enabled)PasswordButton.Visible=enabled;float width=enabled?160:0;if(sessionGrid.ColumnStyles[4].Width!=width)sessionGrid.ColumnStyles[4].Width=width;}
 public void SetAdminActions(bool enabled){/* 2.0.28: so altera quando muda, para nao redesenhar a barra a cada 500 ms */if(ExitButton.Visible!=enabled)ExitButton.Visible=enabled;float width=enabled?180:0;if(sessionGrid.ColumnStyles[6].Width!=width)sessionGrid.ColumnStyles[6].Width=width;}
 GzButton MakeButton(string text,GzButtonKind kind){var b=new GzButton(text,kind){Dock=DockStyle.Fill,Margin=new Padding(5,7,5,8)};return b;}
 [StructLayout(LayoutKind.Sequential)]public struct DockRect {public int left,top,right,bottom;}
 [StructLayout(LayoutKind.Sequential)]public struct DockData {public uint size;public IntPtr window;public uint callback,edge;public DockRect rect;public IntPtr param;}
 public delegate UIntPtr DockCall(uint message,ref DockData data);
 [DllImport("shell32.dll")]static extern UIntPtr SHAppBarMessage(uint message,ref DockData data);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern uint RegisterWindowMessage(string text);
 public DockCall ShellCall=SHAppBarMessage;
 bool notifyEnabled,registered,positioning;uint dockMessage,restartMessage;
 // 2.0.50: barra flutuante aberta/recolhida (o estado vale ate a proxima sessao; Alt+Tab/jogos nao mudam)
 bool collapsed;TableLayoutPanel mainGrid;public BarChevron CollapseButton;public CollapsedTab Tab;
 public bool Collapsed{get{return collapsed;}}
 public const int BarHeight=48,TabWidth=212,TabHeight=30;
 public void Collapse(){if(collapsed)return;collapsed=true;ApplyLayout();Files.LogFullscreen("BARRA: recolhida pelo usuario"+(dockedNow?" (aba na barra de tarefas)":""));}
 public void Expand(){if(!collapsed)return;collapsed=false;ApplyLayout();Files.LogFullscreen("BARRA: aberta");}
 void ApplyLayout(){bool c=ShowCollapsed;if(mainGrid.Visible==c)mainGrid.Visible=!c;if(Tab.Visible!=c)Tab.Visible=c;PositionBar();ApplyShape();Tab.Invalidate();EnsureTopMost();}
 // 2.0.51: aba recolhida na barra de tarefas (TaskbarProbe devolve o lugar; nulo = aba no topo como na 2.0.50)
 public Func<Rectangle,Rectangle?> TaskbarProbe=screen=>FullscreenDetector.TaskbarSlot(screen,TabWidth);
 bool dockedNow;public bool DockedNow{get{return dockedNow;}}
 bool ShowCollapsed{get{return collapsed||Peeking;}}
 Rectangle? DockSlot(Rectangle screen){var p=TaskbarProbe;if(p==null)return null;try{return p(screen);}catch{return null;}}
 // 2.0.52: barra PEQUENA (so o tempo restante) por alguns segundos, por cima do jogo/aplicativo em tela cheia ou tela cheia em janela,
 // no lugar da barra de tarefas (sem a barra de tarefas utilizavel: no topo). O clique atravessa (nao tira o foco do jogo).
 // Ctrl+Alt+T em tela cheia: 5 s (apertar de novo esconde antes). Ultimos 5 minutos em tela cheia: 4 s. Fora da tela cheia a barra ja esta visivel.
 long peekUntil;public const long PeekMs=5000,FiveMinutesPeekMs=4000;public bool ExclusiveGame;const int HotkeyId=0x5041;bool hotkeyOk;
 public bool Peeking{get{return peekUntil>0;}}
 [DllImport("user32.dll")]static extern bool RegisterHotKey(IntPtr hWnd,int id,uint modifiers,uint vk);
 [DllImport("user32.dll")]static extern bool UnregisterHotKey(IntPtr hWnd,int id);
 public void Peek(){Peek(Clock());}
 public void Peek(long now){if(Peeking){EndPeek();Files.LogFullscreen("BARRA: Ctrl+Alt+T (barra pequena escondida)");return;}bool fullNow=fullscreenSuppressed&&FullscreenAhead();if(!fullNow){Restart();return;}StartPeek(now,PeekMs,"Ctrl+Alt+T");}
 // 2.0.54: Ctrl+Alt+T FORA de tela cheia (ou a barra escondida sem jogo na frente: travou) = pequena reinicializacao na hora:
 // desfaz a trava de tela cheia, tira o clique atravessando, mostra a barra se a sessao estiver ativa, refaz o aviso do Windows,
 // recoloca no lugar (topo ou barra de tarefas, aberta/recolhida como estava) e por cima. Em tela cheia de verdade: barra pequena por 5 s.
 public Func<bool> FullscreenNow;public Action ResetRequested;
 bool FullscreenAhead(){var f=FullscreenNow;if(f==null)return true;try{return f();}catch{return true;}}
 public void Restart(){var r=ResetRequested;if(r!=null){try{r();return;}catch(Exception e){Files.LogFullscreen("BARRA: falha ao reiniciar pelo cliente: "+e.Message);}}ResetBar();}
 public void ResetBar(){bool was=fullscreenSuppressed;peekUntil=0;fullscreenDebounce.Reset();fullscreenSuppressed=false;if(IsHandleCreated){int ex=GetWindowLongBar(Handle,-20);if((ex&0x20)!=0)SetWindowLongBar(Handle,-20,ex&~0x20);}clickThrough=false;RemoveDock();ApplyLayout();Z(HWND_TOPMOST);if(IsHandleCreated){Invalidate(true);Update();}Files.LogFullscreen("BARRA: Ctrl+Alt+T - barra reiniciada"+(was?" (estava escondida sem jogo em tela cheia na frente)":""));}
 void StartPeek(long now,long duration,string reason){peekUntil=Math.Max(1,now+duration);if(fullscreenSuppressed)SetClickThrough(true);ApplyLayout();Z(HWND_TOPMOST);Files.LogFullscreen("BARRA: barra pequena por "+(duration/1000)+" s ("+reason+")");}
 public void TickPeek(long now){if(Peeking&&now>=peekUntil)EndPeek();}
 void EndPeek(){if(!Peeking)return;peekUntil=0;ApplyLayout();if(fullscreenSuppressed)Z(HWND_BOTTOM);}
 // 2.0.52: aberta = o topo INTEIRO da tela (pedido do cliente, como antes da 2.0.50), sem reservar a faixa (nada de reajustar a resolucao).
 // Recolhida: aba pequena na barra de tarefas (ou no centro do topo se nao houver barra de tarefas utilizavel).
 public Rectangle TargetBounds(Rectangle screen){if(ShowCollapsed){var slot=DockSlot(screen);if(slot!=null)return slot.Value;int w=Math.Min(screen.Width,TabWidth);return new Rectangle(screen.Left+(screen.Width-w)/2,screen.Top,w,TabHeight);}return new Rectangle(screen.Left,screen.Top,screen.Width,BarHeight);}
 protected override void OnSizeChanged(EventArgs e){base.OnSizeChanged(e);ApplyShape();}
 void ApplyShape(){if(Width<=0||Height<=0)return;int r=ShowCollapsed?12:14;var path=new System.Drawing.Drawing2D.GraphicsPath();if(ShowCollapsed&&dockedNow){/* 2.0.51: na barra de tarefas a aba e arredondada nos quatro cantos */r=8;path.AddArc(0,0,2*r,2*r,180,90);path.AddArc(Width-2*r,0,2*r,2*r,270,90);path.AddArc(Width-2*r,Height-2*r,2*r,2*r,0,90);path.AddArc(0,Height-2*r,2*r,2*r,90,90);path.CloseFigure();var prev=Region;Region=new Region(path);if(prev!=null)prev.Dispose();path.Dispose();return;}path.AddLine(0,0,Width,0);path.AddLine(Width,0,Width,Height-r);path.AddArc(Width-2*r,Height-2*r,2*r,2*r,0,90);path.AddLine(Width-r,Height,r,Height);path.AddArc(0,Height-2*r,2*r,2*r,90,90);path.CloseFigure();var old=Region;Region=new Region(path);if(old!=null)old.Dispose();path.Dispose();}
 DockData Data(){return new DockData{size=(uint)Marshal.SizeOf(typeof(DockData)),window=Handle,callback=dockMessage,edge=1};}
 protected override void OnHandleCreated(EventArgs e){base.OnHandleCreated(e);dockMessage=RegisterWindowMessage("GameZoney.SessionBar.Position");restartMessage=RegisterWindowMessage("TaskbarCreated");if(notifyEnabled){hotkeyOk=RegisterHotKey(Handle,HotkeyId,0x0001|0x0002|0x4000,0x54);Files.LogFullscreen(hotkeyOk?"BARRA: atalho Ctrl+Alt+T ativo":"BARRA: atalho Ctrl+Alt+T indisponivel (em uso por outro programa)");}if(topTimer==null){topTimer=new System.Windows.Forms.Timer{Interval=250};topTimer.Tick+=(a,b)=>ReclaimTop();topTimer.Start();}}
 protected override void OnVisibleChanged(EventArgs e){base.OnVisibleChanged(e);if(Visible)PositionBar();else RemoveDock();}
 void RemoveDock(){if(!registered)return;registered=false;var data=Data();ShellCall(1,ref data);}
 protected override void OnHandleDestroyed(EventArgs e){RemoveDock();if(hotkeyOk){UnregisterHotKey(Handle,HotkeyId);hotkeyOk=false;}if(topTimer!=null){topTimer.Stop();topTimer.Dispose();topTimer=null;}base.OnHandleDestroyed(e);}
 // 2.0.42 (modelo NexCafe):
 // 1) SEMPRE NO TOPO (2.0.49, de volta na 2.0.52): a cada 250 ms a barra reafirma HWND_TOPMOST (sem ativar/roubar o foco).
 // 2) JOGO SEM BORDA (tela cheia em janela): a barra fica por cima e o CLIQUE ATRAVESSA a barra (WS_EX_LAYERED+WS_EX_TRANSPARENT),
 //    evitando o "bug de foco" (clicar perto do topo e o jogo minimizar).
 // 3) TELA CHEIA EXCLUSIVA: a barra se oculta (nao briga pelo topo) e volta ao dar Alt+Tab.
 // 4) No desktop/navegador/jogo em janela: barra normal, botoes clicaveis.
 [DllImport("user32.dll",EntryPoint="SetWindowLongW")]static extern int SetWindowLongBar(IntPtr hWnd,int index,int value);
 [DllImport("user32.dll")]static extern bool SetLayeredWindowAttributes(IntPtr hWnd,uint key,byte alpha,uint flags);
 System.Windows.Forms.Timer topTimer;bool clickThrough;
 protected override CreateParams CreateParams{get{var cp=base.CreateParams;cp.ExStyle|=0x08000000|0x00000080;return cp;}}
 public bool ClickThrough{get{return clickThrough;}}
 public void SetClickThrough(bool value){if(clickThrough==value||!IsHandleCreated)return;int ex=GetWindowLongBar(Handle,-20);if(value){SetWindowLongBar(Handle,-20,ex|0x00080000|0x00000020);SetLayeredWindowAttributes(Handle,0,255,2);}else SetWindowLongBar(Handle,-20,ex&~0x00000020);clickThrough=value;}
 // 2.0.47: enquanto a barra esta escondida, a cada 250 ms o cliente reconfere se ainda ha jogo na frente (independente do
 // relogio principal, que pode ficar parado com um aviso aberto). Assim a barra sempre volta ao sair do jogo (Alt+F4/Alt+Tab).
 public Action Recheck;
 void ReclaimTop(){if(!IsHandleCreated||!Visible)return;TickPeek(Clock());if(Peeking){var pb=FullscreenDetector.PrimaryBounds();if(!positioning&&Bounds!=TargetBounds(pb))PositionBar();Z(HWND_TOPMOST);return;}if(fullscreenSuppressed){var r=Recheck;if(r!=null){try{r();}catch{}}return;}/* 2.0.49/2.0.50: barra fora do lugar (outra resolucao, empurrada) -> volta para a posicao flutuante no topo */{var sb=FullscreenDetector.PrimaryBounds();var expected=TargetBounds(sb);if(!positioning&&Bounds!=expected){PositionBar();Files.LogFullscreen("BARRA: estava fora do lugar "+Bounds+"; recolocada em "+expected);}}Z(HWND_TOPMOST);}
 protected override void WndProc(ref Message m){
  if(m.Msg==0x0312&&m.WParam.ToInt32()==HotkeyId){Peek();return;}
  if(restartMessage!=0&&m.Msg==restartMessage){registered=false;if(Visible)BeginInvoke(new Action(PositionBar));}
  if(dockMessage!=0&&m.Msg==dockMessage){if(m.WParam.ToInt32()==2){FullscreenDetector.ShellHint=m.LParam!=IntPtr.Zero;if(!FullscreenDetector.ShellHint&&!fullscreenSuppressed)BeginInvoke(new Action(EnsureTopMost));}}
  base.WndProc(ref m);
  if(m.Msg==0x7e&&Visible){/* 2.0.50: resolucao mudou -> so reposiciona a barra flutuante (nao ha faixa reservada para refazer) */PositionBar();Files.LogFullscreen("BARRA: resolucao da tela mudou para "+FullscreenDetector.PrimaryBounds()+" (barra reposicionada)");}
 }
 public void ForceRestore(){fullscreenDebounce.Reset();SetFullscreenSuppressed(false);}
 public void SetFullscreenSuppressed(bool value){if(fullscreenSuppressed==value)return;fullscreenSuppressed=value;Files.LogFullscreen(value?"BARRA: escondida (jogo em tela cheia/sem borda)":"BARRA: voltou (saiu do jogo)");if(value){RemoveDock();if(!Peeking)Z(HWND_BOTTOM);}else Z(HWND_TOPMOST);PositionBar();}
 public void PositionBar(){if(positioning)return;var screen=FullscreenDetector.PrimaryBounds();
  if(fullscreenSuppressed&&!Peeking){if(registered)RemoveDock();if(dockedNow){dockedNow=false;ApplyShape();}var hiddenBounds=new Rectangle(screen.Left,screen.Top-400,screen.Width,BarHeight);if(Bounds!=hiddenBounds)Bounds=hiddenBounds;return;}
  positioning=true;try{
   /* 2.0.50: registro so para avisos (ABM_NEW); nenhuma faixa reservada (sem ABM_QUERYPOS/ABM_SETPOS) */if(notifyEnabled&&Visible&&!registered&&!fullscreenSuppressed&&IsHandleCreated){var data=Data();registered=ShellCall(0,ref data)!=UIntPtr.Zero;}
   bool docked=ShowCollapsed&&DockSlot(screen)!=null;var target=TargetBounds(screen);if(Bounds!=target)Bounds=target;if(docked!=dockedNow){dockedNow=docked;ApplyShape();Tab.Invalidate();}
  }finally{positioning=false;}
 }

}
public class LoyaltyToast : Form {
 System.Windows.Forms.Timer closeTimer;
 protected override bool ShowWithoutActivation { get { return true; } }
 protected override CreateParams CreateParams { get { var cp=base.CreateParams; cp.ExStyle|=0x08000000|0x00000080; return cp; } }
 public LoyaltyToast(string message){
  Text="Programa fidelidade";FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;StartPosition=FormStartPosition.Manual;Width=620;Height=145;BackColor=Color.FromArgb(22,23,29);ForeColor=Color.White;Opacity=.96;
  var border=new Panel{Dock=DockStyle.Fill,Padding=new Padding(3),BackColor=GzTheme.Red};
  var body=new Panel{Dock=DockStyle.Fill,BackColor=Color.FromArgb(22,23,29)};
  var label=new Label{Dock=DockStyle.Fill,Text=message,TextAlign=ContentAlignment.MiddleCenter,ForeColor=Color.White,BackColor=Color.Transparent,Font=new Font("Segoe UI",18,FontStyle.Bold)};
  body.Controls.Add(label);border.Controls.Add(body);Controls.Add(border);
  closeTimer=new System.Windows.Forms.Timer{Interval=5000};closeTimer.Tick+=(a,e)=>{closeTimer.Stop();Close();};
 }
 protected override void OnShown(EventArgs e){base.OnShown(e);var area=Screen.PrimaryScreen.WorkingArea;Left=area.Left+Math.Max(0,(area.Width-Width)/2);Top=area.Top+Math.Max(20,Math.Min(90,area.Height-Height));closeTimer.Start();}
 protected override void OnFormClosed(FormClosedEventArgs e){if(closeTimer!=null){closeTimer.Stop();closeTimer.Dispose();closeTimer=null;}base.OnFormClosed(e);}
}
public class TimeBudget {
 public double seconds;public long received;public long contact=-1;public string sessionId;
 // 2.0.22: o relogio local (monotonico) e a referencia da contagem. Antes, a cada consulta (2 s) o tempo era
 // substituido pelo valor do servidor arredondado para cima (Math.ceil) e ja atrasado pela viagem da resposta:
 // o display voltava ~1 s e depois "pulava" um segundo. Agora diferencas pequenas sao corrigidas suavemente
 // (no maximo 0,1 s por consulta) e so mudancas reais (tempo adicionado, ajuste da recepcao) sao aplicadas na hora.
 public const double HardSyncSeconds=3.0,SlewSeconds=0.1;
 public void Update(string id,double value,long now){value=Math.Max(0,value);contact=now;if(id==null||id!=sessionId){sessionId=id;seconds=value;received=now;return;}double local=Left(now),diff=value-local;if(Math.Abs(diff)>HardSyncSeconds||local<=0){seconds=value;received=now;return;}seconds=local+Math.Max(-SlewSeconds,Math.Min(SlewSeconds,diff));received=now;}
 public void Restore(string id,double value,long now){sessionId=id;seconds=Math.Max(0,value);received=now;}
 public void Offline(){contact=-1;}
 public double Left(long now){return Math.Max(0,seconds-(now-received)/1000.0);}
 public bool Online(long now){return contact>=0&&now-contact<9000;}
}
public class WallpaperText : Label {
 public WallpaperText(){SetStyle(ControlStyles.SupportsTransparentBackColor|ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint,true);/* 2.0.56: fundo e texto no mesmo buffer (sem piscar) */BackColor=Color.Transparent;ForeColor=Color.White;AutoSize=false;}
 protected override void OnPaint(PaintEventArgs e){e.Graphics.SmoothingMode=System.Drawing.Drawing2D.SmoothingMode.AntiAlias;using(var path=new System.Drawing.Drawing2D.GraphicsPath())using(var format=new StringFormat{Alignment=StringAlignment.Center,LineAlignment=StringAlignment.Center}){float size=Font.SizeInPoints*e.Graphics.DpiY/72f;path.AddString(Text,Font.FontFamily,(int)Font.Style,size,new RectangleF(3,3,Math.Max(1,Width-6),Math.Max(1,Height-6)),format);using(var pen=new Pen(Color.FromArgb(230,0,0,0),1.6f)){pen.LineJoin=System.Drawing.Drawing2D.LineJoin.Round;e.Graphics.DrawPath(pen,path);}using(var brush=new SolidBrush(ForeColor))e.Graphics.FillPath(brush,path);}}
}
// 2.0.56: TELA DE LOGIN SEM PISCAR. A janela de login ocupa a tela inteira com o fundo esticado (Zoom) e era pintada direto na
// tela: cada redesenho (Tab entre o nick e a senha, clique nos campos, volta para a tela de login) apagava a tela com a cor de fundo
// e so depois desenhava a imagem -> a tela piscava. Agora a janela e os controles da tela de login desenham antes em memoria (buffer
// duplo) e a troca das marcas de foco do teclado (o Tab) nao manda mais redesenhar a janela inteira. Visual e comportamento iguais.
public static class LoginPaint {
 public const int WM_CHANGEUISTATE=0x0127;
 static readonly PropertyInfo Buffered=typeof(Control).GetProperty("DoubleBuffered",BindingFlags.Instance|BindingFlags.NonPublic);
 static readonly MethodInfo StyleOf=typeof(Control).GetMethod("GetStyle",BindingFlags.Instance|BindingFlags.NonPublic);
 // Os campos de texto do Windows (TextBox) ficam como estao; todos os outros controles da tela de login usam buffer duplo.
 public static void Apply(Control root){foreach(Control c in root.Controls){if(!(c is TextBoxBase))Buffered.SetValue(c,true,null);Apply(c);}}
 public static bool IgnoresUiState(int msg){return msg==WM_CHANGEUISTATE;}
 public static bool HasStyle(Control c,ControlStyles style){return (bool)StyleOf.Invoke(c,new object[]{style});}
 public static bool Smooth(Control c){return HasStyle(c,ControlStyles.OptimizedDoubleBuffer)&&HasStyle(c,ControlStyles.AllPaintingInWmPaint);}
 public static void SelfTest(){
  using(var root=new Panel()){var grid=new TableLayoutPanel();var label=new Label();var box=new TextBox();var text=new WallpaperText();grid.Controls.Add(label);grid.Controls.Add(box);root.Controls.Add(grid);root.Controls.Add(text);Apply(root);
   if(!Smooth(grid)||!Smooth(label)||!Smooth(text))throw new Exception("Falha: tela de login sem buffer duplo (piscaria)");
   if(HasStyle(box,ControlStyles.OptimizedDoubleBuffer))throw new Exception("Falha: campo de texto do Windows nao deve usar buffer duplo");}
  if(!IgnoresUiState(0x0127)||IgnoresUiState(0x0128)||IgnoresUiState(0x000F)||IgnoresUiState(0x0100))throw new Exception("Falha: marcas de foco do Tab");
 }
}
public class LoginCard : FlowLayoutPanel {
 protected override void OnSizeChanged(EventArgs e){base.OnSizeChanged(e);if(Width<48||Height<48)return;using(var path=new System.Drawing.Drawing2D.GraphicsPath()){int d=36;path.AddArc(0,0,d,d,180,90);path.AddArc(Width-d-1,0,d,d,270,90);path.AddArc(Width-d-1,Height-d-1,d,d,0,90);path.AddArc(0,Height-d-1,d,d,90,90);path.CloseFigure();var old=Region;Region=new Region(path);if(old!=null)old.Dispose();}}
}
public class ClientForm : Form {
 static Color Bg=GzTheme.Bg,Red=GzTheme.Red;
 Action<Settings> saveSettings=Files.Save;
 Action closeWarning;bool showingCloseWarning;
 Action<Settings> applyPolicies=MachinePolicies.Apply,restorePolicies=MachinePolicies.Restore;
 Settings settings;Transport transport;SummaryWindow summaryWindow=new SummaryWindow();TimeBudget budget=new TimeBudget();Stopwatch monotonic=Stopwatch.StartNew();bool authorized;string setupMessage="";bool busy,loginBusy,maintenance=false,maintenanceDialogOpen,registeringPassword,adminSession,offlineAdminSession,allowedExit,locked=true,closing,maintenancePreserveApps;
 Label status,title,summary,wakeHint;TextBox username,password;CheckBox adminLogin;Button login;Panel content;TableLayoutPanel loginGrid;Form timerWindow;Label timerLabel;List<Form> covers=new List<Form>();System.Windows.Forms.Timer poll,clock,secondsTick;
 SessionCleanup sessionCleanup;Task cleanupTask;bool cleanupBlocked;string cleanupError="";
 readonly RemoteControl remoteControl=new RemoteControl();
 Func<int,string,string> remoteClose;Action<string> remotePower=RemoteControl.Power;bool remoteLocked,remoteWatch;DateTime watchVisibleAt;
 readonly string clientRunId=Guid.NewGuid().ToString("N");int appliedRevision;string policyError="";bool policiesApplied;Dictionary<string,object> last;bool connectionFaulted;int maintenanceFailures;long maintenanceRetry;bool localSessionTrusted;string localMemberName="";long lastShadowSave;bool crashRecoveryPending;string crashRecoverySessionId="";double crashRecoveryRemaining;readonly HashSet<string> loyaltySeen=new HashSet<string>();readonly HashSet<string> loyaltyAcked=new HashSet<string>();readonly Queue<string> loyaltyQueue=new Queue<string>();bool loyaltyShowing;Form loyaltyToast;ChangePasswordForm passwordDialog;long knownAllocated=-1;bool cashClosed;const string CashClosedText="Caixa fechado. Aguarde a recepção abrir o caixa para entrar.";
 // 2.0.21: batimento independente da interface. Se a consulta normal (a cada 2 s) atrasar por qualquer
 // motivo (interface ocupada, limpeza, download do fundo, dialogo aberto), o servidor continua recebendo
 // sinal de vida e nao encerra a sessao por "sem conexao por 10 segundos" com o PC funcionando.
 // Atualizacao leve do relogio a cada 100 ms: o segundo muda no instante certo, sem pular nem repetir.
 void TickDisplay(){if(closing||adminSession||budget.sessionId==null||timerLabel==null)return;long now=monotonic.ElapsedMilliseconds;double left=budget.Left(now);SetTimerText(Duration(left));if(!maintenance&&!maintenanceDialogOpen)UpdateBarFullscreen((SessionBar)timerWindow,left,now);}
 // Verificado a cada 100 ms: a barra sai da frente assim que o jogo entra em tela cheia (antes de o jogo perder o foco).
 void UpdateBarFullscreen(SessionBar bar,double left,long now){/* 2.0.43: a deteccao de jogo vale tambem no MODO ADMINISTRADOR (antes so na sessao do cliente; testando como admin a barra nunca mudava) */bool game=(adminSession||(budget.sessionId!=null&&left>0))&&FullscreenDetector.IsForegroundFullscreen(Handle,bar.Handle);bool exclusive=game&&FullscreenDetector.LastExclusive;/* 2.0.44: a barra SOME nos jogos em tela cheia EXCLUSIVA e tambem em tela cheia SEM BORDA (pedido do cliente; substitui a regra 2.0.42 de barra por cima no jogo sem borda). Clique atravessando fica so como seguranca durante a troca. */bar.ExclusiveGame=exclusive;bar.UpdateFullscreen(game,now);bar.SetClickThrough(game&&(!bar.Suppressed||bar.Peeking));/* 2.0.41: alinha o jogo sem borda deslocado ao monitor (ate 128 px) */if(game&&!exclusive)FullscreenDetector.AdjustPending();else if(!game&&!bar.Suppressed)FullscreenDetector.ResetAdjust();/* 2.0.47: saiu do jogo (janela do jogo fechou/minimizou) -> barra volta na hora */if(!game&&bar.Suppressed&&FullscreenDetector.GameWindowClosed()){bar.ForceRestore();FullscreenDetector.LastGameWindow=IntPtr.Zero;FullscreenDetector.ResetAdjust();}}
 // 2.0.46: REACAO IMEDIATA. Alem da verificacao a cada 500 ms, o cliente e avisado pelo Windows quando a janela em primeiro
 // plano muda ou quando ela muda de posicao/tamanho (jogo entrando em tela cheia/sem borda). Assim a barra some e libera o topo
 // antes de o jogo se ajustar a faixa reservada, e o jogo empurrado (ate 128 px) e alinhado na hora, ficando a frente da barra.
 delegate void WinEventProc(IntPtr hook,uint eventType,IntPtr hwnd,int idObject,int idChild,uint thread,uint time);
 [DllImport("user32.dll")]static extern IntPtr SetWinEventHook(uint eventMin,uint eventMax,IntPtr module,WinEventProc proc,uint process,uint thread,uint flags);
 [DllImport("user32.dll")]static extern bool UnhookWinEvent(IntPtr hook);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr hWnd,out uint processId);
 WinEventProc foregroundProc;IntPtr foregroundHook=IntPtr.Zero,locationHook=IntPtr.Zero;long lastWatchCheck;uint watchedProcess;
 void StartForegroundWatch(){try{foregroundProc=OnWindowEvent;foregroundHook=SetWinEventHook(0x0003,0x0003,IntPtr.Zero,foregroundProc,0,0,0x0002);}catch{}}
 // Posicao/tamanho: somente da janela do programa em primeiro plano (evita receber eventos de todo o sistema).
 /* 2.0.56: diagnostico da tela de login: registra no fullscreen.log quando outro programa fica na frente dela (no maximo 1 linha por segundo) */
 long lastLoginForegroundLog=-10000;void LogLoginForeground(IntPtr hwnd){try{long now=monotonic.ElapsedMilliseconds;if(now-lastLoginForegroundLog<1000)return;uint pid;GetWindowThreadProcessId(hwnd,out pid);if(pid==0||pid==(uint)Process.GetCurrentProcess().Id)return;lastLoginForegroundLog=now;string name;try{using(var p=Process.GetProcessById((int)pid))name=p.ProcessName;}catch{name="pid "+pid;}Files.LogFullscreen("LOGIN: outro programa ficou na frente da tela de login: "+name);}catch{}}
 void WatchLocationOf(IntPtr hwnd){try{uint pid;GetWindowThreadProcessId(hwnd,out pid);if(pid==watchedProcess)return;if(locationHook!=IntPtr.Zero){UnhookWinEvent(locationHook);locationHook=IntPtr.Zero;}watchedProcess=pid;if(pid==0||pid==(uint)Process.GetCurrentProcess().Id)return;locationHook=SetWinEventHook(0x800B,0x800B,IntPtr.Zero,foregroundProc,pid,0,0x0002);}catch{}}
 void StopForegroundWatch(){try{if(foregroundHook!=IntPtr.Zero)UnhookWinEvent(foregroundHook);if(locationHook!=IntPtr.Zero)UnhookWinEvent(locationHook);}catch{}foregroundHook=IntPtr.Zero;locationHook=IntPtr.Zero;watchedProcess=0;}
 void OnWindowEvent(IntPtr hook,uint eventType,IntPtr hwnd,int idObject,int idChild,uint thread,uint time){try{if(closing||idObject!=0||hwnd==IntPtr.Zero)return;if(eventType==0x0003){WatchLocationOf(hwnd);if(locked)LogLoginForeground(hwnd);}else if(hwnd!=GetForegroundWindow())return;long now=monotonic.ElapsedMilliseconds;if(eventType==0x800B&&now-lastWatchCheck<100)return;lastWatchCheck=now;var bar=timerWindow as SessionBar;if(bar==null||!bar.IsHandleCreated)return;UpdateBarFullscreen(bar,budget.Left(now),now);}catch{}}
 void SetTimerText(string text){if(timerLabel.Text!=text)timerLabel.Text=text;}
 bool observing;long lastServerContact=-100000;string connectionProblem,lastLoggedProblem;int networkFailures;DateTime lastRediscover=DateTime.MinValue;bool rediscovering;bool localProblem;volatile bool heartbeatStop;Thread heartbeatThread;
 void StartHeartbeat(){if(heartbeatThread!=null)return;heartbeatThread=new Thread(HeartbeatLoop){IsBackground=true,Name="GameZoney.Heartbeat"};heartbeatThread.Start();}
 void HeartbeatLoop(){long lastAttempt=-100000;while(!heartbeatStop){try{Thread.Sleep(500);if(heartbeatStop||closing)break;var link=transport;string session=budget.sessionId;if(link==null||session==null||adminSession||offlineAdminSession||!String.IsNullOrEmpty(settings.setupDevice))continue;long now=monotonic.ElapsedMilliseconds;if(now-Interlocked.Read(ref lastServerContact)<2500||now-lastAttempt<2000)continue;lastAttempt=now;link.Post("heartbeat",new {clientRunId=clientRunId,clientSessionId=session});Interlocked.Exchange(ref lastServerContact,monotonic.ElapsedMilliseconds);}catch{}}}
 delegate IntPtr HookProc(int code,IntPtr wParam,IntPtr lParam);HookProc hookCallback;IntPtr hook;
 [DllImport("user32.dll",SetLastError=true)]static extern IntPtr SetWindowsHookEx(int type,HookProc callback,IntPtr module,uint thread);
 [DllImport("user32.dll")]static extern bool UnhookWindowsHookEx(IntPtr hook);
 [DllImport("user32.dll")]static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr wParam,IntPtr lParam);
 [DllImport("user32.dll")]static extern short GetAsyncKeyState(int key);
 [DllImport("kernel32.dll",CharSet=CharSet.Auto)]static extern IntPtr GetModuleHandle(string name);
 Button Button(string text,EventHandler click){var b=new Button{Text=text,Width=336,Height=44,BackColor=Red,ForeColor=Color.White,FlatStyle=FlatStyle.Flat,Margin=new Padding(0,8,0,0)};b.Click+=click;return b;}
 Label Label(string text,int size){return new Label{Text=text,ForeColor=Color.White,Font=new Font("Segoe UI",size),AutoSize=false,Width=336,Margin=new Padding(0,3,0,3),Height=size>20?48:26,TextAlign=ContentAlignment.MiddleCenter};}
 public ClientForm(Settings s,bool preview=false){closeWarning=()=>MessageBox.Show(timerWindow!=null&&timerWindow.Visible?timerWindow:this,"O GameZoney Cliente não pode ser fechado no modo usuário. Entre com um administrador do servidor (botão Entrar) para fechar o aplicativo.","Fechamento não permitido",MessageBoxButtons.OK,MessageBoxIcon.Warning);settings=s;transport=new Transport(s);Text="GameZoney • Cliente";Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);BackColor=Bg;ForeColor=Color.White;Font=new Font("Segoe UI",11);FormBorderStyle=FormBorderStyle.None;Bounds=Screen.PrimaryScreen.Bounds;TopMost=true;DoubleBuffered=true;/* 2.0.56: tela de login sem piscar (veja LoginPaint) */
  content=new Panel{Height=60,BackColor=Bg,Visible=true,TabStop=false};content.Paint+=(a,e)=>GzTheme.AccentLine(e.Graphics,content.Width,content.Height-2);Controls.Add(content);wakeHint=new WallpaperText{Text="",Font=new Font("Segoe UI",15),Height=1,Visible=false};Controls.Add(wakeHint);MouseDown+=(a,e)=>{if(locked&&!maintenance&&!maintenanceDialogOpen&&username!=null&&!username.ContainsFocus&&!password.ContainsFocus)username.Focus();};KeyPreview=true;KeyDown+=(a,e)=>{if(locked&&!maintenance&&!maintenanceDialogOpen&&username!=null&&e.KeyCode!=Keys.Tab&&!username.ContainsFocus&&!password.ContainsFocus&&!login.ContainsFocus)username.Focus();};Resize+=(a,e)=>CenterContent();
  BackgroundImageLayout=ImageLayout.Zoom;LoadWallpaper();
  title=Label(s.stationName??"GameZoney",14);status=new WallpaperText{Text="Conectando ao servidor…",Font=new Font("Segoe UI",12),Visible=false};Controls.Add(status);
  summary=new WallpaperText{Text="",Font=new Font("Segoe UI",14),Height=140};Controls.Add(summary);summary.MouseDown+=(sender,e)=>RevealLogin();
  loginGrid=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=9,RowCount=1,Padding=new Padding(14,0,14,2),Margin=Padding.Empty,BackColor=Bg};content.Controls.Add(loginGrid);
  foreach(float width in new float[]{230,125,200,70,170,100,130,0,95})loginGrid.ColumnStyles.Add(new ColumnStyle(loginGrid.ColumnStyles.Count==5?SizeType.Percent:SizeType.Absolute,width));loginGrid.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  var nickLabel=new Label{Text="USUÁRIO / NICK",Font=GzTheme.Mono(8.5f,FontStyle.Regular),Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleRight,ForeColor=GzTheme.Muted,Margin=new Padding(0,0,10,0)};var passLabel=new Label{Text="SENHA",Font=GzTheme.Mono(8.5f,FontStyle.Regular),Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleRight,ForeColor=GzTheme.Muted,Margin=new Padding(0,0,10,0)};
  username=new TextBox{MaxLength=40,TabIndex=0};password=new TextBox{MaxLength=128,UseSystemPasswordChar=true,TabIndex=1};
  /* 2.0.30: logo oficial + nome da maquina em destaque */var brandRow=new FlowLayoutPanel{Dock=DockStyle.Fill,WrapContents=false,FlowDirection=FlowDirection.LeftToRight,Margin=Padding.Empty,Padding=Padding.Empty,BackColor=Bg};var brandLogo=new PictureBox{Image=GzTheme.Mark,SizeMode=PictureBoxSizeMode.Zoom,Width=48,Height=42,Margin=new Padding(0,9,14,0),BackColor=Bg};title.AutoSize=true;title.AutoEllipsis=false;title.MaximumSize=new Size(160,0);title.Width=10;title.Height=10;title.TextAlign=ContentAlignment.MiddleCenter;title.Font=new Font("Consolas",10,FontStyle.Bold);title.ForeColor=Color.White;title.BackColor=Color.FromArgb(52,13,18);title.Padding=new Padding(9,5,9,5);title.Margin=new Padding(0,17,0,0);title.Paint+=(a,e)=>{using(var pen=new Pen(GzTheme.Red))e.Graphics.DrawRectangle(pen,0,0,title.Width-1,title.Height-1);};brandRow.Controls.Add(brandLogo);brandRow.Controls.Add(title);loginGrid.Controls.Add(brandRow,0,0);loginGrid.Controls.Add(nickLabel,1,0);loginGrid.Controls.Add(BarInput(username),2,0);loginGrid.Controls.Add(passLabel,3,0);loginGrid.Controls.Add(BarInput(password),4,0);
  adminLogin=new CheckBox();login=new GzButton("Entrar  →",GzButtonKind.Primary);login.Click+=async(sender,e)=>await Login();login.Dock=DockStyle.Fill;login.Margin=new Padding(10,12,6,12);login.TabIndex=2;loginGrid.Controls.Add(login,6,0);login.Enabled=false;AcceptButton=login;
  /* 2.0.33: sem botao Manutencao. O botao Entrar serve para cliente e para administrador cadastrado no servidor. */clockLabel=new Label{Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleRight,Font=new Font("Consolas",10,FontStyle.Regular),ForeColor=Color.FromArgb(214,216,222),Margin=Padding.Empty,Text=""};loginGrid.Controls.Add(clockLabel,8,0);
  CenterContent();LoginPaint.Apply(this);
  var bar=new SessionBar(!preview);timerWindow=bar;timerLabel=bar.TimeLabel;if(!preview){StartForegroundWatch();bar.Recheck=()=>{if(closing)return;long n=monotonic.ElapsedMilliseconds;UpdateBarFullscreen(bar,budget.Left(n),n);};
   /* 2.0.54: Ctrl+Alt+T confere se ha MESMO jogo/aplicativo em tela cheia na frente; se nao houver, reinicia a barra (mostra de novo) */
   bar.FullscreenNow=()=>{long n=monotonic.ElapsedMilliseconds;return (adminSession||(budget.sessionId!=null&&budget.Left(n)>0))&&FullscreenDetector.IsForegroundFullscreen(Handle,bar.Handle);};
   bar.ResetRequested=()=>{if(closing)return;FullscreenDetector.LastGameWindow=IntPtr.Zero;FullscreenDetector.ResetAdjust();FullscreenDetector.ShellHint=false;long n=monotonic.ElapsedMilliseconds;bool running=adminSession||((authorized||localSessionTrusted)&&!remoteLocked&&budget.sessionId!=null&&budget.Left(n)>0);if(running&&!locked&&!maintenance&&!maintenanceDialogOpen&&!bar.Visible)bar.Show();bar.ResetBar();};}
  if(!preview){var shadow=Files.LoadSession();if(shadow!=null&&!String.IsNullOrEmpty(shadow.id)){ulong uptime=Files.SystemUptimeMs();bool rebooted=shadow.savedSystemUptimeMs>0&&uptime+2000<shadow.savedSystemUptimeMs;double elapsed=rebooted?0:(shadow.savedSystemUptimeMs>0?Math.Max(0,(uptime-shadow.savedSystemUptimeMs)/1000.0):Math.Max(0,(DateTime.UtcNow.Ticks-shadow.savedUtcTicks)/(double)TimeSpan.TicksPerSecond));double remaining=Math.Max(0,shadow.remainingSeconds-elapsed);budget.Restore(shadow.id,remaining,monotonic.ElapsedMilliseconds);localSessionTrusted=true;localMemberName=shadow.memberName??"";if(rebooted){crashRecoveryPending=true;crashRecoverySessionId=shadow.id;crashRecoveryRemaining=shadow.remainingSeconds;}bar.SetMember(localMemberName,shadow.stationName??settings.stationName??"");}}
  bar.PasswordButton.Click+=(a,e)=>ChangePassword();bar.FinishButton.Click+=async(a,e)=>{if(MessageBox.Show(timerWindow,adminSession?"Sair do acesso administrativo e reaplicar os bloqueios?":"Deseja encerrar a seção?","GameZoney",MessageBoxButtons.YesNo)==DialogResult.Yes)await Finish();};
  bar.ExitButton.Click+=async(a,e)=>await CloseAdministratorClient();
  timerWindow.FormClosing+=(a,e)=>{if(!allowedExit){e.Cancel=true;if(!adminSession)ShowCloseWarning();}};FormClosing+=OnClosing;
  poll=new System.Windows.Forms.Timer{Interval=2000};poll.Tick+=async(a,e)=>await Poll();clock=new System.Windows.Forms.Timer{Interval=500};clock.Tick+=(a,e)=>RefreshClock();secondsTick=new System.Windows.Forms.Timer{Interval=100};secondsTick.Tick+=(a,e)=>TickDisplay();
  Shown+=async(a,e)=>{if(preview)return;try{sessionCleanup=SessionCleanup.Create(Files.DirectoryPath);try{applyPolicies(settings);policiesApplied=true;appliedRevision=(settings.machinePolicy??new MachineOptions()).revision;}catch(Exception policyFailure){policiesApplied=false;policyError=policyFailure.Message;}hookCallback=Keyboard;hook=SetWindowsHookEx(13,hookCallback,GetModuleHandle(null),0);if(hook==IntPtr.Zero)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),"Não foi possível restringir os atalhos da tela de login.");poll.Start();clock.Start();secondsTick.Start();StartHeartbeat();if(sessionCleanup.Pending){try{await CleanSession();}catch{}}await Poll();}catch(Exception ex){allowedExit=true;MessageBox.Show(ex.Message,"Não foi possível ativar o cliente");Close();}};
 }
 Control BarInput(TextBox input){input.BorderStyle=BorderStyle.None;input.BackColor=Color.FromArgb(65,67,77);input.ForeColor=Color.White;input.Font=new Font("Segoe UI",12);input.Dock=DockStyle.Fill;input.Margin=Padding.Empty;return WrapInput(input);}
 Control WrapInput(TextBox input){/* 2.0.30: campo escuro com borda vermelha ao selecionar */return new GzInputFrame(input,new Padding(11,7,11,4)){Dock=DockStyle.Fill,Margin=new Padding(0,12,12,12)};}
 void RevealLogin(){if(!locked||maintenance||maintenanceDialogOpen||closing)return;content.Visible=true;status.Visible=true;wakeHint.Visible=false;CenterContent();content.BringToFront();username.Focus();}
 void HideLogin(){password.Clear();username.Clear();adminLogin.Checked=false;content.Visible=true;status.Visible=true;wakeHint.Visible=false;ActiveControl=null;CenterContent();}
 // 2.0.56: o Tab (e a ativacao da janela) trocava as marcas de foco do teclado e o Windows redesenhava a tela de login inteira.
 protected override void WndProc(ref Message m){if(LoginPaint.IgnoresUiState(m.Msg)){m.Result=IntPtr.Zero;return;}base.WndProc(ref m);}
 protected override bool ProcessCmdKey(ref Message msg,Keys keyData){if(locked&&!maintenance&&!maintenanceDialogOpen){if(keyData==Keys.Tab&&username!=null&&username.ContainsFocus){password.Focus();password.SelectionStart=password.TextLength;return true;}if(keyData==(Keys.Shift|Keys.Tab)&&password!=null&&password.ContainsFocus){username.Focus();username.SelectionStart=username.TextLength;return true;}if(keyData==Keys.Tab&&password!=null&&password.ContainsFocus){login.Focus();return true;}}return base.ProcessCmdKey(ref msg,keyData);}
 void CenterContent(){if(content==null)return;content.SetBounds(0,0,ClientSize.Width,60);if(loginGrid!=null){float fieldWidth=Math.Max(90,Math.Min(210,(ClientSize.Width-674)/2f));loginGrid.ColumnStyles[2].Width=fieldWidth;loginGrid.ColumnStyles[4].Width=Math.Min(160,fieldWidth);}if(status!=null)status.SetBounds(Math.Max(20,(ClientSize.Width-900)/2),66,Math.Min(900,Math.Max(200,ClientSize.Width-40)),72);/* 2.0.55: 3 linhas, para caber o motivo da falta de conexao */if(wakeHint!=null)wakeHint.Visible=false;if(summary!=null){int w=Math.Min(760,Math.Max(280,ClientSize.Width-40));summary.SetBounds(Math.Max(20,(ClientSize.Width-w)/2),Math.Max(90,ClientSize.Height-180),w,140);}}
 IntPtr Keyboard(int code,IntPtr wParam,IntPtr data){if(code>=0&&locked&&!maintenance&&(wParam==(IntPtr)0x100||wParam==(IntPtr)0x104)){int key=Marshal.ReadInt32(data);bool alt=(GetAsyncKeyState(0x12)&0x8000)!=0,ctrl=(GetAsyncKeyState(0x11)&0x8000)!=0;bool shift=(GetAsyncKeyState(0x10)&0x8000)!=0;if(LoginKeys.Block(key,alt,ctrl,shift))return (IntPtr)1;}return CallNextHookEx(hook,code,wParam,data);}
 void LockScreen(bool value){if(maintenance||maintenanceDialogOpen)return;if(!value&&!locked&&covers.Count==0&&!Visible&&timerWindow.Visible)return;if(value){if(!locked)HideLogin();locked=true;content.Visible=true;status.Visible=true;wakeHint.Visible=false;timerWindow.Hide();if(!Visible)Show();TopMost=true;Bounds=Screen.PrimaryScreen.Bounds;if(covers.Count==0)foreach(var screen in Screen.AllScreens){if(screen.Primary)continue;var cover=new Form{FormBorderStyle=FormBorderStyle.None,Bounds=screen.Bounds,TopMost=true,BackColor=Bg,ShowInTaskbar=false};cover.Controls.Add(new Label{Text="GameZoney\nEstação bloqueada",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleCenter,ForeColor=Color.White,Font=new Font("Segoe UI",28)});cover.Show();covers.Add(cover);}}else{HideLogin();locked=false;foreach(var cover in covers)cover.Close();covers.Clear();Hide();if(!timerWindow.Visible)timerWindow.Show();}}
 static string Duration(double seconds){long n=(long)Math.Max(0,Math.Ceiling(seconds));return (n/3600).ToString("00")+":"+(n/60%60).ToString("00")+":"+(n%60).ToString("00");}
 static string Value(Dictionary<string,object> d,string key){return d!=null&&d.ContainsKey(key)?Convert.ToString(d[key]):"";}
 void QueueLoyaltyNotice(string message){if(String.IsNullOrWhiteSpace(message)||closing)return;loyaltyQueue.Enqueue(message);if(!loyaltyShowing)ShowNextLoyaltyNotice();}
 void ShowNextLoyaltyNotice(){if(closing||loyaltyShowing||loyaltyQueue.Count==0)return;if(timerWindow!=null&&((SessionBar)timerWindow).Suppressed)return;loyaltyShowing=true;loyaltyToast=new LoyaltyToast(loyaltyQueue.Dequeue());loyaltyToast.FormClosed+=(a,e)=>{loyaltyShowing=false;loyaltyToast=null;if(!closing&&loyaltyQueue.Count>0)BeginInvoke(new Action(ShowNextLoyaltyNotice));};loyaltyToast.Show();}
 async Task HandleLoyaltyNotice(Dictionary<string,object> result){var notice=result.ContainsKey("loyaltyNotice")?result["loyaltyNotice"] as Dictionary<string,object>:null;if(notice==null)return;string noticeId=Value(notice,"id"),message=Value(notice,"text");if(String.IsNullOrEmpty(noticeId)||String.IsNullOrEmpty(message))return;if(loyaltySeen.Add(noticeId)){string rewardTitle=Value(notice,"title");if(!String.IsNullOrEmpty(rewardTitle)){int seconds=1800;try{if(notice.ContainsKey("showSeconds")&&notice["showSeconds"]!=null)seconds=Convert.ToInt32(notice["showSeconds"]);}catch{}((SessionBar)timerWindow).ShowReward(rewardTitle,Value(notice,"detail"),seconds);}else QueueLoyaltyNotice(message);}if(!loyaltyAcked.Contains(noticeId)){try{await Task.Run(()=>transport.Post("loyalty-ack",new {clientRunId=clientRunId,noticeId=noticeId}));loyaltyAcked.Add(noticeId);}catch{}}}
 async Task CleanSession(){
  if(sessionCleanup==null)return;if(cleanupTask!=null){await cleanupTask;return;}
  cleanupBlocked=true;cleanupError="";login.Enabled=false;LockScreen(true);status.Visible=true;status.Text="Preparando o computador: fechando os aplicativos da sessão…";
  cleanupTask=Task.Run(()=>sessionCleanup.Clean());
  try{await cleanupTask;cleanupBlocked=false;cleanupError="";}catch(Exception ex){cleanupError="Limpeza pendente. Procure a recepção: "+ex.Message;throw;}finally{cleanupTask=null;}
 }
 async Task ApplyClean(Dictionary<string,object> result){
  if(sessionCleanup!=null){var active=result["active"] as Dictionary<string,object>;bool administrator=result.ContainsKey("adminAccess")&&result["adminAccess"]!=null;
   string next=administrator||active==null?null:Value(active,"id");bool positive=active!=null&&Convert.ToDouble(active["remainingSeconds"])>0;
   if(cleanupTask!=null)await cleanupTask;
   bool preserveForMaintenance=administrator&&maintenancePreserveApps&&sessionCleanup.Pending;
   if(sessionCleanup.Pending&&(cleanupBlocked||sessionCleanup.Session!=next||!positive)&&!preserveForMaintenance)await CleanSession();
   if(next!=null&&positive&&!sessionCleanup.Pending)sessionCleanup.Begin(next);
  }
  Apply(result);
  await HandleLoyaltyNotice(result);
 }
 // 2.0.36: alterar a senha do cliente em sessao (o servidor confere a senha atual).
 void ChangePassword(){if(passwordDialog!=null&&!passwordDialog.IsDisposed){passwordDialog.Activate();return;}string session=budget.sessionId;if(session==null||adminSession||offlineAdminSession)return;string nick=((SessionBar)timerWindow).MemberLabel.Text;passwordDialog=new ChangePasswordForm(nick,async(currentPassword,newPassword,repeatPassword)=>{if(budget.sessionId!=session)throw new Exception("A sessão mudou. Feche esta janela.");var r=await Task.Run(()=>transport.Post("change-password",new {clientRunId=clientRunId,sessionId=session,currentPassword=currentPassword,newPassword=newPassword,repeatPassword=repeatPassword}));if(!r.ContainsKey("ok")||!Convert.ToBoolean(r["ok"]))throw new Exception("Não foi possível alterar a senha.");});passwordDialog.FormClosed+=(a,e)=>{passwordDialog=null;};passwordDialog.Show(timerWindow);}
 async void CleanupExpired(){try{await CleanSession();}catch{}finally{if(!closing)RefreshClock();}}
 void Apply(Dictionary<string,object> result){
  authorized=true;setupMessage="";offlineAdminSession=false;
  var administrator=result.ContainsKey("adminAccess")?result["adminAccess"] as Dictionary<string,object>:null;
  bool incomingAdmin=administrator!=null,changed=false;
  if(result.ContainsKey("machinePolicy")){var incoming=Files.Json.Deserialize<MachineOptions>(Files.Json.Serialize(result["machinePolicy"]));if(incoming!=null&&!incoming.Same(settings.machinePolicy)){settings.machinePolicy=incoming;saveSettings(settings);changed=true;}}
  try{
   if(incomingAdmin){/* 2.0.57: se o Windows negar a retirada das restricoes, o administrador entra mesmo assim (para poder rodar o reparo) */if(!adminSession){try{restorePolicies(settings);}catch(Exception restoreFailure){Files.LogConnection("Administrador: as restrições do Windows não puderam ser retiradas: "+restoreFailure.Message);}}adminSession=true;policiesApplied=false;appliedRevision=0;}
   else{bool wasAdmin=adminSession;adminSession=false;if(wasAdmin){adminLogin.Checked=false;username.Clear();}if(wasAdmin||!policiesApplied||changed){applyPolicies(settings);policiesApplied=true;appliedRevision=(settings.machinePolicy??new MachineOptions()).revision;}}
   policyError="";
  }catch(Exception ex){adminSession=false;policiesApplied=false;policyError=ex.Message;LockScreen(true);throw new PolicyFailure(ex.Message,ex);}
  var remoteState=result.ContainsKey("remote")?result["remote"] as Dictionary<string,object>:null;
  if(remoteState!=null){remoteLocked=Convert.ToBoolean(remoteState["locked"]);bool watching=Convert.ToBoolean(remoteState["watch"]);if(watching&&!remoteWatch)watchVisibleAt=DateTime.UtcNow;remoteWatch=watching;}
  if(adminSession){remoteLocked=false;remoteWatch=false;}
  Guardian.SetAdministrator(adminSession);last=result;var active=result["active"] as Dictionary<string,object>;/* 2.0.35: tempo alocado conhecido (o servidor nao reduz o tempo com relato anterior a uma recarga) e aviso de caixa fechado */knownAllocated=active!=null&&active.ContainsKey("allocatedSeconds")&&active["allocatedSeconds"]!=null?Convert.ToInt64(active["allocatedSeconds"]):-1;{bool closedNow=result.ContainsKey("cashOpen")&&result["cashOpen"]!=null&&!Convert.ToBoolean(result["cashOpen"]);if(closedNow!=cashClosed){cashClosed=closedNow;if(!adminSession&&active==null){if(closedNow)status.Text=CashClosedText;else if(status.Text==CashClosedText)status.Text="";}}}title.Text=Value(result,"stationName");var bar=(SessionBar)timerWindow;
  string finishText=adminSession?"Sair do administrador":"Encerrar sessão";if(bar.FinishButton.Text!=finishText)bar.FinishButton.Text=finishText;
  if(adminSession){budget.Update(null,0,monotonic.ElapsedMilliseconds);localSessionTrusted=false;localMemberName="";crashRecoveryPending=false;crashRecoverySessionId="";crashRecoveryRemaining=0;Files.ClearSession();status.Text="Acesso administrativo autorizado";bar.SetMember(Value(administrator,"username"),Value(result,"stationName")+" • ADMINISTRADOR");}
  else if(active!=null){double remaining=active.ContainsKey("remainingMs")?Convert.ToDouble(active["remainingMs"])/1000.0:Convert.ToDouble(active["remainingSeconds"]);budget.Update(Value(active,"id"),remaining,monotonic.ElapsedMilliseconds);localSessionTrusted=true;localMemberName=Value(active,"memberUsername");if(String.IsNullOrEmpty(localMemberName))localMemberName=Value(active,"memberName");status.Text="Sessão de "+localMemberName;{string pts=Value(active,"pointsText");bar.SetMember(localMemberName,Value(result,"stationName")+(String.IsNullOrEmpty(pts)?"":" • "+pts+" "+(pts=="1"?"medalha":"medalhas")));}try{Files.SaveSession(new LocalSessionState{id=budget.sessionId,memberName=localMemberName,stationName=Value(result,"stationName"),remainingSeconds=remaining,savedUtcTicks=DateTime.UtcNow.Ticks,savedSystemUptimeMs=Files.SystemUptimeMs()});lastShadowSave=monotonic.ElapsedMilliseconds;}catch{}}
  else{budget.Update(null,0,monotonic.ElapsedMilliseconds);localSessionTrusted=false;localMemberName="";crashRecoveryPending=false;crashRecoverySessionId="";crashRecoveryRemaining=0;Files.ClearSession();status.Text="Disponível";var ended=result["last"] as Dictionary<string,object>;if(ended!=null)summaryWindow.Update(Value(ended,"id"),Convert.ToDouble(ended["finishedAt"]),Convert.ToDouble(result["serverNow"]),monotonic.ElapsedMilliseconds);summary.Text=ended==null||!summaryWindow.Visible(monotonic.ElapsedMilliseconds)?"":"Sessão finalizada • "+Value(ended,"memberName")+"\nInício: "+DateText(ended,"startedAt")+"\nTérmino: "+DateText(ended,"finishedAt")+"\nUtilizado: "+Duration(Convert.ToDouble(ended["usedSeconds"]))+"   Restante: "+Duration(Convert.ToDouble(ended["remainingSeconds"]));}
  remoteControl.SetSession(adminSession?"":budget.sessionId);if(budget.sessionId==null){remoteLocked=false;remoteWatch=false;}
  if(remoteWatch&&!adminSession&&!bar.MemberDetail.Text.StartsWith("TELA VISÍVEL"))bar.SetMember(bar.MemberLabel.Text,"TELA VISÍVEL À RECEPÇÃO • "+bar.MemberDetail.Text);
  RefreshClock();
 }
 static string DateText(Dictionary<string,object> d,string key){return new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc).AddMilliseconds(Convert.ToDouble(d[key])).ToLocalTime().ToString("dd/MM HH:mm");}
 // 2.0.28: o estado do botao Entrar so muda quando realmente muda (sem redesenho a cada 500 ms).
 Label clockLabel;string clockText;
 // 2.0.30: relogio e situacao da conexao na barra de login (so redesenha quando muda).
 void UpdateClock(long now){if(clockLabel==null)return;string text=DateTime.Now.ToString("HH:mm")+"\n"+(budget.Online(now)?"● Online":"● Offline");if(text==clockText)return;clockText=text;clockLabel.Text=text;clockLabel.ForeColor=budget.Online(now)?Color.FromArgb(214,216,222):GzTheme.Muted;}
 void SetLoginEnabled(bool value){if(login!=null&&login.Enabled!=value)login.Enabled=value;}
 void RefreshClock(){Guardian.Pulse();if(closing)return;if(sessionCleanup!=null&&sessionCleanup.Pending&&!adminSession&&cleanupTask==null&&!cleanupBlocked&&budget.sessionId!=null&&budget.Left(monotonic.ElapsedMilliseconds)<=0){CleanupExpired();return;}if(cleanupBlocked||cleanupTask!=null){login.Enabled=false;LockScreen(true);status.Visible=true;status.Text=cleanupError!=""?cleanupError:"Preparando o computador: fechando os aplicativos da sessão…";return;}long now=monotonic.ElapsedMilliseconds;summary.Visible=!adminSession&&budget.sessionId==null&&summaryWindow.Visible(now);if(!summaryWindow.Visible(now))summary.Text="";if(maintenance||maintenanceDialogOpen)return;if(adminSession&&!offlineAdminSession&&!budget.Online(now)){adminSession=false;policiesApplied=false;try{applyPolicies(settings);policiesApplied=true;appliedRevision=(settings.machinePolicy??new MachineOptions()).revision;}catch(Exception ex){policyError=ex.Message;}}Guardian.SetAdministrator(adminSession);double left=budget.Left(now);{var mp=settings.machinePolicy??new MachineOptions();SessionSecurity.Configure(mp.controlPanel,mp.dateTime);}SessionSecurity.Enforce(!adminSession&&!maintenance&&!maintenanceDialogOpen&&budget.sessionId!=null&&left>0);SetTimerText(adminSession?"ADMIN":Duration(left));var bar=(SessionBar)timerWindow;bar.SetAdminActions(adminSession);bar.SetMode(adminSession,left,budget.sessionId);bar.TickReward(!adminSession&&budget.sessionId!=null);{bool userSession=!adminSession&&!offlineAdminSession&&budget.sessionId!=null&&left>0;bar.SetPasswordAction(userSession&&budget.Online(now));if(!userSession&&passwordDialog!=null&&!passwordDialog.IsDisposed)passwordDialog.Close();}UpdateBarFullscreen(bar,left,now);bar.PositionBar();if(loyaltyQueue.Count>0&&!loyaltyShowing&&!bar.Suppressed)ShowNextLoyaltyNotice();if(offlineAdminSession)bar.SetMember("ADMIN LOCAL",settings.stationName??Environment.MachineName);else if(budget.sessionId!=null&&!String.IsNullOrEmpty(localMemberName)&&!budget.Online(now))bar.SetMember(localMemberName,(settings.stationName??Environment.MachineName)+" • OFFLINE");bool running=adminSession||((authorized||localSessionTrusted)&&!remoteLocked&&budget.sessionId!=null&&left>0);LockScreen(!running);/* 2.0.49: em sessao ou admin a barra tem que estar visivel (so fica fora da tela enquanto o jogo esta na frente) */if(running&&!closing&&timerWindow!=null&&!timerWindow.IsDisposed&&!timerWindow.Visible&&!locked){timerWindow.Show();Files.LogFullscreen("BARRA: estava oculta durante a sessao; exibida novamente");}/* 2.0.28: "busy" tambem fica ligado durante a consulta ao servidor a cada 2 s; usar ele aqui fazia o botao Entrar piscar. */UpdateClock(now);SetLoginEnabled(!loginBusy&&!adminSession&&budget.sessionId==null&&String.IsNullOrEmpty(settings.setupDevice)&&((authorized&&budget.Online(now))||(!budget.Online(now)&&!String.IsNullOrEmpty(settings.offlineAdminHash))));if(budget.sessionId!=null&&now-lastShadowSave>=5000){try{Files.SaveSession(new LocalSessionState{id=budget.sessionId,memberName=localMemberName,stationName=settings.stationName,remainingSeconds=left,savedUtcTicks=DateTime.UtcNow.Ticks,savedSystemUptimeMs=Files.SystemUptimeMs()});lastShadowSave=now;}catch{}}if(!String.IsNullOrEmpty(setupMessage)){status.Text=setupMessage;}else if(offlineAdminSession){status.Text="Modo administrador local • servidor indisponível.";}else if(!budget.Online(now)&&budget.sessionId!=null&&left>0){status.Text="Servidor indisponível. A sessão continua localmente e será sincronizada automaticamente.";}else if(!budget.Online(now)&&localProblem&&!String.IsNullOrEmpty(connectionProblem)){status.Text=String.IsNullOrEmpty(settings.offlineAdminHash)?connectionProblem:connectionProblem+" O administrador já validado neste PC pode entrar.";}else if(!budget.Online(now)){string why=String.IsNullOrEmpty(connectionProblem)?"Aguardando reconexão.":"Motivo: "+connectionProblem;status.Text=String.IsNullOrEmpty(settings.offlineAdminHash)?"Sem conexão com o servidor. "+why:"Sem conexão com o servidor. "+why+" O administrador já validado neste PC pode entrar.";}else if(budget.sessionId!=null&&left<=0){status.Text="Tempo esgotado. Aguardando sincronização com o servidor.";}if(remoteLocked&&!adminSession)status.Text="Bloqueado pela recepção. O tempo continua contando.";if(locked&&Form.ActiveForm==null)BringToFront();}
 void LoadWallpaper(){try{string file=Path.Combine(Files.DirectoryPath,"login-wallpaper.img");Image next=null;/* 2.0.25: sem layout enviado pelo servidor, usa o wallpaper padrao GameZoney instalado com o cliente */if(!File.Exists(file))file=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"wallpaper-padrao.jpg");if(File.Exists(file)){using(var stream=File.OpenRead(file))using(var img=Image.FromStream(stream)){if(img.Width>4096||img.Height>4096)throw new Exception("Imagem muito grande.");next=new Bitmap(img);}}var old=BackgroundImage;BackgroundImage=next;if(old!=null)old.Dispose();}catch{}}
 async Task SyncWallpaper(Dictionary<string,object> state){var layout=state.ContainsKey("loginLayout")?state["loginLayout"] as Dictionary<string,object>:null;string revision=Value(layout,"revision");if(revision==(settings.layoutRevision??""))return;var result=await Task.Run(()=>transport.Post("wallpaper",new {clientRunId=clientRunId}));var incoming=result["layout"] as Dictionary<string,object>;string data=Value(result,"image"),file=Path.Combine(Files.DirectoryPath,"login-wallpaper.img");Directory.CreateDirectory(Files.DirectoryPath);if(data!=""){byte[] bytes=Convert.FromBase64String(data);if(bytes.Length>2097152)throw new Exception("Imagem muito grande.");using(var stream=new MemoryStream(bytes))using(var img=Image.FromStream(stream)){if(img.Width>4096||img.Height>4096||((long)img.Width)*img.Height>9000000)throw new Exception("Dimensões inválidas.");}File.WriteAllBytes(file+".tmp",bytes);if(File.Exists(file))File.Replace(file+".tmp",file,null);else File.Move(file+".tmp",file);}else if(File.Exists(file))File.Delete(file);settings.layoutRevision=Value(incoming,"revision");settings.layoutPosition=Value(incoming,"position");saveSettings(settings);LoadWallpaper();CenterContent();}
 // 2.0.55: motivo real da falta de conexao (tela + connection.log a cada motivo novo) e reencontro do servidor na rede.
 void NoteConnectionOk(){if(localProblem)return;/* 2.0.57: so limpa o problema local (restricoes) quando elas forem aplicadas (NoteApplied) */if(lastLoggedProblem!=null)Files.LogConnection("Conexão normal de novo com "+ConnectionDoctor.Host(settings.server)+".");connectionProblem=null;lastLoggedProblem=null;networkFailures=0;}
 void NoteApplied(){if(!localProblem)return;localProblem=false;Files.LogConnection("Restrições do Windows aplicadas de novo; PC disponível.");connectionProblem=null;lastLoggedProblem=null;networkFailures=0;}
 void NoteConnectionFailure(Exception e){localProblem=e is PolicyFailure;string problem=ConnectionDoctor.Describe(e,settings.server);if(problem!=lastLoggedProblem){Files.LogConnection(localProblem?"O servidor respondeu, mas o PC não aplicou as restrições do Windows: "+(e.InnerException??e).Message:"Sem conexão com "+ConnectionDoctor.Host(settings.server)+": "+problem+" | detalhe: "+e.Message);lastLoggedProblem=problem;}if(!rediscovering)connectionProblem=problem;if(ConnectionDoctor.NetworkProblem(e)){networkFailures++;if(networkFailures>=2&&!rediscovering&&(DateTime.UtcNow-lastRediscover).TotalSeconds>=20)Rediscover();}else networkFailures=0;}
 async void Rediscover(){if(rediscovering||closing||!String.IsNullOrEmpty(settings.setupDevice))return;rediscovering=true;lastRediscover=DateTime.UtcNow;var snapshot=settings;string before=snapshot.server;
  try{
   var r=await Task.Run(()=>new Transport(snapshot).Post("discover",new {}));
   var found=ConnectionDoctor.Servers(r);
   string problem;string next=ConnectionDoctor.PickServer(before,snapshot.fingerprint,found,out problem);
   if(closing||!ReferenceEquals(settings,snapshot)||snapshot.server!=before)return;
   if(next!=null){var moved=new Settings();foreach(var field in typeof(Settings).GetFields())field.SetValue(moved,field.GetValue(snapshot));moved.server=next;Files.Validate(moved);snapshot.server=next;saveSettings(snapshot);transport=new Transport(snapshot);networkFailures=0;lastLoggedProblem=null;connectionProblem="servidor encontrado no novo endereço "+ConnectionDoctor.Host(next)+". Reconectando…";Files.LogConnection("Servidor encontrado na rede em novo endereço: "+ConnectionDoctor.Host(before)+" -> "+ConnectionDoctor.Host(next)+" (mesma identidade). Endereço atualizado neste PC.");}
   else if(problem!=null){connectionProblem=problem;Files.LogConnection("Busca do servidor na rede: "+problem);}
  }catch(Exception e){Files.LogConnection("Busca do servidor na rede falhou: "+e.Message);}
  finally{rediscovering=false;}
 }
 // 2.0.33: removida a senha de manutencao. O acesso administrativo usa os administradores cadastrados no servidor.
 async Task RequestAuthorization(){if(sessionCleanup!=null&&sessionCleanup.Pending)await CleanSession();authorized=false;if(adminSession){applyPolicies(settings);policiesApplied=true;}adminSession=false;offlineAdminSession=false;localSessionTrusted=false;Files.ClearSession();budget.Restore(null,0,monotonic.ElapsedMilliseconds);budget.Offline();login.Enabled=false;LockScreen(true);if(String.IsNullOrEmpty(settings.setupDevice)){settings.setupDevice=Guid.NewGuid().ToString("N");settings.setupSecret=Guid.NewGuid().ToString("N")+Guid.NewGuid().ToString("N");saveSettings(settings);}setupMessage="Solicitando autorização da recepção…";var r=await Task.Run(()=>transport.Post("setup",new {device=settings.setupDevice,secret=settings.setupSecret,name=Environment.MachineName}));HandleSetupResult(r);}
 void HandleSetupResult(Dictionary<string,object> r){string state=Value(r,"status");setupMessage=(state=="rejected"?"Autorização recusada. Procure a recepção.":"Aguardando autorização da recepção. Código: "+Value(r,"code"));if(state=="approved"){string verification=(settings.fingerprint??"").Length>=12?settings.fingerprint.Substring(0,12).ToUpperInvariant():settings.fingerprint;if(MessageBox.Show(this,"Máquina aprovada na recepção. Confirme a identidade do servidor exibida no painel:\n\n"+verification+"\n\nContinuar com este servidor?","GameZoney",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes){setupMessage="Identidade não confirmada. Confira o servidor com a recepção.";return;}settings.token=Value(r,"token");settings.device=settings.setupDevice;settings.stationName=Value(r,"stationName");settings.setupDevice=null;settings.setupSecret=null;saveSettings(settings);transport=new Transport(settings);setupMessage="Máquina autorizada. Aguardando sincronização…";}}
 // 2.0.33: removido o acesso temporario. A maquina aguarda a aprovacao no servidor (Computadores > solicitacoes pendentes).
 async Task Poll(){if(sessionCleanup!=null&&sessionCleanup.Pending&&cleanupTask==null&&!observing){observing=true;try{var tracker=sessionCleanup;await Task.Run(()=>tracker.Observe());}catch(Exception ex){cleanupBlocked=true;cleanupError="Falha no acompanhamento da sessão: "+ex.Message;}finally{observing=false;}}if(offlineAdminSession||busy||maintenance||(maintenanceDialogOpen&&!registeringPassword)||closing)return;busy=true;try{if(!String.IsNullOrEmpty(settings.setupDevice)){await RequestAuthorization();return;}string screen="";if(remoteWatch&&!adminSession&&!locked&&timerWindow.Visible&&budget.Online(monotonic.ElapsedMilliseconds)&&DateTime.UtcNow.Subtract(watchVisibleAt).TotalSeconds>=2){try{screen=await Task.Run(()=>RemoteControl.Capture());}catch{}}
 var inventory=adminSession?new object[0]:await Task.Run(()=>remoteControl.Inventory());var resultList=remoteControl.Results.ToArray();long now=monotonic.ElapsedMilliseconds;double clientRemaining=budget.sessionId==null?0:budget.Left(now);
 var r=await Task.Run(()=>transport.Post("state",new {clientRunId=clientRunId,clientVersion="1.0.5",layoutRevision=settings.layoutRevision,policyRevision=appliedRevision,policyError=policyError,remoteVersion=1,canTerminate=true,remoteSessionId=remoteControl.Session,clientSessionId=budget.sessionId,clientRemainingSeconds=clientRemaining,clientAllocatedSeconds=budget.sessionId==null?-1:knownAllocated,recoverySessionId=crashRecoveryPending?crashRecoverySessionId:null,recoveryRemainingSeconds=crashRecoveryPending?crashRecoveryRemaining:0,recoveryAfterRestart=crashRecoveryPending,systemUptimeMs=Files.SystemUptimeMs(),processes=inventory,remoteResults=resultList,screen=screen}));Interlocked.Exchange(ref lastServerContact,monotonic.ElapsedMilliseconds);NoteConnectionOk();if(connectionFaulted){Files.LogConnection("Conexão com o servidor restabelecida. Sessão="+(budget.sessionId??"nenhuma")+".");connectionFaulted=false;}if(!closing){await ApplyClean(r);NoteApplied();if(crashRecoveryPending){var activeAfter=r.ContainsKey("active")?r["active"] as Dictionary<string,object>:null;bool resolved=r.ContainsKey("recoveryResolved")&&Convert.ToBoolean(r["recoveryResolved"]);if(resolved||activeAfter==null||Value(activeAfter,"id")!=crashRecoverySessionId){crashRecoveryPending=false;crashRecoverySessionId="";crashRecoveryRemaining=0;Files.ClearSession();}}await HandleRemote(r);try{await SyncWallpaper(r);}catch(Exception imageError){status.Text="Falha no fundo: "+imageError.Message;}}}catch(ConnectionFailure e){NoteConnectionFailure(e);if(!connectionFaulted){Files.LogConnection("Falha de conexão/status "+e.Status+": "+e.Message+". Sessão="+(budget.sessionId??"nenhuma")+".");connectionFaulted=true;}if(e.Status==401){authorized=false;login.Enabled=false;localSessionTrusted=false;Files.ClearSession();budget.Restore(null,0,monotonic.ElapsedMilliseconds);budget.Offline();if(adminSession){adminSession=false;offlineAdminSession=false;try{applyPolicies(settings);}catch{}}if(String.IsNullOrEmpty(settings.setupDevice)){settings.setupDevice=Guid.NewGuid().ToString("N");settings.setupSecret=Guid.NewGuid().ToString("N")+Guid.NewGuid().ToString("N");saveSettings(settings);}setupMessage="Associação removida. Solicitando nova autorização à recepção…";}else if(e.Status==403){authorized=false;localSessionTrusted=false;Files.ClearSession();budget.Restore(null,0,monotonic.ElapsedMilliseconds);budget.Offline();setupMessage=e.Message;}else{if(!closing&&!budget.Online(monotonic.ElapsedMilliseconds))status.Text=budget.sessionId!=null?"Servidor indisponível • sessão continua ativa neste PC e o tempo segue contando localmente.":e.Message;}}catch(Exception e){NoteConnectionFailure(e);/* 2.0.57: falha das restricoes do Windows ja fica no log (uma vez) com o texto certo */if(!connectionFaulted&&!(e is PolicyFailure)){Files.LogConnection("Falha de conexão: "+e.Message+". Sessão="+(budget.sessionId??"nenhuma")+".");connectionFaulted=true;}if(!closing&&!budget.Online(monotonic.ElapsedMilliseconds))status.Text=budget.sessionId!=null?"Servidor indisponível • sessão continua ativa neste PC e o tempo segue contando localmente.":e.Message;}finally{busy=false;if(!closing)RefreshClock();}}
 async Task HandleRemote(Dictionary<string,object> result){
  var control=result.ContainsKey("remote")?result["remote"] as Dictionary<string,object>:null;if(control==null)return;
  foreach(var item in (System.Collections.IEnumerable)control["commands"]){var c=(Dictionary<string,object>)item;string id=Value(c,"id"),type=Value(c,"type");if(adminSession&&type!="restart"&&type!="shutdown")continue;if(!remoteControl.First(id))continue;
   try{if(Value(c,"sessionId")!=(budget.sessionId??""))throw new Exception("A sessão mudou; comando descartado.");
    if(type=="terminate"){int pid=Convert.ToInt32(c["pid"]);string started=Value(c,"started");remoteControl.Result(id,await Task.Run(()=>remoteControl.TerminateApplication(pid,started)));}
    else if(type=="close")remoteControl.Result(id,(remoteClose??remoteControl.CloseApplication)(Convert.ToInt32(c["pid"]),Value(c,"started")));
    else if(type=="admin"){
     /* 2.0.48: liberacao do modo administrador pela recepcao (inclusive "Liberar todas"): o tempo restante do cliente vai para o saldo no servidor
        e o PC entra em ADMIN SEM fechar o jogo nem os programas abertos (antes a limpeza da sessao fechava tudo). A limpeza dos programas
        da sessao acontece so quando o administrador sair do modo ADMIN, como na manutencao local. */
     maintenancePreserveApps=budget.sessionId!=null&&sessionCleanup!=null&&sessionCleanup.Pending;
     var entered=await Task.Run(()=>transport.Post("remote-admin",new {clientRunId=clientRunId,commandId=id,sessionId=budget.sessionId}));
     try{await ApplyClean(entered);}finally{if(!adminSession)maintenancePreserveApps=false;}remoteControl.Result(id,"Modo administrador liberado pela recepção.");
    }
    else if(type=="restart"||type=="shutdown"){
     if(budget.sessionId!=null){var ended=await Task.Run(()=>transport.Post("finish",new {clientRunId=clientRunId,sessionId=budget.sessionId}));await ApplyClean(ended);}
     remotePower(type);
     remoteControl.Result(id,"Windows programado para "+(type=="restart"?"reiniciar":"desligar")+" em 15 segundos.");
    }
   }catch(Exception e){remoteControl.Result(id,"Falha: "+e.Message);}
  }
 }
 async Task Login(){if(cleanupBlocked||cleanupTask!=null||busy||maintenance||maintenanceDialogOpen)return;bool online=budget.Online(monotonic.ElapsedMilliseconds);string name=username.Text,secret=password.Text;password.Clear();/* 2.0.33: um unico botao Entrar. O servidor decide se o usuario e um cliente ou um administrador cadastrado em Configuracao > Contas de acesso. */if(!adminSession&&!String.IsNullOrEmpty(settings.setupDevice)){status.Text="Esta máquina ainda não foi aprovada. Aprove-a no painel do servidor.";return;}if(!online){if(monotonic.ElapsedMilliseconds<maintenanceRetry){status.Text="Muitas tentativas. Aguarde um minuto para tentar novamente.";return;}if(!CachedAdminMatches(settings,name,secret)){if(!String.IsNullOrEmpty(secret)&&!String.IsNullOrEmpty(settings.offlineAdminHash)){maintenanceFailures++;if(maintenanceFailures>=5){maintenanceRetry=monotonic.ElapsedMilliseconds+60000;maintenanceFailures=0;}}status.Text=String.IsNullOrEmpty(settings.offlineAdminHash)?"Servidor indisponível. Aguarde a reconexão para entrar.":"Servidor indisponível. Somente o administrador já validado neste PC pode entrar até a reconexão.";return;}maintenanceFailures=0;try{try{restorePolicies(settings);}catch(Exception restoreFailure){Files.LogConnection("Administrador local: as restrições do Windows não puderam ser retiradas: "+restoreFailure.Message);}policiesApplied=false;adminSession=true;offlineAdminSession=true;Guardian.SetAdministrator(true);status.Text="Modo administrador local • servidor indisponível.";RefreshClock();}catch(Exception ex){status.Text=ex.Message;}return;}if(!authorized)return;busy=true;loginBusy=true;login.Enabled=false;try{var r=await Task.Run(()=>transport.Post("login",new {username=name,password=secret,clientRunId=clientRunId,supportsPasswordRegistration=true}));if(r.ContainsKey("adminAccess")&&r["adminAccess"]!=null&&!String.IsNullOrEmpty(secret)){try{settings.offlineAdminUsername=name.Trim();settings.offlineAdminHash=Files.Hash(secret);saveSettings(settings);}catch{}}if(r.ContainsKey("registrationRequired")&&Convert.ToBoolean(r["registrationRequired"])){Dictionary<string,object> signedIn=null;maintenanceDialogOpen=true;registeringPassword=true;busy=false;using(var dialog=new PasswordRegistrationForm(name,async(value,repeat)=>{var pending=await Task.Run(()=>transport.Post("login",new {username=name,password=value,clientRunId=clientRunId,supportsPasswordRegistration=true}));if(!pending.ContainsKey("registrationRequired")){signedIn=pending;return;}var registered=await Task.Run(()=>transport.Post("register-password",new {registrationToken=Value(pending,"registrationToken"),clientRunId=clientRunId,password=value,repeatPassword=repeat}));if(!registered.ContainsKey("registered")||!Convert.ToBoolean(registered["registered"]))throw new Exception("Solicitação atualizada. Clique em Confirmar novamente.");})){try{dialog.ShowDialog(this);secret=dialog.RegisteredPassword;}finally{maintenanceDialogOpen=false;registeringPassword=false;busy=true;}}if(secret==null)return;r=signedIn??await Task.Run(()=>transport.Post("login",new {username=name,password=secret,clientRunId=clientRunId,supportsPasswordRegistration=true}));}if(!closing)await ApplyClean(r);}catch(Exception e){if(!closing)status.Text=e.Message;}finally{busy=false;loginBusy=false;}}


 async Task CloseAdministratorClient(){if(!adminSession||busy||closing)return;busy=true;poll.Stop();clock.Stop();secondsTick.Stop();heartbeatStop=true;try{await Task.Run(()=>transport.Post("disconnect",new {clientRunId=clientRunId}));}catch(Exception error){System.Diagnostics.Debug.WriteLine("Aviso de fechamento: "+error.Message);}finally{allowedExit=true;Close();}}
 async Task Finish(){if(busy||maintenance||maintenanceDialogOpen)return;if(adminSession&&!offlineAdminSession)maintenancePreserveApps=false;if(adminSession&&offlineAdminSession){busy=true;try{offlineAdminSession=false;adminSession=false;Guardian.SetAdministrator(false);applyPolicies(settings);policiesApplied=true;appliedRevision=(settings.machinePolicy??new MachineOptions()).revision;if(budget.sessionId!=null&&budget.Left(monotonic.ElapsedMilliseconds)<=0)CleanupExpired();else RefreshClock();}finally{busy=false;}return;}busy=true;string current=budget.sessionId,action=adminSession?"admin-logout":"finish";try{var r=await Task.Run(()=>transport.Post(action,new {sessionId=current,clientRunId=clientRunId}));if(!closing)await ApplyClean(r);}catch(Exception e){budget.Offline();MessageBox.Show(timerWindow,e.Message,"GameZoney");}finally{busy=false;}}
 // 2.0.33: administrador ja validado online neste PC (usado somente quando o servidor esta indisponivel).
 static bool CachedAdminMatches(Settings s,string name,string secret){if(String.IsNullOrEmpty(secret)||String.IsNullOrWhiteSpace(name)||String.IsNullOrEmpty(s.offlineAdminHash))return false;if(!String.Equals(name.Trim(),s.offlineAdminUsername??"",StringComparison.OrdinalIgnoreCase))return false;return Files.Verify(secret,s.offlineAdminHash);}
 // 2.0.33: autoriza desinstalar, restaurar acessos ou reconfigurar com um administrador do servidor (sem senha de manutencao).
 public static bool AuthorizeAdministrator(Settings s,string purpose){if(String.IsNullOrEmpty(s.token)||String.IsNullOrEmpty(s.device))return true;string user=Prompt("Usuário do administrador cadastrado no servidor ("+purpose+")",false);if(user==null)return false;string pass=Prompt("Senha do administrador",true);if(pass==null)return false;if(!String.IsNullOrEmpty(s.maintenance)&&Files.Verify(pass,s.maintenance))return true;if(CachedAdminMatches(s,user,pass))return true;try{var r=new Transport(s).Post("admin-check",new {username=user,password=pass,purpose=purpose});if(r.ContainsKey("ok")&&Convert.ToBoolean(r["ok"]))return true;}catch(Exception e){MessageBox.Show(e.Message,"GameZoney");return false;}MessageBox.Show("Administrador ou senha incorretos.","GameZoney");return false;}
 public static string Prompt(string message,bool secret,IWin32Window owner=null){/* 2.0.30: janela de senha no padrao GameZoney */using(var form=new GzDialog(message,secret)){return (owner==null?form.ShowDialog():form.ShowDialog(owner))==DialogResult.OK?form.Value:null;}}
 void ShowCloseWarning(){if(showingCloseWarning||maintenanceDialogOpen||closing)return;showingCloseWarning=true;/* 2.0.47: Alt+F4 na barra/cliente durante a sessao: o aviso aparece com a barra visivel e NAO trava a atualizacao da barra
 (antes o aviso podia abrir fora da tela, atras do jogo, e a barra nao voltava enquanto ele estivesse aberto). */var bar=timerWindow as SessionBar;bool session=!locked;if(session&&bar!=null&&bar.Suppressed)bar.ForceRestore();bool previous=maintenanceDialogOpen;if(!session)maintenanceDialogOpen=true;try{Files.LogFullscreen("BARRA: tentativa de fechar (Alt+F4) bloqueada");closeWarning();}finally{maintenanceDialogOpen=previous;showingCloseWarning=false;}}
 void OnClosing(object sender,FormClosingEventArgs e){if(!allowedExit&&!adminSession&&e.CloseReason!=CloseReason.WindowsShutDown){e.Cancel=true;ShowCloseWarning();return;}heartbeatStop=true;Guardian.Stop();closing=true;StopForegroundWatch();poll.Stop();clock.Stop();secondsTick.Stop();if(hook!=IntPtr.Zero)UnhookWindowsHookEx(hook);try{restorePolicies(settings);}catch{}loyaltyQueue.Clear();if(loyaltyToast!=null)loyaltyToast.Close();foreach(var cover in covers)cover.Close();covers.Clear();allowedExit=true;timerWindow.Close();}
}
class AutoSetup : Form {
 Label status=new Label(),details=new Label();ListBox servers=new ListBox();Button search=new Button(),choose=new Button(),import=new Button();
 System.Windows.Forms.Timer poll=new System.Windows.Forms.Timer{Interval=3000};bool busy=false;Settings candidate;string secret,device=Guid.NewGuid().ToString("N");public Settings Result;
 List<Settings> found=new List<Settings>();Transport discoveryTransport=new Transport(new Settings{server="https://127.0.0.1:3443",fingerprint=new string('0',64),token=new string('0',64)});
 public AutoSetup(){
  Text="GameZoney · Encontrar servidor";Width=670;Height=470;StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;
  BackColor=Color.FromArgb(16,18,23);ForeColor=Color.White;Font=new Font("Segoe UI",10);
  var executableIcon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);if(executableIcon!=null)Icon=executableIcon;
  status.SetBounds(22,20,605,55);status.Font=new Font("Segoe UI",15,FontStyle.Bold);status.Text="Procurando o servidor da recepção…";
  servers.SetBounds(22,85,605,95);servers.BackColor=Color.FromArgb(29,32,39);servers.ForeColor=Color.White;
  details.SetBounds(22,195,605,130);details.Text="Mantenha o servidor aberto e os computadores na mesma rede local da arena.";
  search.SetBounds(22,340,170,40);search.Text="Procurar novamente";search.ForeColor=Color.Black;search.Click+=async(a,e)=>await Search();
  choose.SetBounds(207,340,210,40);choose.Text="Conectar ao selecionado";choose.ForeColor=Color.Black;choose.Enabled=false;choose.Click+=async(a,e)=>await SelectServer();
  import.SetBounds(22,385,605,30);import.Text="Alternativa: importar arquivo da recepção";import.ForeColor=Color.Black;import.Click+=(a,e)=>Import();
  foreach(var button in new[]{search,choose,import}){button.BackColor=Color.FromArgb(225,228,234);button.UseVisualStyleBackColor=false;}
  Controls.AddRange(new Control[]{status,servers,details,search,choose,import});Shown+=async(a,e)=>await Search();poll.Tick+=async(a,e)=>await Request();FormClosed+=(a,e)=>poll.Stop();
  var bytes=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(bytes);secret=BitConverter.ToString(bytes).Replace("-","").ToLowerInvariant();
 }
 public static Settings Run(){using(var form=new AutoSetup()){return form.ShowDialog()==DialogResult.OK?form.Result:null;}}
 string Code(){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes("display:"+secret))).Replace("-","").Substring(0,8);}
 async Task Search(){if(busy)return;poll.Stop();candidate=null;busy=true;search.Enabled=choose.Enabled=import.Enabled=false;status.Text="Procurando o servidor na rede…";servers.Items.Clear();found.Clear();
  try{var r=await Task.Run(()=>discoveryTransport.Post("discover",new {}));if(IsDisposed)return;
   foreach(var item in (System.Collections.IEnumerable)r["servers"]){var d=(Dictionary<string,object>)item;var s=new Settings{server=Convert.ToString(d["server"]),fingerprint=Convert.ToString(d["fingerprint"]),token=new string('0',64),device=device};found.Add(s);servers.Items.Add(Convert.ToString(d["name"])+" — "+s.server);}
   status.Text=found.Count==0?"Servidor não encontrado.":"Servidor encontrado.";details.Text=found.Count==0?"Abra o servidor 2.2 na recepção. Confira a mesma rede e a liberação de 3444/UDP e 3443/TCP no firewall da recepção. Redes de visitantes podem impedir a descoberta.":"Selecione a recepção correta. A autorização será solicitada pelo painel do servidor.";if(found.Count>0)servers.SelectedIndex=0;
  }catch(Exception e){if(!IsDisposed)status.Text=e.Message;}finally{busy=false;if(!IsDisposed){search.Enabled=import.Enabled=true;choose.Enabled=found.Count>0;}}
  if(!IsDisposed&&found.Count==1)await SelectServer();
 }
 async Task SelectServer(){if(busy||servers.SelectedIndex<0)return;candidate=found[servers.SelectedIndex];search.Enabled=choose.Enabled=import.Enabled=false;servers.Enabled=false;status.Text="Registrando este computador no servidor…";details.Text="Nome do PC: "+Environment.MachineName+"\nCódigo de conferência: "+Code()+"\n\nA tela principal será aberta e ficará aguardando a autorização da recepção.";await Request();}
 async Task Request(){if(busy||candidate==null)return;busy=true;var selected=candidate;
  try{var result=await Task.Run(()=>new Transport(selected).Post("setup",new {device=device,secret=secret,name=Environment.MachineName}));if(IsDisposed)return;
   string state=Convert.ToString(result["status"]);if(state=="rejected"){status.Text="Pedido recusado pela recepção.";details.Text="Selecione o servidor novamente para gerar uma nova solicitação.";servers.Enabled=true;search.Enabled=import.Enabled=true;choose.Enabled=found.Count>0;return;}
   selected.setupDevice=device;selected.setupSecret=secret;selected.stationName=Environment.MachineName;
   if(state=="approved"){
    string verification=selected.fingerprint.Substring(0,12).ToUpperInvariant();
    if(MessageBox.Show(this,"Máquina já aprovada. Confira na recepção a identidade do servidor:\n\n"+verification+"\n\nContinuar com este servidor?","Conferir servidor GameZoney",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes){status.Text="Identidade não confirmada.";return;}
    selected.token=Convert.ToString(result["token"]);selected.stationName=Convert.ToString(result["stationName"]);selected.setupDevice=null;selected.setupSecret=null;
   }
   Files.Validate(selected);Result=selected;DialogResult=DialogResult.OK;Close();
  }catch(Exception e){if(!IsDisposed){status.Text="Sem resposta: "+e.Message;servers.Enabled=true;search.Enabled=import.Enabled=true;choose.Enabled=found.Count>0;}}finally{busy=false;}
 }
 void Import(){if(busy)return;using(var file=new OpenFileDialog{Title="Associação da recepção",Filter="Associação GameZoney (*.json)|*.json"}){if(file.ShowDialog()!=DialogResult.OK)return;try{var s=Files.Json.Deserialize<Settings>(File.ReadAllText(file.FileName));Files.Validate(s);s.device=device;Result=s;DialogResult=DialogResult.OK;Close();}catch(Exception e){MessageBox.Show(this,e.Message,"GameZoney");}}}
}
public static class Guardian {
 static EventWaitHandle stop,administrator,pulse;
 public static void Attach(string key){if(key.Length!=32||!System.Text.RegularExpressions.Regex.IsMatch(key,"^[a-f0-9]+$"))throw new Exception("Identidade do monitor inválida.");Exception last=null;for(int i=0;i<20;i++){try{stop=EventWaitHandle.OpenExisting("Local\\GameZoney.Stop."+key);administrator=EventWaitHandle.OpenExisting("Local\\GameZoney.Admin."+key);pulse=EventWaitHandle.OpenExisting("Local\\GameZoney.Pulse."+key);return;}catch(WaitHandleCannotBeOpenedException e){last=e;Thread.Sleep(100);}}throw new Exception("Não foi possível conectar ao Monitor GameZoney. Tente iniciar o cliente novamente.",last);}
 public static void Launch(string[] args){var info=new ProcessStartInfo(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"MonitorGZ.exe"),args.Length>0&&args[0]=="/reconfigure"?"/reconfigure":""){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden};Process.Start(info);}
 public static void Start(){if(stop==null||administrator==null||pulse==null)throw new Exception("Abra o cliente pelo Monitor GameZoney.");administrator.Reset();stop.Reset();}
 public static void SetAdministrator(bool enabled){if(administrator==null)return;if(enabled)administrator.Set();else administrator.Reset();}
 public static void Pulse(){try{if(pulse!=null)pulse.Set();}catch{}}
 public static void Stop(){if(stop!=null)stop.Set();}
}

class Program {
 static void CreateHandles(Control control){var handle=control.Handle;foreach(Control child in control.Controls)CreateHandles(child);control.PerformLayout();}
 [STAThread]static int Main(string[] args){ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
  try{if(args.Length>0&&args[0]=="/render-bar"){Application.EnableVisualStyles();using(var bar=new SessionBar()){bar.Bounds=new Rectangle(0,0,1024,48);bar.TimeLabel.Text="00:26:56";bar.SetMember("yves","PC 01 • 150 medalhas");CreateHandles(bar);using(var bitmap=new Bitmap(bar.Width,bar.Height)){bar.DrawToBitmap(bitmap,new Rectangle(0,0,bar.Width,bar.Height));bitmap.Save(args[1],System.Drawing.Imaging.ImageFormat.Png);}}return 0;}if(args.Length>0&&args[0]=="/policy-test"){ControlPanelPolicy.SelfTest();MachinePolicies.SelfTest();LoginKeys.SelfTest();SessionSecurity.SelfTest();File.WriteAllText(args[1],"PASS: preservação de política ausente, desabilitada e habilitada; aplicação repetida; restauração sem tocar no Registro real.");return 0;}if(args.Length>0&&args[0]=="/render-setup"){Application.EnableVisualStyles();using(var form=new AutoSetup()){CreateHandles(form);using(var bitmap=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(bitmap,new Rectangle(0,0,form.Width,form.Height));bitmap.Save(args[1],System.Drawing.Imaging.ImageFormat.Png);}}return 0;}if(args.Length>0&&args[0]=="/render"){Application.EnableVisualStyles();var settings=new Settings{server="https://127.0.0.1:3443",fingerprint=new String('0',64),token=new String('0',64),stationName="PC 01 • GameZoney"};using(var form=new ClientForm(settings,true)){form.Size=new Size(1280,800);CreateHandles(form);form.PerformLayout();using(var bitmap=new Bitmap(1280,800)){form.DrawToBitmap(bitmap,new Rectangle(0,0,1280,800));bitmap.Save(args[1],System.Drawing.Imaging.ImageFormat.Png);}}return 0;}if(args.Length>0&&args[0]=="/selftest"){SummaryWindow.SelfTest();FullscreenDetector.SelfTest();ConnectionDoctor.SelfTest();LoginPaint.SelfTest();var b=new TimeBudget();b.Update("test",120,1000);if(b.Left(31000)!=90||!b.Online(9999)||b.Online(10000))throw new Exception("Falha no relógio monotônico/conexão");b.Update("test",91,31000);if(Math.Abs(b.Left(31000)-90.1)>0.001)throw new Exception("Falha: sincronização pequena deve ser suave");b.Update("test",690,31000);if(b.Left(31000)!=690)throw new Exception("Falha: tempo adicionado deve aparecer na hora");b.Update("outra",50,32000);if(b.Left(32000)!=50)throw new Exception("Falha: nova sessão");string hash=Files.Hash("Senha-teste-123");if(!Files.Verify("Senha-teste-123",hash)||Files.Verify("errada",hash))throw new Exception("Falha na senha");File.WriteAllText(args[1],"PASS: relógio monotônico, bloqueio após perda de contato, senha de manutenção.");return 0;}
   if(args.Length>0&&args[0]=="/probe"){var s=Files.Json.Deserialize<Settings>(File.ReadAllText(args[1]));File.WriteAllText(args[2],Files.Json.Serialize(new Transport(s).Post("state",new {})));return 0;}
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   if(args.Length>=2&&args[0]=="/supervised"){Guardian.Attach(args[1]);var rest=new string[args.Length-2];Array.Copy(args,2,rest,0,rest.Length);args=rest;}else if(args.Length==0||args[0]=="/reconfigure"){Guardian.Launch(args);return 0;}
   bool recovery=args.Length>0&&args[0]=="/recover";
   if(recovery){if(!File.Exists(Files.ConfigPath))return 0;var s=Files.Load();if(!ClientForm.AuthorizeAdministrator(s,"restaurar os acessos do Windows"))return 1;MachinePolicies.Restore(s);MessageBox.Show("Restrição restaurada. Se o cliente estiver aberto, entre como administrador e feche o aplicativo antes de desinstalar.");return 0;}
   bool created;using(var mutex=new Mutex(true,"Local\\GameZoneyCliente",out created)){if(!created){if(args.Length>0&&args[0]=="/reconfigure")MessageBox.Show("Entre como administrador (botão Entrar) e feche o cliente antes de reconfigurar.");return 0;}
    if(args.Length>0&&args[0]=="/reconfigure"&&File.Exists(Files.ConfigPath)){var old=Files.Load();if(!ClientForm.AuthorizeAdministrator(old,"reconfigurar este computador"))return 1;if(MessageBox.Show("Reconfigurar a conexão? Será necessária uma nova autorização no servidor.","GameZoney",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return 0;MachinePolicies.Restore(old);File.Move(Files.ConfigPath,Files.ConfigPath+".previous-"+Guid.NewGuid().ToString("N"));}
    Settings settings;if(File.Exists(Files.ConfigPath))settings=Files.Load();else{settings=AutoSetup.Run();if(settings==null)return 0;if(String.IsNullOrEmpty(settings.device)&&String.IsNullOrEmpty(settings.setupDevice))settings.device=Guid.NewGuid().ToString("N");Files.Save(settings);}
    using(var form=new ClientForm(settings)){Guardian.Start();Application.Run(form);Guardian.Stop();}mutex.ReleaseMutex();
   }return 0;
  }catch(Exception e){if(args.Length>0&&(args[0]=="/probe"||args[0]=="/selftest"||args[0]=="/policy-test")){File.WriteAllText(args[args.Length-1],"ERROR: "+e.ToString());return 1;}MessageBox.Show(e.Message,"GameZoney Cliente",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
 }
}
