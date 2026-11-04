'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store');const shop=require('../shop');const cash=require('../cash');const stats=require('../stats');

test('3.0.31: caixa — abertura, vendas ligadas ao caixa, sangria/suprimento, fechamento com diferença e PDF',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-cash-'));let store=new Store(dir);
 try{
  assert.equal(cash.current(store),null);
  assert.throws(()=>cash.move(store,{type:'sangria',cents:100,reason:'x'},'admin'),/Abra o caixa/);
  assert.throws(()=>cash.requireOpen(store,'vender no PDV'),/Abra o caixa antes de vender/);
  const reg=cash.open(store,{openingCents:5000},'admin');assert.equal(reg.number,1);
  assert.throws(()=>cash.open(store,{openingCents:0},'admin'),/Já existe um caixa aberto/);
  const coca=store.state.products.find(p=>p.name==='Coca-cola');
  const sale=shop.sell(store,{items:[{kind:'product',id:coca.id,qty:2}],paymentMethod:'cash'},'recepcao');assert.equal(sale.cashId,reg.id);assert.equal(coca.stock,22);
  shop.sell(store,{items:[{kind:'product',id:coca.id,qty:1}],paymentMethod:'pix'},'recepcao');
  const ana=store.memberSave({name:'Ana',username:'ana'},'admin');
  const rec=store.credit(ana.id,{minutes:60,paymentMethod:'credit'},'recepcao');assert.equal(rec.cashId,reg.id);
  cash.move(store,{type:'suprimento',cents:1000,reason:'troco'},'admin');
  cash.move(store,{type:'sangria',cents:2000,reason:'deposito'},'admin');
  assert.throws(()=>cash.move(store,{type:'sangria',cents:999999,reason:'x'},'admin'),/maior que o dinheiro/);
  let s=cash.summary(store,cash.current(store));
  assert.equal(s.shopCents,1800);assert.equal(s.timeCents,700);assert.equal(s.methods.cash,1200);assert.equal(s.methods.pix,600);assert.equal(s.methods.card,700);
  assert.equal(s.expectedCashCents,5000+1200+1000-2000);
  assert.equal(s.items[0].qty,3);assert.equal(s.items[0].stock,21);
  // cancelamento: sai do total e devolve estoque
  shop.cancelSale(store,{id:sale.id,reason:'desistiu'},'admin');assert.equal(coca.stock,23);
  s=cash.summary(store,cash.current(store));assert.equal(s.methods.cash,0);assert.equal(s.canceledCount,1);
  assert.equal(cash.salesOf(store,reg.id).length,3);
  const closed=cash.close(store,{countedCents:4000},'admin');
  assert.equal(closed.status,'closed');assert.equal(closed.closing.expectedCashCents,4000);assert.equal(closed.differenceCents,0);
  assert.equal(cash.current(store),null);
  // venda depois do fechamento nao entra no caixa fechado
  const after=store.credit(ana.id,{minutes:30,paymentMethod:'cash'},'recepcao');assert.equal(after.cashId,null);
  const pdf=cash.reportPdf(store,reg.id);assert.match(pdf.pdf.toString('latin1'),/^%PDF-1\.4/);assert.match(pdf.pdf.toString('latin1'),/FECHAMENTO DE CAIXA/);
  const st=cash.state(store);assert.equal(st.history.length,1);assert.equal(st.current,null);
  // estoque: entrada e historico de movimentos
  cash.stockEntry(store,{productId:coca.id,qty:10,reason:'Compra fornecedor',costCents:300},'admin');assert.equal(coca.stock,33);assert.equal(coca.costCents,300);
  const moves=cash.stockMoves(store).map(m=>m.type);assert.ok(moves.includes('entrada'));assert.ok(moves.includes('venda'));assert.ok(moves.includes('cancelamento'));
  shop.saveProduct(store,{...coca,stock:30},'admin');assert.equal(store.state.stockMoves.at(-1).type,'ajuste');assert.equal(store.state.stockMoves.at(-1).qty,-3);
  // persiste
  store.close();store=new Store(dir);assert.equal(store.state.cashRegisters.length,1);assert.equal(store.state.cashRegisters[0].closing.expectedCashCents,4000);
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('3.0.31: estatística — máquina, horário, funcionário, cliente, cliente grátis, duração, vendas e fluxo de caixa',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-stats-'));let store=new Store(dir);
 try{
  store.state.settings.timeZone='America/Manaus';
  const day='2026-09-10',base=stats.startOf(day,'America/Manaus');assert.equal(new Date(base).toISOString(),'2026-09-10T04:00:00.000Z');
  const ana=store.memberSave({name:'Ana',username:'ana'},'admin'),bia=store.memberSave({name:'Bia',username:'bia'},'admin');
  // sessoes finalizadas escritas diretamente: Ana 2h na TV 1 (14h-16h), Bia 30min na TV 2 (14h-14h30)
  const H=3600000;
  store.state.sessions.push({id:'s1',stationId:'1',stationName:'TV 1 • PS4',memberId:ana.id,startedAt:base+14*H,finishedAt:base+16*H,usedSeconds:7200,allocatedSeconds:7200,status:'finished'});
  store.state.sessions.push({id:'s2',stationId:'2',stationName:'TV 2 • PS4',memberId:bia.id,startedAt:base+14*H,finishedAt:base+14.5*H,usedSeconds:1800,allocatedSeconds:1800,status:'finished'});
  store.state.sales.push({id:'v1',memberId:ana.id,cents:1400,minutes:120,label:'120 minutos',actor:'recepcao',at:base+13*H,status:'paid',paymentMethod:'cash'});
  store.state.sales.push({id:'v2',memberId:bia.id,cents:350,minutes:30,label:'Promo',promotionId:'p1',actor:'admin',at:base+13*H,status:'paid',paymentMethod:'pix'});
  store.state.sales.push({id:'v3',memberId:bia.id,cents:0,minutes:15,label:'Cortesia',promotionId:'p2',actor:'admin',at:base+13*H,status:'paid',paymentMethod:'cash'});
  stats.freeGrant(store,ana,60,'Prêmio automático do programa fidelidade',base+15*H);
  store.state.staffUsage.push({id:'u1',stationId:'1',stationName:'TV 1 • PS4',username:'admin',kind:'Administrador',startedAt:base+9*H,endedAt:base+9.5*H});
  const q={from:day,to:day};
  const m=stats.report(store,{...q,kind:'machines'}).data;assert.equal(m.most.name,'TV 1 • PS4');assert.equal(m.most.usedSeconds,7200);assert.equal(m.most.sessions,1);assert.equal(m.most.staffSeconds,1800);assert.equal(m.least.usedSeconds,1800);
  const h=stats.report(store,{...q,kind:'hours'}).data;assert.equal(h.byHour[14].seconds,5400);assert.equal(h.byHour[15].seconds,3600);assert.equal(h.byHour[14].sessions,2);assert.equal(h.peak.hour,14);assert.equal(h.byHour[14].avgMachines,1.5);assert.equal(h.byWeekday[4].seconds,9000);
  const f=stats.report(store,{...q,kind:'staff'}).data;assert.equal(f.rows[0].username,'admin');assert.equal(f.rows[0].seconds,1800);
  const c=stats.report(store,{...q,kind:'clients'}).data;assert.equal(c.rows[0].name,'ana');assert.equal(c.rows[0].spentCents,1400);assert.equal(c.rows[1].spentCents,350);assert.equal(c.rows[0].usedSeconds,7200);
  const g=stats.report(store,{...q,kind:'free'}).data;assert.equal(g.count,2);assert.equal(g.minutes,75);
  const d=stats.report(store,{...q,kind:'durations'}).data;assert.equal(d.count,2);assert.equal(d.avgSeconds,4500);assert.equal(d.buckets.find(b=>b.label==='1 a 2 h').count,0);assert.equal(d.buckets.find(b=>b.label==='2 a 4 h').count,1);
  const coca=store.state.products.find(p=>p.name==='Coca-cola');shop.sell(store,{items:[{kind:'product',id:coca.id,qty:2}],paymentMethod:'cash'},'recepcao');
  store.state.shopSales.at(-1).at=base+12*H;
  const v=stats.report(store,{...q,kind:'sales'}).data;assert.equal(v.totalCents,1400+350+1200);
  assert.equal(v.categories.find(x=>x.name==='Bebidas').profitCents,1200-700);assert.equal(v.employees.find(x=>x.name==='recepcao').revenueCents,2600);assert.equal(v.products.find(x=>x.name==='Coca-cola').qty,2);
  assert.throws(()=>stats.report(store,{kind:'x'}),/Relatório inválido/);assert.throws(()=>stats.report(store,{kind:'hours',from:'2026-09-10',to:'2026-09-01'}),/data inicial/);
  // fluxo de caixa projetado com contas a pagar
  stats.setBalance(store,{balanceCents:10000},'admin');
  const today=stats.localDate(Date.now(),'America/Manaus');
  const bill=stats.saveBill(store,{description:'Internet',cents:15000,dueDate:today,recurring:'monthly'},'admin');
  stats.saveBill(store,{description:'Aluguel',cents:50000,dueDate:today},'admin');
  let cf=stats.report(store,{kind:'cashflow'}).data;assert.equal(cf.horizons[0].billsCents,65000+15000*(cf.horizons[0].billsCount-2));assert.ok(cf.horizons[2].billsCount>=4);assert.equal(cf.balanceCents,10000);
  stats.payBill(store,{id:bill.id},'admin');assert.notEqual(store.state.bills.find(b=>b.id===bill.id).dueDate,today);assert.equal(store.state.expenses.at(-1).cents,15000);
  stats.removeBill(store,{id:store.state.bills.find(b=>b.description==='Aluguel').id},'admin');
  cf=stats.report(store,{kind:'cashflow'}).data;assert.equal(cf.bills.length,1);
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('3.0.31: uso das máquinas por funcionário é registrado pelo modo administrador do PC',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-staff-'));let store=new Store(dir);
 try{
  const map=stats.staffTracker(store);
  map.set('1',{username:'admin',lastSeen:Date.now()});
  const a=map.get('1');a.lastSeen=Date.now();map.set('1',a);
  assert.equal(store.state.staffUsage.length,1);
  map.delete('1');
  assert.ok(store.state.staffUsage[0].endedAt>=store.state.staffUsage[0].startedAt);
  map.set('2',{localMaintenance:true,username:'Manutenção / recepção',lastSeen:Date.now()});
  assert.equal(store.state.staffUsage.length,2);assert.equal(store.state.staffUsage[1].kind,'Manutenção local');
  store.close();store=new Store(dir);assert.ok(store.state.staffUsage[1].endedAt);
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});
