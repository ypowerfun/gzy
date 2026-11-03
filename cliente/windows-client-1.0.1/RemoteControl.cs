using System;
using System.IO;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Runtime.InteropServices;
// Only visible applications created after the observed start of this member session.
public class RemoteControl {
 public string Session="";DateTime began;HashSet<string> baseline=new HashSet<string>();
 public List<object> Results=new List<object>();HashSet<string> executed=new HashSet<string>();
 public void SetSession(string session){session=session??"";if(Session==session)return;Session=session;began=DateTime.UtcNow;baseline.Clear();foreach(var p in Process.GetProcesses())using(p){try{baseline.Add(Key(p));}catch{}}}
 static string Key(Process p){return p.Id+":"+p.StartTime.ToUniversalTime().Ticks;}
 bool Eligible(Process p){return Session!=""&&p.Id!=Process.GetCurrentProcess().Id&&p.SessionId==Process.GetCurrentProcess().SessionId&&p.StartTime.ToUniversalTime()>=began&&!baseline.Contains(Key(p))&&p.MainWindowHandle!=IntPtr.Zero&&p.ProcessName!="MonitorGZ"&&p.ProcessName!="GameZoneyCliente";}
 [DllImport("user32.dll")]static extern bool IsHungAppWindow(IntPtr window);
 public static string WindowStatus(IntPtr window){try{return IsHungAppWindow(window)?"not-responding":"running";}catch{return "unknown";}}
 public string TerminateApplication(int pid,string ticks){using(var p=Process.GetProcessById(pid)){if(p.Handle==IntPtr.Zero)throw new Exception("Processo indisponível.");if(!Eligible(p)||p.StartTime.ToUniversalTime().Ticks.ToString()!=ticks)throw new Exception("O programa mudou ou não pertence a esta sessão.");p.Kill();return p.WaitForExit(3000)?"Tarefa finalizada.":"Finalização solicitada; aguardando o Windows liberar o processo.";}}
 public object[] Inventory(){var list=new List<object>();foreach(var p in Process.GetProcesses())using(p){try{if(Eligible(p)&&list.Count<100)list.Add(new {pid=p.Id,started=p.StartTime.ToUniversalTime().Ticks.ToString(),name=p.ProcessName+".exe",status=WindowStatus(p.MainWindowHandle)});}catch{}}return list.ToArray();}
 public string CloseApplication(int pid,string ticks){using(var p=Process.GetProcessById(pid)){if(!Eligible(p)||p.StartTime.ToUniversalTime().Ticks.ToString()!=ticks)throw new Exception("O programa mudou ou não pertence a esta sessão.");return p.CloseMainWindow()?"Fechamento solicitado. O programa pode pedir para salvar arquivos.":"O programa não aceitou o fechamento.";}}
 public bool First(string id){return executed.Add(id);}
 public static void Power(string type){if(type!="restart"&&type!="shutdown")throw new Exception("Comando inválido.");string action=type=="restart"?"/r":"/s";var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"shutdown.exe"),action+" /t 15 /c \"GameZoney: comando da recepção. Salve seus arquivos.\""){UseShellExecute=false,CreateNoWindow=true};using(var process=Process.Start(info)){process.WaitForExit();if(process.ExitCode!=0)throw new Exception("O Windows recusou o comando de energia.");}}
 public void Result(string id,string result){Results.Add(new {id=id,result=result});if(Results.Count>10)Results.RemoveAt(0);}
 public static string Capture(){Rectangle area=Screen.PrimaryScreen.Bounds;using(var full=new Bitmap(area.Width,area.Height))using(var g=Graphics.FromImage(full)){g.CopyFromScreen(area.Location,Point.Empty,area.Size);int width=Math.Min(1280,area.Width),height=Math.Max(1,(int)((double)area.Height*width/area.Width));using(var small=new Bitmap(width,height))using(var sg=Graphics.FromImage(small))using(var stream=new MemoryStream()){sg.DrawImage(full,0,0,width,height);ImageCodecInfo jpeg=null;foreach(var codec in ImageCodecInfo.GetImageEncoders())if(codec.MimeType=="image/jpeg")jpeg=codec;using(var parameters=new EncoderParameters(1)){parameters.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,55L);small.Save(stream,jpeg,parameters);}return Convert.ToBase64String(stream.ToArray());}}}
}
