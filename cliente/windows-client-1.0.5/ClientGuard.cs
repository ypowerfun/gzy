using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Reflection;
[assembly: AssemblyTitle("MonitorGZ")]
[assembly: System.Reflection.AssemblyCompany("GameZoney")]
[assembly: System.Reflection.AssemblyProduct("GameZoney")]
[assembly: System.Reflection.AssemblyDescription("GameZoney Cliente - monitor")]
[assembly: System.Reflection.AssemblyCopyright("© 2026 GameZoney. Todos os direitos reservados.")]
[assembly: System.Reflection.AssemblyTrademark("GameZoney")]
[assembly: AssemblyVersion("1.0.18.0")]
class ClientGuard {
 static void Log(string message){try{string dir=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"GameZoneyCliente");Directory.CreateDirectory(dir);string file=Path.Combine(dir,"monitor.log");if(File.Exists(file)&&new FileInfo(file).Length>262144)File.Delete(file);File.AppendAllText(file,DateTime.UtcNow.ToString("o")+" "+message+Environment.NewLine);}catch{}}
 // 1.0.14: MANUTENÇÃO DO WINDOWS. Ao entrar no Windows o MonitorGZ é aberto pela entrada de inicialização (HKLM Run) e pela
 // tarefa agendada "GameZoney Cliente", as duas com /autostart. Se o administrador DESABILITAR "GameZoneyCliente" em
 // Gerenciador de Tarefas › Inicializar (ou em Configurações › Aplicativos › Inicialização), o Windows grava isso em
 // HKLM\...\Explorer\StartupApproved\Run (só administrador consegue mudar entradas do HKLM; o cliente comum não) e aqui o
 // MonitorGZ fecha sem abrir o GameZoney Cliente. Antes, a tarefa agendada abria o cliente mesmo com a entrada desabilitada.
 // Aberto pelo atalho (sem /autostart) funciona normal. Para voltar: Habilitar de novo a entrada (ou reinstalar o Cliente).
 static bool StartupDisabled(){try{using(var hklm=Microsoft.Win32.RegistryKey.OpenBaseKey(Microsoft.Win32.RegistryHive.LocalMachine,Environment.Is64BitOperatingSystem?Microsoft.Win32.RegistryView.Registry64:Microsoft.Win32.RegistryView.Default))foreach(var sub in new[]{"Run","Run32"})using(var k=hklm.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\"+sub)){var b=k==null?null:k.GetValue("GameZoneyCliente") as byte[];if(b!=null&&b.Length>0&&(b[0]&1)==1)return true;}}catch{}return false;}
 static int Main(string[] args){try{try{Process.GetCurrentProcess().PriorityClass=ProcessPriorityClass.High;}catch{}
  if(args.Length==1&&args[0]=="/autostart"){if(StartupDisabled()){Log("Inicialização do GameZoney Cliente DESABILITADA no Windows (Gerenciador de Tarefas › Inicializar): o cliente não abre (manutenção). Para voltar, habilite a entrada GameZoneyCliente.");return 0;}args=new string[0];}
  if(args.Length>1||args.Length==1&&args[0]!="/reconfigure")return 1;
  bool created;using(var mutex=new Mutex(true,"Local\\GameZoney.Supervisor",out created)){
   if(!created)return 0;
   string root=AppDomain.CurrentDomain.BaseDirectory,exe=Path.Combine(root,"GameZoneyCliente.exe"),extra=args.Length==1?" /reconfigure":"";int delay=2;
   for(;;){string key=Guid.NewGuid().ToString("N");
    using(var stop=new EventWaitHandle(false,EventResetMode.ManualReset,"Local\\GameZoney.Stop."+key))
    using(var admin=new EventWaitHandle(false,EventResetMode.ManualReset,"Local\\GameZoney.Admin."+key))
    using(var pulse=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\GameZoney.Pulse."+key)){
     var start=new ProcessStartInfo(exe,"/supervised "+key+extra){WorkingDirectory=root,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden};
     var uptime=Stopwatch.StartNew();bool watchdogRestart=false,pulseSeen=false;var pulseAge=Stopwatch.StartNew();pulseAge.Reset();
     using(var process=Process.Start(start)){if(process==null)throw new Exception("Não foi possível abrir o cliente.");try{process.PriorityClass=ProcessPriorityClass.High;}catch{}
      Log("Cliente iniciado. PID="+process.Id);
      while(!process.HasExited){
       if(stop.WaitOne(0))return 0;
       if(admin.WaitOne(0)){Thread.Sleep(500);continue;}
       if(pulse.WaitOne(500)){pulseSeen=true;if(pulseAge.IsRunning)pulseAge.Restart();else pulseAge.Start();continue;}
       if(process.HasExited)break;
       // O watchdog usa um pulso emitido pela thread da interface. Isso evita reinícios falsos
       // causados pela antiga checagem de resposta do processo, janelas ocultas, jogos em tela cheia ou diálogos.
       // 2.0.21: tolerancia de 20 s. A verificacao pesada saiu da interface e o servidor recebe batimento
       // independente; reiniciar o cliente cedo demais era o que derrubava sessoes validas.
       bool stalled=pulseSeen?pulseAge.ElapsedMilliseconds>=20000:uptime.ElapsedMilliseconds>=20000;
       if(stalled){watchdogRestart=true;Log(pulseSeen?"Interface sem pulso por 20 segundos; reiniciando cliente.":"Cliente não concluiu a inicialização em 20 segundos; reiniciando.");try{process.Kill();}catch{}try{process.WaitForExit(3000);}catch{}break;}
      }
      try{Log("Cliente encerrado. ExitCode="+(process.HasExited?process.ExitCode:-1));}catch{}
     }
     if(stop.WaitOne(0))return 0;
     if(admin.WaitOne(0))return 0;
     if(uptime.ElapsedMilliseconds>=60000)delay=2;
     int wait=watchdogRestart?1:delay;
     if(stop.WaitOne(wait*1000)||admin.WaitOne(0))return 0;
     Log(watchdogRestart?"Cliente reiniciado pelo watchdog local.":"Cliente encerrado inesperadamente; reiniciando em modo usuário após "+wait+" segundos.");
     delay=watchdogRestart?2:Math.Min(10,delay*2);extra="";
    }
   }
  }
 }catch(Exception e){Log("Falha no monitor: "+e.ToString());return 1;}}
}
