'use strict';
// 1.4.4 (bug relatado pelo dono): ao cadastrar uma promoção e recarregar o cliente com ela, o cliente ganhava 10 medalhas e o
// resgate automático sem o programa fidelidade estar configurado. Causa: servidor de antes da 1.1.4 guardava a fidelidade
// sem a tabela por dia e valia uma regra escondida (R$ 1 = 1 medalha; 10 medalhas = 60 min). O mesmo com o Corujão/Viradão
// (1 medalha por participante sem ninguém configurar).
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {Store} = require('../store');
const {createServer} = require('../server');

async function boot(t, prepare) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-loyhid-'));
  if (prepare) { const st = new Store(directory); prepare(st); st.persist(); st.close(); }
  const inst = createServer({directory, noTimer: true});
  await new Promise(r => inst.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + inst.server.address().port; let cookie = '';
  t.after(async () => { await inst.close(); fs.rmSync(directory, {recursive: true, force: true, maxRetries: 5}); });
  const call = async (url, body, status = 200) => {
    const r = await fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const j = await r.json(); assert.equal(r.status, status, url + ' ' + JSON.stringify(j)); return j;
  };
  if (!inst.store.state.operators.length) await call('/api/setup', {username: 'dono', password: 'senha1234'});
  await call('/api/login', {username: 'dono', password: 'senha1234'});
  return {inst, call, s: inst.store.state};
}
const recharge = async ({call, s}) => {
  await call('/api/cash/open', {openingCents: 0}).catch(() => {});
  const p = await call('/api/promotions', {name: 'Promo R$ 10', minutes: 60, cents: 1000, active: true});
  await call('/api/members', {name: 'Ana', username: 'ana'});
  const m = s.members.find(x => x.username === 'ana');
  await call('/api/credit', {memberId: m.id, promotionId: p.id, paymentMethod: 'cash'});
  return m;
};

test('1.4.4: servidor antigo sem programa configurado — promoção NÃO gera medalha nem resgate; Corujão sem medalha padrão', async t => {
  const b = await boot(t, st => {
    st.state.settings.loyalty = {enabled: true, basis: 'spend', rate: 1}; // como ficava em servidores de antes da 1.1.4
    st.state.settings.eventMedalsMilli = 1000; delete st.state.settings.eventMedalsChecked; // padrão antigo, nunca configurado (servidor de antes da 1.4.4)
    const {passwordHash} = require('../store');
    st.state.operators.push({id: 'o1', username: 'dono', hash: passwordHash('senha1234'), role: 'admin', owner: true, active: true});
  });
  const m = await recharge(b);
  assert.equal(m.pointsMilli || 0, 0, 'sem medalhas');
  assert.equal(m.creditSeconds, 3600, 'só os 60 minutos da promoção (sem os 60 do resgate)');
  assert.equal(b.s.loyaltyLedger.filter(x => x.memberId === m.id).length, 0, 'nada no extrato de medalhas');
  const l = (await b.call('/api/loyalty')).settings;
  assert.equal(l.thresholdMilli, 0); assert.equal(l.rewardMinutes, 0); assert.equal(l.rate, undefined);
  assert.equal(b.s.settings.eventMedalsMilli, 0, 'Corujão/Viradão sem medalha automática');
  const logs = b.inst.store.logs().map(x => x.detail).join('\n');
  assert.match(logs, /regra padrão antiga \(nunca configurada\) desligada/); assert.match(logs, /Corujão\/Viradão: o valor padrão/);
  // com o programa configurado pelo administrador, aí sim gera medalhas
  await b.call('/api/loyalty/settings', {thresholdPoints: 20, rewardMinutes: 30, weekly: Array.from({length: 7}, (_, day) => ({day, cents: 1000, pointsMilli: 5000}))});
  const p = b.s.promotions[0]; await b.call('/api/credit', {memberId: m.id, promotionId: p.id, paymentMethod: 'cash'});
  assert.equal(m.pointsMilli, 5000, 'R$ 10 = 5 medalhas, como configurado'); assert.equal(m.creditSeconds, 7200, 'sem resgate (precisa de 20)');
});

