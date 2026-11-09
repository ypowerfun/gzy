'use strict';
// 1.1.0: autoatendimento no PC (criar conta e recarga PIX com liberação automática) e importação de produtos por planilha
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {Store} = require('../store'), selfService = require('../self-service'), P = require('../products-import'), cash = require('../cash');

test('1.1.0: criar conta no PC e recarregar com PIX — o tempo entra sozinho quando o Mercado Pago aprova', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-self-')), store = new Store(dir), calls = [];
  let mpStatus = 'pending', mpAmount = null;
  const fetch = async (url, init = {}) => {
    calls.push({url, init});
    if (init.method === 'POST') { const body = JSON.parse(init.body); mpAmount = body.transaction_amount; return {ok: true, status: 201, json: async () => ({id: 987, status: 'pending', point_of_interaction: {transaction_data: {qr_code: '000201PIXCOPIAECOLA', qr_code_base64: 'iVBORw0KGgo='}}})}; }
    return {ok: true, status: 200, json: async () => ({id: 987, status: mpStatus, transaction_amount: mpAmount, external_reference: calls.findLast(c => c.init.method === 'POST') && JSON.parse(calls.findLast(c => c.init.method === 'POST').init.body).external_reference})};
  };
  try {
    const ss = selfService(store, {fetch, noTimer: true}), pc = store.state.stations.find(s => s.kind === 'computer');
    assert.deepEqual(ss.flags(), {signup: false, pix: false});
    assert.throws(() => ss.signup(pc, {name: 'Ana', username: 'ana', password: '1234', repeatPassword: '1234'}), /desligado/);
    assert.throws(() => ss.save({pix: true}, 'admin'), /Access Token/);
    assert.throws(() => ss.save({pix: true, token: 'chave-qualquer'}, 'admin'), /inválido/);
    // 1.1.2: pacotes = promoções cadastradas que o admin marca
    const promo = (name, cents, minutes, active = true) => { const p = {id: 'pr-' + cents, name, cents, minutes, active}; store.state.promotions.push(p); return p; };
    const p5 = promo('1h30 por R$ 5', 500, 90), p10 = promo('3h por R$ 10', 1000, 180), p20 = promo('7h por R$ 20', 2000, 420), off = promo('Antiga', 300, 60, false);
    assert.throws(() => ss.save({signup: true, pix: true, token: 'APP_USR-1234567890123456-abcdef', promotionIds: []}, 'admin'), /pelo menos um pacote/);
    let conf = ss.save({signup: true, pix: true, token: 'APP_USR-1234567890123456-abcdef', promotionIds: [p5.id, p10.id, p20.id, off.id, 'inexistente']}, 'admin');
    assert.equal(conf.tokenSet, true); assert.equal(conf.token, undefined); assert.deepEqual(conf.promotionIds, [p5.id, p10.id, p20.id], 'inativa e inexistente ficam de fora');
    assert.equal(conf.promotionsList.length, 4);
    assert.doesNotMatch(JSON.stringify(store.snapshot()), /APP_USR/, 'o token não vai para o painel');
    assert.deepEqual(ss.flags(), {signup: true, pix: true});
    // cadastro no PC
    assert.throws(() => ss.signup(pc, {name: 'Ana', username: 'ana', password: '1234', repeatPassword: '9999'}), /não coincidem/);
    assert.equal(ss.signup(pc, {name: 'Ana', username: 'ana', password: '1234', repeatPassword: '1234', phone: '92999990000'}).username, 'ana');
    assert.throws(() => ss.signup(pc, {name: 'Outra', username: 'ANA', password: '1234', repeatPassword: '1234'}), /já existe/);
    // pacotes: valores e promoções
    const opts = ss.options(); assert.deepEqual(opts.map(o => o.cents), [500, 1000, 2000]); assert.deepEqual(opts.map(o => o.minutes), [90, 180, 420]); assert.equal(opts[1].label, '3h por R$ 10');
    assert.deepEqual(ss.save({signup: true, pix: true, promotionIds: [p10.id]}, 'admin').options.map(o => o.id), ['p:' + p10.id], 'só os marcados aparecem no PC');
    ss.save({signup: true, pix: true, promotionIds: [p5.id, p10.id, p20.id]}, 'admin');
    // PIX: senha errada, caixa fechado e depois aberto
    await assert.rejects(ss.create(pc, {username: 'ana', password: 'errada', option: 'p:' + p10.id}), /incorretos/);
    await assert.rejects(ss.create(pc, {username: 'ana', password: '1234', option: 'p:' + p10.id}), /caixa/i);
    cash.open(store, {openingCents: 0}, 'admin');
    const c = await ss.create(pc, {username: 'ana', password: '1234', option: 'p:' + p10.id});
    assert.equal(c.status, 'pending'); assert.equal(c.copy, '000201PIXCOPIAECOLA'); assert.equal(c.qr, 'iVBORw0KGgo='); assert.equal(mpAmount, 10);
    assert.match(calls[0].init.headers.Authorization, /^Bearer APP_USR/); assert.ok(calls[0].init.headers['X-Idempotency-Key']);
    // ainda não pago
    assert.equal((await ss.status(pc, {id: c.id})).status, 'pending');
    const ana = store.state.members.find(m => m.username === 'ana'); assert.equal(ana.creditSeconds, 0);
    // aprovado: o tempo entra uma vez só, como venda PIX no caixa
    mpStatus = 'approved'; await ss.check(store.state.pixCharges[0], true);
    assert.equal((await ss.status(pc, {id: c.id})).status, 'approved');
    await ss.check(store.state.pixCharges[0], true);
    assert.equal(ana.creditSeconds, (180 + (store.state.sales.at(-1).autoReward?.minutes || 0)) * 60, 'pacote + prêmio automático da Fidelidade, igual ao balcão');
    const sale = store.state.sales.at(-1); assert.equal(sale.paymentMethod, 'pix'); assert.equal(sale.cents, 1000); assert.equal(sale.actor, 'pix-automatico'); assert.ok(sale.cashId);
    // valor diferente do cobrado não libera
    const c2 = await ss.create(pc, {username: 'ana', password: '1234', option: 'p:' + p5.id}); mpAmount = 1; mpStatus = 'approved';
    await ss.check(store.state.pixCharges.find(x => x.id === c2.id), true); assert.equal(store.state.pixCharges.find(x => x.id === c2.id).credited, undefined);
    // 1.1.1: valor livre (Outro valor) com mínimo configurável
    await assert.rejects(ss.create(pc, {username: 'ana', password: '1234', option: 'custom', cents: 700}), /desligado/);
    assert.throws(() => ss.save({signup: true, pix: true, promotionIds: [p5.id], custom: true, customMin: '10', customMax: '5'}, 'admin'), /máximo/);
    conf = ss.save({signup: true, pix: true, promotionIds: [], custom: true, customMin: '5,00', customMax: '100'}, 'admin'); assert.equal(ss.options().length, 0, 'só o Outro valor');
    assert.equal(conf.customMinCents, 500); assert.equal(conf.customMaxCents, 10000); assert.equal(conf.tokenSet, true); assert.equal(ss.custom().min, 500);
    await assert.rejects(ss.create(pc, {username: 'ana', password: '1234', option: 'custom', cents: 499}), /mínimo.*5,00/);
    await assert.rejects(ss.create(pc, {username: 'ana', password: '1234', option: 'custom', cents: 10001}), /máximo/);
    for (const x of store.state.pixCharges) x.status = 'expired';
    mpStatus = 'pending';
    const c3 = await ss.create(pc, {username: 'ana', password: '1234', option: 'custom', cents: 1350}); assert.equal(c3.cents, 1350); assert.equal(mpAmount, 13.5);
    const before = ana.creditSeconds; mpStatus = 'approved'; await ss.check(store.state.pixCharges.find(x => x.id === c3.id), true);
    assert.equal(ana.creditSeconds - before, Math.round(1350 * 60 / store.state.settings.hourCents) * 60);
    // 1.1.4: OBS (nome da organização) e "+ Tempo" na sessão
    ss.save({signup: true, pix: true, promotionIds: [p10.id], payeeName: 'Arena Centro <b>', custom: true, customMin: '5', customMax: '100'}, 'admin');
    assert.equal(ss.payee(), 'Arena Centro b');
    await assert.rejects(ss.create(pc, {mode: 'session', option: 'p:' + p10.id}), /Nenhuma sessão/);
    for (const x of store.state.pixCharges) x.status = 'expired';
    store.start(pc.id, ana.id, 'admin');
    const t = await ss.create(pc, {mode: 'session', option: 'p:' + p10.id}); assert.equal(t.payee, 'Arena Centro b'); assert.equal(t.username, 'ana');
    const sess = store.activeForStation(pc.id), before2 = sess.allocatedSeconds; mpStatus = 'approved';
    await ss.check(store.state.pixCharges.find(x => x.id === t.id), true);
    assert.ok(store.activeForStation(pc.id).allocatedSeconds >= before2 + 180 * 60, '+ Tempo entra na sessão');
    await assert.rejects(ss.create(pc, {mode: 'guest', email: 'x@y.com', option: 'p:' + p10.id}), /sessão em andamento/);
  } finally { store.close(); fs.rmSync(dir, {recursive: true, force: true}); }
});

