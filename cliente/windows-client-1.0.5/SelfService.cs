// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.0.8: AUTOATENDIMENTO na tela de login do PC (ligado no Servidor em Configuração › Autoatendimento no PC):
//  - Criar conta: o cliente faz o próprio cadastro (nome, nick, telefone opcional e senha).
//  - Recarregar com PIX: nick + senha, escolhe o pacote, paga o QR Code na tela e, aprovado, o tempo entra sozinho e o PC
//    já entra na sessão. A senha digitada fica só na memória até o login automático (nunca é gravada).
// 1.0.9: "Outro valor" — o cliente digita quanto quer pagar (a partir do mínimo configurado no Servidor).
using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

public delegate Task<Dictionary<string,object>> SelfPost(string action,object body);

public abstract class SelfForm : Form {
 protected readonly SelfPost post;protected readonly Label error=new Label();protected bool busy;
 protected SelfForm(SelfPost post,string title,int height){this.post=post;Text=title;ClientSize=new Size(460,height);AutoScaleMode=AutoScaleMode.Dpi;StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MinimizeBox=false;MaximizeBox=false;ShowInTaskbar=false;TopMost=true;BackColor=GzTheme.Panel;ForeColor=Color.White;Font=new Font("Segoe UI",10);KeyPreview=true;
  Controls.Add(new Label{Text=title,Font=new Font("Segoe UI",17,FontStyle.Bold),ForeColor=GzTheme.Red2,Left=22,Top=16,Width=410,Height=36});
  error.ForeColor=Color.FromArgb(255,138,144);error.AutoSize=false;Controls.Add(error);
  KeyDown+=(s,e)=>{if(e.KeyCode==Keys.Escape){e.Handled=true;e.SuppressKeyPress=true;Close();}};}
 protected TextBox Field(string label,int top,bool secret=false,int max=60){Controls.Add(new Label{Text=label,Left=22,Top=top,Width=410,Height=22,ForeColor=Color.FromArgb(200,200,205)});var t=new TextBox{Left=22,Top=top+24,Width=410,MaxLength=max,UseSystemPasswordChar=secret,BackColor=Color.FromArgb(10,10,12),ForeColor=Color.White,BorderStyle=BorderStyle.FixedSingle};Controls.Add(t);return t;}
 protected static string V(Dictionary<string,object> d,string k){return d!=null&&d.ContainsKey(k)&&d[k]!=null?Convert.ToString(d[k]):"";}
 protected static string Clean(Exception e){var m=e.Message??"";return m.StartsWith("Falha")||m.Length>0?m:"Não foi possível concluir. Procure a recepção.";}
}

public sealed class SignupForm : SelfForm {
 readonly TextBox name,nick,phone,password,repeat;readonly GzButton confirm=new GzButton("Criar conta",GzButtonKind.Primary),cancel=new GzButton("Cancelar",GzButtonKind.Ghost);
 public string Username{get;private set;}
 public SignupForm(SelfPost post):base(post,"Criar conta",520){
  name=Field("Seu nome",62,false,120);nick=Field("Usuário/Nick (para entrar no PC)",116,false,32);phone=Field("Telefone/WhatsApp (opcional)",170,false,40);password=Field("Senha (4 a 20 caracteres)",224,true,20);repeat=Field("Repetir senha",278,true,20);
  Controls.Add(new Label{Text="O nick pode ter letras sem acento, números, espaço, ponto, hífen ou sublinhado (3 a 32).",Left=22,Top=336,Width=410,Height=40,ForeColor=Color.FromArgb(150,150,158),Font=new Font("Segoe UI",8.5f)});
  error.SetBounds(22,378,410,48);confirm.SetBounds(22,440,200,42);cancel.SetBounds(232,440,200,42);Controls.Add(confirm);Controls.Add(cancel);AcceptButton=confirm;
  confirm.Click+=async(s,e)=>await Submit();cancel.Click+=(s,e)=>Close();Shown+=(s,e)=>{Activate();name.Focus();};
 }
 async Task Submit(){if(busy)return;error.Text="";
  if(name.Text.Trim().Length==0){error.Text="Informe o seu nome.";name.Focus();return;}
  if(nick.Text.Trim().Length<3){error.Text="O Usuário/Nick precisa ter pelo menos 3 caracteres.";nick.Focus();return;}
  if(password.Text.Length<4||password.Text.Length>20){error.Text="A senha deve ter de 4 a 20 caracteres.";password.Focus();return;}
  if(password.Text!=repeat.Text){error.Text="As senhas não coincidem.";repeat.Focus();return;}
  busy=true;confirm.Enabled=false;
  try{var r=await post("signup",new {name=name.Text.Trim(),username=nick.Text.Trim(),phone=phone.Text.Trim(),password=password.Text,repeatPassword=repeat.Text});Username=V(r,"username");DialogResult=DialogResult.OK;Close();}
  catch(Exception e){error.Text=Clean(e);}finally{busy=false;confirm.Enabled=true;password.Clear();repeat.Clear();}
 }
}