test('1.4.4: instalação nova — promoção sem programa configurado não gera medalha; valores do Corujão configurados continuam', async t => {
  const b = await boot(t);
  const m = await recharge(b);
  assert.equal(m.pointsMilli || 0, 0); assert.equal(m.creditSeconds, 3600);
  assert.equal(b.s.settings.eventMedalsMilli, 0);
  // Corujão configurado pelo administrador: não volta a 0 ao reabrir
  await b.call('/api/events/medals', {medals: 1});
  b.s.settings.eventMedalsChecked = false; require('../events').init(b.inst.store);
  assert.equal(b.s.settings.eventMedalsMilli, 1000, 'valor escolhido pelo administrador fica');
});

test('1.4.4: cancelar a recarga que disparou o resgate automático desfaz o prêmio (antes ficava impossível cancelar)', async t => {
  const b = await boot(t);
  await b.call('/api/loyalty/settings', {thresholdPoints: 10, rewardMinutes: 60, weekly: Array.from({length: 7}, (_, day) => ({day, cents: 100, pointsMilli: 1000}))});
  const m = await recharge(b); // R$ 10 = 10 medalhas -> resgate automático de 60 min
  const sale = b.s.sales.at(-1);
  assert.equal(sale.autoReward.minutes, 60); assert.equal(sale.autoReward.costMilli, 10000);
  assert.equal(m.creditSeconds, 7200); assert.equal(m.pointsMilli, 0);
  assert.equal(b.s.freeGrants.filter(g => g.saleId === sale.id).length, 1);
  await b.call('/api/business/cancel', {id: sale.id, reason: 'Recarga lançada errado'});
  assert.equal(sale.status, 'canceled'); assert.equal(sale.autoRewardUndone, true);
  assert.equal(m.creditSeconds, 0, 'tira os 60 min da recarga e os 60 do prêmio');
  assert.equal(m.pointsMilli, 0, 'medalhas voltam ao que eram antes da recarga');
  assert.equal(b.s.freeGrants.filter(g => g.saleId === sale.id).length, 0, 'tempo grátis sai da estatística');
  assert.ok(b.s.loyaltyLedger.some(l => l.reason === 'Estorno do resgate automático (fatura cancelada)' && l.amount === 10000));
  // cliente que já tinha 9 medalhas: a recarga de R$ 1 dispara o prêmio; cancelar volta às 9
  m.pointsMilli = 9000; b.inst.store.persist();
  const p1 = await b.call('/api/promotions', {name: 'Promo R$ 1', minutes: 10, cents: 100, active: true});
  await b.call('/api/credit', {memberId: m.id, promotionId: p1.id, paymentMethod: 'cash'});
  const s2 = b.s.sales.at(-1); assert.equal(s2.autoReward.minutes, 60); assert.equal(m.pointsMilli, 0);
  await b.call('/api/business/cancel', {id: s2.id, reason: 'Teste'});
  assert.equal(m.pointsMilli, 9000); assert.equal(m.creditSeconds, 0);
  // se o cliente já usou o tempo do prêmio, não dá para cancelar (como sempre foi com o tempo da recarga)
  await b.call('/api/credit', {memberId: m.id, promotionId: p1.id, paymentMethod: 'cash'});
  const s3 = b.s.sales.at(-1); m.creditSeconds -= 1800; b.inst.store.persist();
  assert.match((await b.call('/api/business/cancel', {id: s3.id, reason: 'Teste'}, 400)).error, /Saldo indisponível/);
});

test('1.4.4: promoção removida não volta a valer por edição nem por recarga', async t => {
  const b = await boot(t);
  const p = await b.call('/api/promotions', {name: 'Velha', minutes: 30, cents: 500, active: true});
  await b.call('/api/promotions/remove', {id: p.id});
  assert.match((await b.call('/api/promotions', {id: p.id, name: 'Velha', minutes: 30, cents: 500, active: true}, 400)).error, /inexistente/);
  b.s.promotions.find(x => x.id === p.id).active = true; // mesmo com o dado antigo "ativo"
  await b.call('/api/cash/open', {openingCents: 0}).catch(() => {});
  await b.call('/api/members', {name: 'Bia', username: 'bia'});
  const m = b.inst.store.state.members.find(x => x.username === 'bia'); assert.ok(m, JSON.stringify(b.inst.store.state.members.map(x => x.username)));
  assert.match((await b.call('/api/credit', {memberId: m.id, promotionId: p.id, paymentMethod: 'cash'}, 400)).error, /Promoção indisponível/);
});