test('1.1.4: Pagar via PIX sem conta (só e-mail) libera o PC como visitante', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-self3-')), store = new Store(dir); let ref = null, status = 'pending';
  const fetch = async (url, init = {}) => init.method === 'POST' ? (ref = JSON.parse(init.body), {ok: true, status: 201, json: async () => ({id: 5, status: 'pending', point_of_interaction: {transaction_data: {qr_code: 'C', qr_code_base64: 'Q'}}})})
    : {ok: true, status: 200, json: async () => ({id: 5, status, transaction_amount: ref.transaction_amount, external_reference: ref.external_reference})};
  try {
    const started = [];
    const ss = selfService(store, {fetch, noTimer: true, startGuest: async (stationId, input, who, extra) => { const m = {id: 'g1', guest: true, active: true, creditSeconds: 0, pointsMilli: 0, name: 'Visitante', username: '', email: extra.email}; store.state.members.push(m); const sale = store.credit(m.id, input, who); const session = store.start(stationId, m.id, who); started.push({stationId, extra}); return {sale, session}; }});
    const pc = store.state.stations.find(s => s.kind === 'computer'); store.state.promotions.push({id: 'a', name: '1h', cents: 500, minutes: 60, active: true});
    ss.save({pix: true, token: 'APP_USR-1234567890123456-abcdef', promotionIds: ['a']}, 'admin'); cash.open(store, {openingCents: 0}, 'admin');
    await assert.rejects(ss.create(pc, {mode: 'guest', email: 'invalido', option: 'p:a'}), /e-mail válido/);
    const c = await ss.create(pc, {mode: 'guest', email: 'joao@x.com', option: 'p:a'}); assert.equal(ref.payer.email, 'joao@x.com'); assert.match(c.username, /joao@x\.com/);
    status = 'approved'; await ss.check(store.state.pixCharges[0], true); await ss.check(store.state.pixCharges[0], true);
    assert.equal(started.length, 1, 'libera uma vez só'); assert.equal(started[0].extra.email, 'joao@x.com');
    assert.equal(store.activeForStation(pc.id).memberId, 'g1'); assert.equal((await ss.status(pc, {id: c.id})).status, 'approved');
    assert.equal(store.state.sales.at(-1).paymentMethod, 'pix');
  } finally { store.close(); fs.rmSync(dir, {recursive: true, force: true}); }
});

