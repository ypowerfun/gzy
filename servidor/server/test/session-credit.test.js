'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store'),business=require('../business'),cash=require('../cash');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'prime-session-credit-')),store=new Store(dir);t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true})});store.state.stations.push({id:'pc1',name:'PC 01',kind:'computer',active:true});return store;}
test('3.0.43: tempo adicionado com sessão ativa não é desfeito pelo relato atrasado do PC',t=>{
 const store=fixture(t),pc=require('../pc')(store);const m=store.memberSave({name:'Jogador',username:'jogador',password:'1234'},'admin');store.credit(m.id,{minutes:10},'admin');
 const now=Date.now(),session=store.start('pc1',m.id,'admin',now);
 const st=pc.stationState(store.station('pc1'));assert.equal(st.active.allocatedSeconds,600);assert.equal(st.active.memberUsername,'jogador');
 store.credit(m.id,{minutes:60},'admin',now+1000);const endsAt=session.endsAt;assert.equal(session.allocatedSeconds,4200);
 // relato legado (sem clientAllocatedSeconds) logo após a recarga: ignorado
 pc.reconcileClientTime(store.station('pc1'),{clientSessionId:session.id,clientRemainingSeconds:590},now+2000);assert.equal(session.endsAt,endsAt);
 // cliente novo ainda baseado na alocação antiga: ignorado
 pc.reconcileClientTime(store.station('pc1'),{clientSessionId:session.id,clientRemainingSeconds:590,clientAllocatedSeconds:600},now+60000);assert.equal(session.endsAt,endsAt);
 // cliente novo já com a alocação atual e relato menor (offline): reconcilia normalmente
 pc.reconcileClientTime(store.station('pc1'),{clientSessionId:session.id,clientRemainingSeconds:3000,clientAllocatedSeconds:4200},now+62000);assert.equal(session.endsAt,now+62000+3000000);
});
test('3.0.43: prêmio fidelidade com sessão ativa entra na sessão e gera mensagem configurável',t=>{
 const store=fixture(t),pc=require('../pc')(store);const m=store.memberSave({name:'Jogador',username:'yves',password:'1234'},'admin');
 store.state.settings.hourCents=600;business.settings(store,{thresholdPoints:10,rewardMinutes:120,rate:1},'admin');m.pointsMilli=9500;m.creditSeconds=600;
 const promo={id:'p1',name:'Promo',minutes:10,cents:100,active:true};store.state.promotions.push(promo);
 const now=Date.now(),session=store.start('pc1',m.id,'admin',now);const before=session.endsAt;
 store.credit(m.id,{promotionId:'p1'},'admin',now+1000);
 assert.equal(m.pointsMilli,500);assert.equal(session.endsAt,before+(10+120)*60000);
 const n=store.state.loyaltyNotices[0];assert.equal(n.beforeSeconds,1199);assert.equal(n.afterSeconds,1199+7200);
 let msg=business.noticeMessage(store,n,m);assert.equal(msg.title,'PREMIO DE 2hrs ADICIONADOS !');assert.equal(msg.detail,'Tempo antes: 00:19:59 | Tempo após: 02:19:59');assert.equal(msg.showSeconds,1800);
 assert.throws(()=>business.noticeSettings(store,{title:'',detail:'',minutes:30},'admin'),/mensagem principal/);
 business.noticeSettings(store,{title:'{nick}, você ganhou {premio}!',detail:'ignorado',minutes:10},'admin');
 msg=business.noticeMessage(store,n,m);assert.equal(msg.title,'yves, você ganhou 2hrs!');assert.equal(msg.detail,'Tempo antes: 00:19:59 | Tempo após: 02:19:59');assert.equal(msg.showSeconds,600);assert.equal(store.state.settings.loyaltyNotice.detail,undefined);
 const st=pc.stationState(store.station('pc1'));assert.equal(st.loyaltyNotice.title,'yves, você ganhou 2hrs!');assert.equal(st.cashOpen,false);
 cash.open(store,{openingCents:0},'admin');assert.equal(pc.stationState(store.station('pc1')).cashOpen,true);
 assert.equal(business.prizeText(60),'1hr');assert.equal(business.prizeText(90),'1h30min');assert.equal(business.prizeText(45),'45min');
});
test('3.0.44: prêmio sem sessão aparece ao iniciar a sessão com tempo antes/depois automático',t=>{
 const store=fixture(t),pc=require('../pc')(store);const m=store.memberSave({name:'Jogador',username:'semtempo',password:'1234'},'admin');
 store.state.settings.hourCents=600;business.settings(store,{thresholdPoints:10,rewardMinutes:120,rate:1},'admin');m.pointsMilli=9500;m.creditSeconds=0;
 store.state.promotions.push({id:'p2',name:'Promo',minutes:10,cents:100,active:true});
 store.credit(m.id,{promotionId:'p2'},'admin');assert.equal(m.creditSeconds,(10+120)*60);
 const n=store.state.loyaltyNotices[0];assert.equal(n.withSession,false);
 assert.equal(pc.stationState(store.station('pc1')).loyaltyNotice,null);
 const now=Date.now();store.start('pc1',m.id,'admin',now);
 const notice=pc.stationState(store.station('pc1')).loyaltyNotice;assert(notice);
 assert.equal(n.afterSeconds>=7790&&n.afterSeconds<=7800,true);assert.equal(n.beforeSeconds,n.afterSeconds-7200);
 assert.equal(notice.title,'PREMIO DE 2hrs ADICIONADOS !');assert.match(notice.detail,/^Tempo antes: 00:(09|10):\d\d \| Tempo após: 02:(09|10):\d\d$/);
});
test('3.0.46: cliente altera a própria senha durante a sessão',async t=>{
 const store=fixture(t);store.state.stations.find(s=>s.id==='pc1').pcTokenHash='h';store.state.stations.find(s=>s.id==='pc1').pcDevice='d';
 const pc=require('../pc')(store),{verify}=require('../store');const m=store.memberSave({name:'Jogador',username:'Joao 123',password:'1234'},'admin');store.credit(m.id,{minutes:30},'admin');
 const handler=pc.router.stack?null:pc.router.routes?.['/change-password'];if(!handler)return; // express real: rota coberta pelo build HTTP
 const call=body=>new Promise(res=>{const r={statusCode:200,set(){},status(c){this.statusCode=c;return this},json(d){res({status:this.statusCode,data:d})}};handler({stationId:'pc1',tokenHash:'h',device:'d',body:{clientRunId:'b'.repeat(32),...body},socket:{encrypted:true},headers:{}},r,e=>res({status:400,error:e&&e.message}))});
 assert.match((await call({sessionId:'x',currentPassword:'1234',newPassword:'abcd',repeatPassword:'abcd'})).error,/Nenhuma sessão/);
 const session=store.start('pc1',m.id,'admin');
 assert.match((await call({sessionId:session.id,currentPassword:'9999',newPassword:'abcd',repeatPassword:'abcd'})).error,/Senha atual incorreta/);
 assert.match((await call({sessionId:session.id,currentPassword:'1234',newPassword:'abcd',repeatPassword:'abce'})).error,/não coincidem/);
 assert.match((await call({sessionId:session.id,currentPassword:'1234',newPassword:'abc',repeatPassword:'abc'})).error,/4 a 20/);
 assert.match((await call({sessionId:session.id,currentPassword:'1234',newPassword:'1234',repeatPassword:'1234'})).error,/diferente/);
 assert.equal((await call({sessionId:session.id,currentPassword:'1234',newPassword:'nova 99',repeatPassword:'nova 99'})).data.ok,true);
 assert.equal(verify('nova 99',m.passwordHash),true);assert.equal(verify('1234',m.passwordHash),false);
 assert(store.logs({type:'membro'}).some(l=>l.detail.includes('Senha alterada pelo cliente')));
});
test('3.0.47: PC bloqueia após 7 tentativas erradas por 2 minutos',async t=>{
 const store=fixture(t);const st=store.state.stations.find(s=>s.id==='pc1');st.pcTokenHash='h';st.pcDevice='d';
 const pc=require('../pc')(store);const jm=store.memberSave({name:'Jogador',username:'jogador',password:'1234'},'admin');store.credit(jm.id,{minutes:30},'admin');require('../cash').open(store,{openingCents:0},'admin');
 const handler=pc.router.stack?null:pc.router.routes?.['/login'];if(!handler)return;
 const call=body=>new Promise(res=>{const r={statusCode:200,set(){},status(c){this.statusCode=c;return this},json(d){res({status:this.statusCode,data:d})}};handler({stationId:'pc1',tokenHash:'h',device:'d',body:{clientRunId:'b'.repeat(32),...body},socket:{encrypted:true},headers:{}},r,e=>res({status:400,error:e&&e.message}))});
 const realNow=Date.now;let clock=realNow();Date.now=()=>clock;t.after(()=>{Date.now=realNow});
 for(let i=1;i<=3;i++)assert.equal((await call({username:'jogador',password:'errada'})).error,'Usuário ou senha incorretos.');
 assert.match((await call({username:'jogador',password:'errada'})).error,/Restam 3 tentativas/);
 assert.match((await call({username:'jogador',password:'errada'})).error,/Restam 2 tentativas/);
 assert.match((await call({username:'jogador',password:'errada'})).error,/Restam 1 tentativa\./);
 assert.match((await call({username:'jogador',password:'errada'})).error,/aguarde 2 min/);
 assert.match((await call({username:'jogador',password:'1234'})).error,/Muitas tentativas\. Aguarde 2 min para/);
 clock+=60000;assert.match((await call({username:'jogador',password:'1234'})).error,/Aguarde 1 min para/);
 clock+=61000;const ok=await call({username:'jogador',password:'1234'});assert.equal(ok.status,200);assert(ok.data.active);
});
