using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
// 2.0.52: barra no topo INTEIRO, POR CIMA de aplicativos em janela (Explorer, navegador, jogo em janela), saindo so em tela cheia ou
// tela cheia em janela (sem borda); sem reservar a faixa (sem ABM_QUERYPOS/ABM_SETPOS); seta recolhe; estado mantido ao sair/voltar do jogo.
class FloatingBarRegression {
 static void Check(bool ok,string what){if(!ok)throw new Exception("FALHOU: "+what);}
 [STAThread]static int Main(string[] args){try{
  Files.DirectoryPath=Path.Combine(Path.GetTempPath(),"prime-floatbar-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(Files.DirectoryPath);
  using(var probe=new SessionBar(false)){probe.TaskbarProbe=null;
   Check(probe.TargetBounds(new Rectangle(0,0,1920,1080))==new Rectangle(0,0,1920,48),"1920x1080: topo inteiro");
   Check(probe.TargetBounds(new Rectangle(0,0,1366,768))==new Rectangle(0,0,1366,48),"1366x768: topo inteiro");
   Check(probe.TargetBounds(new Rectangle(0,0,800,600))==new Rectangle(0,0,800,48),"800x600: topo inteiro");
   Check(probe.TargetBounds(new Rectangle(1920,0,1280,1024))==new Rectangle(1920,0,1280,48),"monitor deslocado: topo inteiro");
   probe.Collapse();Check(probe.TargetBounds(new Rectangle(0,0,1920,1080))==new Rectangle(854,0,212,30),"sem barra de tarefas: aba no centro do topo");
  }
  using(var bar=new SessionBar()){bar.TaskbarProbe=null;
   int adds=0,removes=0,other=0;bar.ShellCall=delegate(uint message,ref SessionBar.DockData data){if(message==0)adds++;else if(message==1)removes++;else other++;return (UIntPtr)1;};
   var z=new List<long>();bar.ZCall=delegate(IntPtr after){z.Add(after.ToInt64());return true;};
   bar.SetMember("power","MAQUINA-1 • 6,5 PONTOS");bar.TimeLabel.Text="01:23:45";bar.SetMode(false,5025,"sessao-1");bar.SetPasswordAction(true);
   bar.Show();Application.DoEvents();
   var screen=FullscreenDetector.PrimaryBounds();
   Check(!bar.Collapsed&&bar.Bounds==new Rectangle(screen.Left,screen.Top,screen.Width,SessionBar.BarHeight),"abre no topo inteiro");
   Check(bar.TopMost,"barra fica por cima (Explorer/navegador em janela nao a cobrem)");
   Check(adds==1&&other==0,"registra so para avisos e nao reserva a faixa (sem QUERYPOS/SETPOS)");
   for(int i=0;i<20;i++)bar.PositionBar();Check(adds==1&&other==0,"reposicionar nao mexe na area de trabalho");
   bar.CollapseButton.GetType().GetMethod("OnClick",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(bar.CollapseButton,new object[]{EventArgs.Empty});Application.DoEvents();
   Check(bar.Collapsed&&bar.Tab.Visible&&bar.Height==SessionBar.TabHeight,"seta recolhe a barra");
   z.Clear();bar.SetFullscreenSuppressed(true);Check(bar.Top<0&&removes==1&&z.Contains(1),"jogo em tela cheia: barra sai da tela e vai para o fundo");
   z.Clear();bar.SetFullscreenSuppressed(false);Application.DoEvents();Check(bar.Collapsed&&bar.Bounds==bar.TargetBounds(screen)&&adds==2&&other==0&&z.Contains(-1),"saiu do jogo: volta recolhida e por cima");
   bar.Tab.GetType().GetMethod("OnClick",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(bar.Tab,new object[]{EventArgs.Empty});Check(!bar.Collapsed&&bar.Height==SessionBar.BarHeight&&bar.Width==screen.Width,"aba abre a barra no topo inteiro");
   bar.SetFullscreenSuppressed(true);bar.SetFullscreenSuppressed(false);Check(!bar.Collapsed,"Alt+Tab: volta aberta");
   bar.Collapse();bar.SetMode(false,3600,"sessao-2");Check(!bar.Collapsed,"sessao nova comeca aberta");
   bar.Collapse();bar.SetMode(false,299,"sessao-2");Check(bar.Collapsed&&!bar.Peeking,"ultimos 5 minutos fora de tela cheia: nao abre nem pisca (a aba ja esta visivel e fica vermelha)");
   bar.ShowReward("PRÊMIO FIDELIDADE","180 MINUTOS ADICIONADOS",30);Check(!bar.Collapsed,"premio fidelidade abre a barra (aba no topo)");
   Check(!z.Contains(0)&&!z.Contains(-2),"nunca mais a regra 'atras dos aplicativos' (HWND_TOP/HWND_NOTOPMOST)");
   bar.Dispose();Check(removes==3,"fechar libera o registro");
  }
  Console.WriteLine("PASS: barra no topo inteiro e por cima de aplicativos em janela; sai so em tela cheia/tela cheia em janela; sem reservar a faixa do topo; seta recolhe e a aba abre; estado mantido ao sair/voltar do jogo.");return 0;
 }catch(Exception e){Console.WriteLine(e);return 1;}}
}
