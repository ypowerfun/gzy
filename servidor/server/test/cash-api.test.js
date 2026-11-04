'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {createServer}=require('../server');
test('3.0.32: caixa fechado bloqueia recarga, visitante e PDV para operadores e admins adicionados; administrador principal pode',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'prime-cash-api-')),app=createServer({directory,noTimer:true});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});
 const base=()=>'http://127.0.0.1:'+app.server.address().port+'/api';
 const session=()=>{let cookie='';const api=async(url,body)=>{const r=await fetch(base()+url,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const ct=r.headers.get('content-type')||'';return{status:r.status,type:ct,data:ct.includes('json')?await r.json():null}};return api};
 const dono=session(),ger=session(),op=session();
 await dono('/setup',{username:'dono',password:'Senha-dono-123'});await dono('/login',{username:'dono',password:'Senha-dono-123'});
 assert.equal((await dono('/operators',{username:'gerente',password:'Senha-ger-123',role:'admin'})).status,200);
 assert.equal((await dono('/operators',{username:'caixa',password:'Senha-cx-1234',role:'operator'})).status,200);
 assert.equal((await ger('/login',{username:'gerente',password:'Senha-ger-123'})).status,200);
 assert.equal((await op('/login',{username:'caixa',password:'Senha-cx-1234'})).status,200);
 const m=app.store.memberSave({name:'Yves',username:'yves'},'dono');
 const coca=(await op('/shop')).data.products[0];const sale={items:[{kind:'product',id:coca.id,qty:1}],paymentMethod:'cash'};
 assert.equal((await op('/state')).data.cashOpen,false);assert.equal((await op('/state')).data.cashBypass,false);assert.equal((await dono('/state')).data.cashBypass,true);
 for(const api of [op,ger]){
  let r=await api('/credit',{memberId:m.id,minutes:30,paymentMethod:'cash'});assert.equal(r.status,400);assert.match(r.data.error,/Abra o caixa/);
  r=await api('/shop/sale',sale);assert.equal(r.status,400);assert.match(r.data.error,/Abra o caixa/);
  r=await api('/guest-start',{stationId:'1',minutes:30,paymentMethod:'cash'});assert.equal(r.status,400);assert.match(r.data.error,/Abra o caixa/);
 }
 // administrador principal registra mesmo com o caixa fechado (fora de qualquer caixa)
 let r=await dono('/credit',{memberId:m.id,minutes:30,paymentMethod:'cash'});assert.equal(r.status,200);assert.equal(r.data.cashId,null);
 assert.equal((await dono('/shop/sale',sale)).status,200);
 // operador abre o caixa e passa a vender
 const reg=(await op('/cash/open',{openingCents:1000})).data;assert.equal(reg.status,'open');
 assert.equal((await op('/state')).data.cashOpen,true);
 r=await op('/shop/sale',sale);assert.equal(r.status,200);assert.equal(r.data.cashId,reg.id);
 r=await op('/credit',{memberId:m.id,mode:'value',cents:700,paymentMethod:'pix'});assert.equal(r.status,200);assert.equal(r.data.minutes,60);
 const st=(await op('/cash')).data;assert.equal(st.current.summary.shopCents,coca.priceCents);assert.equal(st.current.summary.methods.pix,700);
 assert.equal((await op('/cash/sales?id='+reg.id)).data.length,2);
 const pdf=await op('/cash/report?id='+reg.id);assert.equal(pdf.type,'application/pdf');
 assert.equal((await op('/cash/close',{countedCents:1000+coca.priceCents})).data.differenceCents,0);
 for(const kind of ['machines','hours','staff','clients','free','durations','sales','cashflow'])assert.equal((await op('/stats?kind='+kind)).status,200,kind);
 assert.equal((await dono('/bills',{description:'Internet',cents:9900,dueDate:'2030-01-10',recurring:'monthly'})).status,200);
 assert.notEqual((await op('/bills',{description:'X',cents:100,dueDate:'2030-01-10'})).status,200);
});
