using System;
using System.IO;
using System.Collections.Generic;
// 2.0.59: fim de sessao com jogo protegido por anticheat (ex.: FortniteClient-Win64-Shipping_EAC_EOS, "Acesso negado").
// Antes: "Limpeza pendente. Procure a recepcao" e o PC ficava bloqueado. Agora: processo protegido SEM janela nao bloqueia;
// com janela, o cliente pede para fechar e so bloqueia se a janela continuar aberta. Uso: ProtectedCleanupRegression.exe <pasta>
public class ProtectedCleanupRegression {
 static void Check(bool ok,string message){if(!ok)throw new Exception("FALHOU: "+message);}
 class Pc {
  public List<CleanupProcess> processes=new List<CleanupProcess>();public HashSet<string> protectedNames=new HashSet<string>();public HashSet<string> closesOnRequest=new HashSet<string>();public List<string> killed=new List<string>(),asked=new List<string>();
  public SessionCleanup Cleaner(string dir){var c=new SessionCleanup(dir,dir,dir,()=>new List<CleanupProcess>(processes),p=>{if(protectedNames.Contains(p.name))throw new ProcessProtectedException("Acesso negado");killed.Add(p.name);processes.RemoveAll(x=>x.Key==p.Key);});
   c.ProtectedWaitMs=400;c.CloseWindows=p=>{asked.Add(p.name);if(closesOnRequest.Contains(p.name))processes.RemoveAll(x=>x.Key==p.Key);};return c;}
 }
 static long t0=DateTime.UtcNow.AddMinutes(-5).Ticks;
 static SessionCleanup Session(Pc pc,string dir){pc.processes.Add(new CleanupProcess{pid=1,started=t0,name="explorer",visible=true});var c=pc.Cleaner(dir);c.Begin("s1");return c;}
 public static int Main(string[] args){try{
  string root=Path.GetFullPath(args.Length>0?args[0]:Path.Combine(Path.GetTempPath(),"gz-protected-cleanup-"+Guid.NewGuid().ToString("N")));
  long during=DateTime.UtcNow.AddSeconds(1).Ticks;
  // 1) caso da foto: o jogo fecha, o EAC_EOS (sem janela, filho do launcher) da "Acesso negado" e continua aberto -> PC liberado
  {string dir=Path.Combine(root,"1");var pc=new Pc();var c=Session(pc,dir);
   pc.processes.Add(new CleanupProcess{pid=10,started=during,name="EpicGamesLauncher",visible=true});
   pc.processes.Add(new CleanupProcess{pid=11,parent=10,started=during+1,name="FortniteClient-Win64-Shipping_EAC_EOS",visible=false});
   pc.processes.Add(new CleanupProcess{pid=12,parent=11,started=during+2,name="FortniteClient-Win64-Shipping",visible=true});
   c.Observe();pc.protectedNames.Add("FortniteClient-Win64-Shipping_EAC_EOS");
   c.Clean();
   Check(!c.Pending,"processo protegido SEM janela nao pode bloquear o PC");
   Check(pc.killed.Contains("FortniteClient-Win64-Shipping")&&pc.killed.Contains("EpicGamesLauncher"),"jogo e launcher devem fechar: "+String.Join(",",pc.killed));
   Check(!pc.killed.Contains("explorer"),"explorer (antes do login) deve ficar");
   string log=Path.Combine(dir,"session-cleanup.log");Check(File.Exists(log)&&File.ReadAllText(log).Contains("FortniteClient-Win64-Shipping_EAC_EOS"),"o processo deixado aberto deve ficar anotado no session-cleanup.log");}
  // 2) jogo protegido COM janela: o cliente pede para fechar (como o X) e o jogo fecha -> PC liberado
  {string dir=Path.Combine(root,"2");var pc=new Pc();var c=Session(pc,dir);
   pc.processes.Add(new CleanupProcess{pid=20,started=during,name="GameProtegido",visible=true});c.Observe();
   pc.protectedNames.Add("GameProtegido");pc.closesOnRequest.Add("GameProtegido");
   c.Clean();Check(!c.Pending,"jogo protegido que fecha ao pedido deve liberar o PC");Check(pc.asked.Contains("GameProtegido"),"deveria pedir para fechar a janela");}
  // 3) jogo protegido COM janela que nao fecha: continua bloqueando (o jogo do cliente anterior esta na tela), com o motivo claro
  {string dir=Path.Combine(root,"3");var pc=new Pc();var c=Session(pc,dir);
   pc.processes.Add(new CleanupProcess{pid=30,started=during,name="GameTeimoso",visible=true});c.Observe();pc.protectedNames.Add("GameTeimoso");
   string message=null;try{c.Clean();}catch(IOException e){message=e.Message;}
   Check(message!=null&&message.Contains("não deixa o GameZoney fechar GameTeimoso"),"janela protegida aberta deve bloquear com o motivo: "+message);Check(c.Pending,"limpeza deve continuar pendente");
   pc.processes.RemoveAll(p=>p.name=="GameTeimoso");c.Clean();Check(!c.Pending,"quando a janela fechar, a proxima tentativa libera o PC");}
  // 4) programa comum que nao fecha (sem ser protegido): continua bloqueando como antes
  {string dir=Path.Combine(root,"4");var pc=new Pc();var c=new SessionCleanup(dir,dir,dir,()=>new List<CleanupProcess>(pc.processes),p=>{throw new IOException("O processo não encerrou.");});c.ProtectedWaitMs=400;
   pc.processes.Add(new CleanupProcess{pid=1,started=t0,name="explorer",visible=true});c.Begin("s4");pc.processes.Add(new CleanupProcess{pid=40,started=during,name="Travado",visible=true});c.Observe();
   string message=null;try{c.Clean();}catch(IOException e){message=e.Message;}Check(message!=null&&message.Contains("Programa ainda aberto: Travado"),"programa comum que nao fecha continua bloqueando: "+message);}
  Console.WriteLine("PASS: anticheat/processo protegido sem janela nao bloqueia o PC (fica anotado); jogo protegido recebe pedido de fechar; janela protegida aberta ainda bloqueia com o motivo; programa comum travado bloqueia como antes.");
  return 0;
 }catch(Exception e){Console.WriteLine(e);return 1;}}
}
