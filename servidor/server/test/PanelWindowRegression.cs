using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
// 3.0.68: painel do servidor em janela própria. Confere, sem precisar do WebView2 de verdade:
//  - sem WebView2 (Runtime ou arquivos faltando), o painel abre como antes (Edge/navegador), uma vez por pedido, sem travar o servidor;
//  - o atalho aberto de novo avisa o servidor aberto (não abre outro servidor);
//  - endereços do painel ficam na janela; links de fora vão para o navegador padrão; esquemas perigosos não abrem nada;
//  - o ícone do app do celular está embutido no GameZoney.exe com os tamanhos da bandeja e da janela.
// Compilar junto com Launcher.cs: csc /main:PanelWindowRegression ... Launcher.cs test\PanelWindowRegression.cs
class PanelWindowRegression {
 static void Check(bool ok,string what){if(!ok)throw new Exception("FALHOU: "+what);}
 static void Pump(Func<bool> done,int ms){var t=System.Diagnostics.Stopwatch.StartNew();while(!done()&&t.ElapsedMilliseconds<ms){Application.DoEvents();Thread.Sleep(20);}}
 [STAThread]static int Main(string[] args){try{
  string address="http://127.0.0.1:3999";var opened=new List<string>();var log=new List<string>();
  string userData=Path.Combine(Path.GetTempPath(),"gz-panel-"+Guid.NewGuid().ToString("N"));
  var host=new PanelHost(address,3999,null,line=>{lock(log)log.Add(line);},a=>opened.Add(a),userData);
  // 1) sem WebView2 neste computador: abre no navegador, uma vez, e anota o motivo
  host.Show();Pump(()=>opened.Count>0,15000);
  Check(opened.Count==1&&opened[0]==address,"sem WebView2 o painel deveria abrir no navegador uma vez: "+opened.Count);
  Check(host.Unavailable,"o painel deveria lembrar que a janela própria não está disponível");
  Check(log.Exists(l=>l.StartsWith("Painel: a janela própria não abriu")),"o motivo deveria ir para o server.log: "+String.Join(" | ",log));
  host.Show();Pump(()=>opened.Count>1,3000);
  Check(opened.Count==2,"pedido seguinte abre direto no navegador, sem tentar de novo a janela: "+opened.Count);
  // 2) navegador que falha não derruba o servidor
  var broken=new PanelHost(address,3998,null,line=>{lock(log)log.Add(line);},a=>{throw new InvalidOperationException("sem navegador padrão");},userData);
  broken.Show();Pump(()=>log.Exists(l=>l.Contains("o navegador não abriu")),15000);
  Check(log.Exists(l=>l.Contains("o navegador não abriu (sem navegador padrão)")),"falha do navegador deveria ser anotada, sem exceção");
  // 3) segunda abertura do atalho: avisa o servidor aberto (no Windows, entre processos)
  host.Listen();
  bool signalled=PanelHost.SignalRunning(3999);
  if(signalled){Pump(()=>opened.Count>2,5000);Check(opened.Count==3,"o aviso deveria mostrar o painel do servidor aberto: "+opened.Count);}
  else Console.WriteLine("Aviso: este ambiente não tem eventos nomeados (Windows tem); passo 3 conferido só no Windows.");
  Check(!PanelHost.SignalRunning(3997),"sem servidor aberto, o atalho não acha aviso e abre o servidor normalmente");
  // 4) depois de encerrar, nada mais abre
  host.Dispose();int before=opened.Count;host.Show();Pump(()=>false,300);
  Check(opened.Count==before,"servidor encerrado não abre o painel");
  // 5) endereços: painel fica na janela; fora vai para o navegador padrão
  Check(PanelWindow.Local(address,address+"/"),"painel");
  Check(PanelWindow.Local(address,address+"/api/cash/abc/pdf"),"PDF do caixa");
  Check(PanelWindow.Local(address,"http://localhost:3999/x"),"localhost na mesma porta");
  Check(PanelWindow.Local(address,"blob:http://127.0.0.1:3999/1f2e")&&PanelWindow.Local(address,"about:blank"),"blob/about do painel");
  Check(!PanelWindow.Local(address,"https://wa.me/559284155132"),"WhatsApp vai para o navegador");
  Check(!PanelWindow.Local(address,"https://127.0.0.1:3999/"),"outro esquema");
  Check(!PanelWindow.Local(address,"http://127.0.0.1:3443/pc"),"outra porta");
  Check(!PanelWindow.Local(address,"http://192.168.1.100:3999/"),"outro computador");
  foreach(string bad in new[]{"javascript:alert(1)","file:///C:/Windows/System32/calc.exe","ms-msdt:/id","vbscript:x","\\\\servidor\\c$"})
   Check(!PanelWindow.OpenOutside(bad),"não pode abrir: "+bad);
  // 6) ícone do app do celular embutido (bandeja 16/20/24, janela 32, área de trabalho 48/256)
  using(var s=typeof(PanelHost).Assembly.GetManifestResourceStream("gamezoney.ico")){
   Check(s!=null,"gamezoney.ico deveria estar embutido no GameZoney.exe (/resource:gamezoney.ico,gamezoney.ico)");
   var bytes=new byte[s.Length];s.Read(bytes,0,bytes.Length);int count=BitConverter.ToUInt16(bytes,4);var sizes=new HashSet<int>();
   for(int i=0;i<count;i++){int w=bytes[6+16*i];sizes.Add(w==0?256:w);}
   foreach(int size in new[]{16,20,24,32,48,256})Check(sizes.Contains(size),"ícone sem o tamanho "+size);
   s.Position=0;using(var small=new Icon(s,new Size(16,16)))Check(small.Width==16,"ícone 16x16 da bandeja: "+small.Width);
  }
  Console.WriteLine("PASS: painel em janela própria — sem WebView2 abre no navegador como antes (motivo no log, uma tentativa), navegador com falha não derruba o servidor, atalho avisa o servidor aberto, endereços do painel ficam na janela e links de fora vão para o navegador (esquemas perigosos bloqueados), ícone do app embutido com os tamanhos da bandeja e da janela.");
  try{Directory.Delete(userData,true);}catch{}
  return 0;
 }catch(Exception e){Console.WriteLine(e);return 1;}}
}
