using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.Threading;
using System.Text;
using System.Runtime.InteropServices;

// Protecoes aplicadas somente durante uma sessao de cliente.
// O cronometro do GameZoney usa Stopwatch/uptime monotonic; mudar o relogio do Windows nao altera o tempo da sessao.
public static class SessionSecurity {
 static readonly HashSet<string> ExactBlocked=new HashSet<string>(StringComparer.OrdinalIgnoreCase){
  "cheatengine","cheatengine-x86_64","cheatengine-i386","ceserver"
 };
 // 2.0.24: bloqueios configurados pelo servidor (Configuracao das maquinas).
 // Painel de Controle e Configuracoes: control.exe e o app Configuracoes.
 // Data e hora: applet timedate e o app Configuracoes (onde fica a pagina Data e hora; o Windows nao permite
 // ocultar apenas essa pagina sem permissao de administrador). A janela classica "Data e Hora" tambem e fechada.
 static readonly string[] PanelNames={"control","systemsettings","systemsettingsadminflows"};
 static readonly string[] DateTimeNames={"timedate","systemsettings","systemsettingsadminflows"};
 static volatile bool blockPanel=true,blockDateTime=true;static volatile int configVersion;
 public static void Configure(bool panel,bool dateTime){if(panel==blockPanel&&dateTime==blockDateTime)return;blockPanel=panel;blockDateTime=dateTime;configVersion++;}
 public static bool IsBlockedName(string name,bool panel,bool dateTime){name=(name??"").Trim();if(ExactBlocked.Contains(name)||name.StartsWith("cheatengine",StringComparison.OrdinalIgnoreCase))return true;foreach(string n in PanelNames)if(panel&&String.Equals(n,name,StringComparison.OrdinalIgnoreCase))return true;foreach(string n in DateTimeNames)if(dateTime&&String.Equals(n,name,StringComparison.OrdinalIgnoreCase))return true;return false;}
 static readonly HashSet<string> DateTimeTitles=new HashSet<string>(StringComparer.OrdinalIgnoreCase){"Data e Hora","Data e hora","Date and Time","Fecha y hora","Ajustar data e hora"};
 delegate bool EnumProc(IntPtr h,IntPtr l);
 [DllImport("user32.dll")]static extern bool EnumWindows(EnumProc cb,IntPtr l);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr h,StringBuilder b,int max);
 [DllImport("user32.dll")]static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
 static void CloseDateTimeWindows(){try{EnumWindows((h,l)=>{if(IsWindowVisible(h)){var b=new StringBuilder(128);if(GetWindowText(h,b,b.Capacity)>0&&DateTimeTitles.Contains(b.ToString().Trim()))PostMessage(h,0x0010,IntPtr.Zero,IntPtr.Zero);}return true;},IntPtr.Zero);}catch{}}
 static bool TextMatches(string value){if(String.IsNullOrEmpty(value))return false;value=value.ToLowerInvariant();return value.Contains("cheat engine")||value.Contains("cheatengine");}
 public static bool IsBlockedIdentity(string processName,string productName,string description,string companyName){
  string name=(processName??"").Trim();if(ExactBlocked.Contains(name)||name.StartsWith("cheatengine",StringComparison.OrdinalIgnoreCase))return true;
  return TextMatches(productName)||TextMatches(description)||TextMatches(companyName);
 }
 static bool IsBlocked(Process p){
  string name="";try{name=p.ProcessName??"";}catch{return false;}
  if(IsBlockedName(name,blockPanel,blockDateTime))return true;
  try{string file=p.MainModule.FileName;var info=FileVersionInfo.GetVersionInfo(file);return IsBlockedIdentity(name,info.ProductName,info.FileDescription,info.CompanyName);}catch{return false;}
 }
 static void Terminate(Process p){try{var info=new ProcessStartInfo(Environment.GetFolderPath(Environment.SpecialFolder.System)+"\\taskkill.exe","/F /T /PID "+p.Id){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden};using(var killer=Process.Start(info)){if(killer!=null)killer.WaitForExit(1500);}}catch{try{p.Kill();}catch{}}}
 // 2.0.21: a varredura saiu da thread da interface. Antes ela lia o modulo e a versao de TODOS os
 // processos a cada 750 ms na thread da barra; com jogos abertos isso travava a interface, o pulso do
 // MonitorGZ parava e o cliente era reiniciado (encerrando a sessao mesmo com o servidor ligado).
 // Agora roda em segundo plano e cada processo ja verificado nao e relido.
 static readonly object gate=new object();static volatile bool active;static Thread worker;
 static readonly Dictionary<int,string> cleared=new Dictionary<int,string>();
 public static void Enforce(bool sessionActive){
  active=sessionActive;if(!sessionActive||worker!=null)return;
  lock(gate){if(worker!=null)return;worker=new Thread(Loop){IsBackground=true,Name="GameZoney.SessionSecurity",Priority=ThreadPriority.BelowNormal};worker.Start();}
 }
 static void Loop(){int seenVersion=configVersion;for(;;){try{if(seenVersion!=configVersion){seenVersion=configVersion;cleared.Clear();}if(active){Scan();if(blockDateTime)CloseDateTimeWindows();}else cleared.Clear();}catch{}Thread.Sleep(1000);}}
 static void Scan(){
  var alive=new HashSet<int>();
  foreach(var p in Process.GetProcesses()){try{int id=p.Id;alive.Add(id);string name;try{name=p.ProcessName??"";}catch{continue;}string known;if(cleared.TryGetValue(id,out known)&&known==name)continue;if(IsBlocked(p))Terminate(p);else cleared[id]=name;}catch{}finally{try{p.Dispose();}catch{}}}
  var stale=new List<int>();foreach(int id in cleared.Keys)if(!alive.Contains(id))stale.Add(id);foreach(int id in stale)cleared.Remove(id);
 }
 public static void SelfTest(){
  if(!IsBlockedIdentity("cheatengine-x86_64","","","")||!IsBlockedIdentity("renamed","Cheat Engine 7.5","","")||!IsBlockedIdentity("renamed","","CheatEngine debugger","")||IsBlockedIdentity("steam","Steam","Steam Client","Valve"))throw new Exception("Falha no bloqueio do Cheat Engine");
  if(!IsBlockedName("timedate",false,true)||IsBlockedName("timedate",true,false)||!IsBlockedName("control",true,false)||IsBlockedName("control",false,true)||!IsBlockedName("SystemSettings",false,true)||IsBlockedName("SystemSettings",false,false)||!IsBlockedName("cheatengine-x86_64",false,false))throw new Exception("Falha nos bloqueios de Painel/Data e hora");
 }
}
