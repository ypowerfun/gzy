using System;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
// 2.0.30: tema visual do cliente igual ao painel do servidor 3.0.36 (logo oficial GameZoney,
// preto profundo, vermelho com brilho, cantos chanfrados e linha vermelha nas barras).
// Somente aparencia: nenhuma regra de sessao, bloqueio ou manutencao muda aqui.
public static class GzTheme {
 // 1.0.20 (plano Pro, "Personalizar visual" no Servidor): cor de destaque e logo da arena guardadas pelo SyncBranding em
 // Files.DirectoryPath (branding-color.txt / branding-logo.png). Carregadas aqui, ANTES das cores abaixo (ordem dos campos).
 // Só aparência: Tone() troca apenas os tons dourados (mesma regra do servidor); fundo, textos e alertas não mudam.
 static readonly double[] brand=LoadBrand();
 static readonly double[] gold=Hsl(Color.FromArgb(212,160,23));
 static double[] LoadBrand(){try{string f=Path.Combine(Files.DirectoryPath,"branding-color.txt");if(!File.Exists(f))return null;string t=File.ReadAllText(f).Trim().ToLowerInvariant();if(!System.Text.RegularExpressions.Regex.IsMatch(t,"^#[0-9a-f]{6}$"))return null;return Hsl(ColorTranslator.FromHtml(t));}catch{return null;}}
 static double[] Hsl(Color c){double r=c.R/255.0,g=c.G/255.0,b=c.B/255.0,max=Math.Max(r,Math.Max(g,b)),min=Math.Min(r,Math.Min(g,b)),l=(max+min)/2;if(max==min)return new double[]{0,0,l};double d=max-min,s=l>.5?d/(2-max-min):d/(max+min),h=max==r?(g-b)/d+(g<b?6:0):max==g?(b-r)/d+2:(r-g)/d+4;return new double[]{h*60,s,l};}
 static double Clamp(double v,double a,double b){return Math.Max(a,Math.Min(b,v));}
 static Color FromHsl(double h,double s,double l){h=((h%360)+360)%360/360;if(s==0){int v=(int)Math.Round(l*255);return Color.FromArgb(v,v,v);}double q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;Func<double,int> f=t=>{t=(t+1)%1;double v=t<1/6.0?p+(q-p)*6*t:t<.5?q:t<2/3.0?p+(q-p)*(2/3.0-t)*6:p;return (int)Math.Round(Clamp(v*255,0,255));};return Color.FromArgb(f(h+1/3.0),f(h),f(h-1/3.0));}
 public static bool Branded{get{return brand!=null;}}
 public static Color Tone(int r,int g,int b){var c=Color.FromArgb(r,g,b);if(brand==null)return c;var x=Hsl(c);if(x[0]<39||x[0]>52||x[1]<.45||x[2]<.12||x[2]>.9)return c;return FromHsl(brand[0]+(x[0]-gold[0]),Clamp(brand[1]*x[1]/gold[1],0,1),Clamp(x[2]+(brand[2]-gold[2]),.04,.96));}
 // GameZoney 1.0.1: identidade da logo GZ — preto, ouro e um detalhe vermelho. Os nomes Red/Red2/RedDark ficam
 // (usados no código todo), mas agora são o DOURADO de destaque; o vermelho de alerta é Alert.
 public static readonly Color Bg=GzTheme.Tone(7,7,9);
 public static readonly Color Panel=GzTheme.Tone(17,16,14);
 public static readonly Color Line=GzTheme.Tone(58,51,32);
 public static readonly Color Red=GzTheme.Tone(212,160,23);
 public static readonly Color Red2=GzTheme.Tone(255,206,58);
 public static readonly Color RedDark=GzTheme.Tone(122,88,10);
 public static readonly Color Alert=GzTheme.Tone(232,30,40);
 public static readonly Color Muted=GzTheme.Tone(128,131,142);
 public static readonly Color Green=GzTheme.Tone(47,210,122);
 public static readonly Color Amber=GzTheme.Tone(242,169,59);
 public static readonly Color Input=GzTheme.Tone(11,11,14);
 static Image mark,full;static bool markLoaded,fullLoaded;
 // Logo oficial GameZoney: marca (hexágono GZ) para as barras e logo completa para as janelas.
 public static Image Mark{get{if(!markLoaded){markLoaded=true;mark=LoadBrandLogo()??Load("logo-marca.png");}return mark;}}
 public static Image FullLogo{get{if(!fullLoaded){fullLoaded=true;full=LoadBrandLogo()??Load("logo-gamezoney.png");}return full;}}
 // 1.0.20: logo da arena (visual personalizado) no lugar da logo GameZoney
 static Image LoadBrandLogo(){if(brand==null)return null;try{string file=Path.Combine(Files.DirectoryPath,"branding-logo.png");if(!File.Exists(file))return null;using(var stream=File.OpenRead(file))using(var img=Image.FromStream(stream)){if(img.Width>2048||img.Height>2048)return null;return new Bitmap(img);}}catch{return null;}}
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

public enum GzButtonKind {Primary,Ghost,Danger,Neutral}

// Botao chanfrado desenhado pelo proprio cliente (sem o visual padrao do Windows).
public class GzButton : Button {
 public GzButtonKind Kind;bool hover,pressed;
 public GzButton(string text,GzButtonKind kind){Text=text;Kind=kind;FlatStyle=FlatStyle.Flat;FlatAppearance.BorderSize=0;Cursor=Cursors.Hand;ForeColor=Color.White;Font=new Font("Segoe UI",9.5f,FontStyle.Bold);SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true);}
 protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
 protected override void OnMouseLeave(EventArgs e){hover=false;pressed=false;Invalidate();base.OnMouseLeave(e);}
 protected override void OnMouseDown(MouseEventArgs e){pressed=true;Invalidate();base.OnMouseDown(e);}
 protected override void OnMouseUp(MouseEventArgs e){pressed=false;Invalidate();base.OnMouseUp(e);}
 protected override void OnEnabledChanged(EventArgs e){Invalidate();base.OnEnabledChanged(e);}
 protected override void OnTextChanged(EventArgs e){Invalidate();base.OnTextChanged(e);}
 protected override void OnGotFocus(EventArgs e){Invalidate();base.OnGotFocus(e);}
 protected override void OnLostFocus(EventArgs e){Invalidate();base.OnLostFocus(e);}
 protected override void OnPaint(PaintEventArgs e){
  var g=e.Graphics;Color back=Parent!=null?Parent.BackColor:GzTheme.Bg;g.Clear(back);g.SmoothingMode=SmoothingMode.AntiAlias;
  var r=new Rectangle(0,0,Width-1,Height-1);if(r.Width<4||r.Height<4)return;int alpha=Enabled?255:105;
  Color text=Color.White,border=GzTheme.Line;
  using(var path=GzTheme.Chamfer(r,8)){
   if(Kind==GzButtonKind.Primary){Color top=hover&&Enabled?GzTheme.Tone(255,226,120):GzTheme.Red2,bottom=pressed?GzTheme.Tone(150,105,10):GzTheme.Tone(196,140,14);using(var brush=new LinearGradientBrush(r,Color.FromArgb(alpha,top),Color.FromArgb(alpha,bottom),LinearGradientMode.Vertical))g.FillPath(brush,path);border=Color.Empty;text=GzTheme.Tone(20,15,4);}
   else if(Kind==GzButtonKind.Danger){using(var brush=new SolidBrush(Color.FromArgb(alpha,pressed?GzTheme.Tone(58,16,22):GzTheme.Tone(42,13,17))))g.FillPath(brush,path);border=hover&&Enabled?GzTheme.Red2:GzTheme.Tone(92,24,32);text=GzTheme.Tone(255,138,144);}
   else if(Kind==GzButtonKind.Neutral){using(var brush=new SolidBrush(Color.FromArgb(alpha,pressed?GzTheme.Tone(34,34,42):GzTheme.Tone(26,26,33))))g.FillPath(brush,path);border=hover&&Enabled?GzTheme.Red2:GzTheme.Line;}
   else{if(pressed){using(var brush=new SolidBrush(Color.FromArgb(28,255,255,255)))g.FillPath(brush,path);}border=hover&&Enabled?GzTheme.Red2:GzTheme.Line;}
   if(border!=Color.Empty)using(var pen=new Pen(Color.FromArgb(alpha,border)))g.DrawPath(pen,path);
   if(Focused&&ShowFocusCues&&Kind!=GzButtonKind.Primary)using(var pen=new Pen(Color.FromArgb(120,GzTheme.Red2)))g.DrawPath(pen,path);
  }
  TextRenderer.DrawText(g,(Text??"").ToUpperInvariant(),Font,r,Color.FromArgb(alpha,text),TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.SingleLine|TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix);
 }
}

