using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
class FocusRegression {
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateDesktop(string name,IntPtr device,IntPtr mode,uint flags,uint access,IntPtr security);
 [DllImport("user32.dll",SetLastError=true)]static extern bool SetThreadDesktop(IntPtr desktop);
 static FieldInfo Field(string name){return typeof(ClientForm).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic);}
 [STAThread]static int Main(string[] args){
 IntPtr desktop=CreateDesktop("PrimeFocusTest"+Guid.NewGuid().ToString("N"),IntPtr.Zero,IntPtr.Zero,0,0x10000000,IntPtr.Zero);
 if(desktop==IntPtr.Zero){File.WriteAllText(args[0],"UNAVAILABLE desktop "+Marshal.GetLastWin32Error());return 2;}int result=2;
 var worker=new System.Threading.Thread(()=>{if(!SetThreadDesktop(desktop)){File.WriteAllText(args[0],"UNAVAILABLE thread desktop "+Marshal.GetLastWin32Error());return;}result=RunTest(args);});worker.SetApartmentState(System.Threading.ApartmentState.STA);worker.Start();worker.Join();return result;
 }
 static void Run(ClientForm form,string name){var task=(System.Threading.Tasks.Task)typeof(ClientForm).GetMethod(name,BindingFlags.Instance|BindingFlags.NonPublic).Invoke(form,null);var timeout=System.Diagnostics.Stopwatch.StartNew();while(!task.IsCompleted){Application.DoEvents();System.Threading.Thread.Sleep(10);if(timeout.ElapsedMilliseconds>10000)throw new Exception("Timeout "+name);}task.GetAwaiter().GetResult();}
 class FakeConnection:Transport {public bool Approved;public int StateCalls;public int Setups,Logins,MaintenanceCalls,DisconnectCalls;public string MaintenanceSession;bool revoked=true;public FakeConnection(Settings s):base(s){}public override System.Collections.Generic.Dictionary<string,object> Post(string action,object body){if(action=="state")StateCalls++;if(action=="disconnect"){DisconnectCalls++;return new System.Collections.Generic.Dictionary<string,object>{{"ok",true}};}if(action=="maintenance"){MaintenanceCalls++;var data=Files.Json.Deserialize<System.Collections.Generic.Dictionary<string,object>>(Files.Json.Serialize(body));MaintenanceSession=Convert.ToString(data["sessionId"]);return new System.Collections.Generic.Dictionary<string,object>{{"adminAccess",new System.Collections.Generic.Dictionary<string,object>{{"username","Manutenção / recepção"}}},{"active",null},{"last",null},{"stationName","Teste"}};}if(action=="login"||action=="admin-login")Logins++;if(action=="setup"){Setups++;return new System.Collections.Generic.Dictionary<string,object>{{"status",Approved?"approved":"pending"},{"code","AABB1234"},{"token",new string('a',64)},{"stationName","Teste"}};}if(revoked){revoked=false;throw new ConnectionFailure("Revogado",401);}var layout=new System.Collections.Generic.Dictionary<string,object>{{"revision","test-layout"},{"position","right"}};if(action=="wallpaper"){using(var image=new System.Drawing.Bitmap(32,32))using(var graphics=System.Drawing.Graphics.FromImage(image))using(var stream=new MemoryStream()){graphics.Clear(System.Drawing.Color.DarkSlateBlue);image.Save(stream,System.Drawing.Imaging.ImageFormat.Png);return new System.Collections.Generic.Dictionary<string,object>{{"layout",layout},{"image",Convert.ToBase64String(stream.ToArray())}};}}return new System.Collections.Generic.Dictionary<string,object>{{"loginLayout",layout},{"adminAccess",null},{"active",null},{"last",null},{"stationName","Teste"}};}}
 static int RunTest(string[] args){
  try{Files.DirectoryPath=Path.Combine(Path.GetTempPath(),"prime-layout-test-"+Guid.NewGuid().ToString("N"));Application.EnableVisualStyles();var settings=new Settings{server="https://127.0.0.1:3443",fingerprint=new string('0',64),token=new string('0',64),stationName="Teste"};
   using(var parent=new ClientForm(settings,true)){
    Field("saveSettings").SetValue(parent,new Action<Settings>(x=>{}));int warnings=0;Field("closeWarning").SetValue(parent,new Action(()=>warnings++));var denied=new FormClosingEventArgs(CloseReason.TaskManagerClosing,false);typeof(ClientForm).GetMethod("OnClosing",BindingFlags.Instance|BindingFlags.NonPublic,null,new Type[]{typeof(object),typeof(FormClosingEventArgs)},null).Invoke(parent,new object[]{parent,denied});if(!denied.Cancel||warnings!=1)throw new Exception("Fechamento por gerenciador permitido no modo usuario");int applied=0,restored=0;Field("applyPolicies").SetValue(parent,new Action<Settings>(x=>applied++));Field("restorePolicies").SetValue(parent,new Action<Settings>(x=>restored++));parent.Show();if(((Control)Field("content").GetValue(parent)).Visible)throw new Exception("Login deveria iniciar oculto");typeof(ClientForm).GetMethod("RevealLogin",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(parent,null);if(!((Control)Field("content").GetValue(parent)).Visible||!((TextBox)Field("username").GetValue(parent)).Focused)throw new Exception("Login nao abriu com foco");Field("maintenanceDialogOpen").SetValue(parent,true);
    var budget=(TimeBudget)Field("budget").GetValue(parent);budget.Update("test-session",1,-10000);long received=budget.received;
    int ticks=0;Exception failure=null;Form dialog=null;
    using(var timer=new Timer{Interval=100}){
     timer.Tick+=(a,e)=>{try{
      foreach(Form form in Application.OpenForms)if(form.Owner==parent)dialog=form;
      if(dialog==null)throw new Exception("Prompt sem janela proprietaria");
      TextBox input=null;foreach(Control c in dialog.Controls)if(c is TextBox)input=(TextBox)c;
      if(input==null||dialog.ActiveControl!=input||!input.Focused)throw new Exception("Campo perdeu foco");
      typeof(ClientForm).GetMethod("RefreshClock",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(parent,null);
      typeof(ClientForm).GetMethod("LockScreen",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(parent,new object[]{true});
      if(dialog.ActiveControl!=input||!input.Focused)throw new Exception("Atualizacao roubou foco");
      if(budget.received!=received||budget.Left(10000)!=0)throw new Exception("Prazo da sessao foi pausado");
      input.SelectedText="x";ticks++;if(ticks==12){timer.Stop();dialog.DialogResult=DialogResult.OK;}
     }catch(Exception error){failure=error;timer.Stop();if(dialog!=null)dialog.DialogResult=DialogResult.Cancel;else Application.ExitThread();}};
     timer.Start();var text=ClientForm.Prompt("Senha de manutencao",true,parent);timer.Stop();if(failure!=null)throw failure;if(text!=new string('x',12))throw new Exception("Digitacao incompleta");
    }
    Field("maintenanceDialogOpen").SetValue(parent,false);
    var apply=typeof(ClientForm).GetMethod("Apply",BindingFlags.Instance|BindingFlags.NonPublic);
    var response=new System.Collections.Generic.Dictionary<string,object>{{"adminAccess",new System.Collections.Generic.Dictionary<string,object>{{"username","gestor"}}},{"active",null},{"last",null},{"stationName","PC teste"}};
    apply.Invoke(parent,new object[]{response});if(!(bool)Field("adminSession").GetValue(parent)||restored!=1||(bool)Field("locked").GetValue(parent))throw new Exception("Administrador nao liberado");
    response["adminAccess"]=null;apply.Invoke(parent,new object[]{response});if((bool)Field("adminSession").GetValue(parent)||applied!=1||!(bool)Field("locked").GetValue(parent))throw new Exception("Saida nao restaurou bloqueios");
    response["adminAccess"]=new System.Collections.Generic.Dictionary<string,object>{{"username","gestor"}};apply.Invoke(parent,new object[]{response});budget.received=-20000;typeof(ClientForm).GetMethod("RefreshClock",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(parent,null);if((bool)Field("adminSession").GetValue(parent)||applied!=2||!(bool)Field("locked").GetValue(parent))throw new Exception("Perda de contato nao restaurou bloqueios");
    response["adminAccess"]=null;response["serverNow"]=30900L;response["last"]=new System.Collections.Generic.Dictionary<string,object>{{"id","ended-session"},{"memberName","Cliente teste"},{"startedAt",0L},{"finishedAt",1000L},{"usedSeconds",1},{"remainingSeconds",0}};apply.Invoke(parent,new object[]{response});var summary=(Label)Field("summary").GetValue(parent);if(!summary.Visible)throw new Exception("Resumo nao apareceu");System.Threading.Thread.Sleep(180);typeof(ClientForm).GetMethod("RefreshClock",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(parent,null);if(summary.Visible||summary.Text!=""||((Label)Field("status").GetValue(parent)).Text!="Disponível")throw new Exception("Resumo nao foi ocultado");response["serverNow"]=31080L;apply.Invoke(parent,new object[]{response});if(summary.Visible)throw new Exception("Consulta reabriu resumo expirado");var fake=new FakeConnection(settings);Field("transport").SetValue(parent,fake);
    Run(parent,"Poll");if((bool)Field("authorized").GetValue(parent)||String.IsNullOrEmpty(settings.setupDevice))throw new Exception("Revogacao nao iniciou reautorizacao");
    string device=settings.setupDevice;Run(parent,"Poll");if(settings.setupDevice!=device||fake.Setups!=1||((Button)Field("login").GetValue(parent)).Enabled)throw new Exception("Pendencia liberou login ou mudou identidade");
    Run(parent,"Login");if(fake.Logins!=0)throw new Exception("Login permitido antes da aprovacao");
    fake.Approved=true;Run(parent,"Poll");if(settings.setupDevice!=null||settings.token!=new string('a',64))throw new Exception("Aprovacao nao persistida");
    Field("transport").SetValue(parent,fake);Run(parent,"Poll");if(!(bool)Field("authorized").GetValue(parent)||parent.BackgroundImage==null||settings.layoutPosition!="right")throw new Exception("Fundo ou autorizacao nao aplicado");
    Field("maintenanceDialogOpen").SetValue(parent,true);Field("registeringPassword").SetValue(parent,true);int beforeHeartbeat=fake.StateCalls;Run(parent,"Poll");if(fake.StateCalls!=beforeHeartbeat+1)throw new Exception("Cadastro de senha bloqueou heartbeat");Field("registeringPassword").SetValue(parent,false);Field("maintenanceDialogOpen").SetValue(parent,false);
    if(parent.Controls[0].Left!=0||parent.Controls[0].Width!=parent.ClientSize.Width)throw new Exception("Barra nao ocupa topo");
    typeof(ClientForm).GetMethod("RevealLogin",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(parent,null);if(!((Control)Field("content").GetValue(parent)).Visible)throw new Exception("Login nao apareceu");
    using(var image=new System.Drawing.Bitmap(parent.Width,parent.Height)){parent.DrawToBitmap(image,parent.ClientRectangle);image.Save(args[0]+".png");}
    if(((Control)Field("content").GetValue(parent)).Top!=0)throw new Exception("Login fora do topo");
    typeof(ClientForm).GetMethod("HideLogin",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(parent,null);
    summary.Text="Sessão finalizada • Teste\nInício: 30/09 16:10\nTérmino: 30/09 16:15\nUtilizado: 00:05:00   Restante: 00:25:00";summary.Visible=true;
    if(summary.BackColor!=System.Drawing.Color.Transparent||((Label)Field("wakeHint").GetValue(parent)).BackColor!=System.Drawing.Color.Transparent)throw new Exception("Texto com fundo opaco");
    using(var idle=new System.Drawing.Bitmap(parent.Width,parent.Height)){parent.DrawToBitmap(idle,parent.ClientRectangle);idle.Save(args[0]+"-idle.png");}
    settings.maintenance=Files.Hash("Secret-123456");budget.Update("interrupted-user",300,0);
    using(var keyTimer=new Timer{Interval=100}){keyTimer.Tick+=(sender,eventArgs)=>{foreach(Form form in Application.OpenForms){if(form.Owner==parent){foreach(Control control in form.Controls){var input=control as TextBox;if(input!=null){input.Text="Secret-123456";form.DialogResult=DialogResult.OK;keyTimer.Stop();break;}}break;}}};keyTimer.Start();Run(parent,"MaintenanceCore");keyTimer.Stop();}
    if(fake.MaintenanceCalls!=1||fake.MaintenanceSession!="interrupted-user"||!(bool)Field("adminSession").GetValue(parent)||budget.sessionId!=null)throw new Exception("Manutencao nao confirmou encerramento e modo admin");
    var sessionBar=(SessionBar)Field("timerWindow").GetValue(parent);sessionBar.SetAdminActions(true);if(!sessionBar.ExitButton.Visible)throw new Exception("Botao fechar nao aparece no modo admin");Run(parent,"CloseAdministratorClient");if(fake.DisconnectCalls!=1||!(bool)Field("closing").GetValue(parent))throw new Exception("Fechamento nao notificou servidor");
   }
   File.WriteAllText(args[0],"PASS: dialogo nativo com owner, foco preservado em 12 atualizacoes, digitacao completa e prazo expirado sem pausa; entrada/saida administrativa e perda de contato com reaplicacao das politicas simuladas. Desktop isolado, sem alterar politicas reais.");return 0;
  }catch(Exception e){File.WriteAllText(args[0],e.ToString());return 1;}
 }
}
