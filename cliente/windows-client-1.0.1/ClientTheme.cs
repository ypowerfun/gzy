using System;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
// 2.0.30: tema visual do cliente igual ao painel do servidor 3.0.36 (logo oficial GameZoney,
// preto profundo, vermelho com brilho, cantos chanfrados e linha vermelha nas barras).
// Somente aparencia: nenhuma regra de sessao, bloqueio ou manutencao muda aqui.
public static class PrimeTheme {
 // GameZoney 1.0.1: identidade da logo GZ — preto, ouro e um detalhe vermelho. Os nomes Red/Red2/RedDark ficam
 // (usados no código todo), mas agora são o DOURADO de destaque; o vermelho de alerta é Alert.
 public static readonly Color Bg=Color.FromArgb(7,7,9);
 public static readonly Color Panel=Color.FromArgb(17,16,14);
 public static readonly Color Line=Color.FromArgb(58,51,32);
 public static readonly Color Red=Color.FromArgb(212,160,23);
 public static readonly Color Red2=Color.FromArgb(255,206,58);
 public static readonly Color RedDark=Color.FromArgb(122,88,10);
 public static readonly Color Alert=Color.FromArgb(232,30,40);
 public static readonly Color Muted=Color.FromArgb(128,131,142);
 public static readonly Color Green=Color.FromArgb(47,210,122);
 public static readonly Color Amber=Color.FromArgb(242,169,59);
 public static readonly Color Input=Color.FromArgb(11,11,14);
 static Image mark,full;static bool markLoaded,fullLoaded;
 // Logo oficial GameZoney: marca (hexágono GZ) para as barras e logo completa para as janelas.
 public static Image Mark{get{if(!markLoaded){markLoaded=true;mark=Load("logo-marca.png");}return mark;}}
 public static Image FullLogo{get{if(!fullLoaded){fullLoaded=true;full=Load("logo-prime.png");}return full;}}
 static Image Load(string name){try{string file=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,name);if(!File.Exists(file))return null;using(var stream=File.OpenRead(file))using(var img=Image.FromStream(stream)){return new Bitmap(img);}}catch{return null;}}
 public static Font Mono(float size,FontStyle style){return new Font("Consolas",size,style);}
 // Retangulo com os cantos superior direito e inferior esquerdo cortados (o "A" da logo).
 public static GraphicsPath Chamfer(Rectangle r,int c){var p=new GraphicsPath();c=Math.Max(0,Math.Min(c,Math.Min(r.Width,r.Height)/2));p.AddPolygon(new Point[]{new Point(r.Left,r.Top),new Point(r.Right-c,r.Top),new Point(r.Right,r.Top+c),new Point(r.Right,r.Bottom),new Point(r.Left+c,r.Bottom),new Point(r.Left,r.Bottom-c)});return p;}
 // Somente o canto inferior direito cortado (campos de texto).
 public static GraphicsPath CornerCut(Rectangle r,int c){var p=new GraphicsPath();p.AddPolygon(new Point[]{new Point(r.Left,r.Top),new Point(r.Right,r.Top),new Point(r.Right,r.Bottom-c),new Point(r.Right-c,r.Bottom),new Point(r.Left,r.Bottom)});return p;}
 // Linha vermelha com brilho na base das barras (igual as linhas do wallpaper).
 public static void Chevron(Graphics g,Rectangle r,bool up,Color color){/* 2.0.50 */int cx=r.Left+r.Width/2,cy=r.Top+r.Height/2,w=Math.Max(4,Math.Min(r.Width,r.Height)/4);using(var pen=new Pen(color,2.2f){StartCap=LineCap.Round,EndCap=LineCap.Round,LineJoin=LineJoin.Round}){if(up)g.DrawLines(pen,new[]{new Point(cx-w,cy+w/2),new Point(cx,cy-w/2),new Point(cx+w,cy+w/2)});else g.DrawLines(pen,new[]{new Point(cx-w,cy-w/2),new Point(cx,cy+w/2),new Point(cx+w,cy-w/2)});}}
 public static void AccentLine(Graphics g,int width,int y){if(width<=4)return;var rect=new Rectangle(0,y,width,2);using(var brush=new LinearGradientBrush(rect,Color.Transparent,Color.Transparent,LinearGradientMode.Horizontal)){var blend=new ColorBlend();blend.Colors=new Color[]{Color.FromArgb(0,RedDark),RedDark,Red2,RedDark,Color.FromArgb(0,RedDark)};blend.Positions=new float[]{0f,.15f,.5f,.85f,1f};brush.InterpolationColors=blend;g.FillRectangle(brush,rect);}using(var glow=new LinearGradientBrush(new Rectangle(0,y-3,width,3),Color.FromArgb(0,Red2),Color.FromArgb(60,Red2),LinearGradientMode.Vertical))g.FillRectangle(glow,0,y-3,width,3);}
 // Cantoneiras vermelhas (HUD) nos cantos de um painel.
 public static void Brackets(Graphics g,Rectangle r){using(var pen=new Pen(Red2,2)){g.DrawLine(pen,r.Left+1,r.Top+1,r.Left+22,r.Top+1);g.DrawLine(pen,r.Left+1,r.Top+1,r.Left+1,r.Top+22);}using(var pen=new Pen(RedDark,2)){g.DrawLine(pen,r.Right-1,r.Bottom-1,r.Right-22,r.Bottom-1);g.DrawLine(pen,r.Right-1,r.Bottom-1,r.Right-1,r.Bottom-22);}}
}

