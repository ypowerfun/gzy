'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {createServer}=require('../server'),{passwordHash}=require('../store');

test('Ações dos PCs afetam apenas computadores e suportam admin, sessão e energia por escopo',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-pc-actions-')),app=createServer({directory,noTimer:true});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});
 app.store.state.operators.push({id:'admin',username:'gestor',hash:passwordHash('Admin-123456'),role:'admin'});
 const pc1={id:'pc1',name:'PC 1',kind:'computer',active:true},pc2={id:'pc2',name:'PC 2',kind:'computer',active:true},tv={id:'tv1',name:'TV 1',kind:'tv',active:true,ip:'127.0.0.2',hdmi:1};
 app.store.state.stations.push(pc1,pc2,tv);
 const m=app.store.memberSave({name:'Cliente',username:'cliente',password:'Cliente-123456'},'admin');app.store.credit(m.id,{minutes:20},'admin');const session=app.store.start(pc1.id,m.id,'admin');
 const body1={clientRunId:'a'.repeat(32),remoteVersion:1,canTerminate:true,remoteSessionId:session.id,processes:[]},body2={clientRunId:'b'.repeat(32),remoteVersion:1,canTerminate:true,remoteSessionId:'',processes:[]};
 app.pc.remote.receive(pc1,body1,false);app.pc.remote.receive(pc2,body2,false);app.pc.seen.set(pc1.id,Date.now());app.pc.seen.set(pc2.id,Date.now());
 let cookie='';async function api(url,body){const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/api'+url,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json()}}
 assert.equal((await api('/login',{username:'gestor',password:'Admin-123456'})).status,200);
 let r=await api('/pc/actions',{action:'admin',scope:'available'});assert.equal(r.status,200);assert.equal(r.data.success,1);let commands=app.pc.remote.receive(pc2,body2,false).commands;assert.equal(commands.length,1);assert.equal(commands[0].type,'admin');
 r=await api('/pc/actions',{action:'finish',scope:'all'});assert.equal(r.status,200);assert.equal(r.data.success,1);assert.equal(app.store.activeForStation(pc1.id),undefined);assert(app.store.member(m.id).creditSeconds>0);
 app.pc.remote.receive(pc1,{...body1,remoteSessionId:''},false);app.pc.seen.set(pc1.id,Date.now());r=await api('/pc/actions',{action:'shutdown',scope:'available'});assert.equal(r.status,200);assert.equal(r.data.results.some(x=>x.stationId==='pc1'&&x.ok),true);assert.equal(r.data.results.some(x=>x.stationId==='tv1'),false);
 commands=app.pc.remote.receive(pc1,{...body1,remoteSessionId:''},false).commands;assert.equal(commands.some(c=>c.type==='shutdown'),true);
});

test('1.3.1: desligar o PC pela recepção encerra a sessão, guarda o tempo restante no saldo e o desligamento chega ao PC', async t => {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-pc-off-')),app=createServer({directory,noTimer:true});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:5})});
 app.store.state.operators.push({id:'admin',username:'gestor',hash:passwordHash('Admin-123456'),role:'admin'});
 const pc1={id:'pc1',name:'PC 1',kind:'computer',active:true},pc2={id:'pc2',name:'PC 2',kind:'computer',active:true},pc3={id:'pc3',name:'PC 3',kind:'computer',active:true};app.store.state.stations.push(pc1,pc2,pc3);
 const ana=app.store.memberSave({name:'Ana',username:'ana',password:'Cliente-123456'},'admin');app.store.credit(ana.id,{minutes:60},'admin');const s1=app.store.start(pc1.id,ana.id,'admin');
 const bia=app.store.memberSave({name:'Bia',username:'bia',password:'Cliente-123456'},'admin');app.store.credit(bia.id,{minutes:30},'admin');const s2=app.store.start(pc2.id,bia.id,'admin');
 const run=c=>c.repeat(32),body=(id,sid)=>({clientRunId:run(id),remoteVersion:1,canTerminate:true,remoteSessionId:sid,processes:[]});
 app.pc.remote.receive(pc1,body('a',s1.id),false);app.pc.remote.receive(pc2,body('b',s2.id),false);app.pc.remote.receive(pc3,body('c',''),false);for(const p of [pc1,pc2,pc3])app.pc.seen.set(p.id,Date.now());
 let cookie='';const api=async(url,b)=>{const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/api'+url,{method:b?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json()}};
 assert.equal((await api('/login',{username:'gestor',password:'Admin-123456'})).status,200);
 // Ações dos PCs › Desligar um PC com sessão: sessão encerrada na hora, tempo volta ao saldo
 let r=await api('/pc/actions',{action:'shutdown',scope:'one',stationId:'pc1'});assert.equal(r.status,200,JSON.stringify(r.data));
 assert.match(r.data.results[0].message,/Sessão encerrada, tempo restante guardado no saldo/);
 assert.equal(app.store.activeForStation(pc1.id),undefined,'o tempo parou de contar');
 const left=app.store.member(ana.id).creditSeconds;assert.ok(left>3500&&left<=3600,'saldo devolvido: '+left);
 assert.equal(app.store.state.sessions.find(x=>x.id===s1.id).reason,'PC desligado pela recepção');
 // o PC ainda recebe o desligamento na próxima consulta (mesmo com a sessão já encerrada)
 let cmds=app.pc.remote.receive(pc1,body('a',''),false).commands;assert.ok(cmds.some(c=>c.type==='shutdown'),'comando de desligar entregue');
 // menu do PC (Desligar) com sessão: mesma regra
 r=await api('/pc/command',{stationId:'pc2',type:'shutdown'});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.sessionFinished.guest,false);
 assert.equal(app.store.activeForStation(pc2.id),undefined);assert.ok(app.store.member(bia.id).creditSeconds>1700);
 cmds=app.pc.remote.receive(pc2,body('b',''),false).commands;assert.ok(cmds.some(c=>c.type==='shutdown'));
 // PC livre: só desliga
 r=await api('/pc/actions',{action:'shutdown',scope:'one',stationId:'pc3'});assert.equal(r.data.results[0].message,'Desligamento enviado.');
 // reiniciar com sessão: mesma regra (a tela já prometia encerrar e devolver o saldo)
 const s3=app.store.start(pc1.id,ana.id,'admin');app.pc.remote.receive(pc1,body('a',s3.id),false);app.pc.seen.set(pc1.id,Date.now());
 r=await api('/pc/actions',{action:'restart',scope:'one',stationId:'pc1'});assert.match(r.data.results[0].message,/reinício enviado/);assert.equal(app.store.activeForStation(pc1.id),undefined);assert.equal(app.store.state.sessions.find(x=>x.id===s3.id).reason,'PC reiniciado pela recepção');
 assert.ok(app.pc.remote.receive(pc1,body('a',''),false).commands.some(c=>c.type==='restart'));
 // Cliente reiniciado (outra execução) não recebe o comando antigo ainda não entregue (regra de antes)
 cmds=app.pc.remote.receive(pc3,body('z',''),false).commands;assert.ok(!cmds.some(c=>c.type==='shutdown'),'execução nova não desliga sozinha');
 const logs=app.store.db.prepare("SELECT detail FROM logs WHERE type='fim'").all().map(l=>l.detail).join('\n');assert.match(logs,/Ana encerrou em PC 1 \(PC desligado pela recepção\)/);
});
