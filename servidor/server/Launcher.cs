using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;
using Microsoft.Win32;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.CompilerServices;
using System.Globalization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
[assembly: AssemblyTitle("GameZoney Servidor")]
[assembly: System.Reflection.AssemblyCompany("GameZoney")]
[assembly: System.Reflection.AssemblyProduct("GameZoney")]
[assembly: System.Reflection.AssemblyDescription("GameZoney Servidor - gestão de arenas gamer e lan houses")]
[assembly: System.Reflection.AssemblyCopyright("© 2026 GameZoney. Todos os direitos reservados.")]
[assembly: System.Reflection.AssemblyTrademark("GameZoney")]
[assembly: AssemblyVersion("1.3.8.0")]
class Launcher : ApplicationContext {
    Process child; NotifyIcon tray; System.Windows.Forms.Timer monitor;
    string token=Guid.NewGuid().ToString("N"), address, data; bool stopping=false;
    readonly object logLock=new object();
    // 3.0.68: painel em janela própria (PanelHost/PanelWindow, no fim deste arquivo).
    PanelHost panel; bool panelHintShown;
    static string root=AppDomain.CurrentDomain.BaseDirectory;
    static int MainCode=0;
    // 1.0.7: confere o SHA-256 de cada arquivo que o Node carrega (lista gerada e compilada junto na hora de montar o
    // instalador, em GzIntegrity.cs). Arquivo alterado, trocado ou faltando = o GameZoney não abre. Na versão de
    // desenvolvimento a lista vem vazia (GzIntegrity.dev.cs) e nada é conferido.
    static bool PortBusy(int port){
        try{foreach(var ep in System.Net.NetworkInformation.IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners())if(ep.Port==port)return true;return false;}
        catch{using(var probe=new TcpClient()){var result=probe.BeginConnect("127.0.0.1",port,null,null);return result.AsyncWaitHandle.WaitOne(400)&&probe.Connected;}}
    }
    static void CheckIntegrity(){
        var list=GzIntegrity.Files;if(list==null||list.Length==0)return;
        // 1.0.7: em paralelo (na 1ª abertura o antivírus examina cada arquivo e a conferência em fila demorava)
        string bad=null;
        System.Threading.Tasks.Parallel.For(0,list.Length/2,new System.Threading.Tasks.ParallelOptions{MaxDegreeOfParallelism=Math.Max(2,Math.Min(8,Environment.ProcessorCount))},()=>System.Security.Cryptography.SHA256.Create(),(k,state,sha)=>{
            if(bad!=null){state.Stop();return sha;}
            string rel=list[2*k],file=Path.Combine(root,rel.Replace('\\',Path.DirectorySeparatorChar)),hex="";
            try{using(var f=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete,1<<16))foreach(byte b in sha.ComputeHash(f))hex+=b.ToString("x2");}catch{}
            if(!String.Equals(hex,list[2*k+1],StringComparison.OrdinalIgnoreCase)){bad=rel;state.Stop();}
            return sha;},sha=>sha.Dispose());
        if(bad!=null)throw new Exception("Os arquivos do GameZoney Servidor foram alterados ou estão corrompidos ("+bad+").\n\nReinstale o GameZoney Servidor pelo instalador baixado em gamezoney.com (Minha conta › Downloads). Seus dados são mantidos.");
    }
    static void Open(string target) { Process.Start(new ProcessStartInfo(target){UseShellExecute=true}); }
    static void OpenPanel(string address) {
        string edge=FindEdge();
        if(edge!=null){Rectangle area=Screen.FromPoint(Cursor.Position).WorkingArea;string profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"GameZoney","painel-edge");try{Directory.CreateDirectory(profile);}catch{}
            // 3.0.26: perfil proprio do painel (sem extensoes, barra lateral ou traducao do perfil pessoal do Edge).
            Process.Start(new ProcessStartInfo(edge,"--app="+address+" --user-data-dir=\""+profile+"\" --no-first-run --no-default-browser-check --disable-features=Translate,msEdgeTranslate,msHubApps,msEdgeSidebarV2,EdgeShoppingAssistant --disable-pinch --new-window --start-maximized --window-position="+area.X+","+area.Y+" --window-size="+area.Width+","+area.Height){UseShellExecute=true});}
        else WebView2Setup.Missing();
    }
    /* 1.2.3: backups em Documentos\gamezoney\backup (antes Documentos\bkp gamezoney) */
    static string BackupFolder(){string docs=Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),now=Path.Combine(docs,"gamezoney","backup"),old=Path.Combine(docs,"bkp gamezoney");return Directory.Exists(now)||!Directory.Exists(old)?now:old;}
    static void Restore(string data){using(var dialog=new OpenFileDialog{Title="Restaurar backup completo GameZoney",Filter="Backup GameZoney (*.zip)|*.zip",InitialDirectory=BackupFolder()}){if(dialog.ShowDialog()!=DialogResult.OK)return;if(MessageBox.Show("Restaurar os dados desta cópia? Os dados atuais serão guardados em uma pasta anterior. Saldos e sessões voltarão ao momento do backup.","Restaurar GameZoney",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)return;var info=new ProcessStartInfo(Path.Combine(root,"BackupTool.exe"),"restore \""+dialog.FileName+"\" \""+data+"\""){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardError=true,RedirectStandardOutput=true};using(var process=Process.Start(info)){string output=process.StandardOutput.ReadToEnd(),error=process.StandardError.ReadToEnd();process.WaitForExit();if(process.ExitCode!=0)throw new Exception(error);MessageBox.Show(output+"\nAbra o servidor novamente.","Backup restaurado");}}}
    // 3.0.68: o Edge pode estar em Arquivos de Programas (x86), em Arquivos de Programas ou só registrado no Windows (App Paths).
    static string FindEdge(){
        foreach(string folder in new string[]{Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetEnvironmentVariable("ProgramW6432")}){
            if(String.IsNullOrEmpty(folder))continue;
            string edge=Path.Combine(folder,"Microsoft","Edge","Application","msedge.exe");if(File.Exists(edge))return edge;
        }
        foreach(RegistryKey hive in new RegistryKey[]{Registry.LocalMachine,Registry.CurrentUser}){
            try{using(var key=hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe")){string edge=key==null?null:key.GetValue("") as string;if(!String.IsNullOrEmpty(edge)&&File.Exists(edge))return edge;}}catch{}
        }
        return null;
    }
    // 3.0.68: ícone do GameZoney (gamezoney.ico com vários tamanhos, embutido no GameZoney.exe).
    static Icon AppIcon(Size size){
        try{using(var stream=typeof(Launcher).Assembly.GetManifestResourceStream("gamezoney.ico")){if(stream!=null)return new Icon(stream,size);}}catch{}
        try{return Icon.ExtractAssociatedIcon(Application.ExecutablePath);}catch{return null;}
    }
    void ShowPanel(){if(panel!=null)panel.Show();else OpenPanel(address);}
    void Log(string line) { if(line==null)return; lock(logLock) {try{File.AppendAllText(Path.Combine(data,"server.log"),DateTime.Now.ToString("s")+" "+line+Environment.NewLine);}catch{}} }
    string Request(string path,bool stop=false) {
        HttpWebRequest r=(HttpWebRequest)WebRequest.Create(address+path);r.Proxy=null;r.Timeout=1000;r.ReadWriteTimeout=1000;r.KeepAlive=false;
        if(stop){r.Method="POST";r.Headers["X-GZ-Control"]=token;r.ContentLength=0;}
        using(var response=r.GetResponse())using(var reader=new StreamReader(response.GetResponseStream()))return reader.ReadToEnd();
    }
    Launcher(string directory,int port,bool silent,bool selftest) {
        data=directory;address="http://127.0.0.1:"+port;
        Directory.CreateDirectory(data);string log=Path.Combine(data,"server.log");
        if(File.Exists(log)&&new FileInfo(log).Length>2000000)File.Copy(log,log+".previous",true);
        if(File.Exists(log)&&new FileInfo(log).Length>2000000)File.WriteAllText(log,"");
        // 1.3.2: porta ocupada? Consulta a lista de portas em escuta (instantâneo). Antes tentava conectar e, no Windows,
        // uma conexão recusada em 127.0.0.1 demora: a espera de 400 ms acontecia em TODA abertura.
        if(PortBusy(port))throw new Exception("A porta "+port+" está ocupada. Encerre a versão anterior do GameZoney e abra novamente.");
        if(!silent&&!selftest)Splash.Open();
        // 1.3.2: a conferência dos arquivos roda junto com a partida do Node (antes era um passo inteiro antes dele).
        // O painel só abre depois que ela termina; arquivo alterado = o Node é fechado e o GameZoney não abre, como antes.
        var integrity=System.Threading.Tasks.Task.Run(()=>CheckIntegrity());
        // 1.3.6: o motor do WebView2 (msedgewebview2) começa a abrir junto com o Node; antes só começava depois do servidor pronto
        if(!silent&&!selftest)PanelWindow.Prewarm(PanelHost.DefaultUserData());
        var info=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),"--disable-warning=ExperimentalWarning --disable-sigusr1 server.js");
        info.WorkingDirectory=root;info.UseShellExecute=false;info.CreateNoWindow=true;info.WindowStyle=ProcessWindowStyle.Hidden;info.RedirectStandardOutput=true;info.RedirectStandardError=true;
        // 1.0.7: nada de fora entra no Node (NODE_OPTIONS=--require..., NODE_PATH etc. permitiriam trocar a conferência da licença)
        var drop=new System.Collections.Generic.List<string>();foreach(string k in info.EnvironmentVariables.Keys)if(k.StartsWith("NODE_",StringComparison.OrdinalIgnoreCase)||k.StartsWith("UV_",StringComparison.OrdinalIgnoreCase))drop.Add(k);
        foreach(var k in drop)info.EnvironmentVariables.Remove(k);
        Environment.SetEnvironmentVariable("GZ_DATA_DIR",data);Environment.SetEnvironmentVariable("GZ_CONTROL_TOKEN",token);Environment.SetEnvironmentVariable("PORT",port.ToString());
        Environment.SetEnvironmentVariable("GZ_DOCUMENTS_DIR",Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments));
        if(selftest){Environment.SetEnvironmentVariable("GZ_NO_PC_TLS","1");Environment.SetEnvironmentVariable("GZ_NO_BACKUP","1");}
        child=new Process();child.StartInfo=info;var listening=new ManualResetEvent(false);child.OutputDataReceived+=(s,e)=>{if(e.Data!=null&&e.Data.StartsWith("GameZoney SERVER "))listening.Set();Log(e.Data);};child.ErrorDataReceived+=(s,e)=>Log(e.Data);
        child.Start();child.BeginOutputReadLine();child.BeginErrorReadLine();
        // 1.3.6: espera o aviso "GameZoney SERVER …" que o Node escreve ao abrir a porta e só então confere o /health.
        // No Windows, uma tentativa em 127.0.0.1 antes de a porta abrir fica parada até 1 s (conexão recusada demora) e
        // atrasava o painel. Sem o aviso (versão diferente), confere a cada 1 s como reserva. Enquanto espera, a tela
        // "Iniciando…" e o WebView2 continuam trabalhando (antes a janela ficava parada).
        bool ready=false;var clock=Stopwatch.StartNew();long nextProbe=1500;
        while(clock.ElapsedMilliseconds<60000){
            if(integrity.IsFaulted||child.HasExited)break;
            Application.DoEvents();
            bool heard=listening.WaitOne(15);
            if(!heard&&clock.ElapsedMilliseconds<nextProbe)continue;
            try{ready=Request("/health").Contains("gamezoney-server");}catch{}
            if(ready)break;
            if(heard)Thread.Sleep(50);else nextProbe=clock.ElapsedMilliseconds+1000;
        }
        if(ready)Log("Servidor pronto em "+clock.ElapsedMilliseconds+" ms.");
        // 1.3.6: a conferência dos arquivos não segura mais a abertura do painel (o Node já roda em paralelo desde a 1.3.2,
        // então esperar não protegia nada a mais). Se ela falhar depois, o Node é fechado na hora e o GameZoney sai com o erro.
        if(integrity.IsFaulted||selftest||!ready){try{integrity.Wait();}catch(AggregateException e){try{if(!child.HasExited){child.Kill();child.WaitForExit(3000);}}catch{}Splash.Close();throw e.InnerException??e;}}
        if(!ready){Stop();throw new Exception("O servidor não iniciou. Consulte o arquivo server.log na pasta de dados: "+data);}
        if(selftest){File.WriteAllText(Path.Combine(data,"launcher-selftest.txt"),Request("/health"));Stop();return;}
        var menu=new ContextMenuStrip();menu.Items.Add("Abrir GameZoney",null,(s,e)=>ShowPanel());/* 1.0.5: "Abrir no navegador" e "Abrir pasta de dados" retirados do menu */menu.Items.Add("Abrir diagnóstico",null,(s,e)=>Open(Path.Combine(data,"server.log")));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Encerrar servidor",null,(s,e)=>{if(MessageBox.Show("Encerrar o servidor? As TVs não serão controladas enquanto ele estiver fechado. O prazo das sessões continua correndo.","GameZoney",MessageBoxButtons.YesNo,MessageBoxIcon.Question)==DialogResult.Yes)ExitThread();});
        tray=new NotifyIcon();tray.Text="GameZoney • Servidor ativo";tray.Icon=AppIcon(SystemInformation.SmallIconSize);tray.ContextMenuStrip=menu;tray.Visible=true;tray.DoubleClick+=(s,e)=>ShowPanel();
        panel=new PanelHost(address,port,AppIcon(SystemInformation.IconSize),Log,OpenPanel);panel.Listen();
        panel.Hidden=()=>{if(panelHintShown||tray==null)return;panelHintShown=true;tray.ShowBalloonTip(6000,"GameZoney","O servidor continua ativo. Para abrir o painel de novo, use o ícone perto do relógio.",ToolTipIcon.Info);};
        SystemEvents.SessionEnding+=OnSessionEnding;
        monitor=new System.Windows.Forms.Timer();monitor.Interval=2000;monitor.Tick+=(s,e)=>{if(child.HasExited&&!stopping){monitor.Stop();/* 1.0.6: código 75 = o servidor fechou para instalar a atualização (Configuração › Verificar atualização): fecha sem aviso de erro */if(child.ExitCode==75){Log("Servidor fechado para instalar a atualização.");ExitThread();return;}MessageBox.Show("O servidor encerrou inesperadamente. Abra o GameZoney novamente e consulte o diagnóstico.","GameZoney",MessageBoxButtons.OK,MessageBoxIcon.Error);ExitThread();}};monitor.Start();
        if(!integrity.IsCompleted){var guard=new System.Windows.Forms.Timer();guard.Interval=150;guard.Tick+=(s,e)=>{if(!integrity.IsCompleted)return;guard.Stop();guard.Dispose();if(integrity.IsFaulted)IntegrityFailed(integrity.Exception.InnerException??integrity.Exception);};guard.Start();}
        Splash.Close();
        if(!silent)ShowPanel();
    }
    // 1.3.6: arquivo alterado descoberto depois que o painel abriu: fecha o Node na hora (sem encerramento normal), some com o painel e avisa.
    void IntegrityFailed(Exception e){
        if(stopping)return;stopping=true;MainCode=1;
        try{if(child!=null&&!child.HasExited){child.Kill();child.WaitForExit(3000);}}catch{}
        try{if(panel!=null)panel.Dispose();}catch{}
        try{if(tray!=null){tray.Visible=false;tray.Dispose();tray=null;}}catch{}
        try{Directory.CreateDirectory(data);File.AppendAllText(Path.Combine(data,"launcher-error.log"),DateTime.Now+" "+e+Environment.NewLine);}catch{}
        MessageBox.Show(e.Message,"GameZoney",MessageBoxButtons.OK,MessageBoxIcon.Error);
        ExitThread();
    }
    void OnSessionEnding(object sender,SessionEndingEventArgs e){SessionEnded=true;Stop();}
    public static bool SessionEnded,Ran;
    // 1.3.1: encerrar rápido e com aviso — pede o fim ao Node PRIMEIRO (ele fecha enquanto a janela do painel é descartada), some com o ícone na hora e mostra "Encerrando…"
    void Stop(){if(stopping)return;stopping=true;var watch=Stopwatch.StartNew();bool show=!SessionEnded&&tray!=null;try{if(tray!=null)tray.Visible=false;if(panel!=null){try{panel.HideNow();}catch{}}if(show)Splash.Open("Encerrando o servidor… aguarde alguns segundos.");if(child!=null&&!child.HasExited){try{Request("/internal/stop",true);}catch{}}if(panel!=null){try{panel.Dispose();}catch{}}if(child!=null&&!child.HasExited&&!child.WaitForExit(4000)){/* 1.3.1: mais de 4 s = força o fechamento (pedido do dono); a sessão continua contando e é retomada ao abrir */Log("Encerramento forçado após espera; sessões serão recuperadas ao iniciar.");try{child.Kill();child.WaitForExit(3000);}catch{}}Log("GameZoney encerrado em "+watch.ElapsedMilliseconds+" ms.");}finally{Splash.Close();if(tray!=null){tray.Visible=false;tray.Dispose();}}}
    protected override void ExitThreadCore(){SystemEvents.SessionEnding-=OnSessionEnding;if(monitor!=null)monitor.Stop();Stop();base.ExitThreadCore();}
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [STAThread] static int Main(string[] args){
        // 3.0.68: janela do painel, menus e mensagens nítidos em telas com escala de 125%/150%.
        try{SetProcessDPIAware();}catch{}
        bool selftest=Array.IndexOf(args,"/selftest")>=0,silent=Array.IndexOf(args,"/silent")>=0;
        int port=3000;string data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"GameZoney","data");
        for(int i=0;i<args.Length-1;i++){if(args[i]=="/data")data=args[i+1];if(args[i]=="/port")port=Int32.Parse(args[i+1]);}
        bool created;using(var mutex=new Mutex(true,"Local\\GameZoneyServer_"+port,out created)){
            if(!created){if(Array.IndexOf(args,"/restore")>=0){MessageBox.Show("Encerre o servidor pelo ícone ao lado do relógio antes de restaurar.","GameZoney");return 1;}if(!silent&&!selftest){/* 1.0.7: a 1ª abertura pode estar conferindo os arquivos e iniciando: espera até 90 s o painel ficar pronto */bool shown=false;for(int w=0;w<180&&!shown;w++){shown=PanelHost.SignalRunning(port);if(!shown)Thread.Sleep(500);}if(!shown)OpenPanel("http://127.0.0.1:"+port);}return 0;}
            Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
            if(Array.IndexOf(args,"/restore")>=0){try{Restore(data);}catch(Exception ex){MessageBox.Show(ex.Message,"Falha na restauração");return 1;}return 0;}
            try{var app=new Launcher(data,port,silent,selftest);if(!selftest){Ran=true;Application.Run(app);}}
            catch(Exception e){Splash.Close();MainCode=1;Directory.CreateDirectory(data);File.AppendAllText(Path.Combine(data,"launcher-error.log"),DateTime.Now+" "+e+Environment.NewLine);if(!selftest)MessageBox.Show(e.Message,"GameZoney",MessageBoxButtons.OK,MessageBoxIcon.Error);}
            mutex.ReleaseMutex();
        }
        // 1.1.3: atualização pendente (Configuração › Atualização do sistema › Instalar agora): o servidor acabou de ser
        // encerrado (botão do painel ou ícone ao lado do relógio) → oferece o instalador. Fica DEPOIS do using: o mutex precisa
        // estar fechado, senão o instalador acha que o GameZoney ainda está aberto (AppMutex).
        if(Ran&&!SessionEnded)PendingUpdate.Offer(data);
        return MainCode;
    }
}
// 1.2.6: componente WebView2 da Microsoft (janela própria do painel). O instalador já instala quando falta; se ainda faltar,
// o GameZoney oferece instalar na hora (instalador oficial guardado na pasta do programa). Sem ele e sem o Edge, o painel
// NÃO abre no navegador padrão (Internet Explorer/Brave etc. não mostram o painel e o dono quer só a janela do GameZoney).
static class WebView2Setup {
    const string Id=@"\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    static bool Has(RegistryHive hive,RegistryView view,string path){try{using(var root=RegistryKey.OpenBaseKey(hive,view))using(var k=root.OpenSubKey(path)){string v=k==null?null:k.GetValue("pv") as string;return !String.IsNullOrEmpty(v)&&v!="0.0.0.0";}}catch{return false;}}
    public static bool Installed(){
        foreach(var view in new[]{RegistryView.Registry64,RegistryView.Registry32}){if(Has(RegistryHive.LocalMachine,view,@"SOFTWARE\WOW6432Node"+Id)||Has(RegistryHive.LocalMachine,view,@"SOFTWARE"+Id))return true;}
        return Has(RegistryHive.CurrentUser,RegistryView.Default,@"Software"+Id);
    }
    static string SetupFile(){string f=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"MicrosoftEdgeWebview2Setup.exe");return File.Exists(f)?f:null;}
    public static bool Install(Action<string> log){
        string exe=SetupFile();if(exe==null){log("Painel: WebView2 ausente e sem o instalador da Microsoft na pasta do programa.");return false;}
        if(MessageBox.Show("Para abrir o painel na janela própria do GameZoney, este computador precisa do componente WebView2 da Microsoft (o mesmo que já vem no Windows 10 e 11).\n\nInstalar agora? Precisa de internet e leva alguns minutos.","GameZoney Servidor",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return false;
        using(var wait=new Form{Text="GameZoney Servidor",FormBorderStyle=FormBorderStyle.FixedDialog,StartPosition=FormStartPosition.CenterScreen,ClientSize=new Size(460,110),ControlBox=false,TopMost=true,ShowInTaskbar=true}){
            wait.Controls.Add(new Label{Text="Instalando o componente WebView2 da Microsoft…\nAguarde: o painel abre sozinho quando terminar.",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleCenter,Font=new Font("Segoe UI",10)});
            Process p=null;
            try{p=Process.Start(new ProcessStartInfo(exe,"/silent /install"){UseShellExecute=true});}catch(Exception e){log("Painel: o instalador do WebView2 não abriu ("+e.Message+").");return false;}
            var started=DateTime.UtcNow;var timer=new System.Windows.Forms.Timer{Interval=500};
            timer.Tick+=(s,e)=>{bool done;try{done=p==null||p.HasExited;}catch{done=true;}if(done||Installed()||(DateTime.UtcNow-started).TotalMinutes>15){timer.Stop();wait.Close();}};
            wait.Shown+=(s,e)=>timer.Start();wait.ShowDialog();timer.Dispose();
        }
        bool ok=Installed();if(!ok)log("Painel: o WebView2 não foi instalado (sem internet ou instalação cancelada).");return ok;
    }
    static bool warned;
    // Sem WebView2 e sem Edge: avisa (uma vez por abertura) em vez de abrir o navegador padrão.
    public static void Missing(){
        if(warned)return;warned=true;
        MessageBox.Show("O painel do GameZoney abre numa janela própria, que usa o componente WebView2 da Microsoft — e ele não está instalado neste computador.\n\nInstale o WebView2 (reinstale o GameZoney Servidor com internet, ou baixe em developer.microsoft.com/microsoft-edge/webview2 › Evergreen Bootstrapper) e abra o GameZoney Servidor de novo.\n\nO servidor continua funcionando (ícone perto do relógio): os PCs e as TVs não param.","GameZoney Servidor",MessageBoxButtons.OK,MessageBoxIcon.Warning);
    }
}
// 3.0.68: painel do servidor em JANELA PRÓPRIA do GameZoney (ícone e nome do GameZoney na barra de tarefas, sem barra de
// endereço, abas ou extensões). Por dentro usa o WebView2, o motor do Edge que já vem no Windows 10/11; as telas do painel são
// as mesmas. Fechar a janela só esconde o painel: o servidor continua ativo no ícone perto do relógio.
// Sem o WebView2 Runtime: oferece instalar (1.2.6); sem ele, Edge em modo app se houver, nunca o navegador padrão; o motivo
// fica no server.log. Nada aqui toca na pasta de dados do servidor.
class PanelHost : IDisposable {
    [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(int processId);
    public readonly string Address, UserData; public readonly Icon AppIcon; public readonly Action<string> Log;
    public Action Hidden;
    readonly Action<string> fallback; readonly Control ui; readonly string signalName; bool installTried;
    EventWaitHandle signal; volatile bool disposed; Form window; bool unavailable; int crashes;
    public PanelHost(string address,int port,Icon icon,Action<string> log,Action<string> fallback,string userData=null){
        Address=address;AppIcon=icon;Log=log;this.fallback=fallback;signalName=SignalName(port);
        UserData=userData??DefaultUserData();
        ui=new Control();ui.CreateControl();var handle=ui.Handle;
    }
    public static string DefaultUserData(){return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"GameZoney","painel");}
    // 1.3.6: ao encerrar, a janela some na hora (o descarte do WebView2 vem depois)
    public void HideNow(){var w=window;if(w==null||w.IsDisposed||ui.InvokeRequired)return;try{w.Hide();}catch{}}
    public bool Unavailable{get{return unavailable;}}
    public bool WindowOpen{get{return window!=null&&!window.IsDisposed&&window.Visible;}}
    static string SignalName(int port){return "Local\\GameZoneyPanel_"+port;}
    // Segunda abertura do GameZoney.exe (atalho da área de trabalho/menu Iniciar) com o servidor já aberto: avisa o servidor
    // aberto para mostrar a janela dele, em vez de abrir outro navegador.
    public void Listen(){
        bool created;
        try{signal=new EventWaitHandle(false,EventResetMode.AutoReset,signalName,out created);}
        catch(Exception e){Log("Painel: aviso entre aberturas indisponível ("+e.Message+"); o atalho abre o painel no navegador.");return;}
        var listener=new Thread(()=>{while(true){try{signal.WaitOne();}catch{return;}if(disposed)return;Show();}});
        listener.IsBackground=true;listener.Name="GameZoney painel";listener.Start();
    }
    public static bool SignalRunning(int port){
        EventWaitHandle h;
        try{if(!EventWaitHandle.TryOpenExisting(SignalName(port),out h))return false;}catch{return false;}
        using(h){try{AllowSetForegroundWindow(-1);}catch{}h.Set();}
        return true;
    }
    public void Show(){
        if(ui.InvokeRequired){try{ui.BeginInvoke(new Action(Show));}catch{}return;}
        if(disposed)return;
        if(unavailable){OpenFallback();return;}
        try{ShowWindow();}
        catch(Exception e){Failed("a janela própria não abriu ("+PanelWindow.Describe(e)+").");}
    }
    [MethodImpl(MethodImplOptions.NoInlining)] void ShowWindow(){
        var w=window as PanelWindow;
        if(w==null||w.IsDisposed){w=new PanelWindow(this,false);window=w;}
        w.Front();
    }
    public void Failed(string reason){
        if(ui.InvokeRequired){try{ui.BeginInvoke(new Action<string>(Failed),reason);}catch{}return;}
        if(disposed||unavailable)return;
        /* 1.2.6: sem o WebView2 (ex.: Windows Server sem Edge) oferece instalar o componente da Microsoft e abre de novo na janela própria */
        if(!installTried&&!WebView2Setup.Installed()){installTried=true;var old=window;window=null;if(old!=null&&!old.IsDisposed){try{old.Dispose();}catch{}}
            if(WebView2Setup.Install(Log)){Log("Painel: WebView2 instalado; abrindo a janela própria.");try{ShowWindow();return;}catch(Exception e){reason="a janela própria não abriu depois de instalar o WebView2 ("+PanelWindow.Describe(e)+").";}}}
        Log("Painel: "+reason+" O painel abre no Edge em modo aplicativo, se houver; nunca no navegador padrão.");
        unavailable=true;var w=window;window=null;
        if(w!=null&&!w.IsDisposed){try{w.Dispose();}catch{}}
        OpenFallback();
    }
    void OpenFallback(){try{fallback(Address);}catch(Exception e){Log("Painel: o navegador não abriu ("+e.Message+").");}}
    // O motor do WebView2 fechou sozinho: abre de novo (até 3 vezes); depois disso, o painel volta a abrir no Edge/navegador.
    public void Crashed(bool wasVisible){
        if(disposed)return;
        crashes++;window=null;
        if(crashes>=3){Failed("o WebView2 fechou "+crashes+" vezes.");return;}
        if(wasVisible)Show();
    }
    public void NotifyHidden(){if(Hidden!=null){try{Hidden();}catch{}}}
    public void Dispose(){
        if(disposed)return;disposed=true;
        try{if(signal!=null){signal.Set();}}catch{}
        var w=window;window=null;
        if(w==null||w.IsDisposed)return;
        if(ui.InvokeRequired){try{ui.BeginInvoke(new Action(()=>{try{w.Dispose();}catch{}}));}catch{}}
        else{try{w.Dispose();}catch{}}
    }
}
class PanelWindow : Form {
    static CoreWebView2Environment shared;static bool loaderReady;
    static System.Threading.Tasks.Task<CoreWebView2Environment> warming;static string warmingDir;
    // 1.3.6: cria o ambiente do WebView2 (abre o motor do Edge) enquanto o servidor ainda está subindo
    public static void Prewarm(string userData){
        try{PrepareLoader();var options=new CoreWebView2EnvironmentOptions();options.Language="pt-BR";Directory.CreateDirectory(userData);warmingDir=userData;warming=CoreWebView2Environment.CreateAsync(null,userData,options);}
        catch{warming=null;}
    }
    readonly PanelHost host;readonly bool popup;readonly WebView2 web;
    FormWindowState restoreState=FormWindowState.Maximized;bool started;
    public PanelWindow(PanelHost host,bool popup){
        this.host=host;this.popup=popup;
        Text="GameZoney Servidor";if(host.AppIcon!=null)Icon=host.AppIcon;BackColor=Color.FromArgb(13,13,23);
        Rectangle area=Screen.FromPoint(Cursor.Position).WorkingArea;StartPosition=FormStartPosition.Manual;
        Bounds=popup?new Rectangle(area.X+area.Width/8,area.Y+area.Height/10,area.Width*3/4,area.Height*4/5):new Rectangle(area.X+area.Width/16,area.Y+area.Height/16,area.Width*7/8,area.Height*7/8);
        MinimumSize=new Size(640,480);
        if(!popup)WindowState=FormWindowState.Maximized;
        web=new WebView2();web.Dock=DockStyle.Fill;web.DefaultBackgroundColor=BackColor;Controls.Add(web);
        Resize+=(s,e)=>{if(WindowState!=FormWindowState.Minimized)restoreState=WindowState;};
        if(!popup)FormClosing+=(s,e)=>{if(e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();host.NotifyHidden();}};
    }
    public void Front(){
        if(!Visible)Show();
        if(WindowState==FormWindowState.Minimized)WindowState=restoreState;
        Activate();
        if(!started)Start();else web.Focus();
    }
    async void Start(){
        started=true;
        try{
            if(shared==null&&warming!=null){var pending=warming;warming=null;if(String.Equals(warmingDir,host.UserData,StringComparison.OrdinalIgnoreCase)){try{shared=await pending;}catch{shared=null;}}}
            if(shared==null){
                PrepareLoader();
                var options=new CoreWebView2EnvironmentOptions();options.Language="pt-BR";
                Directory.CreateDirectory(host.UserData);
                shared=await CoreWebView2Environment.CreateAsync(null,host.UserData,options);
            }
            await web.EnsureCoreWebView2Async(shared);
            if(IsDisposed)return;
            Configure();
            web.CoreWebView2.Navigate(host.Address);
            web.Focus();
        }catch(Exception e){if(!IsDisposed)host.Failed("a janela própria não abriu ("+Describe(e)+").");}
    }
    // O WebView2Loader.dll fica em runtimes\win-x64\native (e win-x86) ao lado do GameZoney.exe, como o pacote do WebView2 organiza.
    static void PrepareLoader(){
        if(loaderReady)return;loaderReady=true;
        try{
            string folder=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"runtimes",Environment.Is64BitProcess?"win-x64":"win-x86","native");
            if(File.Exists(Path.Combine(folder,"WebView2Loader.dll")))CoreWebView2Environment.SetLoaderDllFolderPath(folder);
        }catch{}
    }
    public static string Describe(Exception e){
        if(e is WebView2RuntimeNotFoundException)return "o WebView2 Runtime da Microsoft não está instalado neste Windows";
        if(e is DllNotFoundException)return "faltou o arquivo WebView2Loader.dll na pasta do servidor";
        var missing=e as FileNotFoundException;if(missing!=null)return "faltou o arquivo "+(missing.FileName??missing.Message);
        return e.GetType().Name+": "+e.Message;
    }
    void Configure(){
        var core=web.CoreWebView2;var settings=core.Settings;
        settings.AreDevToolsEnabled=false;settings.IsStatusBarEnabled=false;settings.AreHostObjectsAllowed=false;settings.IsWebMessageEnabled=false;
        // 1.0.5: nunca oferecer "Salvar senha" nem preencher campos sozinho (WebView2 Runtime antigo sem essas opções: ignora).
        try{settings.IsPasswordAutosaveEnabled=false;settings.IsGeneralAutofillEnabled=false;}catch(Exception e){host.Log("Painel: não foi possível desligar o salvar senha do WebView2 ("+e.Message+").");}
        core.NewWindowRequested+=OnNewWindow;core.NavigationStarting+=OnNavigation;core.ProcessFailed+=OnProcessFailed;
        // 1.0.9: foto do cliente pela câmera da recepção — o painel local (127.0.0.1) pode usar a câmera sem perguntar; o resto continua negado/perguntado
        try{core.PermissionRequested+=(s2,e2)=>{try{var u=new Uri(e2.Uri);if(e2.PermissionKind==Microsoft.Web.WebView2.Core.CoreWebView2PermissionKind.Camera&&u.IsLoopback)e2.State=Microsoft.Web.WebView2.Core.CoreWebView2PermissionState.Allow;}catch{}};}catch(Exception e){host.Log("Painel: permissão da câmera indisponível ("+e.Message+").");}
        if(popup){
            core.WindowCloseRequested+=(s,e)=>Close();
            core.DocumentTitleChanged+=(s,e)=>{string title=web.CoreWebView2.DocumentTitle;Text=String.IsNullOrEmpty(title)?"GameZoney Servidor":title+" — GameZoney";};
            return;
        }
        // Zoom do painel (Ctrl + roda do mouse, Ctrl + / Ctrl -) lembrado entre aberturas.
        string zoomFile=Path.Combine(host.UserData,"zoom.txt");double zoom;
        try{if(File.Exists(zoomFile)&&Double.TryParse(File.ReadAllText(zoomFile).Trim(),NumberStyles.Float,CultureInfo.InvariantCulture,out zoom)&&zoom>=0.25&&zoom<=5)web.ZoomFactor=zoom;}catch{}
        web.ZoomFactorChanged+=(s,e)=>{try{File.WriteAllText(zoomFile,web.ZoomFactor.ToString("R",CultureInfo.InvariantCulture));}catch{}};
    }
    // Endereços do próprio painel (e PDFs/arquivos gerados por ele) ficam no GameZoney; links de fora abrem no navegador padrão.
    public static bool Local(string address,string uri){
        if(String.IsNullOrEmpty(uri))return true;
        foreach(string scheme in new string[]{"about:","data:","blob:"})if(uri.StartsWith(scheme,StringComparison.OrdinalIgnoreCase))return true;
        Uri target,home;
        if(!Uri.TryCreate(uri,UriKind.Absolute,out target)||!Uri.TryCreate(address,UriKind.Absolute,out home))return false;
        bool sameHost=String.Equals(target.Host,home.Host,StringComparison.OrdinalIgnoreCase)||(target.IsLoopback&&home.IsLoopback);
        return target.Scheme==home.Scheme&&sameHost&&target.Port==home.Port;
    }
    public static bool OpenOutside(string uri){
        Uri target;
        if(!Uri.TryCreate(uri,UriKind.Absolute,out target))return false;
        if(target.Scheme!=Uri.UriSchemeHttp&&target.Scheme!=Uri.UriSchemeHttps&&target.Scheme!=Uri.UriSchemeMailto)return false;
        try{Process.Start(new ProcessStartInfo(target.AbsoluteUri){UseShellExecute=true});return true;}catch{return false;}
    }
    void OnNavigation(object sender,CoreWebView2NavigationStartingEventArgs e){
        if(Local(host.Address,e.Uri))return;
        e.Cancel=true;OpenOutside(e.Uri);
    }
    // PDFs do caixa/cupom e outras janelas do painel: janela do GameZoney com visualizador (Imprimir/Salvar como PDF).
    async void OnNewWindow(object sender,CoreWebView2NewWindowRequestedEventArgs e){
        if(!Local(host.Address,e.Uri)){e.Handled=true;OpenOutside(e.Uri);return;}
        var deferral=e.GetDeferral();PanelWindow child=null;
        try{
            child=new PanelWindow(host,true);child.started=true;child.Show();
            await child.web.EnsureCoreWebView2Async(shared);
            child.Configure();
            e.NewWindow=child.web.CoreWebView2;e.Handled=true;
        }catch(Exception x){
            host.Log("Painel: janela nova aberta pelo padrão do WebView2 ("+Describe(x)+").");
            if(child!=null){try{child.Dispose();}catch{}}
        }finally{deferral.Complete();}
    }
    void OnProcessFailed(object sender,CoreWebView2ProcessFailedEventArgs e){
        host.Log("Painel: o WebView2 informou falha ("+e.ProcessFailedKind+").");
        if(e.ProcessFailedKind==CoreWebView2ProcessFailedKind.RenderProcessExited){try{web.Reload();}catch{}return;}
        if(e.ProcessFailedKind!=CoreWebView2ProcessFailedKind.BrowserProcessExited)return;
        bool wasVisible=Visible&&!popup;
        shared=null;
        BeginInvoke(new Action(()=>{try{Dispose();}catch{}if(!popup)host.Crashed(wasVisible);}));
    }
}
// 1.0.7: janela "Iniciando o GameZoney…" enquanto confere os arquivos e inicia o servidor (na 1ª abertura pode levar alguns
// segundos); fecha sozinha quando o painel aparece ou se der erro.
// 1.1.3: instala a atualização baixada quando o servidor é encerrado (substitui o update-helper.ps1 escondido, que às vezes
// não chegava a rodar: o servidor fechava e nada abria). O servidor grava pending-update.txt (GZUPDATE1, versão, arquivo,
// SHA-256) na pasta de atualizações; aqui o SHA-256 é conferido de novo e o instalador abre em janela normal (o Windows pede a
// permissão de administrador). No fim do instalador, "Abrir GameZoney Servidor" abre o servidor novo. Permissão negada = reabre o atual.
static class PendingUpdate {
    static void Log(string dir,string text){try{File.AppendAllText(Path.Combine(dir,"update.log"),DateTime.Now.ToString("s")+" "+text+Environment.NewLine);}catch{}}
    static DialogResult Ask(string text,MessageBoxButtons buttons,MessageBoxIcon icon){using(var owner=new Form{TopMost=true,ShowInTaskbar=false,StartPosition=FormStartPosition.Manual,Location=new Point(-3000,-3000),Size=new Size(1,1),FormBorderStyle=FormBorderStyle.None}){owner.Show();owner.Activate();return MessageBox.Show(owner,text,"GameZoney — atualização",buttons,icon);}}
    public static void Offer(string data){
        try{
            string trimmed=data.TrimEnd('\\','/');
            string[] dirs={trimmed+"-updates",Path.Combine(Path.GetDirectoryName(trimmed)??trimmed,"updates")};
            foreach(var dir in dirs){
                string pending=Path.Combine(dir,"pending-update.txt");if(!File.Exists(pending))continue;
                string[] l=File.ReadAllLines(pending);
                if(l.Length<4||l[0]!="GZUPDATE1"||!System.Text.RegularExpressions.Regex.IsMatch(l[2],"^GameZoney-Servidor-\\d+\\.\\d+\\.\\d+-Setup\\.exe$")||!System.Text.RegularExpressions.Regex.IsMatch(l[3],"^[a-f0-9]{64}$")){File.Delete(pending);continue;}
                string installer=Path.Combine(dir,l[2]);
                if(!File.Exists(installer)){File.Delete(pending);Log(dir,"Instalador "+l[2]+" não encontrado: pedido apagado.");continue;}
                string hash;using(var sha=System.Security.Cryptography.SHA256.Create())using(var stream=File.OpenRead(installer))hash=BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
                if(hash!=l[3]){Log(dir,"SHA-256 não confere: instalador apagado, nada instalado.");try{File.Delete(installer);}catch{}File.Delete(pending);Ask("O instalador da atualização foi alterado neste computador e foi apagado. Nada foi instalado.\n\nAbra o GameZoney e baixe a atualização de novo em Configuração › Atualização do sistema.",MessageBoxButtons.OK,MessageBoxIcon.Warning);return;}
                if(Ask("O servidor GameZoney foi encerrado.\n\nInstalar agora a atualização "+l[1]+"?\n\nO Windows vai pedir a permissão de administrador. No fim do instalador, deixe marcado \"Abrir GameZoney Servidor\" para o servidor voltar.\n\nNão = instalar depois (o aviso volta na próxima vez que o servidor for encerrado).",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes){Log(dir,"Instalação de "+l[1]+" adiada.");return;}
                try{Process.Start(new ProcessStartInfo(installer,"/SP-"){UseShellExecute=true,WorkingDirectory=dir});Log(dir,"Instalador "+l[2]+" aberto.");}
                catch(Exception e){Log(dir,"Instalador não abriu: "+e.Message);Ask("O instalador não abriu (a permissão de administrador foi negada?). O GameZoney vai abrir de novo na versão atual; para tentar outra vez, encerre o servidor de novo.",MessageBoxButtons.OK,MessageBoxIcon.Information);try{Process.Start(new ProcessStartInfo(Application.ExecutablePath){UseShellExecute=true});}catch{}}
                return;
            }
        }catch(Exception e){try{File.AppendAllText(Path.Combine(data,"launcher-error.log"),DateTime.Now+" atualização pendente: "+e+Environment.NewLine);}catch{}}
    }
}
static class Splash {
    static Form form;
    public static void Open(){Open("Iniciando o servidor… aguarde alguns segundos.");}
    public static void Open(string text){
        try{if(form!=null)Close();
            form=new Form{FormBorderStyle=FormBorderStyle.None,StartPosition=FormStartPosition.CenterScreen,Size=new Size(420,130),BackColor=Color.FromArgb(18,23,32),ShowInTaskbar=true,Text="GameZoney",TopMost=true};
            try{using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("gamezoney.ico"))if(s!=null)form.Icon=new Icon(s);}catch{}
            var title=new Label{Text="GameZoney",ForeColor=Color.FromArgb(253,208,52),Font=new Font("Segoe UI",18,FontStyle.Bold),AutoSize=true,Location=new Point(24,22)};
            var sub=new Label{Text=text,ForeColor=Color.FromArgb(220,224,232),Font=new Font("Segoe UI",10),AutoSize=true,Location=new Point(26,72)};
            form.Controls.Add(title);form.Controls.Add(sub);form.Show();form.Refresh();Application.DoEvents();
        }catch{form=null;}
    }
    public static void Close(){try{if(form!=null){form.Close();form.Dispose();}}catch{}form=null;}
}
