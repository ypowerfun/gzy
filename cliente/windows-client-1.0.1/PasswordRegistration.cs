using System;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;
public sealed class PasswordRegistrationForm : Form {
 readonly TextBox password=new TextBox(),repeat=new TextBox();
 readonly Label error=new Label();readonly Button confirm=new Button();
 readonly Func<string,string,Task> register;bool completed,submitting;
 public string RegisteredPassword {get;private set;}
 public PasswordRegistrationForm(string username,Func<string,string,Task> callback){register=callback;Text="Registrar senha";ClientSize=new Size(440,330);AutoScaleMode=AutoScaleMode.Dpi;StartPosition=FormStartPosition.CenterParent;FormBorderStyle=FormBorderStyle.FixedDialog;ControlBox=false;MinimizeBox=false;MaximizeBox=false;ShowInTaskbar=false;TopMost=true;BackColor=Color.FromArgb(25,27,33);ForeColor=Color.White;Font=new Font("Segoe UI",10);KeyPreview=true;
  Controls.Add(new Label{Text="Registrar senha",Font=new Font("Segoe UI",17,FontStyle.Bold),Left=22,Top=18,Width=390,Height=36});Controls.Add(new Label{Text="Usuário/Nick: "+username,Left=22,Top=62,Width=390,Height=26});
  Controls.Add(new Label{Text="Senha (4 a 20 caracteres)",Left=22,Top=96,Width=390,Height=24});password.SetBounds(22,122,390,28);password.UseSystemPasswordChar=true;password.MaxLength=20;password.TabIndex=0;Controls.Add(password);
  Controls.Add(new Label{Text="Repetir senha",Left=22,Top=158,Width=390,Height=24});repeat.SetBounds(22,184,390,28);repeat.UseSystemPasswordChar=true;repeat.MaxLength=20;repeat.TabIndex=1;Controls.Add(repeat);
  error.SetBounds(22,219,390,50);error.ForeColor=Color.LightCoral;Controls.Add(error);confirm.SetBounds(22,275,390,35);confirm.Text="Confirmar";confirm.TabIndex=2;confirm.BackColor=Color.FromArgb(239,51,69);confirm.FlatStyle=FlatStyle.Flat;confirm.Click+=async(s,e)=>await Submit();Controls.Add(confirm);AcceptButton=confirm;
  KeyDown+=(s,e)=>{if(e.KeyCode==Keys.Escape){e.Handled=true;e.SuppressKeyPress=true;}};FormClosing+=(s,e)=>{if(!completed&&e.CloseReason!=CloseReason.WindowsShutDown)e.Cancel=true;};Shown+=(s,e)=>{Activate();password.Focus();};
 }
 async Task Submit(){if(submitting)return;if(password.Text.Length==0){error.Text="Digite a senha que deseja usar.";password.Focus();return;}/* 2.0.32: senha do cliente de 4 a 20 caracteres */if(password.Text.Length<4||password.Text.Length>20){error.Text="A senha deve ter de 4 a 20 caracteres.";password.Focus();return;}if(password.Text!=repeat.Text){error.Text="As senhas não coincidem. Digite novamente.";repeat.Focus();return;}submitting=true;confirm.Enabled=false;password.Enabled=false;repeat.Enabled=false;error.Text="Registrando senha…";try{string value=password.Text;await register(value,repeat.Text);RegisteredPassword=value;completed=true;DialogResult=DialogResult.OK;Close();}catch(Exception e){error.Text=e.Message;}finally{submitting=false;if(!IsDisposed){confirm.Enabled=true;password.Enabled=true;repeat.Enabled=true;}}}
}
// 2.0.36: o cliente altera a propria senha durante a sessao (botao "Alterar senha" na barra de tempo).
public sealed class ChangePasswordForm : Form {
 readonly TextBox current=new TextBox(),password=new TextBox(),repeat=new TextBox();
 readonly Label error=new Label();readonly Button confirm=new Button(),cancel=new Button();
 readonly Func<string,string,string,Task> change;bool submitting;
 public ChangePasswordForm(string username,Func<string,string,string,Task> callback){change=callback;Text="Alterar senha";ClientSize=new Size(440,420);AutoScaleMode=AutoScaleMode.Dpi;StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MinimizeBox=false;MaximizeBox=false;ShowInTaskbar=false;TopMost=true;BackColor=Color.FromArgb(25,27,33);ForeColor=Color.White;Font=new Font("Segoe UI",10);KeyPreview=true;
  Controls.Add(new Label{Text="Alterar senha",Font=new Font("Segoe UI",17,FontStyle.Bold),Left=22,Top=18,Width=390,Height=36});Controls.Add(new Label{Text="Usuário/Nick: "+username,Left=22,Top=62,Width=390,Height=26});
  Controls.Add(new Label{Text="Senha atual",Left=22,Top=96,Width=390,Height=24});current.SetBounds(22,122,390,28);current.UseSystemPasswordChar=true;current.MaxLength=128;current.TabIndex=0;Controls.Add(current);
  Controls.Add(new Label{Text="Nova senha (4 a 20 caracteres)",Left=22,Top=158,Width=390,Height=24});password.SetBounds(22,184,390,28);password.UseSystemPasswordChar=true;password.MaxLength=20;password.TabIndex=1;Controls.Add(password);
  Controls.Add(new Label{Text="Repetir nova senha",Left=22,Top=220,Width=390,Height=24});repeat.SetBounds(22,246,390,28);repeat.UseSystemPasswordChar=true;repeat.MaxLength=20;repeat.TabIndex=2;Controls.Add(repeat);
  error.SetBounds(22,281,390,50);error.ForeColor=Color.LightCoral;Controls.Add(error);
  confirm.SetBounds(22,340,250,35);confirm.Text="Alterar senha";confirm.TabIndex=3;confirm.BackColor=Color.FromArgb(239,51,69);confirm.FlatStyle=FlatStyle.Flat;confirm.Click+=async(s,e)=>await Submit();Controls.Add(confirm);AcceptButton=confirm;
  cancel.SetBounds(282,340,130,35);cancel.Text="Cancelar";cancel.TabIndex=4;cancel.BackColor=Color.FromArgb(44,46,54);cancel.FlatStyle=FlatStyle.Flat;cancel.Click+=(s,e)=>{if(!submitting){DialogResult=DialogResult.Cancel;Close();}};Controls.Add(cancel);CancelButton=cancel;
  FormClosing+=(s,e)=>{if(submitting&&e.CloseReason==CloseReason.UserClosing)e.Cancel=true;};Shown+=(s,e)=>{Activate();current.Focus();};
 }
 async Task Submit(){if(submitting)return;if(current.Text.Length==0){error.Text="Digite a senha atual.";current.Focus();return;}if(password.Text.Length<4||password.Text.Length>20){error.Text="A nova senha deve ter de 4 a 20 caracteres.";password.Focus();return;}if(password.Text!=repeat.Text){error.Text="As novas senhas não coincidem. Digite novamente.";repeat.Focus();return;}if(password.Text==current.Text){error.Text="A nova senha deve ser diferente da atual.";password.Focus();return;}
  submitting=true;confirm.Enabled=false;cancel.Enabled=false;current.Enabled=false;password.Enabled=false;repeat.Enabled=false;error.ForeColor=Color.White;error.Text="Alterando senha…";
  try{await change(current.Text,password.Text,repeat.Text);submitting=false;MessageBox.Show(this,"Senha alterada com sucesso. Use a nova senha no próximo login.","GameZoney",MessageBoxButtons.OK,MessageBoxIcon.Information);DialogResult=DialogResult.OK;Close();}
  catch(Exception e){error.ForeColor=Color.LightCoral;error.Text=e.Message;}
  finally{submitting=false;if(!IsDisposed&&Visible){confirm.Enabled=true;cancel.Enabled=true;current.Enabled=true;password.Enabled=true;repeat.Enabled=true;}}}
}
