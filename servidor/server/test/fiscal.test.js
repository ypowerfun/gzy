'use strict';
// 1.3.0 (Pro): notas fiscais de saída pela Focus NFe — NFC-e (produtos do PDV) e NFS-e (recargas e serviços).
// Roda contra um simulador HTTP da API v2 (test/focus-mock.js) que cobra os campos obrigatórios da documentação oficial.
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path');
const {createServer} = require('../server'), focusMock = require('./focus-mock'), planHelper = require('./plan-helper');
const CNPJ = '11222333000181', TOKEN = 'tokenHomologacao123';

async function boot(t, extra = {}) {
  let offset = 0; const clock = () => Date.now() + offset;
  const mock = await focusMock({token: TOKEN, now: clock});
  const {license, plan} = planHelper();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-fiscal-'));
  const app = createServer({directory, noTimer: true, license, fiscalBase: mock.base, fiscalNow: clock, ...extra});
  app.store.state.settings.timeZone = 'America/Sao_Paulo';
  await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + app.server.address().port; let cookie = '';
  t.after(async () => { await app.close(); await mock.close(); fs.rmSync(directory, {recursive: true, force: true, maxRetries: 5}); });
  const call = async (url, body, status = 200) => { const r = await fetch(base + '/api' + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)}); const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; return text ? JSON.parse(text) : null; };
  await call('/setup', {name: 'Dono', username: 'admin', password: 'senha123'}); await call('/login', {username: 'admin', password: 'senha123'});
  const tick = async (ms = 0) => { offset += ms; await app.fiscal.tick(); };
  return {app, mock, call, plan: p => plan(app, p), tick, advance: ms => { offset += ms; }, now: clock};
}
const docs = async (call, q = '') => (await call('/fiscal' + q)).docs;
const baseCfg = {enabled: true, env: 'homologacao', cnpj: CNPJ, razao: 'Arena Teste LTDA', ie: '123456789', im: '98765', municipio: '3550308', uf: 'SP', regime: 'simples', token: TOKEN,
  nfce: {enabled: true, auto: true, cfop: '5102', cst: '102', origem: '0', ncm: ''}, nfse: {enabled: true, auto: true, mode: 'municipal', itemLista: '1.07', aliquota: '2', services: true}};

test('1.3.0: notas fiscais só no Pro; configuração valida e o token nunca volta ao painel', async t => {
  const s = await boot(t);
  assert.match((await s.call('/fiscal', undefined, 400)).error, /plano Pro/);                       // teste grátis
  s.plan('standard'); assert.match((await s.call('/fiscal', undefined, 400)).error, /plano Pro/);   // Standard
  s.plan('pro'); const st = await s.call('/fiscal'); assert.equal(st.settings.enabled, false); assert.equal(st.settings.tokenSet, false);
  assert.match((await s.call('/fiscal/settings', {...baseCfg, cnpj: '11222333000100'}, 400)).error, /CNPJ/);
  assert.match((await s.call('/fiscal/settings', {...baseCfg, token: 'x y'}, 400)).error, /Token/);
  assert.match((await s.call('/fiscal/settings', {...baseCfg, nfse: {...baseCfg.nfse, itemLista: ''}}, 400)).error, /lista de serviços/);
  assert.match((await s.call('/fiscal/settings', {...baseCfg, nfse: {...baseCfg.nfse, mode: 'nacional', codTribNac: '010701'}}, 400)).error, /IBS\/CBS/);
  const saved = await s.call('/fiscal/settings', baseCfg); assert.equal(saved.tokenSet, true); assert.equal(saved.enabled, true);
  // token só no servidor: nem na resposta, nem no estado do painel
  for (const body of [JSON.stringify(saved), JSON.stringify(await s.call('/fiscal')), JSON.stringify(await s.call('/state'))]) assert.ok(!body.includes(TOKEN), 'token exposto');
  assert.equal(s.app.store.state.secrets.focusToken, TOKEN);
  // testar conexão: token certo (404 da consulta = conectado) e token errado (401)
  assert.match((await s.call('/fiscal/test', {})).message, /funcionando/);
  assert.match(s.mock.log.at(-1).auth, /^Basic /);
  s.app.store.state.secrets.focusToken = 'outroTokenErrado1'; assert.match((await s.call('/fiscal/test', {}, 400)).error, /recusou o token/);
  s.app.store.state.secrets.focusToken = TOKEN;
  // plano venceu (volta ao teste): para de emitir, mas ainda dá para desligar
  s.plan(null); assert.match((await s.call('/fiscal', undefined, 400)).error, /plano Pro/);
  assert.equal((await s.call('/fiscal/settings', {enabled: false})).enabled, false);
});

