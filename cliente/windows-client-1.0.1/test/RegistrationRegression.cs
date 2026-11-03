using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
class RegistrationRegression {
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateDesktop(string name,IntPtr device,IntPtr mode,uint flags,uint access,IntPtr security);
 [DllImport("user32.dll")]static extern bool SetThreadDesktop(IntPtr desktop);
 static object Field(object obj,string name){return obj.GetType().GetField(name,BindingFlags.NonPublic|BindingFlags.Instance).GetValue(obj);}
 [STAThread]static int Main(string[] args){int result=1;IntPtr desk=CreateDesktop("PrimeRegistrationTest"+Guid.NewGuid().ToString("N"),IntPtr.Zero,IntPtr.Zero,0,0x10000000,IntPtr.Zero);var thread=new System.Threading.Thread(()=>{try{if(desk==IntPtr.Zero||!SetThreadDesktop(desk))throw new Exception("Desktop de teste indisponível");Application.EnableVisualStyles();int calls=0;using(var form=new PasswordRegistrationForm("teste",(a,b)=>{calls++;if(calls==1)throw new Exception("Servidor desconectado");if(a!="x"||a!=b)throw new Exception("Senha alterada");return Task.FromResult(0);})){form.Show();Application.DoEvents();if(form.ControlBox||form.CancelButton!=null)throw new Exception("Fechamento disponível");form.Close();Application.DoEvents();if(form.IsDisposed||!form.Visible)throw new Exception("Fechou antes de registrar");var first=(TextBox)Field(form,"password");var repeat=(TextBox)Field(form,"repeat");var button=(Button)Field(form,"confirm");button.PerformClick();if(calls!=0)throw new Exception("Aceitou vazio");first.Text="x";repeat.Text="y";button.PerformClick();if(calls!=0)throw new Exception("Aceitou confirmação diferente");repeat.Text="x";button.PerformClick();Application.DoEvents();if(calls!=1||form.IsDisposed||!form.Visible)throw new Exception("Fechou com falha de rede");button.PerformClick();Application.DoEvents();if(calls!=2||form.RegisteredPassword!="x")throw new Exception("Não confirmou senha curta");}File.WriteAllText(args[0],"PASS: cadastro sem cancelar/fechar, senha vazia e divergente rejeitadas, falha de rede mantém janela, senha curta confirmada. Desktop isolado.");result=0;}catch(Exception e){File.WriteAllText(args[0],e.ToString());}});thread.SetApartmentState(System.Threading.ApartmentState.STA);thread.Start();thread.Join();return result;}
}
