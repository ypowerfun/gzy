using System;
using System.Collections.Generic;
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
[assembly: AssemblyTitle("GameZoney Servidor")]
[assembly: AssemblyVersion("1.0.3.0")]
class Launcher : ApplicationContext {
    Process child; NotifyIcon tray; System.Windows.Forms.Timer monitor;
    string token=Guid.NewGuid().ToString("N"), address, data; bool stopping=false;
    readonly object logLock=new object();
    // 3.0.53: HTTPS dos apps (Caddy, pasta C:\GameZoneyHTTPS) abre escondido junto com o servidor e fecha junto com ele.
    Process https; string httpsDir; int httpsRestarts=0; DateTime httpsStartedAt; bool httpsWarned=false, httpsExternal=false;
    string httpsWarning; ToolStripMenuItem httpsStatus;
    readonly object httpsLock=new object();
    static string root=AppDomain.CurrentDomain.BaseDirectory;
    static int MainCode=0;
    static void Open(string target) { Process.Start(new ProcessStartInfo(target){UseShellExecute=true}); }
    // 1.0.3: o painel abre no navegador PADRÃO do Windows (Chrome, Firefox, Brave, Opera, Edge...). Sem janela embutida e sem
    // depender do Edge. Se o Windows não tiver navegador padrão registrado (ou ele não abrir), tenta os navegadores instalados.
    static void OpenPanel(string address) {
        try{Process.Start(new ProcessStartInfo(address){UseShellExecute=true});return;}catch{}
        foreach(string browser in InstalledBrowsers()){
            try{Process.Start(new ProcessStartInfo(browser,"\""+address+"\""){UseShellExecute=false});return;}catch{}
        }
        MessageBox.Show("Não foi possível abrir o navegador. Abra o endereço "+address+" no seu navegador (Chrome, Firefox, Brave...).","GameZoney",MessageBoxButtons.OK,MessageBoxIcon.Warning);
    }
    static void Restore(string data){using(var dialog=new OpenFileDialog{Title="Restaurar backup completo GameZoney",Filter="Backup GameZoney (*.zip)|*.zip",InitialDirectory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"bkp gamezoney")}){if(dialog.ShowDialog()!=DialogResult.OK)return;if(MessageBox.Show("Restaurar os dados desta cópia? Os dados atuais serão guardados em uma pasta anterior. Saldos e sessões voltarão ao momento do backup.","Restaurar GameZoney",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)return;var info=new ProcessStartInfo(Path.Combine(root,"BackupTool.exe"),"restore \""+dialog.FileName+"\" \""+data+"\""){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardError=true,RedirectStandardOutput=true};using(var process=Process.Start(info)){string output=process.StandardOutput.ReadToEnd(),error=process.StandardError.ReadToEnd();process.WaitForExit();if(process.ExitCode!=0)throw new Exception(error);MessageBox.Show(output+"\nAbra o servidor novamente.","Backup restaurado");}}}
    // Navegadores instalados (registro "App Paths" do Windows e pastas comuns), na ordem de preferência.
    static IEnumerable<string> InstalledBrowsers(){
        var found=new List<string>();
        foreach(string exe in new string[]{"chrome.exe","firefox.exe","brave.exe","opera.exe","vivaldi.exe","msedge.exe"})
        foreach(RegistryKey hive in new RegistryKey[]{Registry.CurrentUser,Registry.LocalMachine}){
            try{using(var key=hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\"+exe)){string path=key==null?null:key.GetValue("") as string;if(!String.IsNullOrEmpty(path)){path=path.Trim('"');if(File.Exists(path)&&!found.Contains(path))found.Add(path);}}}catch{}
        }
        string local=Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        foreach(string folder in new string[]{Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),Environment.GetEnvironmentVariable("ProgramW6432"),local})
        foreach(string rel in new string[]{@"Google\Chrome\Application\chrome.exe",@"Mozilla Firefox\firefox.exe",@"BraveSoftware\Brave-Browser\Application\brave.exe",@"Programs\Opera\opera.exe",@"Vivaldi\Application\vivaldi.exe",@"Microsoft\Edge\Application\msedge.exe"}){
            if(String.IsNullOrEmpty(folder))continue;
            string path=Path.Combine(folder,rel);if(File.Exists(path)&&!found.Contains(path))found.Add(path);
        }
        return found;
    }
    // 3.0.68: ícone do app do celular (gamezoney.ico com vários tamanhos, embutido no GameZoney.exe).
    static Icon AppIcon(Size size){
        try{using(var stream=typeof(Launcher).Assembly.GetManifestResourceStream("gamezoney.ico")){if(stream!=null)return new Icon(stream,size);}}catch{}
        try{return Icon.ExtractAssociatedIcon(Application.ExecutablePath);}catch{return null;}
    }
    void ShowPanel(){OpenPanel(address);}
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
        var info=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),"--disable-warning=ExperimentalWarning server.js");
        info.WorkingDirectory=root;info.UseShellExecute=false;info.CreateNoWindow=true;info.WindowStyle=ProcessWindowStyle.Hidden;info.RedirectStandardOutput=true;info.RedirectStandardError=true;
        Environment.SetEnvironmentVariable("GZ_DATA_DIR",data);Environment.SetEnvironmentVariable("GZ_CONTROL_TOKEN",token);Environment.SetEnvironmentVariable("PORT",port.ToString());
        Environment.SetEnvironmentVariable("GZ_DOCUMENTS_DIR",Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments));
        if(selftest){Environment.SetEnvironmentVariable("GZ_NO_PC_TLS","1");Environment.SetEnvironmentVariable("GZ_NO_BACKUP","1");}
        child=new Process();child.StartInfo=info;child.OutputDataReceived+=(s,e)=>Log(e.Data);child.ErrorDataReceived+=(s,e)=>Log(e.Data);
        child.Start();child.BeginOutputReadLine();child.BeginErrorReadLine();
        bool ready=false;for(int i=0;i<60;i++){if(child.HasExited)break;try{ready=Request("/health").Contains("gamezoney-server");if(ready)break;}catch{}Thread.Sleep(250);}
        if(!ready){Stop();throw new Exception("O servidor não iniciou. Consulte o arquivo server.log na pasta de dados: "+data);}
        if(selftest){File.WriteAllText(Path.Combine(data,"launcher-selftest.txt"),Request("/health"));Stop();return;}
        var menu=new ContextMenuStrip();menu.Items.Add("Abrir GameZoney",null,(s,e)=>ShowPanel());menu.Items.Add("Abrir pasta de dados",null,(s,e)=>Open(data));menu.Items.Add("Abrir diagnóstico",null,(s,e)=>Open(Path.Combine(data,"server.log")));
        // GameZoney 1.0.1: sem apps de celular, sem o servidor HTTPS dos apps (Caddy) no menu nem ao abrir.
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Encerrar servidor",null,(s,e)=>{if(MessageBox.Show("Encerrar o servidor? As TVs não serão controladas enquanto ele estiver fechado. O prazo das sessões continua correndo.","GameZoney",MessageBoxButtons.YesNo,MessageBoxIcon.Question)==DialogResult.Yes)ExitThread();});
        tray=new NotifyIcon();tray.Text="GameZoney • Servidor ativo";tray.Icon=AppIcon(SystemInformation.SmallIconSize);tray.ContextMenuStrip=menu;tray.Visible=true;tray.DoubleClick+=(s,e)=>ShowPanel();
        SystemEvents.SessionEnding+=OnSessionEnding;
        RefreshHttpsStatus();
        monitor=new System.Windows.Forms.Timer();monitor.Interval=2000;monitor.Tick+=(s,e)=>{if(child.HasExited&&!stopping){monitor.Stop();MessageBox.Show("O servidor encerrou inesperadamente. Abra o GameZoney novamente e consulte o diagnóstico.","GameZoney",MessageBoxButtons.OK,MessageBoxIcon.Error);ExitThread();}};monitor.Tick+=(s,e)=>{WatchHttps();RefreshHttpsStatus();};monitor.Start();
        if(!silent)ShowPanel();
    }
    static string FindHttps(){
        foreach(string dir in new string[]{Path.Combine(root,"https"),@"C:\GameZoneyHTTPS"}){
            if(File.Exists(Path.Combine(dir,"Caddy.exe"))&&File.Exists(Path.Combine(dir,"Caddyfile")))return dir;
        }
        return null;
    }
    static bool PortBusy(int port){
        using(var probe=new TcpClient()){try{var result=probe.BeginConnect("127.0.0.1",port,null,null);return result.AsyncWaitHandle.WaitOne(400)&&probe.Connected;}catch{return false;}}
    }
    // Qualquer resposta da porta de administração do Caddy (localhost:2019) significa que um Caddy já está aberto.
    static bool CaddyAlive(){
        try{var r=(HttpWebRequest)WebRequest.Create("http://localhost:2019/config/");r.Proxy=null;r.Timeout=800;r.ReadWriteTimeout=800;using(r.GetResponse()){}return true;}
        catch(WebException e){return e.Response!=null;}
        catch{return false;}
    }
    static void CaddyStopRequest(){
        try{var r=(HttpWebRequest)WebRequest.Create("http://localhost:2019/stop");r.Proxy=null;r.Method="POST";r.ContentLength=0;r.Timeout=3000;r.ReadWriteTimeout=3000;using(r.GetResponse()){}}catch{}
    }
    void HttpsLog(string line){if(line==null)return;lock(logLock){try{File.AppendAllText(Path.Combine(data,"https.log"),DateTime.Now.ToString("s")+" "+line+Environment.NewLine);}catch{}}}
    // O aviso é mostrado pelo relógio da interface (RefreshHttpsStatus), nunca direto de outra thread.
    void Warn(string message){Log(message);if(!httpsWarned){httpsWarned=true;httpsWarning=message;}}
    void UpdateTray(){}
    void RefreshHttpsStatus(){
        bool running=https!=null&&!https.HasExited;
        string state=running?"iniciado":httpsExternal?"iniciado (aberto à mão)":httpsDir==null?"não encontrado":"parado";
        if(httpsStatus!=null)httpsStatus.Text="● Servidor do app: "+state;
        if(tray!=null){try{tray.Text="GameZoney • Servidor ativo"+(running||httpsExternal?" • App ativo":"");}catch{}}
        string warning=httpsWarning;httpsWarning=null;
        if(warning!=null&&tray!=null){try{tray.ShowBalloonTip(8000,"GameZoney",warning,ToolTipIcon.Warning);}catch{}}
    }
    void StartHttps(){
        lock(httpsLock){
            httpsDir=FindHttps();httpsExternal=false;
            if(httpsDir==null){Log("HTTPS dos apps: Caddy.exe e Caddyfile não encontrados em C:\\GameZoneyHTTPS (opcional).");return;}
            if(CaddyAlive()){httpsExternal=true;Log("HTTPS dos apps: um Caddy já estava aberto; mantido como está (use Reiniciar servidor do app para o servidor assumir).");return;}
            if(PortBusy(443)){Warn("O servidor do app não iniciou: a porta 443 está ocupada por outro programa.");return;}
            LaunchCaddy();
        }
    }
    void LaunchCaddy(){
        string log=Path.Combine(data,"https.log");
        try{if(File.Exists(log)&&new FileInfo(log).Length>2000000){File.Copy(log,log+".previous",true);File.WriteAllText(log,"");}}catch{}
        var info=new ProcessStartInfo(Path.Combine(httpsDir,"Caddy.exe"),"run --config \""+Path.Combine(httpsDir,"Caddyfile")+"\" --adapter caddyfile");
        info.WorkingDirectory=httpsDir;info.UseShellExecute=false;info.CreateNoWindow=true;info.WindowStyle=ProcessWindowStyle.Hidden;info.RedirectStandardOutput=true;info.RedirectStandardError=true;
        info.EnvironmentVariables.Remove("GZ_CONTROL_TOKEN");
        var p=new Process();p.StartInfo=info;p.OutputDataReceived+=(s,e)=>HttpsLog(e.Data);p.ErrorDataReceived+=(s,e)=>HttpsLog(e.Data);
        try{p.Start();p.BeginOutputReadLine();p.BeginErrorReadLine();}
        catch(Exception e){Warn("O servidor do app não iniciou: "+e.Message);return;}
        https=p;httpsStartedAt=DateTime.Now;Log("HTTPS dos apps: Caddy iniciado ("+httpsDir+").");UpdateTray();
    }
    void WatchHttps(){
        lock(httpsLock){
            if(https==null||stopping||!https.HasExited)return;
            int code=https.ExitCode;https.Dispose();https=null;UpdateTray();
            if((DateTime.Now-httpsStartedAt).TotalSeconds>120)httpsRestarts=0;
            if(httpsRestarts<3&&!PortBusy(443)){httpsRestarts++;Log("HTTPS dos apps: Caddy fechou (código "+code+"); reabrindo ("+httpsRestarts+"/3).");LaunchCaddy();}
            else Warn("O servidor do app parou (código "+code+"). Veja o diagnóstico do servidor do app e use Reiniciar servidor do app.");
        }
    }
    void StopHttps(){
        Process p;lock(httpsLock){p=https;https=null;}
        if(p==null)return;
        try{if(!p.HasExited){CaddyStopRequest();if(!p.WaitForExit(12000)){p.Kill();p.WaitForExit(3000);}}}catch(Exception e){Log("HTTPS dos apps: "+e.Message);}
        Log("HTTPS dos apps: Caddy encerrado.");UpdateTray();
    }
    // Menu do ícone: fecha o Caddy (também um aberto à mão) e abre de novo, por exemplo depois de renovar o certificado.
    void RestartHttps(){
        new Thread(()=>{
            StopHttps();
            if(CaddyAlive()){CaddyStopRequest();for(int i=0;i<60&&CaddyAlive();i++)Thread.Sleep(250);}
            httpsExternal=false;
            httpsRestarts=0;httpsWarned=false;StartHttps();
            Log(https!=null?"HTTPS dos apps reiniciado pelo menu.":"HTTPS dos apps: reinício pelo menu não abriu o Caddy (veja as linhas acima).");
        }){IsBackground=true}.Start();
    }
    void OnSessionEnding(object sender,SessionEndingEventArgs e){Stop();}
    void Stop(){if(stopping)return;stopping=true;try{StopHttps();if(child!=null&&!child.HasExited){try{Request("/internal/stop",true);}catch{}if(!child.WaitForExit(15000)){Log("Encerramento forçado após espera; sessões serão recuperadas ao iniciar.");child.Kill();child.WaitForExit(3000);}}}finally{if(tray!=null){tray.Visible=false;tray.Dispose();}}}
    protected override void ExitThreadCore(){SystemEvents.SessionEnding-=OnSessionEnding;if(monitor!=null)monitor.Stop();Stop();base.ExitThreadCore();}
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [STAThread] static int Main(string[] args){
        // 3.0.68: janela do painel, menus e mensagens nítidos em telas com escala de 125%/150%.
        try{SetProcessDPIAware();}catch{}
        bool selftest=Array.IndexOf(args,"/selftest")>=0,silent=Array.IndexOf(args,"/silent")>=0;
        int port=3000;string data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"GameZoney","data");
        for(int i=0;i<args.Length-1;i++){if(args[i]=="/data")data=args[i+1];if(args[i]=="/port")port=Int32.Parse(args[i+1]);}
        bool created;using(var mutex=new Mutex(true,"Local\\GameZoneyServer_"+port,out created)){
            if(!created){if(Array.IndexOf(args,"/restore")>=0){MessageBox.Show("Encerre o servidor pelo ícone ao lado do relógio antes de restaurar.","GameZoney");return 1;}if(!silent&&!selftest)OpenPanel("http://127.0.0.1:"+port);return 0;}
            Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
            if(Array.IndexOf(args,"/restore")>=0){try{Restore(data);}catch(Exception ex){MessageBox.Show(ex.Message,"Falha na restauração");return 1;}return 0;}
            try{var app=new Launcher(data,port,silent,selftest);if(!selftest)Application.Run(app);}
            catch(Exception e){MainCode=1;Directory.CreateDirectory(data);File.AppendAllText(Path.Combine(data,"launcher-error.log"),DateTime.Now+" "+e+Environment.NewLine);if(!selftest)MessageBox.Show(e.Message,"GameZoney",MessageBoxButtons.OK,MessageBoxIcon.Error);}
            mutex.ReleaseMutex();
        }return MainCode;
    }
}