test('1.3.0: NFC-e dos produtos e NFS-e dos serviços do PDV, NFS-e da recarga; erros da Sefaz, reenvio, cancelamento e Log', async t => {
  const s = await boot(t); s.plan('pro');
  await s.call('/cash/open', {openingCents: 0});
  // venda ANTES de ligar as notas não entra na fila
  const cat = await s.call('/shop'), coca = cat.products.find(p => p.name === 'Coca-cola'), xerox = cat.services.find(p => p.name === 'Xerox');
  await s.call('/shop/sale', {items: [{kind: 'product', id: coca.id, qty: 1}], paymentMethod: 'cash'});
  await s.call('/fiscal/settings', baseCfg); s.advance(1000);
  // produto sem NCM e sem NCM padrão: erro claro, sem chamar a Focus
  const sale = await s.call('/shop/sale', {items: [{kind: 'product', id: coca.id, qty: 2}, {kind: 'service', id: xerox.id, qty: 3}], payments: [{method: 'cash', cents: 600}, {method: 'pix', cents: 750}]});
  await s.tick();
  let list = await docs(s.call); assert.equal(list.length, 2, 'só a venda feita depois de ligar');
  let nfce = list.find(d => d.kind === 'nfce'), nfse = list.find(d => d.kind === 'nfse');
  assert.equal(nfce.status, 'erro'); assert.match(nfce.message, /sem NCM/); assert.equal(s.mock.log.filter(r => r.path === '/v2/nfce').length, 0);
  // NFS-e do serviço do PDV: processando → autorizada
  assert.equal(nfse.status, 'processando'); assert.equal(nfse.cents, 150);
  const nfseReq = s.mock.log.find(r => r.path === '/v2/nfse'); assert.equal(nfseReq.body.servico.valor_servicos, 1.5); assert.equal(nfseReq.body.servico.item_lista_servico, '1.07'); assert.equal(nfseReq.body.prestador.cnpj, CNPJ); assert.equal(nfseReq.body.tomador, undefined); assert.match(nfseReq.body.servico.discriminacao, /3x Xerox/);
  await s.tick(11000); await s.tick(11000);
  nfse = (await docs(s.call)).find(d => d.kind === 'nfse'); assert.equal(nfse.status, 'autorizado'); assert.ok(nfse.numero); assert.match(nfse.links.url, /^https:/); assert.match(nfse.links.xml, new RegExp('^' + s.mock.base + '/arquivos/'));
  // corrige o NCM no produto e reenvia (nova referência)
  await s.call('/shop/product', {...coca, fiscal: {ncm: '22021000', cfop: '5405', cst: '500'}});
  await s.call('/fiscal/retry', {id: nfce.id}); await s.tick();
  nfce = (await docs(s.call)).find(d => d.kind === 'nfce'); assert.equal(nfce.status, 'autorizado', nfce.message); assert.match(nfce.ref, /-r1$/);
  const req = s.mock.log.filter(r => r.path === '/v2/nfce').at(-1).body;
  assert.equal(req.cnpj_emitente, CNPJ); assert.equal(req.items.length, 1); assert.equal(req.items[0].codigo_ncm, '22021000'); assert.equal(req.items[0].cfop, '5405'); assert.equal(req.items[0].icms_situacao_tributaria, '500'); assert.equal(req.items[0].valor_bruto, 12);
  assert.match(req.data_emissao, /-03:00$/, 'hora com o fuso do servidor');
  // pagamento combinado: só a parte dos produtos (R$ 12,00) dividida entre dinheiro e PIX
  assert.deepEqual(req.formas_pagamento.map(p => p.forma_pagamento), ['01', '17']); assert.equal(req.formas_pagamento.reduce((a, p) => a + p.valor_pagamento, 0), 12);
  assert.match(nfce.links.danfe, new RegExp('^' + s.mock.base)); assert.match(nfce.links.qrcode, /^https:/); assert.equal(nfce.chave.length, 47);
  // a tela do cupom acha as notas da venda
  assert.equal((await s.call('/fiscal/sale?source=shop&id=' + sale.id)).docs.length, 2);
  // rejeição da Sefaz (NCM inexistente) aparece com a mensagem da Sefaz
  const fanta = cat.products.find(p => p.name === 'Fanta'); await s.call('/shop/product', {...fanta, fiscal: {ncm: '99999999'}});
  await s.call('/shop/sale', {items: [{kind: 'product', id: fanta.id, qty: 1}], paymentMethod: 'card'}); await s.tick();
  const rej = (await docs(s.call)).find(d => d.kind === 'nfce' && d.status === 'erro'); assert.match(rej.message, /NCM inexistente/);
  // recarga de cliente com CPF: NFS-e com tomador; visitante sem CPF: sem tomador
  const ana = await s.call('/members', {name: 'Ana Souza', username: 'ana', cpf: '529.982.247-25', email: 'ana@exemplo.com'});
  await s.call('/credit', {memberId: ana.id, minutes: 60, paymentMethod: 'debit'}); await s.tick();
  const rec = s.mock.log.filter(r => r.path === '/v2/nfse').at(-1).body; assert.deepEqual(rec.tomador, {cpf: '52998224725', razao_social: 'Ana Souza', email: 'ana@exemplo.com'}); assert.equal(rec.servico.valor_servicos, 7);
  await s.tick(11000); await s.tick(11000);
  assert.ok((await docs(s.call)).some(d => d.source === 'recharge' && d.status === 'autorizado'));
  // cancelamento: senha, motivo e prazo de 30 min da NFC-e
  assert.match((await s.call('/fiscal/cancel', {id: nfce.id, reason: 'Venda desfeita pelo cliente', authPassword: 'errada'}, 400)).error, /Senha/);
  assert.match((await s.call('/fiscal/cancel', {id: nfce.id, reason: 'curto', authPassword: 'senha123'}, 400)).error, /15 a 255/);
  const can = await s.call('/fiscal/cancel', {id: nfce.id, reason: 'Venda desfeita pelo cliente no balcão', authPassword: 'senha123'}); assert.equal(can.status, 'cancelado'); assert.match(can.links.xmlCancel, /-can\.xml$/);
  assert.equal(s.mock.docs.get('nfce:' + nfce.ref).status, 'cancelado');
  const nfseRec = (await docs(s.call)).find(d => d.source === 'recharge'); s.advance(40 * 60000);
  assert.equal((await s.call('/fiscal/cancel', {id: nfseRec.id, reason: 'Recarga lançada em duplicidade', authPassword: 'senha123'})).status, 'cancelado', 'NFS-e: sem prazo de 30 min');
  // tudo registrado no Log
  const logs = await s.call('/logs?type=fiscal'), text = logs.map(l => l.detail).join('\n');
  for (const re of [/NFC-e autorizada nº \d+ \(cupom/, /NFS-e autorizada/, /NFC-e recusada .*NCM inexistente/, /NFC-e cancelada .*Venda desfeita/, /Notas fiscais: ligadas/]) assert.match(text, re);
});

test('1.3.0: sem internet a venda não trava; a nota fica pendente e sai sozinha sem duplicar', async t => {
  const s = await boot(t); s.plan('pro'); await s.call('/cash/open', {openingCents: 0});
  await s.call('/fiscal/settings', {...baseCfg, nfce: {...baseCfg.nfce, ncm: '22021000'}, nfse: {...baseCfg.nfse, enabled: false}});
  const coca = (await s.call('/shop')).products.find(p => p.name === 'Coca-cola');
  s.mock.st.down = true;
  const t0 = Date.now(); await s.call('/shop/sale', {items: [{kind: 'product', id: coca.id, qty: 1}], paymentMethod: 'pix'}); assert.ok(Date.now() - t0 < 1500, 'a venda responde na hora');
  await s.tick(); let d = (await docs(s.call))[0]; assert.equal(d.status, 'pendente'); assert.match(d.message, /internet/);
  await s.tick(); assert.equal((await docs(s.call))[0].tries, 1, 'espera antes de tentar de novo');
  // volta a internet, mas a resposta do envio se perde: na próxima vez consulta antes e não manda duas vezes
  s.mock.st.down = false; s.mock.st.dropAfterProcess = true; await s.tick(20000);
  d = (await docs(s.call))[0]; assert.equal(d.status, 'pendente');
  await s.tick(40000); d = (await docs(s.call))[0];
  assert.equal(d.status, 'autorizado'); assert.equal(s.mock.log.filter(r => r.method === 'POST' && r.path === '/v2/nfce').length, 1, 'um único envio chegou à Focus');
  assert.equal([...s.mock.docs.keys()].filter(k => k.startsWith('nfce:')).length, 1, 'uma única nota na Focus');
  assert.equal(s.mock.log.filter(r => r.method === 'GET' && r.path.startsWith('/v2/nfce/')).length, 2, 'consultou antes de reenviar (2 vezes)');
  // Focus fora do ar (503): continua pendente
  s.mock.st.fail503 = true; await s.call('/shop/sale', {items: [{kind: 'product', id: coca.id, qty: 1}], paymentMethod: 'cash'}); await s.tick(60000);
  assert.ok((await docs(s.call)).some(x => x.status === 'pendente' && /indisponível/.test(x.message)));
  s.mock.st.fail503 = false; await s.tick(60000); assert.ok((await docs(s.call)).every(x => x.status === 'autorizado'));
  // venda cancelada antes da nota sair: a nota é descartada (não emite)
  s.mock.st.down = true; const v = await s.call('/shop/sale', {items: [{kind: 'product', id: coca.id, qty: 1}], paymentMethod: 'cash'}); await s.tick(60000);
  await s.call('/shop/cancel', {id: v.id, reason: 'Cliente desistiu'}); s.mock.st.down = false; await s.tick(600000);
  assert.equal((await docs(s.call)).find(x => x.sourceId === v.id).status, 'descartada');
  // as notas continuam guardadas depois de reabrir
  const {Store} = require('../store'); assert.ok(s.app.store.state.fiscalDocs.length >= 3);
  assert.equal(typeof Store, 'function');
});

test('1.3.0: NFS-e Nacional (DPS) com numeração própria e campos da reforma tributária', async t => {
  const s = await boot(t); s.plan('pro'); await s.call('/cash/open', {openingCents: 0});
  await s.call('/fiscal/settings', {...baseCfg, regime: 'mei', nfce: {...baseCfg.nfce, enabled: false}, nfse: {enabled: true, auto: true, mode: 'nacional', codTribNac: '010701', ibsCbsCst: '000', ibsCbsClass: '000001', nbs: '115022000', serieDps: 3, nextDps: 41}});
  const bia = await s.call('/members', {name: 'Bia', username: 'bia'});
  await s.call('/credit', {memberId: bia.id, minutes: 60, paymentMethod: 'pix'}); await s.call('/credit', {memberId: bia.id, minutes: 30, paymentMethod: 'cash'});
  await s.tick();
  const reqs = s.mock.log.filter(r => r.path === '/v2/nfsen'); assert.equal(reqs.length, 2);
  assert.deepEqual(reqs.map(r => r.body.numero_dps), [41, 42]); assert.equal(reqs[0].body.serie_dps, 3);
  const b = reqs[0].body; assert.equal(b.codigo_opcao_simples_nacional, '2'); assert.equal(b.cnpj_prestador, CNPJ); assert.equal(b.codigo_tributacao_nacional_iss, '010701'); assert.equal(b.ibs_cbs_classificacao_tributaria, '000001'); assert.equal(b.codigo_nbs, '115022000'); assert.equal(b.data_competencia, b.data_emissao.slice(0, 10)); assert.equal(b.cpf_tomador, undefined);
  assert.equal(s.app.store.state.settings.fiscal.nfse.nextDps, 43);
  await s.tick(11000); await s.tick(11000);
  const list = await docs(s.call); assert.ok(list.every(d => d.status === 'autorizado' && /danfse/.test(d.links.danfse)), JSON.stringify(list.map(d => d.message)));
  // cancelamento no endereço nacional
  assert.equal((await s.call('/fiscal/cancel', {id: list[0].id, reason: 'Recarga lançada errada no balcão', authPassword: 'senha123'})).status, 'cancelado');
  assert.ok(s.mock.log.some(r => r.method === 'DELETE' && r.path.startsWith('/v2/nfsen/')));
});

test('1.3.0: importação de produtos aceita NCM, CFOP e CST/CSOSN (dados do contador)', () => {
  const fs2 = require('fs'), os2 = require('os'), path2 = require('path'), {Store} = require('../store'), shop = require('../shop'), imp = require('../products-import');
  const dir = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'gz-imp-fis-')), store = new Store(dir);
  try {
    shop.init(store);
    const csv = 'Código;Nome;Categoria;Custo;Preço de venda;NCM;CFOP;CSOSN\n;Água 500ml;Bebidas;1,00;3,00;2201.10.00;5102;102\n;Suco;Bebidas;2,00;5,00;123;5102;102\n';
    const parsed = imp.parse('produtos.csv', Buffer.from(csv).toString('base64'));
    assert.equal(parsed.rows[0].ncm, '22011000'); assert.equal(parsed.rows[0].cst, '102');
    const checked = imp.validate(store, parsed.rows); assert.equal(checked[1].error, 'NCM inválido (8 dígitos).');
    imp.importProducts(store, parsed.rows.slice(0, 1), 'admin');
    assert.deepEqual(store.state.products.find(p => p.name === 'Água 500ml').fiscal, {ncm: '22011000', cfop: '5102', cst: '102'});
    // cadastro manual: NCM inválido recusado; vazio = usa o padrão
    const agua = store.state.products.find(p => p.name === 'Água 500ml');
    assert.throws(() => shop.saveProduct(store, {...agua, fiscal: {ncm: '12'}}, 'admin'), /NCM do produto/);
    shop.saveProduct(store, {...agua, fiscal: {ncm: '', cfop: '', cst: ''}}, 'admin'); assert.equal(agua.fiscal, undefined);
  } finally { store.close(); fs2.rmSync(dir, {recursive: true, force: true, maxRetries: 5}); }
});