public enum PrimeButtonKind {Primary,Ghost,Danger,Neutral}

// Botao chanfrado desenhado pelo proprio cliente (sem o visual padrao do Windows).
public class PrimeButton : Button {
 public PrimeButtonKind Kind;bool hover,pressed;
 public PrimeButton(string text,PrimeButtonKind kind){Text=text;Kind=kind;FlatStyle=FlatStyle.Flat;FlatAppearance.BorderSize=0;Cursor=Cursors.Hand;ForeColor=Color.White;Font=new Font("Segoe UI",9.5f,FontStyle.Bold);SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true);}
 protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
 protected override void OnMouseLeave(EventArgs e){hover=false;pressed=false;Invalidate();base.OnMouseLeave(e);}
 protected override void OnMouseDown(MouseEventArgs e){pressed=true;Invalidate();base.OnMouseDown(e);}
 protected override void OnMouseUp(MouseEventArgs e){pressed=false;Invalidate();base.OnMouseUp(e);}
 protected override void OnEnabledChanged(EventArgs e){Invalidate();base.OnEnabledChanged(e);}
 protected override void OnTextChanged(EventArgs e){Invalidate();base.OnTextChanged(e);}
 protected override void OnGotFocus(EventArgs e){Invalidate();base.OnGotFocus(e);}
 protected override void OnLostFocus(EventArgs e){Invalidate();base.OnLostFocus(e);}
 protected override void OnPaint(PaintEventArgs e){
  var g=e.Graphics;Color back=Parent!=null?Parent.BackColor:PrimeTheme.Bg;g.Clear(back);g.SmoothingMode=SmoothingMode.AntiAlias;
  var r=new Rectangle(0,0,Width-1,Height-1);if(r.Width<4||r.Height<4)return;int alpha=Enabled?255:105;
  Color text=Color.White,border=PrimeTheme.Line;
  using(var path=PrimeTheme.Chamfer(r,8)){
   if(Kind==PrimeButtonKind.Primary){Color top=hover&&Enabled?Color.FromArgb(255,226,120):PrimeTheme.Red2,bottom=pressed?Color.FromArgb(150,105,10):Color.FromArgb(196,140,14);using(var brush=new LinearGradientBrush(r,Color.FromArgb(alpha,top),Color.FromArgb(alpha,bottom),LinearGradientMode.Vertical))g.FillPath(brush,path);border=Color.Empty;text=Color.FromArgb(20,15,4);}
   else if(Kind==PrimeButtonKind.Danger){using(var brush=new SolidBrush(Color.FromArgb(alpha,pressed?Color.FromArgb(58,16,22):Color.FromArgb(42,13,17))))g.FillPath(brush,path);border=hover&&Enabled?PrimeTheme.Red2:Color.FromArgb(92,24,32);text=Color.FromArgb(255,138,144);}
   else if(Kind==PrimeButtonKind.Neutral){using(var brush=new SolidBrush(Color.FromArgb(alpha,pressed?Color.FromArgb(34,34,42):Color.FromArgb(26,26,33))))g.FillPath(brush,path);border=hover&&Enabled?PrimeTheme.Red2:PrimeTheme.Line;}
   else{if(pressed){using(var brush=new SolidBrush(Color.FromArgb(28,255,255,255)))g.FillPath(brush,path);}border=hover&&Enabled?PrimeTheme.Red2:PrimeTheme.Line;}
   if(border!=Color.Empty)using(var pen=new Pen(Color.FromArgb(alpha,border)))g.DrawPath(pen,path);
   if(Focused&&ShowFocusCues&&Kind!=PrimeButtonKind.Primary)using(var pen=new Pen(Color.FromArgb(120,PrimeTheme.Red2)))g.DrawPath(pen,path);
  }
  TextRenderer.DrawText(g,(Text??"").ToUpperInvariant(),Font,r,Color.FromArgb(alpha,text),TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.SingleLine|TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix);
 }
}

