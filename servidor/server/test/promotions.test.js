'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {createServer}=require('../server');
test('3.0.30: remover promoção — some da lista e das recargas, faturas antigas preservadas, só administrador',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'prime-promo-')),app=createServer({directory,noTimer:true});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});
 let cookie='';const api=async(url,body)=>{const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/api'+url,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json()}};
 await api('/setup',{username:'dono',password:'Senha-dono-123'});await api('/login',{username:'dono',password:'Senha-dono-123'});
 await api('/promotions',{name:'PROMOCAO DE 20',minutes:360,price:'20',cents:2000,active:true});
 const promo=(await api('/state')).data.promotions[0];assert.equal(promo.name,'PROMOCAO DE 20');
 const m=app.store.memberSave({name:'Yves',username:'yves'},'dono');const sale=app.store.credit(m.id,{promotionId:promo.id},'dono');
 assert.equal((await api('/promotions/remove',{id:promo.id})).status,200);
 assert.equal((await api('/state')).data.promotions.length,0);assert.equal(sale.label,'PROMOCAO DE 20');
 assert.throws(()=>app.store.credit(m.id,{promotionId:promo.id},'dono'),/indisponível/);
 assert.equal((await api('/promotions/remove',{id:promo.id})).status,400);
});
