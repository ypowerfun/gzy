'use strict';
// 1.2.2: histórico com mais de 90 dias em tabela própria — relatórios, estatística, extrato, ranking e caixas antigos dão o MESMO resultado
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../store');
const shop=require('../shop'),cash=require('../cash'),stats=require('../stats'),history=require('../history'),events=require('../events'),business=require('../business');
const legacy=require('./legacy-loyalty');
test('1.2.2: arquivar o histórico antigo não muda nenhum relatório e libera o estado em memória',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-arch-'));const realNow=Date.now;let clock=Date.UTC(2026,0,5,13);Date.now=()=>clock;
  const s=new Store(directory);t.after(()=>{Date.now=realNow;s.close();fs.rmSync(directory,{recursive:true,force:true})});
  legacy(s); // medalhas a cada recarga, para o extrato e o ranking terem dados
  const DAY=86400000,members=[1,2,3].map(i=>s.memberSave({name:'Cliente '+i,username:'arq'+i,password:'Senha-Teste-123'},'admin'));
  const coke=shop.saveProduct(s,{name:'Refri',category:'Bebidas',costCents:300,priceCents:600,stock:5000},'admin');
  let unused=null,oldCoupon=null;
  for(let d=0;d<200;d++){clock=Date.UTC(2026,0,5,13)+d*DAY;
    cash.open(s,{openingCents:0},'admin');
    const m=members[d%3];const rc=s.credit(m.id,{minutes:60,paymentMethod:'cash'},'admin',clock);s.change('admin','teste','medalhas',()=>{business.points(s,s.member(m.id),1000+d,'Compra de tempo',rc.id||'x',clock);if(d%9===4)business.points(s,s.member(m.id),-500,'Resgate: teste','r',clock+1);});s.start('1',m.id,'admin',clock+60000);s.finish('1','admin','manual',clock+1800000);
    clock+=1900000;const sale=shop.sell(s,{items:[{kind:'product',id:coke.id,qty:1+(d%2)}],paymentMethod:d%2?'pix':'cash'},'admin');if(d===5)oldCoupon=sale.id;
    if(d===10){clock+=1000;const idle=s.memberSave({name:'Sem jogar',username:'arq9',password:'Senha-Teste-123'},'admin');unused=s.credit(idle.id,{minutes:30,paymentMethod:'pix'},'admin',clock);} // compra que (por enquanto) não foi usada
    if(d%7===3)shop.cancelSale(s,{id:sale.id,reason:'teste'},'admin');
    clock+=60000;cash.close(s,{countedCents:0},'admin');
  }
  clock+=DAY;
  const snap=()=>JSON.stringify({
    rep:['2026-01','2026-03','2026-07'].map(k=>business.report(s,{period:'month',date:k})),repY:business.report(s,{period:'year',date:'2026'}),repD:business.report(s,{period:'day',date:'2026-02-10'}),
    st:['machines','hours','clients','free','durations','sales'].map(kind=>stats.report(s,{kind,from:'2026-01-01',to:'2026-07-25'})),
    hs:history.page(s,'sessions',{page:2}),hp:history.all(s,'points',{}).length,hx:history.all(s,'sessions',{nick:'arq2'}).length,
    rk:['2026-02','2026-07'].map(m=>events.ranking(s,{month:m})),
    cx:[s.state.cashRegisters[3].id,s.state.cashRegisters[150].id].map(id=>cash.salesOf(s,id))
  });
  const before=snap(),sizeBefore=JSON.stringify(s.state).length;
  const r=await s.archiveOld(clock);
  console.log('# arquivados',JSON.stringify(r.counts));assert.ok(r.moved>300,'arquivou '+r.moved);assert.ok(r.counts.sessions>=100&&r.counts.sales>=100&&r.counts.shopSales>=100&&r.counts.loyaltyLedger>=100);
  assert.ok(s.state.sessions.every(x=>x.startedAt>=clock-90*DAY),'só sessões recentes em memória');
  assert.ok(s.state.sales.some(x=>x.id===unused.id),'recarga ainda cancelável continua no estado');
  console.log('# tamanho',sizeBefore,JSON.stringify(s.state).length,JSON.stringify(Object.fromEntries(Object.entries(s.state).map(([k,v])=>[k,JSON.stringify(v).length]).filter(([k,n])=>n>5000))));assert.ok(JSON.stringify(s.state).length<sizeBefore*0.8,'estado menor');
  {const a=JSON.parse(before),b=JSON.parse(snap());for(const k of Object.keys(a)){const x=JSON.stringify(a[k]),y=JSON.stringify(b[k]);if(x!==y){let i=0;while(x[i]===y[i])i++;console.log('# DIF',k,x.slice(Math.max(0,i-150),i+80),' ==> ',y.slice(Math.max(0,i-150),i+80));}}}
  assert.equal(snap(),before,'relatórios iguais depois de arquivar');
  assert.ok(fs.readdirSync(path.join(directory,'backups')).some(f=>/^antes-arquivar-historico-/.test(f)),'cópia antes da 1ª vez');
  // reabrir o servidor: tudo continua igual
  s.close();const s2=new Store(directory);Object.assign(s,{db:s2.db,state:s2.state});assert.equal(snap(),before,'iguais depois de reabrir');
  // segunda rodada não arquiva de novo o que já foi e não mexe
  assert.equal((await s.archiveOld(clock)).moved,0);
  // recarga antiga usada não pode ser cancelada (como antes); cupom antigo pode (volta para o estado e devolve o estoque)
  const oldSale=s.history('sales',0,Date.UTC(2026,1,1)).find(x=>x.archived);assert.throws(()=>business.cancel(s,{id:oldSale.id,reason:'x'},'admin'),/já iniciou uma sessão|já cancelada/);
  const stock=s.state.products.find(p=>p.id===coke.id).stock;cash.open(s,{openingCents:0},'admin');
  shop.cancelSale(s,{id:oldCoupon,reason:'devolução'},'admin');assert.equal(s.state.products.find(p=>p.id===coke.id).stock,stock+2);
  assert.equal(s.history('shopSales').filter(x=>x.id===oldCoupon).length,1,'sem duplicar');assert.equal(s.history('shopSales').find(x=>x.id===oldCoupon).status,'canceled');
  assert.ok(shop.receiptPdf(s,s.history('shopSales',0,Date.UTC(2026,1,1))[0].id).pdf,'reimprimir cupom antigo');
  // próximo arquivamento guarda a versão cancelada
  clock+=DAY;await s.archiveOld(clock);assert.equal(s.findArchived('shopSales',oldCoupon).status,'canceled');
});