// Campo de texto escuro com canto cortado; a borda fica vermelha quando o campo esta selecionado.
public class PrimeInputFrame : Panel {
 readonly TextBox box;
 public PrimeInputFrame(TextBox input,Padding padding){box=input;BackColor=PrimeTheme.Input;Padding=padding;input.BorderStyle=BorderStyle.None;input.BackColor=PrimeTheme.Input;input.ForeColor=Color.White;input.Dock=DockStyle.Fill;input.Margin=Padding.Empty;Controls.Add(input);SetStyle(ControlStyles.ResizeRedraw|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint|ControlStyles.UserPaint,true);input.GotFocus+=(a,e)=>Invalidate();input.LostFocus+=(a,e)=>Invalidate();MouseDown+=(a,e)=>input.Focus();}
 protected override void OnPaint(PaintEventArgs e){var g=e.Graphics;g.Clear(Parent!=null?Parent.BackColor:PrimeTheme.Bg);g.SmoothingMode=SmoothingMode.AntiAlias;var r=new Rectangle(0,0,Width-1,Height-1);using(var path=PrimeTheme.CornerCut(r,7)){using(var brush=new SolidBrush(PrimeTheme.Input))g.FillPath(brush,path);bool focus=box.ContainsFocus;using(var pen=new Pen(focus?PrimeTheme.Red2:PrimeTheme.Line,focus?1.6f:1f))g.DrawPath(pen,path);}}
}

// Faixa de progresso do tempo (proporcao do tempo restante na sessao atual).
public class PrimeProgress : Control {
 double value;bool low;
 public PrimeProgress(){SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true);}
 public void SetValue(double v,bool isLow){v=Math.Max(0,Math.Min(1,v));if(Math.Abs(v-value)<0.002&&isLow==low)return;value=v;low=isLow;Invalidate();}
 protected override void OnPaint(PaintEventArgs e){var g=e.Graphics;g.Clear(Parent!=null?Parent.BackColor:PrimeTheme.Bg);int h=4,y=(Height-h)/2;using(var b=new SolidBrush(Color.FromArgb(31,31,38)))g.FillRectangle(b,0,y,Width,h);int w=(int)Math.Round(Width*value);if(w>0)using(var b=new LinearGradientBrush(new Rectangle(0,y,Math.Max(2,w),h),PrimeTheme.RedDark,low?PrimeTheme.Alert:PrimeTheme.Red,LinearGradientMode.Horizontal))g.FillRectangle(b,0,y,w,h);}
}

// Janela de senha (Manutencao / Recepcao e demais confirmacoes com senha) no padrao GameZoney.
public class PrimeDialog : Form {
 readonly TextBox input;
 public string Value{get{return input.Text;}}
 public PrimeDialog(string message,bool secret){
  Text="GameZoney";FormBorderStyle=FormBorderStyle.None;StartPosition=FormStartPosition.CenterScreen;TopMost=true;ShowInTaskbar=true;BackColor=PrimeTheme.Panel;ForeColor=Color.White;Font=new Font("Segoe UI",10);KeyPreview=true;
  int width=540,pad=26;
  string lower=(message??"").ToLowerInvariant();
  string heading=lower.Contains("manuten")?"MANUTENÇÃO / RECEPÇÃO":lower.Contains("administrador")?"ACESSO DO ADMINISTRADOR":"GameZoney";
  var logo=new PictureBox{Image=PrimeTheme.Mark,SizeMode=PictureBoxSizeMode.Zoom,Bounds=new Rectangle(pad,22,44,36),BackColor=Color.Transparent};
  var caption=new Label{Text="// ACESSO RESTRITO",ForeColor=PrimeTheme.Red2,Font=PrimeTheme.Mono(8.5f,FontStyle.Regular),AutoSize=false,Bounds=new Rectangle(pad+56,22,width-pad*2-56,16),BackColor=Color.Transparent};
  var title=new Label{Text=heading,ForeColor=Color.White,Font=new Font("Segoe UI",13,FontStyle.Bold),AutoSize=false,Bounds=new Rectangle(pad+56,38,width-pad*2-56,26),BackColor=Color.Transparent};
  var text=new Label{Text=message,ForeColor=Color.FromArgb(185,188,196),AutoSize=false,BackColor=Color.Transparent};
  Size measured=TextRenderer.MeasureText(message??"",text.Font,new Size(width-pad*2,1000),TextFormatFlags.WordBreak);int textHeight=Math.Max(22,measured.Height+4);
  int y=86;text.Bounds=new Rectangle(pad,y,width-pad*2,textHeight);y+=textHeight+12;
  var fieldLabel=new Label{Text=secret?"SENHA":"INFORMAÇÃO",ForeColor=PrimeTheme.Muted,Font=PrimeTheme.Mono(8.5f,FontStyle.Regular),AutoSize=false,Bounds=new Rectangle(pad,y,width-pad*2,16),BackColor=Color.Transparent};y+=20;
  input=new TextBox{UseSystemPasswordChar=secret,MaxLength=128,Font=new Font("Segoe UI",13)};
  var frame=new PrimeInputFrame(input,new Padding(12,9,12,6)){Bounds=new Rectangle(pad,y,width-pad*2,42)};y+=42+24;
  var cancel=new PrimeButton("Cancelar",PrimeButtonKind.Ghost){DialogResult=DialogResult.Cancel,Bounds=new Rectangle(width-pad-150-12-130,y,130,38)};
  var ok=new PrimeButton("Confirmar",PrimeButtonKind.Primary){DialogResult=DialogResult.OK,Bounds=new Rectangle(width-pad-150,y,150,38)};
  y+=38+24;ClientSize=new Size(width,y);
  Controls.AddRange(new Control[]{logo,caption,title,text,fieldLabel,frame,cancel,ok});AcceptButton=ok;CancelButton=cancel;
  using(var path=PrimeTheme.Chamfer(new Rectangle(0,0,width,y),18))Region=new Region(path);
  Shown+=(a,e)=>{Activate();input.Select();input.Focus();};
 }
 protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);var g=e.Graphics;g.SmoothingMode=SmoothingMode.AntiAlias;var r=new Rectangle(0,0,ClientSize.Width-1,ClientSize.Height-1);using(var path=PrimeTheme.Chamfer(r,18))using(var pen=new Pen(PrimeTheme.Line))g.DrawPath(pen,path);g.SmoothingMode=SmoothingMode.None;PrimeTheme.Brackets(g,r);using(var pen=new Pen(Color.FromArgb(36,36,44)))g.DrawLine(pen,26,74,ClientSize.Width-26,74);}
}

