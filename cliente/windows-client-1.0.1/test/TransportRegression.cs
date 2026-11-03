using System;
using System.Diagnostics;
using System.IO;
// 2.0.55: o componente de conexao (runtime\node.exe + transport.js) nunca trava o cliente e sempre diz o motivo real.
// Uso: TransportRegression.exe <pasta-com-node-de-verdade>   (o teste troca runtime/node.exe ao lado do .exe a cada caso)
class TransportRegression {
 static void Check(bool ok,string what){if(!ok)throw new Exception("FALHOU: "+what);}
 static string Base{get{return AppDomain.CurrentDomain.BaseDirectory;}}
 static void Fake(string script){string dir=Path.Combine(Base,"runtime"),node=Path.Combine(dir,"node.exe");Directory.CreateDirectory(dir);if(File.Exists(node)||IsLink(node))File.Delete(node);if(script==null)return;File.WriteAllText(node,"#!/bin/sh\n"+script+"\n");Process.Start("chmod","+x \""+node+"\"").WaitForExit();}
 static bool IsLink(string p){try{return (File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0;}catch{return false;}}
 static string Fail(Transport t){try{t.Post("state",new {});return "(sem erro)";}catch(ConnectionFailure e){return e.Message;}catch(Exception e){return "OUTRO TIPO: "+e.GetType().Name+": "+e.Message;}}
 static int Main(string[] args){try{
  Files.DirectoryPath=Path.Combine(Path.GetTempPath(),"prime-transport-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(Files.DirectoryPath);
  ConnectionDoctor.SelfTest();
  var s=new Settings{server="https://127.0.0.1:1/",fingerprint=new string('A',64),token=new string('1',64),device="device-teste-1234567890",stationName="PC 01"};
  var t=new Transport(s);
  Fake(null);string m=Fail(t);Check(m.Contains("não foi encontrado"),"sem runtime\\node.exe: "+m);
  Fake("echo 'Error: falha de teste no componente' 1>&2; exit 3");m=Fail(t);Check(m.Contains("código 3")&&m.Contains("falha de teste no componente"),"componente quebrado mostra o erro dele: "+m);
  Fake("echo 'isto nao e json'");m=Fail(t);Check(m.Contains("resposta inválida"),"resposta invalida: "+m);
  Transport.StateTimeoutMs=1500;Fake("exec sleep 30");var clock=Stopwatch.StartNew();m=Fail(t);clock.Stop();
  Check(m.Contains("não respondeu em 1 s")&&clock.ElapsedMilliseconds<6000,"componente travado e encerrado em "+clock.ElapsedMilliseconds+" ms: "+m);
  Transport.StateTimeoutMs=12000;
  // node de verdade + transport.js: servidor recusando a conexao
  if(args.Length>0){Fake("exec \""+args[0]+"\" \"$@\"");m=Fail(t);var e=new ConnectionFailure(m,0);
   Check(ConnectionDoctor.NetworkProblem(e)&&ConnectionDoctor.Describe(e,s.server).Contains("recusou a conexão"),"servidor fora do ar: "+m+" => "+ConnectionDoctor.Describe(e,s.server));}
  Console.WriteLine("PASS: componente de conexao sem runtime, quebrado, com resposta invalida e travado (encerrado no tempo-limite) dao o motivo real; servidor fora do ar vira busca na rede.");return 0;
 }catch(Exception e){Console.WriteLine(e);return 1;}}
}
