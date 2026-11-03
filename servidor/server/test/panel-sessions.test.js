'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store');const panelSessions=require('../panel-sessions');
test('3.0.48: login do painel fica ativo com uso, sobrevive a reinício e não grava o token',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'prime-panel-sess-'));let clock=Date.parse('2026-10-15T12:00:00Z');const now=()=>clock;
 let store=new Store(dir);
 try{
  let s=panelSessions(store,{now});const token='a'.repeat(64);
  s.set(token,{id:'op1'});assert.equal(s.get(token).id,'op1');
  assert(!JSON.stringify(store.state.panelSessions).includes(token),'token não pode ir para o banco');
  clock+=13*3600000;assert.equal(s.touch(token).id,'op1','antes vencia em 12 h; agora continua');
  clock+=200*86400000;assert.equal(s.touch(token).id,'op1','uso renova a validade');
  store.close();store=new Store(dir);s=panelSessions(store,{now});
  assert.equal(s.get(token).id,'op1','continua logado depois de reiniciar o servidor');
  const other='b'.repeat(64);s.set(other,{id:'op1'});
  for(const [key,v] of s)if(v.id==='op1'&&key!==s.keyOf(token))s.delete(key);
  assert.equal(s.get(other),undefined);assert.equal(s.get(token).id,'op1','troca de senha encerra só as outras sessões');
  s.delete(token);assert.equal(s.get(token),undefined,'Sair encerra a sessão');
  s.set(other,{id:'op2'});clock+=366*86400000;assert.equal(s.get(other),undefined,'sem uso por mais de 1 ano vence');
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});
