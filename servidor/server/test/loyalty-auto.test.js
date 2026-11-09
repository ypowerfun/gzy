'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store'),business=require('../business');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-loyalty-auto-')),store=require('./legacy-loyalty')(new Store(dir));t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true})});return store;}
function member(store,user='jogador'){return store.memberSave({name:'Jogador Teste',username:user,password:'Senha-123456'},'admin');}
function program(store,points=10,minutes=60){return business.settings(store,{thresholdPoints:points,rewardMinutes:minutes,rate:1},'admin');}

function promo(s,minutes){const p={id:'promo-'+minutes+'-'+s.state.promotions.length,name:minutes+' min',minutes,cents:Math.round(minutes*s.state.settings.hourCents/60),active:true};s.state.promotions.push(p);return p.id;}
test('todos os membros entram automaticamente no programa e o prêmio é automático',t=>{
 const store=fixture(t),m=member(store);store.state.settings.hourCents=1000;program(store,10,60);
 const sale=store.credit(m.id,{promotionId:promo(store,60)},'admin',Date.now());
 assert.equal(store.state.settings.loyalty.enabled,true);assert.equal(store.state.settings.loyalty.thresholdMilli,10000);assert.equal(store.state.settings.loyalty.rewardMinutes,60);
 assert.equal(m.pointsMilli,0);assert.equal(m.creditSeconds,7200);
 assert.deepEqual(sale.autoReward,{rewardId:'automatic-program',rewardName:'Tempo fidelidade',count:1,minutes:60});
 assert.equal(store.state.loyaltyNotices.length,1);assert.equal(store.state.loyaltyNotices[0].memberId,m.id);assert.equal(store.state.loyaltyNotices[0].minutes,60);
 assert.match(store.state.loyaltyLedger.at(-1).reason,/Resgate automático do programa fidelidade/);
});

test('resgate automático durante sessão adiciona prêmio à sessão e mantém aviso para o cliente',t=>{
 const store=fixture(t),m=member(store);store.state.settings.hourCents=600;program(store,10,60);m.pointsMilli=9000;m.creditSeconds=1800;
 const now=Date.now(),session=store.start('1',m.id,'admin',now);const before=session.endsAt;const sale=store.credit(m.id,{promotionId:promo(store,10)},'admin',now+1000);
 assert.equal(m.pointsMilli,0);assert.equal(sale.autoReward.rewardId,'automatic-program');
 assert.equal(session.allocatedSeconds,6000);assert.equal(session.endsAt,before+4200000);
 assert.equal(store.state.loyaltyNotices.length,1);assert.equal(store.state.loyaltyNotices[0].minutes,60);
});

test('saldo suficiente para múltiplos ciclos libera todos os prêmios sem perder pontos restantes',t=>{
 const store=fixture(t),m=member(store);store.state.settings.hourCents=600;program(store,10,60);m.pointsMilli=19500;
 const sale=store.credit(m.id,{promotionId:promo(store,5)},'admin',Date.now());
 assert.equal(sale.pointsMilli,500);assert.equal(m.pointsMilli,0);assert.equal(sale.autoReward.count,2);assert.equal(sale.autoReward.minutes,120);
 assert.equal(m.creditSeconds,5*60+120*60);assert.equal(store.state.loyaltyNotices[0].minutes,120);assert.equal(store.state.loyaltyNotices[0].count,2);
 assert.equal(store.state.loyaltyLedger.at(-1).amount,-20000);assert.match(store.state.loyaltyLedger.at(-1).reason,/\(2x\)/);
});

test('configuração global substitui catálogo automático e mantém regras por dia',t=>{
 const store=fixture(t);business.reward(store,{name:'Legado',points:5,minutes:30,autoRedeem:true},'admin');
 const weekly=Array.from({length:7},(_,day)=>({day,cents:1000,pointsMilli:day===0?0:2000}));
 business.settings(store,{thresholdPoints:25,rewardMinutes:90,weekly},'admin');
 assert.equal(store.state.settings.loyalty.thresholdMilli,25000);assert.equal(store.state.settings.loyalty.rewardMinutes,90);assert.equal(store.state.settings.loyalty.weekly.length,7);
 assert.equal(store.state.rewards.some(r=>r.autoRedeem),false);
});

