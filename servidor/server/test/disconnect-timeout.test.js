'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');const {createServer}=require('../server');

test('PC sem resposta fica vermelho em 10 s, servidor aguarda 1 minuto e só então encerra devolvendo o saldo desde o momento em que ficou vermelho',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-signal-'));const app=createServer({directory,noTimer:true});t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});const store=app.store,pc=app.pc;
 store.state.stations.push({id:'offline',name:'PC offline',kind:'computer',active:true});const m=store.memberSave({name:'Pessoa',username:'pessoa',password:'Senha-123456'},'admin');store.credit(m.id,{minutes:10},'admin');const now=Date.now(),session=store.start('offline',m.id,'admin',now-120000);pc.seen.set('offline',now);
 const before=store.remaining(session,now);assert(before<=480&&before>470);assert.equal(pc.expireDisconnected('offline',now+9999),null);assert.equal(store.activeForStation('offline').id,session.id);
 assert.equal(pc.expireDisconnected('offline',now+10000),null);assert.equal(pc.connected('offline',now+10000),false);assert(pc.reconnectWatch.has('offline'));assert.equal(pc.reconnectSecondsLeft('offline',now+10000),60);assert.equal(pc.expireDisconnected('offline',now+69999),null);assert.equal(store.activeForStation('offline').id,session.id);
 const finished=pc.expireDisconnected('offline',now+70000);assert.equal(finished.id,session.id);assert.equal(finished.reason,'sem conexão por 1 minuto');assert.equal(store.activeForStation('offline'),undefined);assert.equal(m.creditSeconds,before-10);assert.equal(finished.remainingSeconds,before-10);assert.equal(pc.reconnectWatch.has('offline'),false);
});

test('PC vermelho que reconecta dentro de 1 minuto volta ao verde e mantém a sessão',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-reconnect-'));const app=createServer({directory,noTimer:true});t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});const store=app.store,pc=app.pc;
 store.state.stations.push({id:'blip',name:'PC oscilando',kind:'computer',active:true});const m=store.memberSave({name:'Oscila',username:'oscila',password:'Senha-123456'},'admin');store.credit(m.id,{minutes:10},'admin');const now=Date.now(),session=store.start('blip',m.id,'admin',now-60000);pc.seen.set('blip',now);
 assert.equal(pc.expireDisconnected('blip',now+15000),null);assert(pc.reconnectWatch.has('blip'));
 pc.markSeen('blip',now+50000);assert.equal(pc.reconnectWatch.has('blip'),false);assert.equal(pc.connected('blip',now+50000),true);assert.equal(pc.reconnectSecondsLeft('blip',now+50000),null);
 assert.equal(pc.expireDisconnected('blip',now+75000),null);assert.equal(store.activeForStation('blip').id,session.id);assert(store.logs({type:'computador'}).some(l=>l.detail.includes('Conexão restabelecida')));
 assert.equal(pc.expireDisconnected('blip',now+50000+9000),null);assert.equal(pc.reconnectWatch.has('blip'),false);
});

test('reinício do servidor dá janela para o cliente reconectar e reconciliar o tempo local',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-restart-offline-'));let app=createServer({directory,noTimer:true});const store=app.store;store.state.stations.push({id:'pc1',name:'PC 1',kind:'computer',active:true});const m=store.memberSave({name:'Segundo',username:'segundo',password:'Senha-123456'},'admin');store.credit(m.id,{minutes:10},'admin');const start=Date.now()-120000;const s=store.start('pc1',m.id,'admin',start);const id=s.id;await app.close();
 app=createServer({directory,noTimer:true});t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});const restored=app.store.activeForStation('pc1');assert(restored);assert.equal(restored.id,id);const now=Date.now();assert.equal(app.pc.expireDisconnected('pc1',now+5000),null);const localRemaining=Math.max(0,app.store.remaining(restored,now)-30);const sync=app.pc.reconcileClientTime(app.store.station('pc1'),{clientSessionId:id,clientRemainingSeconds:localRemaining},now+6000);app.pc.seen.set('pc1',now+6000);assert(sync);assert(app.store.remaining(restored,now+6000)<=localRemaining);assert.equal(app.pc.connected('pc1',now+6000),true);
});