// Campo de texto escuro com canto cortado; a borda fica vermelha quando o campo esta selecionado.
public class GzInputFrame : Panel {
 readonly TextBox box;
 public GzInputFrame(TextBox input,Padding padding){box=input;BackColor=GzTheme.Input;Padding=padding;input.BorderStyle=BorderStyle.None;input.BackColor=GzTheme.Input;input.ForeColor=Color.White;input.Dock=DockStyle.Fill;input.Margin=Padding.Empty;Controls.Add(input);SetStyle(ControlStyles.ResizeRedraw|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint|ControlStyles.UserPaint,true);input.GotFocus+=(a,e)=>Invalidate();input.LostFocus+=(a,e)=>Invalidate();MouseDown+=(a,e)=>input.Focus();}
 protected override void OnPaint(PaintEventArgs e){var g=e.Graphics;g.Clear(Parent!=null?Parent.BackColor:GzTheme.Bg);g.SmoothingMode=SmoothingMode.AntiAlias;var r=new Rectangle(0,0,Width-1,Height-1);using(var path=GzTheme.CornerCut(r,7)){using(var brush=new SolidBrush(GzTheme.Input))g.FillPath(brush,path);bool focus=box.ContainsFocus;using(var pen=new Pen(focus?GzTheme.Red2:GzTheme.Line,focus?1.6f:1f))g.DrawPath(pen,path);}}
}

