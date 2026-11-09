'use strict';
// 1.2.1: gravações leves — presença do servidor (5 s) e ponto de controle de cada consulta do PC não regravam o estado inteiro
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../store');
test('1.2.1: presença e ponto de controle gravados em linha pequena, aplicados ao reabrir e limpos na gravação completa',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-light-'));let s=new Store(directory);t.after(()=>{try{s.close()}catch{}fs.rmSync(directory,{recursive:true,force:true})});
  const m=s.memberSave({name:'Ana',username:'leve1',password:'Senha-Teste-123'},'admin');s.credit(m.id,{minutes:60},'admin',1000);const session=s.start('2',m.id,'admin',1000);
  const stateRow=()=>s.db.prepare('SELECT data FROM state WHERE id=1').get().data,before=stateRow();
  // presença: não mexe no estado gravado
  s.state.runtime.lastAliveAt=999999999999;s.state.runtime.cleanShutdown=false;s.persistRuntime();
  // ponto de controle do PC: idem
  session.lastClientSyncAt=5000;session.lastClientRemainingSeconds=3500;session.lastClientRunId='run-1';session.lastClientSystemUptimeMs=777;s.checkpoint(session);
  assert.equal(stateRow(),before,'o estado completo não foi regravado');
  assert.equal(s.db.prepare("SELECT COUNT(*) n FROM live").get().n,2);
  // queda do servidor sem gravação completa: ao reabrir, os dois aparecem
  s.close();s=new Store(directory);const again=s.activeForMember(m.id);
  assert.equal(s.state.runtime.lastAliveAt,999999999999);assert.equal(s.state.runtime.cleanShutdown,false);
  assert.equal(again.lastClientRemainingSeconds,3500);assert.equal(again.lastClientRunId,'run-1');assert.equal(again.lastClientSystemUptimeMs,777);assert.equal(again.endsAt,session.endsAt);
  // ponto de controle mais antigo que o estado completo não volta o relógio
  again.lastClientSyncAt=9000;again.lastClientRemainingSeconds=3400;s.db.prepare("INSERT INTO live(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data").run('cp:'+again.id,JSON.stringify({lastClientSyncAt:6000,lastClientRemainingSeconds:3490}));
  s.db.prepare('UPDATE state SET data=? WHERE id=1').run(JSON.stringify(s.state));s.close();s=new Store(directory);assert.equal(s.activeForMember(m.id).lastClientRemainingSeconds,3400);
  // gravação completa limpa os pontos de controle (o estado já os leva)
  s.persist();assert.equal(s.db.prepare("SELECT COUNT(*) n FROM live WHERE key LIKE 'cp:%'").get().n,0);
  // sessão encerrada: ponto de controle velho é ignorado
  s.checkpoint({id:'outra',lastClientSyncAt:1});s.finish('2','admin','teste',2000);s.close();s=new Store(directory);assert.equal(s.activeForMember(m.id),undefined);
});
