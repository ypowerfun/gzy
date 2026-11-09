'use strict';
// 1.2.3: pasta Documentos\gamezoney\backup; automáticos só dos últimos 7 dias; manuais nunca apagados
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../store'),createBackups=require('../backups');
test('1.2.3: backups movidos da pasta antiga, automáticos com mais de 7 dias apagados, manuais e desconhecidos guardados',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gz-ret-')),docs=path.join(root,'Documentos'),old=path.join(docs,'bkp gamezoney'),app=path.join(root,'app');fs.mkdirSync(app);fs.mkdirSync(old,{recursive:true});
  const store=new Store(path.join(root,'data'));t.after(()=>{store.close();fs.rmSync(root,{recursive:true,force:true})});
  const DAY=86400000,base=Date.parse('2026-11-20T12:00:00Z'),iso=t=>new Date(t).toISOString().replace(/[:.]/g,'-');
  // instalação antiga: configuração apontando para a pasta antiga + arquivos antigos (sem auto/manual no nome)
  store.state.settings.timeZone='UTC'; // o teste não pode depender do fuso do computador (no Windows Manaus/−4 o 'dia seguinte' caía antes das 03:00)
  store.state.settings.backup={enabled:true,time:'03:00',directory:old};
  const legacyAuto='GameZoney-'+iso(base-20*DAY)+'-aaaaaa.zip',legacyManual='GameZoney-'+iso(base-30*DAY)+'-bbbbbb.zip',legacyUnknown='GameZoney-'+iso(base-40*DAY)+'-cccccc.zip';
  for(const f of [legacyAuto,legacyManual,legacyUnknown,'anotacao.txt'])fs.writeFileSync(path.join(old,f),'x');
  store.log('sistema','backup','Backup completo criado: '+path.join(old,legacyAuto));store.log('admin','backup','Backup completo criado: '+path.join(old,legacyManual));
  let time=base;const b=createBackups(store,{application:app,documents:docs,now:()=>time,pack:async(stage,file)=>fs.writeFileSync(file,'zip')});
  const dir=path.join(docs,'gamezoney','backup');
  assert.equal(b.status().directory,dir,'configuração passou para a pasta nova');assert.ok(!fs.existsSync(old),'pasta antiga vazia removida');
  assert.deepEqual(fs.readdirSync(dir).sort(),[legacyAuto,legacyManual,legacyUnknown,'anotacao.txt'].sort(),'tudo movido, nada apagado');
  // automáticos recentes (dentro de 7 dias) e um antigo de 8 dias + um manual antigo novo formato
  const auto8='GameZoney-auto-'+iso(base-8*DAY)+'-dddddd.zip',auto6='GameZoney-auto-'+iso(base-6*DAY)+'-eeeeee.zip',manual90='GameZoney-manual-'+iso(base-90*DAY)+'-ffffff.zip';
  for(const f of [auto8,auto6,manual90])fs.writeFileSync(path.join(dir,f),'x');
  // backup manual não apaga nada
  b.start('admin','manual');await b.wait();let names=fs.readdirSync(dir);assert.ok(names.some(n=>/^GameZoney-manual-/.test(n)&&n!==manual90));assert.ok(names.includes(auto8)&&names.includes(legacyAuto));
  // backup automático (pelo agendamento) apaga só automáticos com mais de 7 dias
  time=base+DAY;assert.ok(b.due());b.tick();await b.wait();names=fs.readdirSync(dir);
  assert.ok(!names.includes(auto8),'automático de 8 dias apagado');assert.ok(!names.includes(legacyAuto),'automático antigo (pelo Log) apagado');
  for(const keep of [auto6,manual90,legacyManual,legacyUnknown,'anotacao.txt'])assert.ok(names.includes(keep),'guardado: '+keep);
  assert.equal(names.filter(n=>/^GameZoney-auto-/.test(n)).length,2,'o de 6 dias + o novo');
  // pasta escolhida pelo usuário não é trocada
  const store2=new Store(path.join(root,'data2'));t.after(()=>store2.close());store2.state.settings.backup={enabled:true,time:'03:00',directory:path.join(root,'D')};createBackups(store2,{application:app,documents:path.join(root,'docs2')});assert.equal(store2.state.settings.backup.directory,path.join(root,'D'));
});
