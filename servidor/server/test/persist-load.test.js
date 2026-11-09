'use strict';
// 1.2.1: consultas dos PCs (a cada 2 s) não podem regravar o estado inteiro — com meses de uso ele passa de dezenas de MB
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');const {createServer}=require('../server');
test('1.2.1: consultas de estado e batimentos do PC (com e sem sessão, com controle de impressão) não regravam o estado inteiro',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-load-'));const pfx=path.join(directory,'server.pfx');execFileSync(path.join(__dirname,'..','CertTool.exe'),[pfx],{windowsHide:true});
 const {license,plan}=require('./plan-helper')();const app=createServer({directory,noTimer:true,license});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));require('../cash').open(app.store,{openingCents:0},'admin');t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});const port=await app.startPC(0,pfx);
 const pem=new crypto.X509Certificate(fs.readFileSync(pfx+'.cer')).toString();fs.writeFileSync(pfx+'.cer',pem);
 app.store.state.stations.push({id:'pc1',kind:'computer',name:'PC 01',active:true});app.store.state.settings.printControl={enabled:true,serviceId:''};plan(app,'standard');
 const member=app.store.memberSave({name:'Jogador',username:'jogador',password:'Senha-123456'},'admin');app.store.credit(member.id,{minutes:30},'admin');const token=app.pc.issue('pc1');const device='machine-000000000001';
 function request(action,body={}){return new Promise((resolve,reject)=>{const bytes=JSON.stringify(body);const req=https.request({host:'127.0.0.1',port,path:'/pc/'+action,method:'POST',ca:fs.readFileSync(pfx+'.cer'),checkServerIdentity:()=>undefined,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'X-GZ-Device':device}},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({code:res.statusCode,data:JSON.parse(text)}))});req.on('error',reject);req.end(bytes)})}
 const network=[{mac:'00-11-22-33-44-55',ip:'192.168.0.20',mask:'255.255.255.0',name:'Ethernet',wol:true}],runId='a'.repeat(32);
 const poll=extra=>request('state',{clientRunId:runId,clientVersion:'1.0.15',printVersion:1,printJobs:[],network,systemUptimeMs:1000,...extra});
 assert.equal((await poll()).code,200); // 1ª consulta: associa o PC e guarda a placa de rede (gravação esperada)
 let full=0;const original=app.store.persist.bind(app.store);app.store.persist=()=>{full++;return original()};
 for(let i=0;i<10;i++)assert.equal((await poll()).code,200);
 assert.equal(full,0,'PC livre: nenhuma gravação completa');
 const r=await request('login',{username:'jogador',password:'Senha-123456'});assert.equal(r.code,200);const session=r.data.active;full=0;
 for(let i=0;i<10;i++){const left=app.store.remaining(app.store.activeForStation('pc1'));assert.equal((await poll({clientSessionId:session.id,clientRemainingSeconds:left,clientAllocatedSeconds:app.store.activeForStation('pc1').allocatedSeconds})).code,200);assert.equal((await request('heartbeat',{clientRunId:runId,clientSessionId:session.id})).code,200);}
 assert.equal(full,0,'PC em sessão: nenhuma gravação completa (só o ponto de controle)');
 const cp=app.store.db.prepare("SELECT data FROM live WHERE key=?").get('cp:'+session.id);assert.ok(cp,'ponto de controle gravado');assert.ok(JSON.parse(cp.data).lastClientRemainingSeconds>0);
 // documento cancelado no próprio PC entra no histórico: aí grava
 await poll({clientSessionId:session.id,printJobs:[{id:'job1',printer:'HP',document:'a.pdf',pages:1,copies:1}]});full=0;await poll({clientSessionId:session.id,printJobs:[]});assert.equal(full,1);
});
