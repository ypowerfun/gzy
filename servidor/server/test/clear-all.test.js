'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store,passwordHash}=require('../store');const shop=require('../shop');const cash=require('../cash');const {clearAll}=require('../clear-all');
test('3.0.34: ClearAll apaga todos os registros e mantém estações, pareamentos e configurações',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-clear-'));let store=new Store(dir);
 try{
  store.state.operators.push({id:'o1',username:'dono',hash:passwordHash('Senha-123456'),role:'admin',owner:true,active:true});
  store.state.settings.hourCents=900;store.state.settings.timeZone='America/Sao_Paulo';
  const pc={id:'pc1',name:'PC 1',kind:'computer',active:true,pcTokenHash:'hash-do-token',pcDevice:'a'.repeat(32),loginLayout:{x:1}};
  store.state.stations.push(pc,{id:'old',name:'Removido',kind:'computer',removedAt:1});store.persist();
  fs.mkdirSync(path.join(dir,'pairing'));fs.writeFileSync(path.join(dir,'pairing','tv-1.json'),'{"token":"x"}');fs.writeFileSync(path.join(dir,'pc-server.pfx'),'cert');
  const m=store.memberSave({name:'Ana',username:'ana'},'dono');
  cash.open(store,{openingCents:100},'dono');store.credit(m.id,{minutes:60,paymentMethod:'cash'},'dono');
  const coca=store.state.products[0];shop.sell(store,{items:[{kind:'product',id:coca.id,qty:1}],paymentMethod:'pix'},'dono');
  store.change('dono','promocao','x',()=>store.state.promotions.push({id:'p',name:'P',minutes:60,cents:500,active:true}));
  store.start('1',m.id,'dono');
  assert(store.logs().length>3);store.close();
  const r=await clearAll(dir);
  assert.equal(r.before.clientes,1);assert.equal(r.before.contas,1);assert(fs.existsSync(r.backup));
  store=new Store(dir);const s=store.state;
  for(const k of ['operators','members','sessions','sales','promotions','products','services','shopSales','cashRegisters','stockMoves','expenses','bills','loyaltyLedger','freeGrants','staffUsage','balanceAdjustments'])assert.equal((s[k]||[]).length,0,k);
  assert.equal(s.settings.hourCents,900);assert.equal(s.settings.timeZone,require('../netinfo').timeZone()||'America/Sao_Paulo'); // 1.0.5: fuso automático (o do Windows) quando detectável
  const kept=s.stations.find(x=>x.id==='pc1');assert.equal(kept.pcTokenHash,'hash-do-token');assert.equal(kept.pcDevice,'a'.repeat(32));assert.deepEqual(kept.loginLayout,{x:1});
  assert(s.stations.some(x=>x.id==='1'));assert(!s.stations.some(x=>x.id==='old'));
  assert(fs.existsSync(path.join(dir,'pairing','tv-1.json')));assert(fs.existsSync(path.join(dir,'pc-server.pfx')));
  const logs=store.logs().filter(l=>!/Fuso horário ajustado/.test(l.detail));assert.equal(logs.length,1);assert.match(logs[0].detail,/ClearAll/);
  assert.equal(s.runtime.cleanShutdown,true);assert.equal(cash.current(store),null);
  // numeracao recomeca
  const m2=store.memberSave({name:'Bia',username:'bia'},'novo');const sale=store.credit(m2.id,{minutes:30,paymentMethod:'cash'},'novo');assert.equal(sale.invoiceNumber,1);
  // backup anterior continua legivel com os dados antigos
  const {DatabaseSync}=require('node:sqlite');const old=new DatabaseSync(r.backup);assert.equal(JSON.parse(old.prepare('SELECT data FROM state').get().data).members.length,1);old.close();
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});
