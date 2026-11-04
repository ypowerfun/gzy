'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');const {Store}=require('../store');
test('3.0.28: recarga em minutos ou em valor (minutos proporcionais ao valor da hora)',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'prime-credit-value-'));const s=new Store(dir);
 try{s.state.settings.hourCents=700;
  assert.deepEqual([s.quote({minutes:60}).cents,s.quote({mode:'value',cents:700}).minutes,s.quote({mode:'value',cents:500}).minutes,s.quote({mode:'value',cents:1000}).minutes],[700,60,43,86]);
  assert.throws(()=>s.quote({mode:'value',cents:5}),/insuficiente/);assert.throws(()=>s.quote({mode:'value',cents:0}),/inválido/);
  const m=s.memberSave({name:'Valor',username:'valor'},'admin');const sale=s.credit(m.id,{mode:'value',cents:500,paymentMethod:'pix'},'admin');
  assert.equal(sale.cents,500);assert.equal(sale.minutes,43);assert.equal(s.member(m.id).creditSeconds,43*60);
 }finally{s.close();fs.rmSync(dir,{recursive:true,force:true})}
});
