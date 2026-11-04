'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store');const {createServer}=require('../server');

test('auditoria de queda simultânea informa ausência de perda e devolução manual é única quando necessária',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-recovery-review-'));
 const seed=new Store(directory);seed.state.stations.push({id:'pc-power',name:'PC queda',kind:'computer',active:true});const m=seed.memberSave({name:'Cliente',username:'cliente',password:'Senha-123456'},'admin');seed.credit(m.id,{minutes:10},'admin');const now=Date.now(),session=seed.start('pc-power',m.id,'admin',now-120000);seed.state.runtime.lastAliveAt=now;seed.state.runtime.cleanShutdown=false;seed.persist();seed.close();
 const app=createServer({directory,noTimer:true});t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});
 let audit=app.pc.recoveryAudit();assert(audit);assert.equal(audit.status,'checking');
 const current=app.store.activeForStation('pc-power');const finished=app.pc.recoverInterruptedSession(app.store.station('pc-power'),{recoveryAfterRestart:true,recoverySessionId:current.id,recoveryRemainingSeconds:470,clientRunId:'d'.repeat(32),systemUptimeMs:1000},now+60000);assert(finished);assert(finished.remainingSeconds>=470);
 audit=app.pc.recoveryAudit();assert(audit);assert.equal(audit.status,'ok');assert.match(audit.message,/não houve perda de saldo/i);
 const review=app.pc.recoveryReview().items.find(r=>r.sessionId===session.id);assert(review);assert.equal(review.status,'ok');
 const before=app.store.member(m.id).creditSeconds;review.status='needs-refund';review.potentialLossSeconds=15;app.store.persist();const refunded=app.pc.refundRecovery(review.id,'admin');assert.equal(refunded.seconds,15);assert.equal(app.store.member(m.id).creditSeconds,before+15);assert.throws(()=>app.pc.refundRecovery(review.id,'admin'));
});

test('reinício apenas do servidor não é tratado como queda simultânea quando o PC continua ativo',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-recovery-server-only-'));
 const seed=new Store(directory);seed.state.stations.push({id:'pc-online',name:'PC online',kind:'computer',active:true});const m=seed.memberSave({name:'Online',username:'online',password:'Senha-123456'},'admin');seed.credit(m.id,{minutes:10},'admin');const now=Date.now(),session=seed.start('pc-online',m.id,'admin',now-30000);seed.state.runtime.lastAliveAt=now;seed.state.runtime.cleanShutdown=false;seed.persist();seed.close();
 const app=createServer({directory,noTimer:true});t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});
 assert.equal(app.pc.recoveryAudit().status,'checking');app.pc.reconcileClientTime(app.store.station('pc-online'),{clientSessionId:session.id,clientRemainingSeconds:565,clientRunId:'e'.repeat(32),systemUptimeMs:800000,recoveryAfterRestart:false},now+1000);assert.equal(app.pc.recoveryAudit(),null);const review=app.pc.recoveryReview().items.find(r=>r.sessionId===session.id);assert.equal(review.status,'ignored');assert.equal(review.simultaneous,false);
});