// 2.0.50: seta da barra flutuante (para cima = recolher; para baixo = abrir).
public class BarChevron : Control {
 readonly bool up;bool hover;
 public BarChevron(bool pointsUp){up=pointsUp;SetStyle(ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.UserPaint|ControlStyles.ResizeRedraw|ControlStyles.SupportsTransparentBackColor,true);Cursor=Cursors.Hand;BackColor=PrimeTheme.Bg;}
 protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
 protected override void OnMouseLeave(EventArgs e){hover=false;Invalidate();base.OnMouseLeave(e);}
 protected override void OnPaint(PaintEventArgs e){var g=e.Graphics;g.SmoothingMode=SmoothingMode.AntiAlias;g.Clear(BackColor);
  var box=new Rectangle(1,1,Width-3,Height-3);using(var path=PrimeTheme.Chamfer(box,5))using(var fill=new SolidBrush(hover?Color.FromArgb(70,PrimeTheme.Red):Color.FromArgb(28,30,36)))using(var edge=new Pen(hover?PrimeTheme.Red:Color.FromArgb(62,64,72))){g.FillPath(fill,path);g.DrawPath(edge,path);}
  PrimeTheme.Chevron(g,new Rectangle(0,0,Width,Height),up,Color.White);}
}
// 2.0.50: barra recolhida — aba pequena no topo com a logo, o tempo restante e a seta para abrir.
public class CollapsedTab : Control {
 readonly SessionBar bar;bool hover;
 public CollapsedTab(SessionBar owner){bar=owner;SetStyle(ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.UserPaint|ControlStyles.ResizeRedraw,true);Cursor=Cursors.Hand;BackColor=PrimeTheme.Bg;}
 protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
 protected override void OnMouseLeave(EventArgs e){hover=false;Invalidate();base.OnMouseLeave(e);}
 protected override void OnPaint(PaintEventArgs e){var g=e.Graphics;g.SmoothingMode=SmoothingMode.AntiAlias;g.TextRenderingHint=System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;g.Clear(hover?Color.FromArgb(24,25,31):BackColor);
  int h=Height;if(PrimeTheme.Mark!=null)g.DrawImage(PrimeTheme.Mark,new Rectangle(12,(h-18)/2-1,20,18));
  using(var font=new Font("Consolas",12.5f,FontStyle.Bold))using(var brush=new SolidBrush(bar.TimeLabel.ForeColor)){var size=g.MeasureString(bar.TimeLabel.Text,font);g.DrawString(bar.TimeLabel.Text,font,brush,40,(h-size.Height)/2-1);}
  PrimeTheme.Chevron(g,new Rectangle(Width-38,0,26,h-2),bar.DockedNow,/* 2.0.51: na barra de tarefas a seta aponta para cima */hover?PrimeTheme.Red2:Color.FromArgb(214,216,222));
  PrimeTheme.AccentLine(g,Width,h-2);}
}
