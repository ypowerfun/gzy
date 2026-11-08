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
    return {ok: true, status: 200, json: async () => ({id: 987, status: mpStatus, transaction_amount: mpAmount, external_reference: calls.find(c => c.init.method === 'POST') && JSON.parse(calls.find(c => c.init.method === 'POST').init.body).external_reference})};
  };
  try {
    const ss = selfService(store, {fetch, noTimer: true}), pc = store.state.stations.find(s => s.kind === 'computer');
    assert.deepEqual(ss.flags(), {signup: false, pix: false});
    assert.throws(() => ss.signup(pc, {name: 'Ana', username: 'ana', password: '1234', repeatPassword: '1234'}), /desligado/);
    assert.throws(() => ss.save({pix: true}, 'admin'), /Access Token/);
    assert.throws(() => ss.save({pix: true, token: 'chave-qualquer'}, 'admin'), /inválido/);
    let conf = ss.save({signup: true, pix: true, token: 'APP_USR-1234567890123456-abcdef', values: '5, 10, 20'}, 'admin');
    assert.equal(conf.tokenSet, true); assert.equal(conf.token, undefined); assert.deepEqual(conf.values, [500, 1000, 2000]);
    assert.doesNotMatch(JSON.stringify(store.snapshot()), /APP_USR/, 'o token não vai para o painel');
    assert.deepEqual(ss.flags(), {signup: true, pix: true});
    // cadastro no PC
    assert.throws(() => ss.signup(pc, {name: 'Ana', username: 'ana', password: '1234', repeatPassword: '9999'}), /não coincidem/);
    assert.equal(ss.signup(pc, {name: 'Ana', username: 'ana', password: '1234', repeatPassword: '1234', phone: '92999990000'}).username, 'ana');
    assert.throws(() => ss.signup(pc, {name: 'Outra', username: 'ANA', password: '1234', repeatPassword: '1234'}), /já existe/);
    // pacotes: valores e promoções
    const opts = ss.options(); assert.deepEqual(opts.map(o => o.cents), [500, 1000, 2000]); assert.equal(opts[0].minutes, Math.round(500 * 60 / store.state.settings.hourCents));
    // PIX: senha errada, caixa fechado e depois aberto
    await assert.rejects(ss.create(pc, {username: 'ana', password: 'errada', option: 'v:1000'}), /incorretos/);
    await assert.rejects(ss.create(pc, {username: 'ana', password: '1234', option: 'v:1000'}), /caixa/i);
    cash.open(store, {openingCents: 0}, 'admin');
    const c = await ss.create(pc, {username: 'ana', password: '1234', option: 'v:1000'});
    assert.equal(c.status, 'pending'); assert.equal(c.copy, '000201PIXCOPIAECOLA'); assert.equal(c.qr, 'iVBORw0KGgo='); assert.equal(mpAmount, 10);
    assert.match(calls[0].init.headers.Authorization, /^Bearer APP_USR/); assert.ok(calls[0].init.headers['X-Idempotency-Key']);
    // ainda não pago
    assert.equal((await ss.status(pc, {id: c.id})).status, 'pending');
    const ana = store.state.members.find(m => m.username === 'ana'); assert.equal(ana.creditSeconds, 0);
    // aprovado: o tempo entra uma vez só, como venda PIX no caixa
    mpStatus = 'approved'; await ss.check(store.state.pixCharges[0], true);
    assert.equal((await ss.status(pc, {id: c.id})).status, 'approved');
    await ss.check(store.state.pixCharges[0], true);
    assert.equal(ana.creditSeconds, opts[1].minutes * 60);
    const sale = store.state.sales.at(-1); assert.equal(sale.paymentMethod, 'pix'); assert.equal(sale.cents, 1000); assert.equal(sale.actor, 'pix-automatico'); assert.ok(sale.cashId);
    // valor diferente do cobrado não libera
    const c2 = await ss.create(pc, {username: 'ana', password: '1234', option: 'v:500'}); mpAmount = 1; mpStatus = 'approved';
    await ss.check(store.state.pixCharges.find(x => x.id === c2.id), true); assert.equal(store.state.pixCharges.find(x => x.id === c2.id).credited, undefined);
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