public sealed class PixForm : SelfForm {
 readonly TextBox nick,password;readonly ListBox options=new ListBox();readonly GzButton generate=new GzButton("Gerar PIX",GzButtonKind.Primary),cancel=new GzButton("Cancelar",GzButtonKind.Ghost),copy=new GzButton("Copiar código",GzButtonKind.Neutral);
 readonly PictureBox qr=new PictureBox();readonly TextBox code=new TextBox();readonly Label info=new Label(),status=new Label();readonly Timer poll=new Timer{Interval=3000};
 readonly List<string> ids=new List<string>();string chargeId;DateTime expires;
 readonly Label customLabel=new Label();readonly TextBox customValue=new TextBox();int customMin,customMax,hourCents;
 public string Username{get;private set;}public string Password{get;private set;}
 public PixForm(SelfPost post,string presetNick):base(post,"Recarregar com PIX",600){
  nick=Field("Usuário/Nick",62,false,32);nick.Text=presetNick??"";password=Field("Senha",116,true,20);
  Controls.Add(new Label{Text="Escolha o pacote",Left=22,Top=172,Width=410,Height=22,ForeColor=Color.FromArgb(200,200,205)});
  options.SetBounds(22,196,410,200);options.BackColor=Color.FromArgb(10,10,12);options.ForeColor=Color.White;options.BorderStyle=BorderStyle.FixedSingle;options.Font=new Font("Segoe UI",12);options.ItemHeight=28;Controls.Add(options);
  error.SetBounds(22,462,410,66);
  customLabel.SetBounds(22,402,410,22);customLabel.ForeColor=Color.FromArgb(200,200,205);customLabel.Visible=false;Controls.Add(customLabel);
  customValue.SetBounds(22,426,150,30);customValue.MaxLength=10;customValue.Font=new Font("Segoe UI",12);customValue.BackColor=Color.FromArgb(10,10,12);customValue.ForeColor=Color.White;customValue.BorderStyle=BorderStyle.FixedSingle;customValue.Visible=false;Controls.Add(customValue);
  options.SelectedIndexChanged+=(s,e)=>ToggleCustom();customValue.TextChanged+=(s,e)=>UpdateCustomHint();generate.SetBounds(22,536,200,44);cancel.SetBounds(232,536,200,44);Controls.Add(generate);Controls.Add(cancel);AcceptButton=generate;
  qr.SetBounds(95,62,270,270);qr.SizeMode=PictureBoxSizeMode.Zoom;qr.BackColor=Color.White;qr.Visible=false;Controls.Add(qr);
  info.SetBounds(22,340,410,50);info.Font=new Font("Segoe UI",11,FontStyle.Bold);info.TextAlign=ContentAlignment.MiddleCenter;info.Visible=false;Controls.Add(info);
  code.SetBounds(22,394,300,28);code.ReadOnly=true;code.BackColor=Color.FromArgb(10,10,12);code.ForeColor=Color.White;code.Visible=false;Controls.Add(code);
  copy.SetBounds(330,392,102,32);copy.Visible=false;Controls.Add(copy);
  status.SetBounds(22,430,410,50);status.TextAlign=ContentAlignment.MiddleCenter;status.ForeColor=Color.FromArgb(200,200,205);status.Visible=false;Controls.Add(status);
  generate.Click+=async(s,e)=>await Generate();cancel.Click+=async(s,e)=>await CancelCharge();copy.Click+=(s,e)=>{try{Clipboard.SetText(code.Text);status.Text="Código copiado. Cole no app do banco (PIX copia e cola).";}catch{}};
  poll.Tick+=async(s,e)=>await Check();FormClosed+=(s,e)=>poll.Stop();
  Shown+=async(s,e)=>{Activate();if(nick.Text.Length>0)password.Focus();else nick.Focus();await LoadOptions();};
 }
 async Task LoadOptions(){try{var r=await post("pix/options",new {});options.Items.Clear();ids.Clear();var list=r.ContainsKey("options")?r["options"] as IEnumerable:null;if(list!=null)foreach(var o in list){var d=o as Dictionary<string,object>;if(d==null)continue;ids.Add(V(d,"id"));int cents=Convert.ToInt32(d["cents"]),minutes=Convert.ToInt32(d["minutes"]);options.Items.Add(V(d,"label")+"  —  "+(cents/100.0).ToString("C",new System.Globalization.CultureInfo("pt-BR"))+"  •  "+Hours(minutes));}var k=r.ContainsKey("custom")?r["custom"] as Dictionary<string,object>:null;if(k!=null){customMin=Convert.ToInt32(k["min"]);customMax=Convert.ToInt32(k["max"]);hourCents=Convert.ToInt32(k["hourCents"]);ids.Add("custom");options.Items.Add("Outro valor (a partir de "+Brl(customMin)+")");}
  if(options.Items.Count>0)options.SelectedIndex=0;else error.Text="Nenhum pacote disponível. Procure a recepção.";}catch(Exception e){error.Text=Clean(e);}}
 static string Brl(int cents){return (cents/100.0).ToString("C",new System.Globalization.CultureInfo("pt-BR"));}
 bool IsCustom(){return options.SelectedIndex>=0&&options.SelectedIndex<ids.Count&&ids[options.SelectedIndex]=="custom";}
 void ToggleCustom(){bool c=IsCustom();customLabel.Visible=c;customValue.Visible=c;if(c){UpdateCustomHint();customValue.Focus();}}
 int CustomCents(){decimal v;var t=customValue.Text.Replace("R$","").Trim().Replace(".",",");if(!decimal.TryParse(t,System.Globalization.NumberStyles.Number,new System.Globalization.CultureInfo("pt-BR"),out v))return -1;return (int)Math.Round(v*100);}
 void UpdateCustomHint(){int c=CustomCents();customLabel.Text="Valor em reais (de "+Brl(customMin)+" a "+Brl(customMax)+")"+(c>=customMin&&c<=customMax&&hourCents>0?"  =  "+Hours((int)Math.Round(c*60.0/hourCents)):"");}
 static string Hours(int m){return m>=60?(m/60)+"h"+(m%60>0?(m%60).ToString("00"):"")+" de jogo":m+" min de jogo";}
 async Task Generate(){if(busy)return;error.Text="";if(nick.Text.Trim().Length==0||password.Text.Length==0){error.Text="Digite o seu nick e a sua senha.";return;}if(options.SelectedIndex<0){error.Text="Escolha um pacote.";return;}
  int cents=0;if(IsCustom()){cents=CustomCents();if(cents<customMin||cents>customMax){error.Text="Digite um valor de "+Brl(customMin)+" a "+Brl(customMax)+".";customValue.Focus();return;}}
  busy=true;generate.Enabled=false;
  try{var r=await post("pix/create",new {username=nick.Text.Trim(),password=password.Text,option=ids[options.SelectedIndex],cents=cents});Username=nick.Text.Trim();Password=password.Text;chargeId=V(r,"id");
   try{expires=DateTimeOffset.FromUnixTimeMilliseconds(Convert.ToInt64(r["expiresAt"])).LocalDateTime;}catch{expires=DateTime.Now.AddMinutes(15);}
   ShowQr(V(r,"qr"),V(r,"copy"),Convert.ToInt32(r["cents"]),V(r,"label"));poll.Start();}
  catch(Exception e){error.Text=Clean(e);generate.Enabled=true;}finally{busy=false;}
 }
 void ShowQr(string base64,string copyCode,int cents,string label){
  foreach(Control c in Controls)if(c!=qr&&c!=info&&c!=code&&c!=copy&&c!=status&&c!=cancel&&!(c is Label&&c.Top<40))c.Visible=false;
  try{var bytes=Convert.FromBase64String(base64);using(var ms=new MemoryStream(bytes))qr.Image=new Bitmap(Image.FromStream(ms));}catch{qr.Image=null;}
  qr.Visible=true;info.Text="Pague "+(cents/100.0).ToString("C",new System.Globalization.CultureInfo("pt-BR"))+" • "+label;info.Visible=true;code.Text=copyCode;code.Visible=copyCode.Length>0;copy.Visible=copyCode.Length>0;
  status.Text="Abra o app do seu banco e pague pelo QR Code ou pelo PIX copia e cola. O tempo entra sozinho assim que o pagamento for aprovado.";status.Visible=true;cancel.Text="Fechar";cancel.SetBounds(130,536,200,44);
 }
 async Task Check(){if(busy||chargeId==null)return;busy=true;
  try{var r=await post("pix/status",new {id=chargeId});string st=V(r,"status");
   if(st=="approved"){poll.Stop();status.ForeColor=Color.FromArgb(120,220,140);status.Text="Pagamento aprovado! Entrando…";DialogResult=DialogResult.OK;await Task.Delay(900);Close();return;}
   if(st=="expired"||st=="error"){poll.Stop();status.ForeColor=Color.FromArgb(255,138,144);status.Text=st=="expired"?"O PIX expirou. Feche e gere outro.":"Pagamento recebido, mas o tempo não entrou sozinho. Procure a recepção.";return;}
   int left=(int)Math.Max(0,(expires-DateTime.Now).TotalSeconds);status.Text="Aguardando o pagamento… expira em "+(left/60)+":"+(left%60).ToString("00")+". O tempo entra sozinho quando o PIX for aprovado.";}
  catch{}finally{busy=false;}
 }
 async Task CancelCharge(){poll.Stop();if(chargeId!=null&&DialogResult!=DialogResult.OK){try{await post("pix/cancel",new {id=chargeId});}catch{}}Close();}
}