// Faixa de progresso do tempo (proporcao do tempo restante na sessao atual).
public class GzProgress : Control {
 double value;bool low;
 public GzProgress(){SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true);}
 public void SetValue(double v,bool isLow){v=Math.Max(0,Math.Min(1,v));if(Math.Abs(v-value)<0.002&&isLow==low)return;value=v;low=isLow;Invalidate();}
 protected override void OnPaint(PaintEventArgs e){var g=e.Graphics;g.Clear(Parent!=null?Parent.BackColor:GzTheme.Bg);int h=4,y=(Height-h)/2;using(var b=new SolidBrush(GzTheme.Tone(31,31,38)))g.FillRectangle(b,0,y,Width,h);int w=(int)Math.Round(Width*value);if(w>0)using(var b=new LinearGradientBrush(new Rectangle(0,y,Math.Max(2,w),h),GzTheme.RedDark,low?GzTheme.Alert:GzTheme.Red,LinearGradientMode.Horizontal))g.FillRectangle(b,0,y,w,h);}
}

// Janela de senha (Manutencao / Recepcao e demais confirmacoes com senha) no padrao GameZoney.
public class GzDialog : Form {
 readonly TextBox input;
 public string Value{get{return input.Text;}}
 public GzDialog(string message,bool secret){
  Text="GameZoney";FormBorderStyle=FormBorderStyle.None;StartPosition=FormStartPosition.CenterScreen;TopMost=true;ShowInTaskbar=true;BackColor=GzTheme.Panel;ForeColor=Color.White;Font=new Font("Segoe UI",10);KeyPreview=true;
  int width=540,pad=26;
  string lower=(message??"").ToLowerInvariant();
  string heading=lower.Contains("manuten")?"MANUTENÇÃO / RECEPÇÃO":lower.Contains("administrador")?"ACESSO DO ADMINISTRADOR":"GameZoney";
  var logo=new PictureBox{Image=GzTheme.Mark,SizeMode=PictureBoxSizeMode.Zoom,Bounds=new Rectangle(pad,22,44,36),BackColor=Color.Transparent};
  var caption=new Label{Text="// ACESSO RESTRITO",ForeColor=GzTheme.Red2,Font=GzTheme.Mono(8.5f,FontStyle.Regular),AutoSize=false,Bounds=new Rectangle(pad+56,22,width-pad*2-56,16),BackColor=Color.Transparent};
  var title=new Label{Text=heading,ForeColor=Color.White,Font=new Font("Segoe UI",13,FontStyle.Bold),AutoSize=false,Bounds=new Rectangle(pad+56,38,width-pad*2-56,26),BackColor=Color.Transparent};
  var text=new Label{Text=message,ForeColor=GzTheme.Tone(185,188,196),AutoSize=false,BackColor=Color.Transparent};
  Size measured=TextRenderer.MeasureText(message??"",text.Font,new Size(width-pad*2,1000),TextFormatFlags.WordBreak);int textHeight=Math.Max(22,measured.Height+4);
  int y=86;text.Bounds=new Rectangle(pad,y,width-pad*2,textHeight);y+=textHeight+12;
  var fieldLabel=new Label{Text=secret?"SENHA":"INFORMAÇÃO",ForeColor=GzTheme.Muted,Font=GzTheme.Mono(8.5f,FontStyle.Regular),AutoSize=false,Bounds=new Rectangle(pad,y,width-pad*2,16),BackColor=Color.Transparent};y+=20;
  input=new TextBox{UseSystemPasswordChar=secret,MaxLength=128,Font=new Font("Segoe UI",13)};
  var frame=new GzInputFrame(input,new Padding(12,9,12,6)){Bounds=new Rectangle(pad,y,width-pad*2,42)};y+=42+24;
  var cancel=new GzButton("Cancelar",GzButtonKind.Ghost){DialogResult=DialogResult.Cancel,Bounds=new Rectangle(width-pad-150-12-130,y,130,38)};
  var ok=new GzButton("Confirmar",GzButtonKind.Primary){DialogResult=DialogResult.OK,Bounds=new Rectangle(width-pad-150,y,150,38)};
  y+=38+24;ClientSize=new Size(width,y);
  Controls.AddRange(new Control[]{logo,caption,title,text,fieldLabel,frame,cancel,ok});AcceptButton=ok;CancelButton=cancel;
  using(var path=GzTheme.Chamfer(new Rectangle(0,0,width,y),18))Region=new Region(path);
  Shown+=(a,e)=>{Activate();input.Select();input.Focus();};
 }
 protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);var g=e.Graphics;g.SmoothingMode=SmoothingMode.AntiAlias;var r=new Rectangle(0,0,ClientSize.Width-1,ClientSize.Height-1);using(var path=GzTheme.Chamfer(r,18))using(var pen=new Pen(GzTheme.Line))g.DrawPath(pen,path);g.SmoothingMode=SmoothingMode.None;GzTheme.Brackets(g,r);using(var pen=new Pen(GzTheme.Tone(36,36,44)))g.DrawLine(pen,26,74,ClientSize.Width-26,74);}
}

