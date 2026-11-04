'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {createServer}=require('../server'),{passwordHash}=require('../store');

test('3.0.21: Visitante libera estação livre só com tempo e pagamento, sem pontos e sem guardar saldo',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-guest-')),app=createServer({directory,noTimer:true});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});
 app.store.state.operators.push({id:'admin',username:'gestor',hash:passwordHash('Admin-123456'),role:'admin'});
 app.store.state.stations.push({id:'pc1',name:'PC 1',kind:'computer',active:true,pcTokenHash:'x'},{id:'pc2',name:'PC 2',kind:'computer',active:true,pcTokenHash:'y'});
 app.pc.seen.set('pc1',Date.now());app.pc.seen.set('pc2',Date.now());
 let cookie='';async function api(url,body){const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/api'+url,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json()}}
 assert.equal((await api('/login',{username:'gestor',password:'Admin-123456'})).status,200);
 assert.equal((await api('/guest-start',{stationId:'pc1',minutes:60})).status,400);
 let r=await api('/guest-start',{stationId:'pc1',minutes:60,paymentMethod:'pix'});assert.equal(r.status,200);assert.equal(r.data.session.memberName,'Visitante');assert.equal(r.data.sale.paymentMethod,'pix');assert.equal(r.data.sale.pointsMilli,0);
 assert.equal((await api('/guest-start',{stationId:'pc1',minutes:30,paymentMethod:'cash'})).status,400);
 assert.equal((await api('/guest-start',{stationId:'pc2',minutes:30,paymentMethod:'cash'})).status,200);
 const state=(await api('/state')).data;assert.equal(state.sessions.filter(s=>s.status==='active'&&s.memberName==='Visitante').length,2);
 const guestId=r.data.session.memberId;const finished=app.store.finish('pc1','gestor','manual',Date.now()+20*60000);
 assert(finished.guestForfeitSeconds>0);const g=app.store.member(guestId);assert.equal(g.creditSeconds,0);assert.equal(g.active,false);assert.equal(g.pointsMilli,0);
 assert(!(await api('/state')).data.members.some(m=>m.id===guestId));
});

test('3.0.22: Visitantes em grupo liberam 20 estações livres de uma vez e informam as que não puderam',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-guest-batch-')),app=createServer({directory,noTimer:true});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});
 app.store.state.operators.push({id:'op',username:'recepcao',hash:passwordHash('Recepcao-123456'),role:'operator'});
 const ids=[];for(let i=1;i<=22;i++){const id='pc'+i;ids.push(id);app.store.state.stations.push({id,name:'PC '+i,kind:'computer',active:true,pcTokenHash:'h'+i});if(i!==22)app.pc.seen.set(id,Date.now());}
 const m=app.store.memberSave({name:'Cliente',username:'cliente'},'admin');app.store.credit(m.id,{minutes:30},'admin');app.store.start('pc21',m.id,'admin');
 let cookie='';async function api(url,body){const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/api'+url,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json()}}
 assert.equal((await api('/login',{username:'recepcao',password:'Recepcao-123456'})).status,200);
 assert.equal((await api('/guest-start-batch',{stationIds:ids,minutes:60})).status,400);
 // 3.0.32: operador so libera visitantes com o caixa aberto
 const closed=await api('/guest-start-batch',{stationIds:ids,minutes:60,paymentMethod:'cash'});assert.equal(closed.status,400);assert.match(closed.data.error,/Abra o caixa/);
 assert.equal((await api('/cash/open',{openingCents:0})).status,200);
 const r=await api('/guest-start-batch',{stationIds:ids,minutes:60,paymentMethod:'cash'});
 assert.equal(r.status,200);assert.equal(r.data.total,22);assert.equal(r.data.success,20);assert.equal(r.data.failed,2);
 assert.equal(app.store.state.sessions.filter(s=>s.status==='active'&&s.memberName==='Visitante').length,20);
 assert.equal(app.store.state.sales.filter(s=>s.memberName==='Visitante').length,20);
 assert.equal(app.store.activeForStation('pc21').memberId,m.id);
});
