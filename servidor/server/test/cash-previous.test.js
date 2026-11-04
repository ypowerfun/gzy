'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store');const cash=require('../cash');
test('3.0.39: caixas anteriores — só administrador principal, só datas passadas, sem sobreposição, PDF e remoção',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-cash-prev-'));let store=new Store(dir);
 try{
  store.state.settings.timeZone='America/Manaus';const now=Date.parse('2026-10-07T15:00:00Z');
  const input={from:'2026-08-01',to:'2026-08-30',cents:20000,note:'antes do sistema'};
  assert.throws(()=>cash.addPrevious(store,input,'gerente',false,now),/administrador principal/);
  assert.throws(()=>cash.addPrevious(store,{...input,to:'2026-10-07'},'dono',true,now),/anteriores a hoje/);
  assert.throws(()=>cash.addPrevious(store,{...input,from:'2026-09-01',to:'2026-08-01'},'dono',true,now),/data inicial/);
  assert.throws(()=>cash.addPrevious(store,{...input,cents:0},'dono',true,now),/Valor total/);
  const reg=cash.addPrevious(store,input,'dono',true,now);
  assert.equal(reg.historical,true);assert.equal(reg.countedCents,20000);assert.equal(reg.periodFrom,'2026-08-01');assert.equal(new Date(reg.openedAt).toISOString(),'2026-08-01T04:00:00.000Z');
  assert.throws(()=>cash.addPrevious(store,{...input,from:'2026-08-30',to:'2026-09-05'},'dono',true,now),/Já existe caixa anterior/);
  cash.addPrevious(store,{from:'2026-10-06',to:'2026-10-06',cents:5000},'dono',true,now);
  const st=cash.state(store);assert.equal(st.history.length,2);assert.equal(st.history[0].periodFrom,'2026-10-06');assert.equal(st.history[1].summary.totalCents,20000);
  const pdf=cash.reportPdf(store,reg.id).pdf.toString('latin1');assert.match(pdf,/CAIXA ANTERIOR/);assert.match(pdf,/01\/08\/2026 a 30\/08\/2026/);
  assert.equal(cash.current(store),null);
  assert.throws(()=>cash.removePrevious(store,{id:reg.id},'gerente',false),/administrador principal/);
  cash.removePrevious(store,{id:reg.id},'dono',true);assert.equal(cash.state(store).history.length,1);
  assert(store.logs({type:'caixa'}).some(l=>l.detail.includes('Caixa anterior registrado')));
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});
test('3.0.41: caixa anterior não substitui caixa registrado pelo sistema',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-cash-prev2-'));const store=new Store(dir);
 try{
  store.state.settings.timeZone='America/Manaus';const now=Date.parse('2026-10-07T15:00:00Z');
  // caixa do sistema aberto em 10/09 e fechado em 11/09 (horário de Manaus)
  store.state.cashRegisters.push({id:'sys1',number:++store.state.cashSequence,status:'closed',openedAt:Date.parse('2026-09-10T22:00:00Z'),closedAt:Date.parse('2026-09-11T06:00:00Z'),openedBy:'admin',closedBy:'admin',openingCents:0,moves:[]});
  assert.deepEqual(cash.systemDays(store,now),['2026-09-10','2026-09-11']);
  assert.throws(()=>cash.addPrevious(store,{from:'2026-09-01',to:'2026-09-30',cents:1000},'dono',true,now),/registrado pelo sistema em 10\/09\/2026, 11\/09\/2026/);
  assert.throws(()=>cash.addPrevious(store,{from:'2026-09-11',to:'2026-09-11',cents:1000},'dono',true,now),/não podem ser substituídos/);
  const ok=cash.addPrevious(store,{from:'2026-09-01',to:'2026-09-09',cents:1000},'dono',true,now);assert.equal(ok.historical,true);
  cash.addPrevious(store,{from:'2026-09-12',to:'2026-09-30',cents:1000},'dono',true,now);
  assert.equal(store.state.cashRegisters.find(c=>c.id==='sys1').historical,undefined);
  assert.deepEqual(cash.state(store).systemDays,['2026-09-10','2026-09-11']);
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});
