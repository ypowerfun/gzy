using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
// 2.0.52: aba recolhida NA BARRA DE TAREFAS; em tela cheia ou tela cheia em janela (sem borda) a barra PEQUENA aparece por cima
// no lugar da barra de tarefas: 4 s nos ultimos 5 minutos e 5 s no Ctrl+Alt+T (apertar de novo esconde antes). O clique atravessa.
class TaskbarTabRegression {
 static void Check(bool ok,string what){if(!ok)throw new Exception("FALHOU: "+what);}
 [STAThread]static int Main(string[] args){try{
  Files.DirectoryPath=Path.Combine(Path.GetTempPath(),"prime-taskbar-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(Files.DirectoryPath);
  FullscreenDetector.SelfTest();
  string preview=args.Length>0?args[0]:null;
  using(var bar=new SessionBar()){
   bar.ShellCall=delegate(uint message,ref SessionBar.DockData data){return (UIntPtr)1;};
   var z=new List<long>();bar.ZCall=delegate(IntPtr after){z.Add(after.ToInt64());return true;};
   long t=0;bar.Clock=()=>t;
   var screen=FullscreenDetector.PrimaryBounds();
   Rectangle? slot=FullscreenDetector.TabSlot(screen,new Rectangle(screen.Left,screen.Bottom-48,screen.Width,48),new Rectangle(screen.Right-320,screen.Bottom-48,320,48),SessionBar.TabWidth);
   Check(slot!=null,"barra de tarefas embaixo: ha lugar para a aba");
   bar.TaskbarProbe=s=>slot;
   bar.SetMember("power","MAQUINA-1 • 6,5 PONTOS");bar.TimeLabel.Text="01:23:45";bar.SetMode(false,5025,"sessao-1");
   bar.Show();Application.DoEvents();
   Check(!bar.Collapsed&&bar.Bounds==new Rectangle(screen.Left,screen.Top,screen.Width,SessionBar.BarHeight),"sessao comeca com a barra aberta no topo inteiro");
   bar.Collapse();Application.DoEvents();
   Check(bar.DockedNow&&bar.Bounds==slot.Value,"recolher leva a aba para a barra de tarefas, ao lado da bandeja");
   if(preview!=null)Save(bar,Path.Combine(preview,"aba-barra-tarefas.png"));
   // fora de tela cheia: Ctrl+Alt+T e os 5 minutos nao fazem nada a mais (a aba ja esta visivel)
   bool full=true;bar.FullscreenNow=()=>full;
   bar.Peek();Check(!bar.Peeking&&!bar.Suppressed&&bar.DockedNow&&bar.Bounds==slot.Value,"Ctrl+Alt+T fora de tela cheia: reinicia a barra no lugar (aba na barra de tarefas)");
   bar.SetMode(false,299,"sessao-1");Check(!bar.Peeking&&bar.Collapsed&&bar.DockedNow,"ultimos 5 minutos fora de tela cheia: aba continua na barra de tarefas (vermelha)");
   bar.SetMode(false,5025,"sessao-1");
   // jogo em tela cheia: some igual a barra de tarefas
   bar.SetFullscreenSuppressed(true);Check(bar.Top<0&&!bar.DockedNow,"tela cheia: aba some igual a barra de tarefas");
   // ultimos 5 minutos em tela cheia: barra pequena por 4 s no lugar da barra de tarefas
   t=1000;z.Clear();bar.SetMode(false,299,"sessao-1");Application.DoEvents();
   Check(bar.Peeking&&bar.Bounds==slot.Value&&bar.Tab.Visible&&bar.ClickThrough&&z.Contains(-1),"5 minutos em tela cheia: barra pequena aparece no lugar da barra de tarefas (clique atravessa)");
   if(preview!=null){bar.TimeLabel.Text="00:04:58";Application.DoEvents();Save(bar,Path.Combine(preview,"aba-5min-tela-cheia.png"));}
   bar.TickPeek(4999);Check(bar.Peeking,"fica 4 s");
   z.Clear();bar.TickPeek(5000);Check(!bar.Peeking&&bar.Top<0&&z.Contains(1),"depois de 4 s some de novo (fundo)");
   // Ctrl+Alt+T em tela cheia: 5 s; de novo = esconde antes
   t=10000;bar.Peek();Application.DoEvents();Check(bar.Peeking&&bar.Bounds==slot.Value,"Ctrl+Alt+T em tela cheia: barra pequena aparece");
   bar.TickPeek(14999);Check(bar.Peeking,"fica 5 s");
   t=12000;bar.Peek();Check(!bar.Peeking&&bar.Top<0,"Ctrl+Alt+T de novo: some antes dos 5 s");
   t=20000;bar.Peek();bar.TickPeek(25000);Check(!bar.Peeking&&bar.Top<0,"sozinho: some depois de 5 s");
   bar.ExclusiveGame=true;t=30000;bar.Peek();Check(bar.Peeking&&bar.Bounds==slot.Value,"tela cheia total: Ctrl+Alt+T tambem mostra a barra pequena");bar.Peek();bar.ExclusiveGame=false;
   // barra aberta + tela cheia + 5 minutos: tambem aparece a barra pequena (a escolha aberta/recolhida nao muda)
   bar.SetFullscreenSuppressed(false);bar.Expand();bar.SetMode(false,5025,"sessao-1");bar.SetFullscreenSuppressed(true);
   t=40000;bar.SetMode(false,299,"sessao-1");Check(bar.Peeking&&!bar.Collapsed&&bar.Bounds==slot.Value,"barra aberta em tela cheia: 5 minutos mostram a barra pequena");
   bar.TickPeek(44000);Check(!bar.Peeking&&bar.Top<0,"some depois de 4 s");
   bar.SetFullscreenSuppressed(false);bar.SetClickThrough(false);Application.DoEvents();
   Check(!bar.Collapsed&&bar.Bounds==new Rectangle(screen.Left,screen.Top,screen.Width,SessionBar.BarHeight),"saiu do jogo: barra aberta no topo inteiro");
   // 2.0.54: barra travada escondida na area de trabalho (sem jogo na frente): Ctrl+Alt+T reinicia na hora
   full=false;bar.SetFullscreenSuppressed(true);bar.SetClickThrough(true);Check(bar.Top<0,"simula a barra travada fora da tela");
   bar.Peek();Application.DoEvents();Check(!bar.Peeking&&!bar.Suppressed&&!bar.ClickThrough&&!bar.Collapsed&&bar.Top==screen.Top&&bar.Width==screen.Width,"Ctrl+Alt+T sem jogo na frente: barra volta aberta no topo, clicavel");
   // barra oculta por engano com a sessao ativa: o cliente mostra de novo
   bool canShow=true;bar.ResetRequested=()=>{if(canShow&&!bar.Visible)bar.Show();bar.ResetBar();};
   bar.Hide();Check(!bar.Visible,"simula a barra oculta");bar.Peek();Application.DoEvents();Check(bar.Visible&&bar.Top==screen.Top,"Ctrl+Alt+T: barra oculta aparece de novo");
   canShow=false;bar.Hide();bar.Peek();Check(!bar.Visible,"sem sessao ativa (tela de login) o atalho nao mostra a barra");
   bar.Show();bar.ResetRequested=null;full=true;
   // sem barra de tarefas utilizavel: barra pequena no centro do topo
   bar.TaskbarProbe=s=>null;bar.SetFullscreenSuppressed(true);t=50000;bar.Peek();Check(bar.Peeking&&bar.Top==screen.Top&&bar.Height==SessionBar.TabHeight,"sem barra de tarefas: barra pequena no topo");bar.Peek();
   bar.SetFullscreenSuppressed(false);bar.SetClickThrough(false);
  }
  Console.WriteLine("PASS: Ctrl+Alt+T fora de tela cheia reinicia a barra (travada/oculta volta na hora); aba na barra de tarefas; some em tela cheia igual a barra de tarefas; em tela cheia a barra pequena aparece no lugar da barra de tarefas por 4 s nos ultimos 5 minutos e por 5 s no Ctrl+Alt+T (de novo esconde antes); clique atravessa.");return 0;
 }catch(Exception e){Console.WriteLine(e);return 1;}}
 static void Save(Form f,string path){using(var img=new Bitmap(f.Width,f.Height)){f.DrawToBitmap(img,new Rectangle(0,0,f.Width,f.Height));img.Save(path);}}
}
