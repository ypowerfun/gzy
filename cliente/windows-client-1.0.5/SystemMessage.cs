using System;
using System.IO;
using System.Drawing;
using System.Drawing.Text;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// 1.0.5: "Enviar Mensagem" (Ações dos PCs). Aviso "AVISO DO SISTEMA" no canto superior esquerdo, só o texto (sem fundo),
// por cima de tudo, pelo tempo definido no servidor. A janela NÃO recebe clique nem teclado e NÃO rouba o foco
// (WS_EX_TRANSPARENT + WS_EX_NOACTIVATE + WS_EX_LAYERED): o cliente continua jogando normalmente.
// Fonte: Montserrat (pasta "fonts" do cliente ou instalada no Windows); se não houver, Segoe UI Black / Arial Black.
// 1.0.13: letras ~20% menores (ocupavam muito da tela); mesma fonte e posição. Também mostra os avisos automáticos do
// servidor (tempo acabando e prêmio da fidelidade), que chegam pela mesma fila do Enviar Mensagem.
// Trecho entre *asteriscos* sai em dourado (ex.: "Servidor encerra em *20 minutos!*").
public class SystemMessage : Form {
 [DllImport("user32.dll")] static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref MsgPoint pptDst, ref MsgSize psize, IntPtr hdcSrc, ref MsgPoint pprSrc, int crKey, ref MsgBlend pblend, int dwFlags);
 [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hWnd);
 [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
 [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr hDC);
 [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr hdc);
 [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr hDC, IntPtr hObject);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr hObject);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
 [StructLayout(LayoutKind.Sequential)] struct MsgPoint { public int x, y; public MsgPoint(int a, int b) { x = a; y = b; } }
 [StructLayout(LayoutKind.Sequential)] struct MsgSize { public int cx, cy; public MsgSize(int a, int b) { cx = a; cy = b; } }
 [StructLayout(LayoutKind.Sequential, Pack = 1)] struct MsgBlend { public byte op, flags, alpha, format; }

 static readonly Color Gold = GzTheme.Tone(255,201,38), GoldTop = GzTheme.Tone(255,220,92), GoldBottom = GzTheme.Tone(232,168,18);
 static PrivateFontCollection privateFonts; static FontFamily family; static FontStyle familyStyle;
 readonly string text; readonly int seconds; readonly Stopwatch clock = new Stopwatch(); Timer timer; Rectangle screen;

 protected override bool ShowWithoutActivation { get { return true; } }
 protected override CreateParams CreateParams { get { var cp = base.CreateParams; cp.ExStyle |= 0x00080000 | 0x00000020 | 0x08000000 | 0x00000080 | 0x00000008; return cp; } }

 public SystemMessage(string text, int seconds) {
  this.text = (text ?? "").Trim(); this.seconds = Math.Max(3, Math.Min(3600, seconds));
  FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; TopMost = true; StartPosition = FormStartPosition.Manual; Text = "Aviso do sistema";
  screen = Screen.PrimaryScreen.Bounds;
  Bounds = new Rectangle(screen.Left, screen.Top, Math.Max(320, (int)(screen.Width * 0.66)), Math.Max(160, (int)(screen.Height * 0.6)));
 }
 protected override void OnShown(EventArgs e) {
  base.OnShown(e); clock.Start(); Frame();
  timer = new Timer { Interval = 80 }; timer.Tick += (a, b) => Frame(); timer.Start();
 }
 protected override void OnFormClosed(FormClosedEventArgs e) { if (timer != null) { timer.Stop(); timer.Dispose(); timer = null; } base.OnFormClosed(e); }
 protected override void WndProc(ref Message m) { if (m.Msg == 0x0084) { m.Result = (IntPtr)(-1); return; } /* HTTRANSPARENT */ base.WndProc(ref m); }

 void Frame() {
  if (IsDisposed || !IsHandleCreated) return;
  double t = clock.Elapsed.TotalMilliseconds, total = seconds * 1000.0;
  if (t >= total) { Close(); return; }
  double alpha = Math.Min(1, t / 300.0); if (total - t < 500) alpha = Math.Max(0, (total - t) / 500.0);
  double pulse = 0.84 + 0.16 * Math.Cos(t / 1000.0 * Math.PI); // brilho suave do texto branco (como no exemplo)
  try { Render((byte)(alpha * 255), pulse); } catch { }
  SetWindowPos(Handle, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0200); // TOPMOST sem ativar/mover
 }

 static FontFamily Family() {
  if (family != null) return family;
  try {
   string dir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "fonts");
   foreach (string f in new[] { "Montserrat-ExtraBold.ttf", "Montserrat-Bold.ttf", "Montserrat-Black.ttf" }) {
    string p = Path.Combine(dir, f); if (!File.Exists(p)) continue;
    privateFonts = new PrivateFontCollection(); privateFonts.AddFontFile(p); family = privateFonts.Families[0]; break;
   }
  } catch { family = null; }
  if (family == null) foreach (string n in new[] { "Montserrat ExtraBold", "Montserrat", "Segoe UI Black", "Arial Black", "Segoe UI" }) {
   try { family = new FontFamily(n); break; } catch { }
  }
  if (family == null) family = FontFamily.GenericSansSerif;
  bool plainHeavy = family.Name.IndexOf("Black", StringComparison.OrdinalIgnoreCase) >= 0 || family.Name.IndexOf("ExtraBold", StringComparison.OrdinalIgnoreCase) >= 0;
  familyStyle = !plainHeavy && family.IsStyleAvailable(FontStyle.Bold) ? FontStyle.Bold : family.IsStyleAvailable(FontStyle.Regular) ? FontStyle.Regular : FontStyle.Bold;
  return family;
 }

 struct Word { public string Text; public bool Gold; public bool Break; }
 static List<Word> Words(string text) {
  var list = new List<Word>(); bool gold = false; var current = new System.Text.StringBuilder();
  Action flush = () => { if (current.Length > 0) { list.Add(new Word { Text = current.ToString(), Gold = gold }); current.Clear(); } };
  foreach (char c in text.ToUpper(new System.Globalization.CultureInfo("pt-BR"))) {
   if (c == '*') { flush(); gold = !gold; continue; }
   if (c == '\n') { flush(); list.Add(new Word { Break = true }); continue; }
   if (c == '\r') continue;
   if (char.IsWhiteSpace(c)) { flush(); continue; }
   current.Append(c);
  }
  flush(); return list;
 }

 void Render(byte alpha, double pulse) {
  int w = Width, h = Height;
  using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
   using (var g = Graphics.FromImage(bmp)) { g.Clear(Color.Transparent); Draw(g, text, w, h, screen.Width, screen.Height, pulse); }
   Push(bmp, w, h, alpha);
  }
 }
 // Prévia (teste/visual): desenha o aviso numa imagem do tamanho da tela.
 public static void Preview(string text, Image background, string file) {
  int W = background.Width, H = background.Height;
  using (var bmp = new Bitmap(background)) { using (var g = Graphics.FromImage(bmp)) Draw(g, text, (int)(W * 0.66), (int)(H * 0.6), W, H, 1.0); bmp.Save(file, ImageFormat.Png); }
 }
 static void Draw(Graphics g, string text, int w, int h, float W, float H, double pulse) {
   {
    g.SmoothingMode = SmoothingMode.AntiAlias; g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
    var fam = Family(); var fmt = StringFormat.GenericTypographic; fmt.FormatFlags |= StringFormatFlags.MeasureTrailingSpaces;
    float left = W * 0.046f, top = H * 0.06f, maxWidth = W * 0.30f;
    using (var titleFont = new Font(fam, Math.Max(10f, H * 0.017f), familyStyle, GraphicsUnit.Pixel))
    using (var mainFont = new Font(fam, Math.Max(16f, H * 0.034f), familyStyle, GraphicsUnit.Pixel))
    using (var shadow = new SolidBrush(Color.FromArgb(150, 0, 0, 0)))
    using (var goldBrush = new SolidBrush(Gold)) {
     int white = (int)(255 * pulse);
     using (var whiteBrush = new SolidBrush(Color.FromArgb(255, white, white, Math.Min(255, white + 4)))) {
      g.DrawString("AVISO DO SISTEMA", titleFont, shadow, left + 1, top + 1, fmt);
      g.DrawString("AVISO DO SISTEMA", titleFont, goldBrush, left, top, fmt);
      float y = top + titleFont.Size * 1.45f, lineH = mainFont.Size * 1.12f, x = left;
      float space = g.MeasureString("A A", mainFont, 10000, fmt).Width - g.MeasureString("AA", mainFont, 10000, fmt).Width;
      foreach (var word in Words(text)) {
       if (word.Break) { x = left; y += lineH; continue; }
       float ww = g.MeasureString(word.Text, mainFont, 100000, fmt).Width;
       if (x > left && x + ww > left + maxWidth) { x = left; y += lineH; }
       if (y + lineH > h) break;
       g.DrawString(word.Text, mainFont, shadow, x + 2, y + 2, fmt);
       if (word.Gold) using (var lg = new LinearGradientBrush(new RectangleF(x, y, Math.Max(1, ww), lineH), GoldTop, GoldBottom, LinearGradientMode.Vertical)) g.DrawString(word.Text, mainFont, lg, x, y, fmt);
       else g.DrawString(word.Text, mainFont, whiteBrush, x, y, fmt);
       x += ww + space;
      }
     }
    }
   }
 }
 void Push(Bitmap bmp, int w, int h, byte alpha) {
   IntPtr screenDc = GetDC(IntPtr.Zero), memDc = CreateCompatibleDC(screenDc), hBitmap = IntPtr.Zero, old = IntPtr.Zero;
   try {
    hBitmap = bmp.GetHbitmap(Color.FromArgb(0)); old = SelectObject(memDc, hBitmap);
    var size = new MsgSize(w, h); var src = new MsgPoint(0, 0); var pos = new MsgPoint(Left, Top);
    var blend = new MsgBlend { op = 0, flags = 0, alpha = alpha, format = 1 };
    UpdateLayeredWindow(Handle, screenDc, ref pos, ref size, memDc, ref src, 0, ref blend, 2);
   } finally {
    ReleaseDC(IntPtr.Zero, screenDc);
    if (hBitmap != IntPtr.Zero) { SelectObject(memDc, old); DeleteObject(hBitmap); }
    DeleteDC(memDc);
   }
  }
 }
