'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {createServer}=require('../server'),{passwordHash}=require('../store');

test('Ações dos PCs afetam apenas computadores e suportam admin, sessão e energia por escopo',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'prime-pc-actions-')),app=createServer({directory,noTimer:true});
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