test('1.1.2: configuração anterior — promoções ativas continuam no PC', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-self2-')), store = new Store(dir);
  try {
    store.state.promotions.push({id: 'a', name: 'A', cents: 500, minutes: 60, active: true}, {id: 'b', name: 'B', cents: 900, minutes: 120, active: false});
    store.state.settings.selfService = {signup: true, pix: true, values: [1000], promotions: true, payerEmail: ''};
    const ss = selfService(store, {noTimer: true}); assert.deepEqual(store.state.settings.selfService.promotionIds, ['a']); assert.deepEqual(ss.options().map(o => o.id), ['p:a']);
  } finally { store.close(); fs.rmSync(dir, {recursive: true, force: true}); }
});

test('1.1.0: importar produtos por planilha — cria, atualiza pelo código, calcula a margem e cria categoria', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-pimp-')), store = new Store(dir);
  try {
    const coca = store.state.products.find(p => p.name === 'Coca-cola');
    const csv = '﻿Código do produto;Nome;Categoria;Custo;Preço de venda;Margem de venda;Estoque\n'
      + `${coca.code};Coca-Cola lata;Bebidas;3,50;;70;30\n`
      + '7894900700015;Guaraná lata;Bebidas;R$ 2,90;5,00;;\n'
      + 'FF100;Pin Free Fire;Gift Cards;8,00;10,00;;5\n'
      + ';Sem nome;Bebidas;1;2;;\n'
      + '999;Errado;Bebidas;abc;2;;\n';
    const parsed = P.parse('produtos.csv', Buffer.from(csv).toString('base64'));
    assert.deepEqual(Object.keys(parsed.columns).sort(), ['category', 'code', 'cost', 'margin', 'name', 'price', 'stock']);
    const rows = P.validate(store, parsed.rows);
    assert.deepEqual(rows.map(r => r.status), ['update', 'new', 'new', 'new', 'error']);
    assert.equal(rows[0].finalPrice, 600); assert.equal(rows[0].finalMargin, 70); // 3,50 + 70% = 5,95 → 6,00
    assert.equal(rows[1].barcode, '7894900700015'); assert.equal(rows[2].barcode, 'FF100'); assert.match(rows[4].error, /Custo não reconhecido/);
    const r = P.importProducts(store, parsed.rows, 'admin'); assert.equal(r.created, 3); assert.equal(r.updated, 1);
    assert.equal(coca.name, 'Coca-Cola lata'); assert.equal(coca.stock, 30); assert.equal(coca.priceCents, 600); assert.equal(coca.costCents, 350);
    const ff = store.state.products.find(p => p.name === 'Pin Free Fire'); assert.equal(ff.category, 'Gift Cards'); assert.ok(store.state.categories.includes('Gift Cards'));
    assert.equal(ff.priceCents, 1000); assert.equal(ff.stock, 5); assert.ok(ff.code > coca.code);
    assert.equal(store.state.products.find(p => p.name === 'Guaraná lata').costCents, 290);
    // reimportar a mesma planilha só atualiza (não duplica)
    assert.deepEqual(P.validate(store, parsed.rows).map(x => x.status).slice(0, 3), ['update', 'update', 'update']);
    assert.equal(P.money('1.250,90'), 125090); assert.equal(P.money('1250.9'), 125090); assert.equal(P.percent('50%'), 50); assert.equal(P.percent({number: 0.5}), 50);
  } finally { store.close(); fs.rmSync(dir, {recursive: true, force: true}); }
});
