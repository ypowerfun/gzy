'use strict';
// 1.3.6: abrir o servidor grava o estado inteiro UMA vez (antes 4–5 seguidas; com 1 ano de dados cada uma custava ~0,2 s)
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../store');const {createServer}=require('../server');
test('1.3.6: abertura do servidor faz uma gravação completa só, e ela fica salva',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-boot-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true,maxRetries:5}));
 const first=createServer({directory,noTimer:true});const boot1=first.store.state.runtime.bootId;await first.close();
 let writes=0;const original=Store.prototype.persist;Store.prototype.persist=function(){if(!this.batch)writes++;return original.call(this)};
 let app;try{app=createServer({directory,noTimer:true})}finally{Store.prototype.persist=original}
 assert.equal(writes,1,'uma gravação completa na abertura');assert.equal(app.store.batch,0,'gravações normais voltam depois da abertura');
 const boot2=app.store.state.runtime.bootId;assert.notEqual(boot2,boot1);
 const disk=new Store(directory);try{assert.equal(disk.state.runtime.bootId,boot2,'o que a abertura mudou foi gravado')}finally{disk.close()}
 app.store.change('admin','config','teste',()=>{app.store.state.settings.organization='Arena Boot'});
 await app.close();const again=new Store(directory);try{assert.equal(again.state.settings.organization,'Arena Boot')}finally{again.close()}
});
test('1.3.6: store sem batch (testes e ferramentas) continua gravando na hora',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-boot2-'));const s=new Store(directory);try{assert.equal(s.batch,0);s.state.settings.organization='X';s.persist();const r=new Store(directory);try{assert.equal(r.state.settings.organization,'X')}finally{r.close()}}finally{s.close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:5})}
});
