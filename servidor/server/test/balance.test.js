'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store'),balance=require('../balance'),business=require('../business'),{createServer}=require('../server');
test('Saldo: conservação, segundos, validação, auditoria persistente e proteção de estorno',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'balance-'));let s=new Store(dir);t.after(()=>{s.close();fs.rmSync(dir,{recursive:true,force:true})});
 const a=s.memberSave({name:'Ana',username:'ana'},'admin'),b=s.memberSave({name:'Beto',username:'beto'},'admin');
 for(const paymentMethod of ['cash','pix','credit','debit'])assert.equal(s.credit(a.id,{minutes:10,paymentMethod},'admin').paymentMethod,paymentMethod);
 assert.throws(()=>s.credit(a.id,{minutes:10,paymentMethod:'fake'},'admin'));
 const saved=JSON.stringify(s.state),run=x=>balance.adjust(s,{type:'transfer',memberId:a.id,targetId:b.id,minutes:10,reason:'Ajuste',...x},'admin');
 for(const x of [{targetId:a.id},{minutes:-1},{minutes:500},{reason:' '},{type:'bad'}])assert.throws(()=>run(x));assert.equal(JSON.stringify(s.state),saved);
 const revenue=s.state.sales.reduce((n,x)=>n+x.cents,0),points=a.pointsMilli;run({});assert.equal(a.creditSeconds,1800);assert.equal(b.creditSeconds,600);assert.equal(a.pointsMilli,points);assert.equal(b.pointsMilli,0);assert.throws(()=>business.cancel(s,{id:s.state.sales[0].id,reason:'Estorno'},'admin'),/transferido/);
 s.start('1',b.id,'admin');assert.throws(()=>run({}),/Encerre/);s.finish('1','admin');
 a.creditSeconds+=25;run({all:true});assert.equal(a.creditSeconds,0);assert.equal(b.creditSeconds,2425);
 balance.adjust(s,{type:'remove',memberId:b.id,all:true,reason:'Correção autorizada'},'admin');assert.equal(b.creditSeconds,0);assert.equal(s.state.sales.reduce((n,x)=>n+x.cents,0),revenue);
 const report=business.report(s);assert(business.csv(report).includes('Forma de pagamento'));assert(business.csv(report).includes('Pix'));assert.equal(balance.history(s,{nick:'BETO'}).total,3);
 s.close();s=new Store(dir);assert.equal(s.state.balanceAdjustments.length,3);assert.equal(s.state.balanceAdjustments.at(-1).seconds,2425);assert.equal(s.member(b.id).creditSeconds,0);
});
test('API exige administrador para saldo e configurações e valida pagamento antes da TV',async t=>{
 let commands=0;class TV{async hdmi(){commands++}disconnect(){}}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'balance-api-')),app=createServer({directory:dir,Vidaa:TV,noTimer:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await app.close();fs.rmSync(dir,{recursive:true,force:true})});const base='http://127.0.0.1:'+app.server.address().port;let cookie='';
 async function call(url,body,status=200){const r=await fetch(base+'/api'+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r.json();}
 await call('/setup',{username:'admin',password:'password123'});await call('/login',{username:'admin',password:'password123'});const a=await call('/members',{name:'Ana',username:'ana'}),b=await call('/members',{name:'Beto',username:'beto'});
 await call('/credit',{memberId:a.id,minutes:10,stationId:'1',paymentMethod:'bad'},400);assert.equal(commands,0);await call('/credit',{memberId:a.id,minutes:10,paymentMethod:'pix'});
 await call('/balance',{type:'transfer',memberId:a.id,targetId:b.id,all:true,reason:'Teste'});assert.equal((await call('/balance')).total,1);
 await call('/operators',{username:'operator',password:'password123',role:'operator'});await call('/logout',{});await call('/login',{username:'operator',password:'password123'});
 await call('/balance',undefined,400);await call('/balance',{type:'remove',memberId:b.id,all:true,reason:'Proibido'},400);await call('/settings',{},400);await call('/backup/status',undefined,400);assert.equal(app.store.member(b.id).creditSeconds,600);
 // 3.0.32: operador so adiciona tempo com o caixa aberto
 await call('/credit',{memberId:a.id,minutes:5,paymentMethod:'cash'},400);assert.equal(app.store.member(a.id).creditSeconds,0);
 await call('/cash/open',{openingCents:0});
 await call('/credit',{memberId:a.id,minutes:5,paymentMethod:'cash'});assert.equal(app.store.member(a.id).creditSeconds,300);
});
