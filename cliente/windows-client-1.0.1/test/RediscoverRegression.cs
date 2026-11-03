using System;
using System.Collections.Generic;
using System.IO;
// 2.0.55: servidor mudou de endereco -> o cliente acha na rede (3444/UDP) o servidor com a MESMA impressao digital e
// passa a usar o novo endereco; com outra impressao digital, nunca troca. Uso: RediscoverRegression.exe <fingerprint> <porta> <token> <aparelho> [endereco-para-busca-direta]
class RediscoverRegression {
 static void Check(bool ok,string what){if(!ok)throw new Exception("FALHOU: "+what);}
 static int Main(string[] args){try{
  Files.DirectoryPath=Path.Combine(Path.GetTempPath(),"prime-rediscover-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(Files.DirectoryPath);
  string fingerprint=args[0],port=args[1];
  var old=new Settings{server="https://10.255.255.1:3443/",fingerprint=fingerprint,token=args[2],device=args[3],stationName="PC 01"};
  /* args[4] (opcional): busca direta num endereco, para ambientes de teste sem broadcast UDP; no PC a busca e por broadcast (igual a primeira associacao) */
  var r=args.Length>4?new Transport(old).Post("discover",new {target=args[4]}):new Transport(old).Post("discover",new {});
  var found=ConnectionDoctor.Servers(r);
  Check(found.Count>=1,"a busca achou o servidor na rede");
  string problem;string next=ConnectionDoctor.PickServer(old.server,old.fingerprint,found,out problem);
  Check(next!=null&&next.EndsWith(":"+port)&&problem==null,"servidor com a mesma identidade em outro endereco e aceito: "+next+" / "+problem);
  var moved=new Settings{server=next,fingerprint=fingerprint,token=old.token,device=old.device,stationName="PC 01"};Files.Validate(moved);
  var state=new Transport(moved).Post("state",new {});
  Check(state!=null&&state.ContainsKey("stationName")&&Convert.ToString(state["stationName"])=="PC 01","o PC volta a falar com o servidor no novo endereco (identidade conferida pelo transport.js)");
  string other=ConnectionDoctor.PickServer(old.server,new string('0',64),found,out problem);
  Check(other==null&&problem!=null&&problem.Contains("outra identidade"),"com outra impressao digital nunca troca: "+problem);
  Console.WriteLine("PASS: servidor em novo endereco reencontrado na rede pela mesma impressao digital ("+ConnectionDoctor.Host(next)+") e consulta de estado no novo endereco; outra identidade nunca e aceita.");return 0;
 }catch(Exception e){Console.WriteLine(e);return 1;}}
}
