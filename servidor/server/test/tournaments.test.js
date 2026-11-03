'use strict';
// 3.0.61: torneios disponíveis do site (ChatGPT Sites) na aba Torneios — o servidor busca, confere e entrega.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createServer} = require('../server');
const tournamentsService = require('../tournaments');
class FakeTV { async hdmi() {} async openClientPage() {} disconnect() {} }
const sample = {updatedAt: '2026-10-22T12:00:00Z', tournaments: [
  {id: 'viradao', title: 'Viradão de Outubro', status: 'soon', startsAt: '2026-10-31T23:00:00Z', url: 'https://primearena1.com.br/torneios/viradao'},
  {id: 'copa', title: 'Copa FC 26', status: 'open', game: 'EA FC 26', platform: 'PS5', format: 'Mata-mata 1x1', startsAt: '2026-10-25T23:00:00Z', slots: {filled: 12, total: 16}, entryFee: 'R$ 20,00', prize: 'R$ 300', url: '/torneios/copa'},
  {id: 'velho', title: 'Torneio encerrado', status: 'finished'},
  {id: 'mal', title: 'Link estranho', status: 'live', url: 'https://outro-site.com/torneios/x'}
]};
const fakeFetch = (body, calls = []) => async (url, init) => { calls.push({url, init}); return new Response(JSON.stringify(body), {status: 200}); };
const fakeStore = () => ({state: {settings: {mobile: {}}}});

test('3.0.61: endereço dos torneios só HTTPS público', () => {
  assert.equal(tournamentsService.validateUrl(''), '');
  assert.equal(tournamentsService.validateUrl('https://primearena1.com.br/api/torneios'), 'https://primearena1.com.br/api/torneios');
  for (const bad of ['http://primearena1.com.br/api/torneios', 'https://a:b@site.com/x', 'https://localhost/x', 'https://10.0.0.5/x', 'https://servidor.local/x', 'https://intranet/x', 'lixo'])
    assert.throws(() => tournamentsService.validateUrl(bad), /HTTPS|inválido/, bad);
});

test('3.0.61: dados do site conferidos: só abertos/em breve/andamento/esgotados, links só do site em /torneios', () => {
  const out = tournamentsService.normalize(sample).tournaments;
  assert.deepEqual(out.map(t => t.id), ['copa', 'mal', 'viradao'], 'abertos primeiro, depois em andamento, depois em breve; encerrado fora');
  assert.equal(out[0].url, 'https://primearena1.com.br/torneios/copa');
  assert.equal(out[1].url, 'https://primearena1.com.br/torneios', 'link de outro site vira a página de torneios');
  assert.deepEqual(out[0].slots, {filled: 12, total: 16});
  assert.equal(out[0].statusText, 'Inscrições abertas');
  for (const bad of ['javascript:alert(1)', 'https://primearena1.com.br/conta', 'https://primearena1.com.br.evil.com/torneios', '//evil.com/torneios'])
    assert.equal(tournamentsService.tournamentLink(bad), 'https://primearena1.com.br/torneios', bad);
  const many = tournamentsService.normalize({tournaments: Array.from({length: 40}, (_, i) => ({id: 'x' + i, title: 'T' + i, status: 'open', slots: {filled: 50, total: 10}}))}).tournaments;
  assert.equal(many.length, 20);
  assert.deepEqual(many[0].slots, {filled: 10, total: 10});
  assert.throws(() => tournamentsService.normalize({}), /tournaments/);
});

test('3.0.61: busca uma vez, guarda 5 min, não segue redirecionamento; site fora do ar não quebra', async () => {
  let clock = 1_000_000;
  const calls = [];
  const svc = tournamentsService(fakeStore(), {fetch: fakeFetch(sample, calls), now: () => clock});
  const first = await svc.forMember();
  assert.equal(first.available, true);
  assert.equal(first.tournaments.length, 3);
  assert.equal(calls[0].url, tournamentsService.DEFAULT_URL);
  assert.equal(calls[0].init.redirect, 'error');
  clock += 60_000; await svc.forMember(); assert.equal(calls.length, 1);
  clock += 5 * 60_000; await svc.forMember(); assert.equal(calls.length, 2);
  const down = tournamentsService(fakeStore(), {fetch: async () => { throw Error('ENOTFOUND'); }, now: () => clock});
  const res = await down.forMember();
  assert.equal(res.available, false);
  assert.equal(res.page, 'https://primearena1.com.br/torneios');
  const html = tournamentsService(fakeStore(), {fetch: async () => new Response('<html></html>', {status: 200}), now: () => clock});
  assert.equal((await html.forMember()).available, false);
});

test('3.0.61: rota /mobile/api/torneios exige login', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-torneios-'));
  const calls = [];
  const server = createServer({directory: dir, noTimer: true, Vidaa: FakeTV, mobile: {tournamentsFetch: fakeFetch(sample, calls)}});/* GameZoney 1.0.1: API dos apps desligada por padrão; os testes dela ligam aqui */server.store.state.settings.mobile={...server.store.state.settings.mobile,enabled:true};
  t.after(async () => { await server.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  await new Promise(r => server.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.server.address().port;
  server.store.memberSave({name: 'Tobias', username: 'tobi', password: 'abc123'}, 'admin');
  server.store.persist();
  let cookie = '';
  const call = async (route, body, csrf) => {
    const res = await fetch(base + '/mobile/api' + route, {method: body ? 'POST' : 'GET', headers: {...(cookie ? {Cookie: cookie} : {}), ...(body ? {'Content-Type': 'application/json', 'X-Prime-CSRF': csrf} : {})}, body: body && JSON.stringify(body)});
    const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    return {status: res.status, json: await res.json()};
  };
  const auth = await call('/auth');
  assert.equal((await call('/torneios')).status, 401);
  assert.equal(calls.length, 0, 'sem login o servidor nem consulta o site');
  await call('/login', {username: 'tobi', password: 'abc123'}, auth.json.csrfToken);
  const res = await call('/torneios');
  assert.equal(res.status, 200);
  assert.equal(res.json.tournaments[0].title, 'Copa FC 26');
  assert.throws(() => require('../mobile')(server.store, {}).configure({tournamentsUrl: 'http://site.com/x'}, 'admin'), /HTTPS/);
});
