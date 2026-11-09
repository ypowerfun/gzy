'use strict';
// 1.1.6: avisos automáticos na tela do PC (tempo acabando e prêmio da fidelidade), pela mesma fila do "Enviar Mensagem"
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {Store} = require('../store'), pcNotices = require('../pc-notices');

function fixture(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-pcn-')), store = new Store(dir); t.after(() => { store.close(); fs.rmSync(dir, {recursive: true, force: true}); }); return store; }

test('1.1.6: aviso de tempo uma vez quando faltar o tempo configurado; volta a valer depois de comprar mais tempo', t => {
  const store = fixture(t), sent = [], fake = {sendMessage: (id, text, seconds) => sent.push({id, text, seconds})};
  const n = pcNotices(store, fake), pc = store.state.stations.find(s => s.kind === 'computer'), tv = store.state.stations.find(s => s.kind === 'tv');
  const m = store.memberSave({name: 'Ana', username: 'ana', password: '1234'}, 'admin'), m2 = store.memberSave({name: 'Bia', username: 'bia', password: '1234'}, 'admin');
  store.credit(m.id, {minutes: 30}, 'admin'); store.credit(m2.id, {minutes: 3}, 'admin');
  const s = store.start(pc.id, m.id, 'admin'), s2 = store.start(tv.id, m2.id, 'admin'), now = Date.now();
  n.check(now); assert.equal(sent.length, 0, 'ainda falta muito');
  n.check(s.endsAt - 5 * 60000 + 1000); assert.equal(sent.length, 1); assert.equal(sent[0].id, pc.id); assert.match(sent[0].text, /Restam apenas \*5 minutos\*/); assert.equal(sent[0].seconds, 10);
  n.check(s.endsAt - 4 * 60000); assert.equal(sent.length, 1, 'não repete');
  assert.ok(!sent.some(x => x.id === tv.id), 'TV não recebe');
  s.endsAt += 20 * 60000; n.check(s.endsAt - 25 * 60000); n.check(s.endsAt - 2 * 60000); assert.equal(sent.length, 2, 'depois de + Tempo avisa de novo'); assert.match(sent[1].text, /2 minutos/);
  // configuração
  assert.throws(() => n.save({timeWarning: true, warnMinutes: 0, seconds: 10, loyalty: true}, 'admin'), /Minutos/);
  const c = n.save({timeWarning: false, warnMinutes: 10, seconds: 6, warnText: 'Faltam *{minutos} min* <b>', loyalty: false}, 'admin');
  assert.equal(c.warnText, 'Faltam *{minutos} min* b'); assert.equal(c.warnMinutes, 10);
  n.loyalty(pc.id, 'PREMIO'); assert.equal(sent.length, 2, 'fidelidade desligada');
  n.save({timeWarning: true, warnMinutes: 10, seconds: 6, warnText: '', loyalty: true}, 'admin');
  n.loyalty(pc.id, 'PREMIO DE 1 HORA ADICIONADOS !'); assert.equal(sent.at(-1).text, '*Programa fidelidade*\nPREMIO DE 1 HORA ADICIONADOS !'); assert.equal(sent.at(-1).seconds, 6);
  assert.match(store.state.settings.pcNotices.warnText, /Restam apenas/, 'texto vazio volta ao padrão');
  void s2;
});

test('1.1.6: prêmio automático da fidelidade aparece como comunicado no PC, uma vez', t => {
  const store = fixture(t); require('./legacy-loyalty')(store);
  const pc = require('../pc')(store), n = pcNotices(store, pc); pc.useNotices(n);
  const station = store.state.stations.find(s => s.kind === 'computer'), m = store.memberSave({name: 'Ana', username: 'ana', password: '1234'}, 'admin');
  store.credit(m.id, {minutes: 30}, 'admin'); store.start(station.id, m.id, 'admin');
  store.state.loyaltyNotices.push({id: 'n1', memberId: m.id, rewardId: 'automatic-program', minutes: 60, count: 1, createdAt: Date.now(), withSession: true, beforeSeconds: 0, afterSeconds: 3600});
  let st = pc.stationState(station); assert.ok(st.loyaltyNotice, 'aviso da barra continua');
  st = pc.stationState(station);   // o comunicado entra na fila e chega na consulta seguinte do PC (a cada 2 s)
  assert.equal(st.messages.length, 1); assert.match(st.messages[0].text, /Programa fidelidade/); assert.match(st.messages[0].text, /PREMIO DE 1hr ADICIONADOS/);
  st = pc.stationState(station); assert.equal(st.messages.length, 1, 'não duplica');
});