test('queda simultânea: reinício do PC encerra a sessão pelo checkpoint e devolve o maior saldo seguro',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-power-recovery-'));const app=createServer({directory,noTimer:true});t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});const store=app.store,pc=app.pc;
 store.state.stations.push({id:'power',name:'PC energia',kind:'computer',active:true});const m=store.memberSave({name:'Energia',username:'energia',password:'Senha-123456'},'admin');store.credit(m.id,{minutes:10},'admin');const now=Date.now(),session=store.start('power',m.id,'admin',now-120000);
 pc.reconcileClientTime(store.station('power'),{clientSessionId:session.id,clientRemainingSeconds:472,clientRunId:'a'.repeat(32),systemUptimeMs:500000},now);
 const finished=pc.recoverInterruptedSession(store.station('power'),{recoveryAfterRestart:true,recoverySessionId:session.id,recoveryRemainingSeconds:470,clientRunId:'b'.repeat(32),systemUptimeMs:1500},now+60000);
 assert(finished);assert.equal(finished.reason,'recuperação após reinício/queda da estação');assert.equal(finished.remainingSeconds,472);assert.equal(store.member(m.id).creditSeconds,472);assert.equal(store.activeForStation('power'),undefined);assert.equal(finished.recovery.clientReportedRemainingSeconds,470);assert.equal(finished.recovery.serverLastKnownRemainingSeconds,472);
 const logs=store.logs({type:'recuperacao-energia'});assert(logs.some(l=>l.detail.includes('sem perda detectada')&&l.detail.includes('PC energia')));
});

test('queda simultânea sem retorno do PC usa o último checkpoint persistido após a janela de reinício do servidor',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-power-fallback-'));let app=createServer({directory,noTimer:true});let store=app.store;
 store.state.stations.push({id:'fallback',name:'PC fallback',kind:'computer',active:true});const m=store.memberSave({name:'Fallback',username:'fallback',password:'Senha-123456'},'admin');store.credit(m.id,{minutes:10},'admin');const now=Date.now(),session=store.start('fallback',m.id,'admin',now-120000);app.pc.reconcileClientTime(store.station('fallback'),{clientSessionId:session.id,clientRemainingSeconds:468,clientRunId:'c'.repeat(32),systemUptimeMs:700000},now);await app.close();
 app=createServer({directory,noTimer:true});t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});store=app.store;const recovered=app.pc.expireDisconnected('fallback',Date.now()+app.pc.startupGraceMs+1000);assert(recovered);assert.equal(recovered.reason,'recuperação após reinício simultâneo/queda de energia');assert.equal(recovered.remainingSeconds,468);assert.equal(store.member(m.id).creditSeconds,468);assert.equal(store.activeForStation('fallback'),undefined);assert(store.logs({type:'recuperacao-energia'}).some(l=>l.detail.includes('último checkpoint do servidor')));
});


test('regras complementares: queda do servidor preserva sessão para reconexão; queda do cliente com servidor ativo encerra e devolve saldo',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-dual-offline-'));let app=createServer({directory,noTimer:true});let store=app.store;
 store.state.stations.push({id:'dual',name:'PC dual',kind:'computer',active:true});const m=store.memberSave({name:'Dual',username:'dual',password:'Senha-123456'},'admin');store.credit(m.id,{minutes:10},'admin');const started=Date.now()-60000;const session=store.start('dual',m.id,'admin',started);const id=session.id;app.pc.reconcileClientTime(store.station('dual'),{clientSessionId:id,clientRemainingSeconds:540,clientRunId:'d'.repeat(32),systemUptimeMs:500000},Date.now());
 await app.close();
 // Servidor indisponível: nenhuma rotina do servidor pode consumir/encerrar a sessão. No retorno existe janela de reconexão.
 app=createServer({directory,noTimer:true});t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});store=app.store;const restored=store.activeForStation('dual');assert(restored);assert.equal(restored.id,id);const back=Date.now();assert.equal(app.pc.expireDisconnected('dual',back+10000),null);
 // Cliente volta a falar com o servidor e a sessão permanece ativa.
 app.pc.reconcileClientTime(store.station('dual'),{clientSessionId:id,clientRemainingSeconds:520,clientRunId:'e'.repeat(32),systemUptimeMs:510000},back+11000);app.pc.seen.set('dual',back+11000);assert.equal(store.activeForStation('dual').id,id);
 // Depois, com servidor ativo, o PC deixa de responder: fica vermelho em 10 s; após mais 1 minuto sem reconectar a sessão é encerrada.
 const before=store.remaining(store.activeForStation('dual'),back+11000);assert.equal(app.pc.expireDisconnected('dual',back+21000),null);const finished=app.pc.expireDisconnected('dual',back+81000);assert(finished);assert.equal(finished.reason,'sem conexão por 1 minuto');assert.equal(store.activeForStation('dual'),undefined);assert(store.member(m.id).creditSeconds>0);assert(store.member(m.id).creditSeconds<=before);
});