test('3.0.30: pontos fidelidade somente quando a recarga usa uma promoção ativa',t=>{
 const store=fixture(t),m=member(store);store.state.settings.hourCents=1000;program(store,1000,60);
 const plain=store.credit(m.id,{minutes:60},'admin');assert.equal(plain.pointsMilli,0);assert.equal(m.pointsMilli,0);
 const byValue=store.credit(m.id,{mode:'value',cents:2000},'admin');assert.equal(byValue.pointsMilli,0);assert.equal(m.pointsMilli,0);
 const withPromo=store.credit(m.id,{promotionId:promo(store,120)},'admin');assert.equal(withPromo.pointsMilli,20000);assert.equal(m.pointsMilli,20000);
 store.state.promotions.at(-1).active=false;assert.throws(()=>store.credit(m.id,{promotionId:store.state.promotions.at(-1).id},'admin'),/Promoção indisponível/);
});

test('3.0.67: "Ativar programa fidelidade" por cliente — desmarcado não ganha pontos nem prêmio; marcado volta a ganhar', t => {
 const store = fixture(t), m = member(store); store.state.settings.hourCents = 1000; program(store, 10, 60);
 assert.equal(m.loyaltyEnabled, true, 'cliente novo já entra no programa');
 // desativa pelo cadastro (admin ou operador): fica registrado no log
 store.memberSave({id: m.id, name: m.name, username: m.username, loyaltyEnabled: false}, 'operador1');
 assert.equal(m.loyaltyEnabled, false);
 assert.ok(store.logs().some(l => l.type === 'fidelidade' && /DESATIVADO para Jogador Teste/.test(l.detail) && l.actor === 'operador1'));
 m.pointsMilli = 9500; // pontos antigos continuam no saldo
 const ledger = store.state.loyaltyLedger.length, seconds = m.creditSeconds;
 const sale = store.credit(m.id, {promotionId: promo(store, 60)}, 'admin', Date.now());
 assert.equal(sale.pointsMilli, 0, 'recarga com promoção não gera pontos');
 assert.equal(sale.loyaltyOff, true);
 assert.equal(sale.autoReward, undefined, 'sem prêmio automático');
 assert.equal(m.pointsMilli, 9500, 'pontos antigos ficam como estão');
 assert.equal(store.state.loyaltyLedger.length, ledger, 'nada entra no extrato de pontos');
 assert.equal(m.creditSeconds, seconds + 3600, 'o tempo comprado entra normalmente');
 // editar outros dados sem mandar o campo não muda a escolha
 store.memberSave({id: m.id, name: 'Jogador Novo Nome', username: m.username}, 'admin');
 assert.equal(m.loyaltyEnabled, false);
 // reativa: volta a ganhar pontos e o prêmio automático
 store.memberSave({id: m.id, name: m.name, username: m.username, loyaltyEnabled: true}, 'admin');
 assert.ok(store.logs().some(l => l.type === 'fidelidade' && /ATIVADO para Jogador Novo Nome/.test(l.detail)));
 const again = store.credit(m.id, {promotionId: promo(store, 60)}, 'admin', Date.now());
 assert.ok(again.pointsMilli > 0, 'volta a ganhar pontos');
 assert.equal(again.autoReward?.rewardId, 'automatic-program', 'e o prêmio automático (9,5 + novos pontos passam de 10)');
 // clientes antigos (sem o campo) continuam participando
 const old = member(store, 'antigo'); delete old.loyaltyEnabled;
 const oldSale = store.credit(old.id, {promotionId: promo(store, 60)}, 'admin', Date.now());
 assert.ok(oldSale.pointsMilli > 0 || oldSale.autoReward, 'cadastro antigo sem o campo = programa ativo');
});
