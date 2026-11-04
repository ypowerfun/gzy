'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');const {createServer}=require('../server');
test('3.0.17: batimento do Cliente 2.0.21 mantém a sessão viva sem alterar saldo; sem batimento fica vermelho em 10 s e a sessão continua (queda de rede/internet)',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-hb-'));const pfx=path.join(directory,'server.pfx');execFileSync(path.join(__dirname,'..','CertTool.exe'),[pfx],{windowsHide:true});
 const app=createServer({directory,noTimer:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));/* 3.0.43: cliente só entra no PC com caixa aberto */require('../cash').open(app.store,{openingCents:0},'admin');t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});const port=await app.startPC(0,pfx);
 const pem=new crypto.X509Certificate(fs.readFileSync(pfx+'.cer')).toString();fs.writeFileSync(pfx+'.cer',pem);
 app.store.state.stations.push({id:'pc1',kind:'computer',name:'PC 01',active:true});const member=app.store.memberSave({name:'Jogador',username:'jogador',password:'Senha-123456'},'admin');app.store.credit(member.id,{minutes:10},'admin');const token=app.pc.issue('pc1');const device='machine-000000000001';
 function request(action,body={},options={}){return new Promise((resolve,reject)=>{const bytes=JSON.stringify(body);const req=https.request({host:'127.0.0.1',port,path:'/pc/'+action,method:'POST',ca:fs.readFileSync(pfx+'.cer'),checkServerIdentity:()=>undefined,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(options.token||token),'X-GZ-Device':options.device||device}},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({code:res.statusCode,data:JSON.parse(text)}))});req.on('error',reject);req.end(bytes)})}
 assert.equal((await request('state')).code,200);
 const r=await request('login',{username:'jogador',password:'Senha-123456'});const sessionId=r.data.active.id;const credit=app.store.member(member.id).creditSeconds;
 app.pc.seen.set('pc1',Date.now()-9500);
 const hb=await request('heartbeat',{clientRunId:'a'.repeat(32),clientSessionId:sessionId});assert.equal(hb.code,200);assert.equal(hb.data.active.id,sessionId);
 assert.equal(app.pc.expireDisconnected('pc1',Date.now()+5000),null);assert.equal(app.store.activeForStation('pc1').id,sessionId);assert.equal(app.store.member(member.id).creditSeconds,credit);
 assert.equal((await request('heartbeat',{}, {token:'invalid'})).code,401);
 assert.equal((await request('heartbeat',{}, {device:'outro-computador-0001'})).code,403);
 const last=app.pc.seen.get('pc1');assert.equal(app.pc.expireDisconnected('pc1',last+10000),null);assert.equal(app.pc.connected('pc1',last+10000),false);assert.equal(app.pc.expireDisconnected('pc1',last+70000),null);assert.equal(app.pc.expireDisconnected('pc1',last+300000),null);assert.equal(app.store.activeForStation('pc1').id,sessionId);assert.equal(app.store.member(member.id).creditSeconds,credit);
});
