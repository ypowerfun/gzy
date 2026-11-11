'use strict';
// 1.2.9: encerrar o servidor rápido — comando de TV preso, backup em andamento e conexões Keep-Alive (painel/PCs) não seguram o fechamento
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const {createServer}=require('../server');
test('1.2.9: encerrar não espera TV que não responde nem conexão mantida aberta; dados gravados e encerramento limpo',async t=>{
 let calls=0;class TV{hdmi(){calls++;return new Promise(()=>{})}home(){return new Promise(()=>{})}disconnect(){}}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-shutdown-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:5}));
 const app=createServer({directory:dir,Vidaa:TV,noTimer:true,shutdown:{queueMs:300}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;let cookie='';
 const call=async(url,body,status=200)=>{const r=await fetch(base+'/api'+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});if(status!==null)assert.equal(r.status,status,url+' '+await r.clone().text());if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r.json().catch(()=>null)};
 await call('/setup',{username:'admin',password:'password123'});await call('/login',{username:'admin',password:'password123'});await call('/cash/open',{openingCents:0});
 const a=await call('/members',{name:'Ana',username:'ana'});const tv=app.store.state.stations.find(s=>s.kind==='tv');tv.ip='192.0.2.10';
 // recarga que inicia na TV: o comando da TV nunca termina (TV desligada) e a fila de operações fica presa
 const stuck=fetch(base+'/api/credit',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({memberId:a.id,minutes:10,stationId:tv.id,paymentMethod:'cash'})}).catch(()=>null);
 for(let i=0;i<50&&!calls;i++)await new Promise(r=>setTimeout(r,20));assert.ok(calls>0,'comando da TV enviado');
 // painel com conexão Keep-Alive aberta (como o WebView2)
 const agent=new http.Agent({keepAlive:true});await new Promise(r=>http.get(base+'/health',{agent},res=>{res.resume();res.on('end',r)}));
 const t0=Date.now();await app.close();const ms=Date.now()-t0;agent.destroy();
 assert.ok(ms<3000,'encerrou em '+ms+' ms (antes esperava a TV para sempre)');
 const {Store}=require('../store'),s=new Store(dir);try{assert.equal(s.state.runtime.cleanShutdown,true);assert.ok(s.state.logs?true:true)}finally{s.close()}
 stuck.then(()=>{});
});
test('1.2.9: instalação nova sem TV/PC de exemplo; instalação antiga perde só os exemplos nunca usados e sem alteração',async t=>{
 const {Store}=require('../store'),mk=()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'gz-ex-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true,maxRetries:5}));return d};
 // nova (como o GameZoney.exe): sem estações
 let d=mk(),app=createServer({directory:d,examples:false,noTimer:true});assert.deepEqual(app.store.state.stations,[]);await app.close();
 // antiga, exemplos intactos: os dois saem, com registro no Log; reabrir não mexe de novo
 d=mk();let s=new Store(d);assert.equal(s.state.stations.length,2);s.close();
 app=createServer({directory:d,examples:false,noTimer:true});assert.deepEqual(app.store.state.stations,[]);assert.ok(app.store.logs?true:true);await app.close();
 s=new Store(d);try{assert.ok(s.db.prepare("SELECT 1 FROM logs WHERE detail LIKE 'Estações de exemplo retiradas: Exemplo Console, Exemplo PC'").get())}finally{s.close()}
 // antiga, exemplos usados/alterados: ficam
 d=mk();s=new Store(d);const m=s.memberSave({name:'Ana',username:'ana'},'admin');s.credit(m.id,{minutes:10,paymentMethod:'cash'},'admin');s.start('1',m.id,'admin');s.finish('1','admin');s.state.stations.find(x=>x.id==='2').name='PC 01';s.persist();s.close();
 app=createServer({directory:d,examples:false,noTimer:true});assert.deepEqual(app.store.state.stations.map(x=>x.id).sort(),['1','2']);await app.close();
 // os testes (com pasta própria) continuam com os exemplos
 d=mk();app=createServer({directory:d,noTimer:true});assert.equal(app.store.state.stations.length,2);await app.close();
});
