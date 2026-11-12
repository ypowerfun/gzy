'use strict';
// 1.3.2: nome da Arena/Organização (todos os planos) no cupom, no caixa, no relatório e nos arquivos exportados; em branco = GameZoney
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {Store}=require('../store'),shop=require('../shop'),cash=require('../cash'),business=require('../business'),org=require('../organization');
test('1.3.2: nome da arena/organização — padrão GameZoney, salvar, limpar e usar no cupom, no caixa e no relatório',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-org-')),store=new Store(dir);t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:5})});
 assert.equal(org.name(store),'GameZoney');assert.equal(org.fileTag(store),'gamezoney');
 assert.throws(()=>org.save(store,{name:'x'.repeat(61)},'admin'),/no máximo 60/);
 org.save(store,{name:'  Arena  São João <b>\n'},'admin');assert.equal(store.state.settings.organization,'Arena São João b');
 assert.equal(org.name(store),'Arena São João b');assert.equal(org.fileTag(store),'Arena-Sao-Joao-b');
 assert.match(store.logs({}).rows?.[0]?.detail||JSON.stringify(store.logs({})),/Nome da arena\/organização: Arena São João b/);
 cash.open(store,{openingCents:1000},'admin');
 const coke=shop.catalog(store,true).products[0],sale=shop.sell(store,{items:[{kind:'product',id:coke.id,qty:1}],paymentMethod:'pix'},'admin');
 const pdf=shop.receiptPdf(store,sale.id).pdf.toString('latin1');assert.match(pdf,/Td\n\(\s*Arena S[^)]*\) Tj/,'cupom começa com o nome da arena');
 const reg=store.state.cashRegisters.at(-1);assert.ok(cash.reportPdf(store,reg.id).pdf.toString('latin1').includes('Arena S'),'fechamento de caixa');
 const csv=business.csv(business.report(store,{period:'day'}),org.name(store));assert.match(csv,/"Arena\/Organização";"Arena São João b"/);
 org.save(store,{name:''},'admin');assert.equal(org.name(store),'GameZoney');assert.match(shop.receiptPdf(store,sale.id).pdf.toString('latin1'),/Td\n\(\s*GameZoney\) Tj/);
});
