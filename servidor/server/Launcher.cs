﻿using System;
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
[assembly: AssemblyVersion("1.0.8.0")]
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
        else Open(address);
    }
    static void Restore(string data){using(var dialog=new OpenFileDialog{Title="Restaurar backup completo GameZoney",Filter="Backup GameZoney (*.zip)|*.zip",InitialDirectory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"bkp gamezoney")}){if(dialog.ShowDialog()!=DialogResult.OK)return;if(MessageBox.Show("Restaurar os dados desta cópia? Os dados atuais serão guardados em uma pasta anterior. Saldos e sessões voltarão ao momento do backup.","Restaurar GameZoney",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)return;var info=new ProcessStartInfo(Path.Combine(root,"BackupTool.exe"),"restore \""+dialog.FileName+"\" \""+data+"\""){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardError=true,RedirectStandardOutput=true};using(var process=Process.Start(info)){string output=process.StandardOutput.ReadToEnd(),error=process.StandardError.ReadToEnd();process.WaitForExit();if(process.ExitCode!=0)throw new Exception(error);MessageBox.Show(output+"\nAbra o servidor novamente.","Backup restaurado");}}}
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
        HttpWebRequest r=(HttpWebRequest)WebRequest.Create(address+path);r.Proxy=null;r.Timeout=1000;r.ReadWriteTimeout=1000;
        if(stop){r.Method="POST";r.Headers["X-GZ-Control"]=token;r.ContentLength=0;}
        using(var response=r.GetResponse())using(var reader=new StreamReader(response.GetResponseStream()))return reader.ReadToEnd();
    }
    Launcher(string directory,int port,bool silent,bool selftest) {
        data=directory;address="http://127.0.0.1:"+port;
        Directory.CreateDirectory(data);string log=Path.Combine(data,"server.log");
        if(File.Exists(log)&&new FileInfo(log).Length>2000000)File.Copy(log,log+".previous",true);
        if(File.Exists(log)&&new FileInfo(log).Length>2000000)File.WriteAllText(log,"");
        using(var probe=new TcpClient()){var result=probe.BeginConnect("127.0.0.1",port,null,null);if(result.AsyncWaitHandle.WaitOne(400)&&probe.Connected)throw new Exception("A porta "+port+" está ocupada. Encerre a versão anterior do GameZoney e abra novamente.");}
        if(!silent&&!selftest)Splash.Open();
        CheckIntegrity();
        var info=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),"--disable-warning=ExperimentalWarning --disable-sigusr1 server.js");
        info.WorkingDirectory=root;info.UseShellExecute=false;info.CreateNoWindow=true;info.WindowStyle=ProcessWindowStyle.Hidden;info.RedirectStandardOutput=true;info.RedirectStandardError=true;
        // 1.0.7: nada de fora entra no Node (NODE_OPTIONS=--require..., NODE_PATH etc. permitiriam trocar a conferência da licença)
        var drop=new System.Collections.Generic.List<string>();foreach(string k in info.EnvironmentVariables.Keys)if(k.StartsWith("NODE_",StringComparison.OrdinalIgnoreCase)||k.StartsWith("UV_",StringComparison.OrdinalIgnoreCase))drop.Add(k);
        foreach(var k in drop)info.EnvironmentVariables.Remove(k);
        Environment.SetEnvironmentVariable("GZ_DATA_DIR",data);Environment.SetEnvironmentVariable("GZ_CONTROL_TOKEN",token);Environment.SetEnvironmentVariable("PORT",port.ToString());
        Environment.SetEnvironmentVariable("GZ_DOCUMENTS_DIR",Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments));
        if(selftest){Environment.SetEnvironmentVariable("GZ_NO_PC_TLS","1");Environment.SetEnvironmentVariable("GZ_NO_BACKUP","1");}
        child=new Process();child.StartInfo=info;child.OutputDataReceived+=(s,e)=>Log(e.Data);child.ErrorDataReceived+=(s,e)=>Log(e.Data);
        child.Start();child.BeginOutputReadLine();child.BeginErrorReadLine();
        bool ready=false;for(int i=0;i<240;i++){if(child.HasExited)break;try{ready=Request("/health").Contains("gamezoney-server");if(ready)break;}catch{}Thread.Sleep(250);}
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
        Splash.Close();
        if(!silent)ShowPanel();
    }
    void OnSessionEnding(object sender,SessionEndingEventArgs e){Stop();}
    void Stop(){if(stopping)return;stopping=true;try{if(panel!=null)panel.Dispose();if(child!=null&&!child.HasExited){try{Request("/internal/stop",true);}catch{}if(!child.WaitForExit(15000)){Log("Encerramento forçado após espera; sessões serão recuperadas ao iniciar.");child.Kill();child.WaitForExit(3000);}}}finally{if(tray!=null){tray.Visible=false;tray.Dispose();}}}
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
            try{var app=new Launcher(data,port,silent,selftest);if(!selftest)Application.Run(app);}
            catch(Exception e){Splash.Close();MainCode=1;Directory.CreateDirectory(data);File.AppendAllText(Path.Combine(data,"launcher-error.log"),DateTime.Now+" "+e+Environment.NewLine);if(!selftest)MessageBox.Show(e.Message,"GameZoney",MessageBoxButtons.OK,MessageBoxIcon.Error);}
            mutex.ReleaseMutex();
        }return MainCode;
    }
}
// 3.0.68: painel do servidor em JANELA PRÓPRIA do GameZoney (ícone e nome do GameZoney na barra de tarefas, sem barra de
// endereço, abas ou extensões). Por dentro usa o WebView2, o motor do Edge que já vem no Windows 10/11; as telas do painel são
// as mesmas. Fechar a janela só esconde o painel: o servidor continua ativo no ícone perto do relógio.
// Sem o WebView2 Runtime (ou sem os arquivos dele), o painel abre como antes (Edge em modo app ou navegador padrão) e o motivo
// fica no server.log. Nada aqui toca na pasta de dados do servidor.
class PanelHost : IDisposable {
    [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(int processId);
    public readonly string Address, UserData; public readonly Icon AppIcon; public readonly Action<string> Log;
    public Action Hidden;
    readonly Action<string> fallback; readonly Control ui; readonly string signalName;
    EventWaitHandle signal; volatile bool disposed; Form window; bool unavailable; int crashes;
    public PanelHost(string address,int port,Icon icon,Action<string> log,Action<string> fallback,string userData=null){
        Address=address;AppIcon=icon;Log=log;this.fallback=fallback;signalName=SignalName(port);
        UserData=userData??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"GameZoney","painel");
        ui=new Control();ui.CreateControl();var handle=ui.Handle;
    }
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
        Log("Painel: "+reason+" O painel abre no Edge/navegador, como antes da 3.0.68.");
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
static class Splash {
    static Form form;
    public static void Open(){
        try{
            form=new Form{FormBorderStyle=FormBorderStyle.None,StartPosition=FormStartPosition.CenterScreen,Size=new Size(420,130),BackColor=Color.FromArgb(18,23,32),ShowInTaskbar=true,Text="GameZoney",TopMost=true};
            try{using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("gamezoney.ico"))if(s!=null)form.Icon=new Icon(s);}catch{}
            var title=new Label{Text="GameZoney",ForeColor=Color.FromArgb(253,208,52),Font=new Font("Segoe UI",18,FontStyle.Bold),AutoSize=true,Location=new Point(24,22)};
            var sub=new Label{Text="Iniciando o servidor… aguarde alguns segundos.",ForeColor=Color.FromArgb(220,224,232),Font=new Font("Segoe UI",10),AutoSize=true,Location=new Point(26,72)};
            form.Controls.Add(title);form.Controls.Add(sub);form.Show();form.Refresh();Application.DoEvents();
        }catch{form=null;}
    }
    public static void Close(){try{if(form!=null){form.Close();form.Dispose();}}catch{}form=null;}
}
