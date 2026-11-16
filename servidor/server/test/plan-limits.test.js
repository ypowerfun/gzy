'use strict';
// 1.4.7 (pedido do dono): plano Free para sempre (sem conta) — até 10 PCs, 2 consoles, 10 produtos, 5 serviços, 5 categorias.
// Standard/Pro sem limite. Plano que venceu: o que já passou do limite continua funcionando, mas não dá para alterar.
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createServer} = require('../server'), planHelper = require('./plan-helper');

test('1.4.7: plano Free — limites ao cadastrar; Standard sem limite; plano vencido mantém tudo funcionando sem alterar', async t => {
  const {license, plan} = planHelper();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-limits-')), app = createServer({directory, noTimer: true, license});
  await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + app.server.address().port; let cookie = '';
  t.after(async () => { await app.close(); fs.rmSync(directory, {recursive: true, force: true, maxRetries: 5}); });
  async function call(url, body, status = 200) { const r = await fetch(base + '/api' + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)}); const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; return text ? JSON.parse(text) : null; }
  await call('/setup', {name: 'Dono', username: 'admin', password: 'senha123'}); await call('/login', {username: 'admin', password: 'senha123'});
  const S = app.store.state;
  let st = await call('/state'); assert.equal(st.limits.free, true); assert.deepEqual(st.limits.limits, {computer: 10, tv: 2, products: 10, services: 5, categories: 5});
  assert.equal((await call('/license')).mode, 'free');
  // estações: o exemplo de teste já conta (1 PC e 1 console)
  for (let i = 2; i <= 10; i++) await call('/stations', {name: 'PC ' + i, kind: 'computer'});
  assert.match((await call('/stations', {name: 'PC 11', kind: 'computer'}, 400)).error, /Plano Free: até 10 PCs/);
  await call('/stations', {name: 'Console 2', kind: 'tv', ip: '192.168.0.50'});
  assert.match((await call('/stations', {name: 'Console 3', kind: 'tv', ip: '192.168.0.51'}, 400)).error, /até 2 consoles/);
  // editar dentro do limite pode; trocar o tipo para um tipo cheio não
  const pc2 = S.stations.find(s => s.name === 'PC 2'); await call('/stations', {id: pc2.id, name: 'PC 2 (sala)', kind: 'computer'});
  assert.match((await call('/stations', {id: pc2.id, name: 'PC 2', kind: 'tv', ip: '192.168.0.60'}, 400)).error, /consoles/);
  // desativar libera uma vaga; reativar com tudo cheio não
  await call('/stations', {id: pc2.id, name: 'PC 2', kind: 'computer', active: false}); await call('/stations', {name: 'PC 11', kind: 'computer'});
  assert.match((await call('/stations', {id: pc2.id, name: 'PC 2', kind: 'computer'}, 400)).error, /até 10 PCs/);
  // autorizar PC novo (sem estação) também respeita o limite
  assert.match((await call('/pc/approve', {device: 'x'}, 400)).error, /até 10 PCs/);
  // produtos/serviços/categorias (3 produtos, 3 serviços e 4 categorias de exemplo)
  for (let i = 4; i <= 10; i++) await call('/shop/product', {name: 'Produto ' + i, category: 'Bebidas', costCents: 100, priceCents: 300, stock: 5});
  assert.match((await call('/shop/product', {name: 'Produto 11', category: 'Bebidas', costCents: 100, priceCents: 300, stock: 5}, 400)).error, /até 10 produtos/);
  for (let i = 4; i <= 5; i++) await call('/shop/service', {name: 'Serviço ' + i, priceCents: 200});
  assert.match((await call('/shop/service', {name: 'Serviço 6', priceCents: 200}, 400)).error, /até 5 serviços/);
  await call('/shop/category', {name: 'Doces'}); assert.match((await call('/shop/category', {name: 'Salgados'}, 400)).error, /até 5 categorias/);
  await call('/shop/category', {old: 'Doces', name: 'Doces e balas'});
  const p4 = S.products.find(p => p.name === 'Produto 4'); await call('/shop/product', {id: p4.id, name: 'Produto 4', category: 'Bebidas', costCents: 100, priceCents: 350, stock: 5});
  // importação: criar além do limite é recusado sem gravar nada
  const imp = await call('/shop/products/import', {rows: [{name: 'Novo A', category: 'Bebidas', costCents: 100, priceCents: 300}]}, 400); assert.match(imp.error, /até 10 produtos/);
  assert.equal(S.products.filter(p => p.active).length, 10);
  st = await call('/state'); assert.deepEqual(st.limits.used, {computer: 10, tv: 2, products: 10, services: 5, categories: 5}); assert.deepEqual(st.limits.over, []);

  // Standard: sem limites, NFC-e/NFS-e, visual e impressão
  plan(app, 'standard'); st = await call('/state'); assert.equal(st.limits.free, false); assert.equal(st.features.fiscal, true); assert.equal(st.features.layout, true); assert.equal(st.features.print, true); assert.ok(!st.features.nfe && !st.features.app && !st.features.units);
  for (let i = 12; i <= 14; i++) await call('/stations', {name: 'PC ' + i, kind: 'computer'});
  await call('/stations', {name: 'Console 3', kind: 'tv', ip: '192.168.0.51'});
  await call('/shop/product', {name: 'Produto 11', category: 'Bebidas', costCents: 100, priceCents: 300, stock: 5});
  await call('/shop/service', {name: 'Serviço 6', priceCents: 200}); await call('/shop/category', {name: 'Salgados'});
  await call('/cash/open', {openingCents: 0});
  const m = await call('/members', {name: 'Ana', username: 'ana', password: 'Senha-1234'});

  // plano venceu: volta ao Free. Tudo o que já existe continua funcionando (sessão no PC 14, venda do produto 11)...
  plan(app, null); st = await call('/state'); assert.equal(st.limits.free, true); assert.deepEqual(st.limits.over.sort(), ['categories', 'computer', 'products', 'services', 'tv']);
  const pc14 = S.stations.find(s => s.name === 'PC 14'), con3 = S.stations.find(s => s.name === 'Console 3'), p11 = S.products.find(p => p.name === 'Produto 11');
  await call('/credit', {memberId: m.id ?? S.members.find(x => x.username === 'ana').id, minutes: 60, paymentMethod: 'cash'});
  app.store.start(con3.id, S.members.find(x => x.username === 'ana').id, 'teste'); assert.ok(app.store.activeForStation(con3.id), 'console acima do limite inicia sessão');
  app.store.finish(con3.id, 'teste');
  await call('/shop/sale', {items: [{kind: 'product', id: p11.id, qty: 1}], paymentMethod: 'cash'});
  // ...mas não dá para alterar a configuração do que passou do limite
  assert.match((await call('/stations', {id: pc14.id, name: 'PC 14 novo', kind: 'computer'}, 400)).error, /você tem 13 PCs \(o limite é 10\).*continuam funcionando/);
  assert.match((await call('/stations', {name: 'PC 15', kind: 'computer'}, 400)).error, /até 10 PCs/);
  assert.match((await call('/shop/product', {id: p11.id, name: 'Produto 11', category: 'Bebidas', costCents: 100, priceCents: 999, stock: 5}, 400)).error, /você tem 11 produtos/);
  assert.match((await call('/shop/service', {id: S.services.find(x => x.name === 'Serviço 6').id, name: 'Serviço 6', priceCents: 900}, 400)).error, /você tem 6 serviços/);
  assert.match((await call('/shop/category', {old: 'Salgados', name: 'Salgadinhos'}, 400)).error, /você tem 6 categorias/);
  assert.match((await call('/branding', {color: '#2f8cff'}, 400)).error, /Standard e Pro/);
  assert.match((await call('/fiscal', undefined, 400)).error, /Standard e Pro/);
  // remover/desativar sempre pode; voltando ao limite, alterar volta a funcionar
  await call('/shop/remove', {kind: 'product', id: p11.id});
  await call('/shop/product', {id: p4.id, name: 'Produto 4', category: 'Bebidas', costCents: 100, priceCents: 400, stock: 5});
  await call('/stations', {id: pc14.id, name: 'PC 14', kind: 'computer', active: false});
  // assinando de novo e entrando com a conta, tudo volta a poder ser alterado
  plan(app, 'pro'); await call('/stations', {id: pc14.id, name: 'PC 14', kind: 'computer'}); await call('/shop/category', {old: 'Salgados', name: 'Salgadinhos'});
});
