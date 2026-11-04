using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
// 2.0.57: o Windows negou acesso as chaves das restricoes (HKCU\...\Policies\System e \Explorer). Antes a tela dizia
// "Sem conexao com o servidor" e o PC ficava bloqueado sem explicacao. Agora: a tela diz o motivo real e onde esta o reparo,
// o servidor recebe o erro (painel > Recebimento pelos clientes), o PC volta sozinho depois do reparo e o administrador
// consegue entrar mesmo se as restricoes nao puderem ser retiradas. Uso: PolicyAccessRegression.exe
class PolicyAccessRegression {
 static void Check(bool ok,string what){if(!ok)throw new Exception("FALHOU: "+what);}
 const BindingFlags F=BindingFlags.Instance|BindingFlags.NonPublic;
 static FieldInfo Field(string name){return typeof(ClientForm).GetField(name,F);}
 static void Run(ClientForm form,string name){var task=(System.Threading.Tasks.Task)typeof(ClientForm).GetMethod(name,F).Invoke(form,null);var timeout=System.Diagnostics.Stopwatch.StartNew();while(!task.IsCompleted){Application.DoEvents();System.Threading.Thread.Sleep(10);if(timeout.ElapsedMilliseconds>10000)throw new Exception("Timeout "+name);}task.GetAwaiter().GetResult();}
 static void Tick(ClientForm form){typeof(ClientForm).GetMethod("RefreshClock",F).Invoke(form,null);}
 class FakeServer:Transport {
  public bool Admin;public string LastPolicyError;public int States;
  public FakeServer(Settings s):base(s){}
  public override Dictionary<string,object> Post(string action,object body){
   if(action=="state"){States++;var data=Files.Json.Deserialize<Dictionary<string,object>>(Files.Json.Serialize(body));LastPolicyError=data.ContainsKey("policyError")?Convert.ToString(data["policyError"]):null;}
   var r=new Dictionary<string,object>{{"active",null},{"last",null},{"stationName","MAQUINA-7"},{"cashOpen",true},{"serverNow",0}};
   if(Admin)r["adminAccess"]=new Dictionary<string,object>{{"username","admin"}};
   return r;
  }
 }
 [STAThread]static int Main(string[] args){try{
  Files.DirectoryPath=Path.Combine(Path.GetTempPath(),"gz-policy-access-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(Files.DirectoryPath);
  var settings=new Settings{server="https://127.0.0.1:3443",fingerprint=new string('0',64),token=new string('0',64),stationName="MAQUINA-7",offlineAdminHash=null};
  using(var form=new ClientForm(settings,true)){
   Field("saveSettings").SetValue(form,new Action<Settings>(x=>{}));
   var server=new FakeServer(settings);Field("transport").SetValue(form,server);
   bool denied=true;int applies=0,restores=0;string deniedText="O acesso à chave do Registro 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' foi negado.";
   Field("applyPolicies").SetValue(form,new Action<Settings>(x=>{applies++;if(denied)throw new Exception("Gerenciador de Tarefas: "+deniedText);}));
   Field("restorePolicies").SetValue(form,new Action<Settings>(x=>{restores++;if(denied)throw new UnauthorizedAccessException(deniedText);}));
   var status=(Control)Field("status").GetValue(form);
   // 1) acesso negado: a tela diz o motivo real (e nao "Sem conexao") e onde esta o reparo
   Run(form,"Poll");Tick(form);
   Check(applies>=1,"o cliente deveria tentar aplicar as restricoes");
   Check(status.Text.StartsWith("Este PC não conseguiu aplicar as restrições do Windows")&&status.Text.Contains("Reparar restrições do Windows")&&status.Text.Contains("foi negado"),"mensagem da tela: "+status.Text);
   Check(!status.Text.Contains("Sem conexão"),"nao pode dizer 'Sem conexao' quando o servidor respondeu: "+status.Text);
   Check(!(bool)Field("policiesApplied").GetValue(form),"restricoes nao aplicadas devem continuar bloqueando o cliente");
   // 2) o servidor recebe o erro original (painel > Recebimento pelos clientes)
   Run(form,"Poll");Tick(form);
   Check(server.LastPolicyError!=null&&server.LastPolicyError.Contains("foi negado"),"o servidor deveria receber o erro: "+server.LastPolicyError);
   Check(status.Text.StartsWith("Este PC não conseguiu"),"mensagem continua na segunda consulta: "+status.Text);
   // 3) depois do reparo: na proxima consulta as restricoes sao aplicadas e o PC fica disponivel sozinho
   denied=false;Run(form,"Poll");Tick(form);
   Check((bool)Field("policiesApplied").GetValue(form),"restricoes deveriam ser aplicadas depois do reparo");
   Check(status.Text=="Disponível","PC deveria voltar a Disponivel: "+status.Text);
   Check(!(bool)Field("localProblem").GetValue(form),"o problema local deveria ser limpo");
   // 4) administrador entra mesmo se o Windows negar a retirada das restricoes (para poder rodar o reparo)
   denied=true;server.Admin=true;Run(form,"Poll");Tick(form);
   Check(restores>=1,"o cliente deveria tentar retirar as restricoes ao entrar o administrador");
   Check((bool)Field("adminSession").GetValue(form),"o administrador deveria entrar mesmo com o acesso negado");
   Console.WriteLine("PASS: acesso negado as restricoes do Windows mostra o motivo real (sem 'Sem conexao') e o reparo; o servidor recebe o erro; o PC volta sozinho depois do reparo; o administrador entra mesmo com o acesso negado.");
  }
  return 0;
 }catch(Exception e){Console.WriteLine(e);return 1;}}
}