// 2.0.50: seta da barra flutuante (para cima = recolher; para baixo = abrir).
public class BarChevron : Control {
 readonly bool up;bool hover;
 public BarChevron(bool pointsUp){up=pointsUp;SetStyle(ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.UserPaint|ControlStyles.ResizeRedraw|ControlStyles.SupportsTransparentBackColor,true);Cursor=Cursors.Hand;BackColor=GzTheme.Bg;}
 protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
 protected override void OnMouseLeave(EventArgs e){hover=false;Invalidate();base.OnMouseLeave(e);}
 protected override void OnPaint(PaintEventArgs e){var g=e.Graphics;g.SmoothingMode=SmoothingMode.AntiAlias;g.Clear(BackColor);
  var box=new Rectangle(1,1,Width-3,Height-3);using(var path=GzTheme.Chamfer(box,5))using(var fill=new SolidBrush(hover?Color.FromArgb(70,GzTheme.Red):GzTheme.Tone(28,30,36)))using(var edge=new Pen(hover?GzTheme.Red:GzTheme.Tone(62,64,72))){g.FillPath(fill,path);g.DrawPath(edge,path);}
  GzTheme.Chevron(g,new Rectangle(0,0,Width,Height),up,Color.White);}
}
// 2.0.50: barra recolhida — aba pequena no topo com a logo, o tempo restante e a seta para abrir.
public class CollapsedTab : Control {
 readonly SessionBar bar;bool hover;
 public CollapsedTab(SessionBar owner){bar=owner;SetStyle(ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.UserPaint|ControlStyles.ResizeRedraw,true);Cursor=Cursors.Hand;BackColor=GzTheme.Bg;}
 protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
 protected override void OnMouseLeave(EventArgs e){hover=false;Invalidate();base.OnMouseLeave(e);}
 protected override void OnPaint(PaintEventArgs e){var g=e.Graphics;g.SmoothingMode=SmoothingMode.AntiAlias;g.TextRenderingHint=System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;g.Clear(hover?GzTheme.Tone(24,25,31):BackColor);
  int h=Height;if(GzTheme.Mark!=null)g.DrawImage(GzTheme.Mark,new Rectangle(12,(h-18)/2-1,20,18));
  using(var font=new Font("Consolas",12.5f,FontStyle.Bold))using(var brush=new SolidBrush(bar.TimeLabel.ForeColor)){var size=g.MeasureString(bar.TimeLabel.Text,font);g.DrawString(bar.TimeLabel.Text,font,brush,40,(h-size.Height)/2-1);}
  GzTheme.Chevron(g,new Rectangle(Width-38,0,26,h-2),bar.DockedNow,/* 2.0.51: na barra de tarefas a seta aponta para cima */hover?GzTheme.Red2:GzTheme.Tone(214,216,222));
  GzTheme.AccentLine(g,Width,h-2);}
}
