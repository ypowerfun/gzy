'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store');const shop=require('../shop');const business=require('../business');
test('3.0.23: produtos/serviços, venda com baixa de estoque, cupom PDF e cancelamento sem receita',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-shop-'));let store=new Store(dir);
 try{
  const c=shop.catalog(store,true);assert.deepEqual(c.products.map(p=>p.name),['Coca-cola','Fanta','Biscoito']);assert.deepEqual(c.services.map(s=>s.name),['Xerox','Impressão','Trabalhos Escolares']);
  assert.equal(shop.catalog(store,false).products[0].costCents,undefined);
  const pin=shop.saveProduct(store,{name:'Pin 100',category:'Produtos Virtuais (Pins e Créditos)',costCents:800,priceCents:1000,barcode:'789123',stock:5},'admin');
  assert.throws(()=>shop.saveProduct(store,{name:'Outro',category:'Bebidas',costCents:1,priceCents:2,barcode:'789123',stock:1},'admin'),/código de barras/);
  const coke=c.products[0],xerox=c.services[0];
  assert.throws(()=>shop.sell(store,{items:[{kind:'product',id:pin.id,qty:6}],paymentMethod:'pix'},'op'),/Estoque insuficiente/);
  assert.throws(()=>shop.sell(store,{items:[{kind:'product',id:pin.id,qty:1}]},'op'),/forma de pagamento/);
  const sale=shop.sell(store,{items:[{kind:'product',id:coke.id,qty:2},{kind:'service',id:xerox.id,qty:10},{kind:'product',id:pin.id,qty:1}],paymentMethod:'card'},'op');
  assert.equal(sale.totalCents,2*600+10*50+1000);assert.equal(store.state.products.find(p=>p.id===coke.id).stock,22);
  let r=business.report(store,{period:'day'});assert.equal(r.shopRevenue,sale.totalCents);assert.equal(r.revenue,sale.totalCents);assert.equal(r.transactions,1);
  const pdf=shop.receiptPdf(store,sale.id).pdf;assert.equal(pdf.slice(0,5).toString(),'%PDF-');assert(pdf.toString('latin1').includes('%%EOF'));
  shop.cancelSale(store,{id:sale.id,reason:'Cliente desistiu'},'admin');
  r=business.report(store,{period:'day'});assert.equal(r.revenue,0);assert.equal(r.canceled,1);assert.equal(store.state.products.find(p=>p.id===coke.id).stock,24);assert.equal(store.state.products.find(p=>p.id===pin.id).stock,5);
  assert.throws(()=>shop.cancelSale(store,{id:sale.id,reason:'x'},'admin'),/já foi cancelada/);
  assert(business.csv(r).includes('Venda produtos/serviços'));
  shop.removeItem(store,{kind:'product',id:pin.id},'admin');assert(!shop.catalog(store,true).products.some(p=>p.id===pin.id));
  store.close();store=new Store(dir);assert.equal(store.state.shopSales.length,1);assert.equal(store.state.products.filter(p=>p.active).length,3);
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});
test('3.0.64: margem de lucro calcula o preço de venda e arredonda para cima no real inteiro',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-shop-margem-'));let store=new Store(dir);
 try{
  // 3,50 + 50% = 5,25 → 6,00 (o preço enviado pela tela é ignorado: vale a conta do servidor)
  const a=shop.saveProduct(store,{name:'Energético',category:'Bebidas',costCents:350,marginPercent:'50',priceCents:1,stock:3},'admin');
  assert.equal(a.priceCents,600);assert.equal(a.marginPercent,50);
  // 3,00 + 43,33% = 4,2999 → 5,00 ; 10,00 + 10% = 11,00 exato (não sobe para 12)
  assert.equal(shop.saveProduct(store,{name:'Chiclete',category:'Snacks / Alimentos',costCents:300,marginPercent:'43,33',stock:1},'admin').priceCents,500);
  assert.equal(shop.saveProduct(store,{name:'Fone',category:'Acessórios e Periféricos',costCents:1000,marginPercent:10,stock:1},'admin').priceCents,1100);
  // sem margem: preço digitado, como antes
  const b=shop.saveProduct(store,{name:'Água',category:'Bebidas',costCents:150,marginPercent:'',priceCents:350,stock:1},'admin');
  assert.equal(b.priceCents,350);assert.equal(b.marginPercent,null);
  // editar mudando o custo recalcula com a margem guardada enviada pela tela
  assert.equal(shop.saveProduct(store,{id:a.id,name:'Energético',category:'Bebidas',costCents:420,marginPercent:50,stock:3},'admin').priceCents,700);
  for(const bad of ['-1','1001','abc'])assert.throws(()=>shop.saveProduct(store,{name:'X'+bad,category:'Bebidas',costCents:100,marginPercent:bad,stock:1},'admin'),/Margem de lucro/);
  assert.throws(()=>shop.saveProduct(store,{name:'Grátis',category:'Bebidas',costCents:0,marginPercent:50,stock:1},'admin'),/custo maior que zero/);
  // a margem não aparece para operador (assim como o custo)
  const op=shop.catalog(store,false).products.find(p=>p.name==='Energético');
  assert.equal(op.marginPercent,undefined);assert.equal(op.costCents,undefined);
  assert.equal(shop.catalog(store,true).products.find(p=>p.name==='Energético').marginPercent,50);
 }finally{store.close?.();fs.rmSync(dir,{recursive:true,force:true})}
});
