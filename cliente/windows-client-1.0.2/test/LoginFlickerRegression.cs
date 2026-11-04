using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
// 2.0.56: a tela de login nao pode piscar. Monta a tela de login de verdade (modo previa, sem servidor) e confere que a janela e
// todos os controles dela desenham em memoria antes (buffer duplo), menos os campos de texto do Windows, e que o Tab nao manda
// redesenhar a janela inteira. Uso: LoginFlickerRegression.exe
class LoginFlickerRegression {
 static void Check(bool ok,string what){if(!ok)throw new Exception("FALHOU: "+what);}
 static int Walk(Control root,ref int textBoxes){int checkedControls=0;foreach(Control c in root.Controls){if(c is TextBoxBase){textBoxes++;Check(!LoginPaint.HasStyle(c,ControlStyles.OptimizedDoubleBuffer),"campo de texto do Windows ficou com buffer duplo: "+c.GetType().Name);}else{Check(LoginPaint.Smooth(c),"controle sem buffer duplo na tela de login: "+c.GetType().Name+" '"+c.Text+"'");checkedControls++;}checkedControls+=Walk(c,ref textBoxes);}return checkedControls;}
 [STAThread]static int Main(string[] args){try{
  Files.DirectoryPath=Path.Combine(Path.GetTempPath(),"gz-login-flicker-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(Files.DirectoryPath);
  LoginPaint.SelfTest();
  var settings=new Settings{server="https://127.0.0.1:3443",fingerprint=new string('0',64),token=new string('0',64),stationName="MAQUINA-7"};
  using(var form=new ClientForm(settings,true)){
   form.Size=new Size(1280,800);
   Check(LoginPaint.Smooth(form),"janela de login sem buffer duplo (o fundo apagava e redesenhava a tela inteira)");
   int textBoxes=0;int count=Walk(form,ref textBoxes);
   Check(textBoxes==2,"esperava os 2 campos (nick e senha), achou "+textBoxes);
   Check(count>=10,"poucos controles conferidos: "+count);
   foreach(string name in new[]{"status","summary","wakeHint"}){var f=typeof(ClientForm).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic);var c=(Control)f.GetValue(form);Check(c is WallpaperText&&LoginPaint.Smooth(c),"texto sobre o fundo sem buffer duplo: "+name);}
   var wndProc=typeof(ClientForm).GetMethod("WndProc",BindingFlags.Instance|BindingFlags.NonPublic,null,new[]{typeof(Message).MakeByRefType()},null);
   Check(wndProc!=null&&wndProc.DeclaringType==typeof(ClientForm),"a tela de login precisa tratar a troca das marcas de foco (Tab)");
   Console.WriteLine("PASS: tela de login com buffer duplo na janela e em "+count+" controles (2 campos de texto do Windows mantidos), textos sobre o fundo sem piscar e Tab sem redesenhar a janela inteira.");
  }
  return 0;
 }catch(Exception e){Console.WriteLine(e);return 1;}}
}
