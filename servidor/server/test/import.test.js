'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store');const imp=require('../import');const {workbook}=require('../excel');
test('3.0.20: importação de clientes por planilha (xlsx/csv) cadastra sem senha, com saldo inicial, sem alterar existentes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'prime-import-'));const store=new Store(dir);
 try{
  store.memberSave({name:'Já existe',username:'ana'},'admin');
  const xlsx=workbook('Clientes',['Nome','Nick','Tempo'],[['João da Silva','joao.silva','01:30'],['Maria','maria_s',90],['Ana','ana','00:10'],['Carlos','carlos@lima','1h'],['Pedro','pedro-x','2h15'],['Ruim','ruim','abc']]);
  const parsed=imp.parse('clientes.xlsx',Buffer.from(xlsx).toString('base64'));
  const rows=imp.validate(store,parsed.rows);
  assert.deepEqual(rows.map(r=>r.status),['new','new','exists','error','new','error']);
  assert.deepEqual(rows.filter(r=>r.status==='new').map(r=>r.seconds),[5400,5400,8100]);
  const before=store.state.members.length;const result=imp.importMembers(store,rows,'admin');
  assert.equal(result.imported,3);assert.equal(result.skipped,1);assert.equal(result.errors,2);assert.equal(store.state.members.length,before+3);
  const j=store.state.members.find(m=>m.username==='joao.silva');assert.equal(j.creditSeconds,5400);assert.equal(store.publicMember(j).hasPassword,false);assert.equal(j.pointsMilli,0);assert.equal(j.active,true);
  assert.equal(store.state.members.find(m=>m.username==='ana').creditSeconds,0);
  assert.throws(()=>imp.importMembers(store,rows,'admin'),/Nenhum cliente novo/);
  const csv=imp.parse('c.csv',Buffer.from('﻿Nome;Nick;Horas\nZé;ze_1;1,5\n','utf8').toString('base64'));assert.equal(csv.rows[0].seconds,5400);assert.equal(csv.rows[0].name,'Zé');
  for(const [v,s] of [['1h30',5400],['45min',2700],['1:05:10',3910],['2 horas',7200]])assert.equal(imp.parseTime(v,'minutes'),s);
  assert(store.logs({type:'membro'}).some(l=>l.detail.includes('Importação de planilha')));
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('3.0.33: importação com Pontos fidelidade (Nome, Nick, Tempo, Pontos fidelidade) — saldo inicial no extrato',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'prime-import-pts-'));const store=new Store(dir);
 try{
  const xlsx=workbook('Clientes',['Nome','Nick','Tempo','Pontos fidelidade'],[['João','joao_p','01:00',150],['Maria','maria_p',30,''],['Bia','bia_p','00:10','12,5'],['Ruim','ruim_p','00:10','abc']]);
  const parsed=imp.parse('c.xlsx',Buffer.from(xlsx).toString('base64'));assert.equal(parsed.columns.points,true);
  const rows=imp.validate(store,parsed.rows);
  assert.deepEqual(rows.map(r=>r.status),['new','new','new','error']);assert.match(rows[3].error,/Pontos fidelidade/);
  assert.deepEqual(rows.slice(0,3).map(r=>r.pointsMilli),[150000,0,12500]);
  const result=imp.importMembers(store,rows,'admin');assert.equal(result.imported,3);assert.equal(result.pointsMilli,162500);
  const j=store.state.members.find(m=>m.username==='joao_p');assert.equal(j.pointsMilli,150000);assert.equal(j.creditSeconds,3600);
  assert.equal(store.state.loyaltyLedger.filter(l=>l.reference==='import').length,2);
  assert(store.logs({type:'membro'}).some(l=>l.detail.includes('162,5 ponto(s) fidelidade')));
  // CSV sem cabecalho: Nome;Nick;Tempo;Pontos
  const csv=imp.parse('c.csv',Buffer.from('Zé;ze_9;90;1.250\n','utf8').toString('base64'));assert.equal(csv.rows[0].pointsMilli,1250000);assert.equal(csv.rows[0].seconds,5400);
  // planilha antiga de 3 colunas continua funcionando (pontos = 0)
  const old=imp.parse('o.csv',Buffer.from('Nome;Nick;Tempo\nAna;ana_9;10\n','utf8').toString('base64'));assert.equal(old.rows[0].pointsMilli,0);
  for(const [v,n] of [['150',150000],['12,5',12500],['1.250',1250000],['',0],['-1',null],['10 pts',10000]])assert.equal(imp.parsePoints(v),n,v);
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});
