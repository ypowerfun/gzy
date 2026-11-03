'use strict';
// 3.0.60: rankings do site (ChatGPT Sites) no app do cliente — o servidor busca, confere e entrega.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createServer} = require('../server');
const {Readable} = require('node:stream');
const rankingsService = require('../rankings');
class FakeTV { async hdmi() {} async openClientPage() {} disconnect() {} }
const sample = {updatedAt:'2026-10-22T12:00:00Z', note:'O Viradão conta eventos distintos.', boards:[
  {id:'medalhas', title:'Top 10 Medalhas', unit:'medalhas', entries:[{name:'Marialvo Junior', value:2}]},
  {id:'campeonatos', title:'Top 10 Campeonatos ganhos', unit:'títulos', emptyTitle:'A próxima conquista pode ser sua.', entries:[]},
  {id:'viradao', title:'Top 10 Participação em Viradão', unit:'participações', entries:[{name:'Ketchupxzd', value:3},{name:'Leonardo Araujo', value:2},{name:'tobi', value:2}]}
]};
function fakeFetch(body, calls = []) {
  return async (url, init) => { calls.push({url, init}); return new Response(typeof body === 'string' ? body : JSON.stringify(body), {status:200, headers:{'Content-Type':'application/json'}}); };
}
const fakeStore = (mobile = {}) => ({state:{settings:{mobile}}});

test('3.0.60: endereço dos rankings só HTTPS público, sem credenciais', () => {
  assert.equal(rankingsService.validateUrl(''), '');
  assert.equal(rankingsService.validateUrl('https://primearena1.com.br/api/rankings'), 'https://primearena1.com.br/api/rankings');
  for (const bad of ['http://primearena1.com.br/api/rankings', 'https://user:pw@site.com/x', 'https://localhost/x', 'https://192.168.1.10/x', 'https://[::1]/x', 'https://servidor.local/x', 'https://intranet/x', 'ftp://site.com/x', 'nada'])
    assert.throws(() => rankingsService.validateUrl(bad), /HTTPS|inválido/, bad);
});

test('3.0.60: dados do site são conferidos e limpos (limites, nomes, valores)', () => {
  const many = Array.from({length: 15}, (_, i) => ({name: 'Jogador ' + i, value: 15 - i}));
  const out = rankingsService.normalize({boards:[
    {id:'Top Medalhas!!', title:'  Top 10\u0000 Medalhas ', unit:'medalhas', entries:[...many, {name:'', value:3}, {name:'x', value:-1}]},
    {id:'sem-titulo', title:'', entries:[]},
    {id:'dup', title:'A', entries:[{name:'<img src=x onerror=1>', value:'7', position:1}]},
    {id:'dup', title:'B', entries:[]}
  ]});
  assert.equal(out.boards.length, 2);
  assert.equal(out.boards[0].id, 'top-medalhas--');
  assert.equal(out.boards[0].title, 'Top 10 Medalhas');
  assert.equal(out.boards[0].medal, true);
  assert.equal(out.boards[0].entries.length, 15, '3.0.65: o quadro de medalhas guarda até 200 posições (para achar a sua posição)');
  assert.deepEqual(out.boards[0].entries[0], {position:1, name:'Jogador 0', value:15, avatarUrl:''});
  assert.equal(out.boards[1].entries[0].name, '<img src=x onerror=1>'); // o app escapa ao desenhar
  assert.equal(out.boards[1].entries[0].value, 7);
  assert.throws(() => rankingsService.normalize({}), /boards/);
  assert.throws(() => rankingsService.normalize({boards:[{title:''}]}), /título/);
});

test('3.0.60: busca uma vez, guarda, não segue redirecionamento e marca "você"', async () => {
  let clock = 1_000_000;
  const calls = [];
  const svc = rankingsService(fakeStore(), {fetch: fakeFetch(sample, calls), now: () => clock});
  const first = await svc.forMember({username:'tobi', name:'Tobias'});
  assert.equal(first.available, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, rankingsService.DEFAULT_URL);
  assert.equal(calls[0].init.redirect, 'error');
  const viradao = first.boards.find(b => b.id === 'viradao');
  assert.deepEqual(viradao.entries.map(e => [e.position, e.name, e.me]), [[1,'Ketchupxzd',false],[2,'Leonardo Araujo',false],[3,'tobi',true]]);
  assert.equal(first.note, 'O Viradão conta eventos distintos.');
  // dentro de 5 minutos: usa a cópia guardada
  clock += 60_000; await svc.forMember({username:'ana'}); assert.equal(calls.length, 1);
  // depois de 5 minutos: devolve a cópia e atualiza em segundo plano
  clock += 5 * 60_000; await svc.forMember({username:'ana'}); assert.equal(calls.length, 2);
});

test('3.0.60: site fora do ar ou resposta inválida não derruba o app', async () => {
  let clock = 5_000_000, mode = 'ok';
  const fetch = async () => {
    if (mode === 'down') throw Error('ENOTFOUND');
    if (mode === 'html') return new Response('<html>página</html>', {status:200});
    if (mode === '500') return new Response('erro', {status:500});
    return new Response(JSON.stringify(sample), {status:200});
  };
  const empty = rankingsService(fakeStore(), {fetch: async () => { throw Error('ENOTFOUND'); }, now: () => clock});
  const none = await empty.forMember({username:'ana'});
  assert.equal(none.available, false);
  assert.match(none.error, /ENOTFOUND/);
  for (const bad of ['html', '500']) {
    const svc = rankingsService(fakeStore(), {fetch: async () => (mode = bad, fetch()), now: () => clock});
    const res = await svc.forMember({});
    assert.equal(res.available, false, bad);
  }
  // já tinha dados: continua mostrando a última versão boa, marcada como antiga
  mode = 'ok';
  const svc = rankingsService(fakeStore(), {fetch, now: () => clock});
  assert.equal((await svc.forMember({})).available, true);
  mode = 'down'; clock += 6 * 60_000;
  await svc.forMember({}); await new Promise(r => setTimeout(r, 10));
  const kept = await svc.forMember({});
  assert.equal(kept.available, true);
  assert.equal(kept.stale, true);
  assert.equal(svc.status().ok, false);
});

test('3.0.60: rota /mobile/api/rankings exige login e entrega os rankings do site', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-rank-'));
  const calls = [];
  const server = createServer({directory:dir, noTimer:true, Vidaa:FakeTV, mobile:{rankingsFetch: fakeFetch(sample, calls)}});/* GameZoney 1.0.1: API dos apps desligada por padrão; os testes dela ligam aqui */server.store.state.settings.mobile={...server.store.state.settings.mobile,enabled:true};
  t.after(async () => { await server.close(); fs.rmSync(dir, {recursive:true, force:true}); });
  await new Promise(r => server.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.server.address().port;
  server.store.memberSave({name:'Tobias', username:'tobi', password:'abc123'}, 'admin');
  server.store.persist();
  let cookie = '';
  const call = async (route, body, csrf) => {
    const res = await fetch(base + '/mobile/api' + route, {method: body ? 'POST' : 'GET', headers: {...(cookie ? {Cookie: cookie} : {}), ...(body ? {'Content-Type':'application/json', 'X-Prime-CSRF': csrf} : {})}, body: body && JSON.stringify(body)});
    const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    return {status: res.status, json: await res.json()};
  };
  const auth = await call('/auth');
  assert.equal((await call('/rankings')).status, 401);
  assert.equal(calls.length, 0, 'sem login o servidor nem consulta o site');
  const login = await call('/login', {username:'tobi', password:'abc123'}, auth.json.csrfToken);
  assert.equal(login.status, 200);
  const res = await call('/rankings');
  assert.equal(res.status, 200);
  assert.equal(res.json.available, true);
  assert.equal(res.json.boards.length, 3);
  assert.equal(res.json.boards[2].entries[2].me, true);
  // configuração na recepção: endereço inválido recusado, válido guardado
  assert.throws(() => server.app && require('../mobile')(server.store, {}).configure({rankingsUrl:'http://site.com/x'}, 'admin'), /HTTPS/);
});

// ---------------------------------------------------------------- 3.0.65: fotos do site e SUA POSIÇÃO pelo nick
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), Buffer.alloc(64, 1)]);
const publicDns = async () => [{address: '104.21.32.1', family: 4}];
const medalSample = {boards: [
  {id: 'medalhas', title: 'Top 10 Medalhas', unit: 'medalhas', entries: [
    ...Array.from({length: 36}, (_, i) => ({name: 'Jogador ' + (i + 1), value: 100 - i, avatar: i === 0 ? 'https://primearena1.com.br/avatares/j1.png' : i === 1 ? '/avatares/j2.webp' : undefined})),
    {name: '  power ', value: 27, avatar: 'https://cdn.site-fotos.com/power.jpg'}]},
  {id: 'viradao', title: 'Top 10 Viradão', unit: 'participações', entries: [{name: 'Yves A.', nick: 'POWER', value: 3}, {name: 'Power', nick: 'outro', value: 2}]}]};
const loyaltyStore = () => ({state: {settings: {mobile: {}, loyalty: {thresholdMilli: 20000, rewardMinutes: 180}},
  members: [{id: 'm1', username: 'Power', name: 'Yves Adriel', pointsMilli: 6500}],
  loyaltyLedger: [{memberId: 'm1', amount: 1000, reason: 'Compra'}, {memberId: 'm1', amount: -20000, reason: 'Resgate automático (1x)'}, {memberId: 'outro', amount: -20000, reason: 'Resgate automático (1x)'}]}});

test('3.0.65: link da foto só HTTPS público (link completo ou caminho do site)', () => {
  const base = 'https://primearena1.com.br/api/rankings';
  assert.equal(rankingsService.avatarLink('/avatares/power.png', base), 'https://primearena1.com.br/avatares/power.png');
  assert.equal(rankingsService.avatarLink('https://cdn.site-fotos.com/a.webp#x', base), 'https://cdn.site-fotos.com/a.webp');
  for (const bad of ['http://primearena1.com.br/a.png', 'https://192.168.0.10/a.png', 'https://localhost/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://u:p@site.com/a.png', '', null])
    assert.equal(rankingsService.avatarLink(bad, base), '', String(bad));
  const out = rankingsService.normalize({boards: [{id: 'm', title: 'Top Medalhas', entries: [{name: 'a', value: 1, foto: '/f/a.png'}, {name: 'b', value: 1, avatar: 'ftp://x.com/b.png'}]}]}, base);
  assert.deepEqual(out.boards[0].entries.map(e => e.avatarUrl), ['https://primearena1.com.br/f/a.png', '']);
  assert.equal(rankingsService.imageType(PNG), 'image/png');
  assert.equal(rankingsService.imageType(Buffer.from('<svg onload=alert(1)>')), '');
  assert.equal(rankingsService.privateAddress('10.0.0.7', 4), true);
  assert.equal(rankingsService.privateAddress('::ffff:127.0.0.1', 6), true);
  assert.equal(rankingsService.privateAddress('104.21.32.1', 4), false);
});

test('3.0.65/3.0.66: Top 10 + SUA POSIÇÃO pelo nick (mesmo fora do Top 10), fotos pelo servidor, sem fidelidade', async () => {
  const svc = rankingsService(loyaltyStore(), {fetch: fakeFetch(medalSample), lookup: publicDns, now: () => 1_000_000});
  const res = await svc.forMember({id: 'm1', username: 'Power'});
  assert.equal(res.available, true);
  assert.equal(res.nick, 'Power');
  const medals = res.boards[0];
  assert.equal(medals.id, 'medalhas');
  assert.equal(medals.medal, true);
  assert.equal(medals.entries.length, 10, 'o app recebe só o Top 10');
  assert.equal(medals.entries.some(e => e.me), false);
  assert.deepEqual({position: medals.me.position, name: medals.me.name, value: medals.me.value, me: medals.me.me}, {position: 37, name: 'power', value: 27, me: true}, 'nick igual (maiúsculas/espaços não importam)');
  assert.match(medals.me.avatar, /^\/mobile\/api\/avatar\/[a-f0-9]{32}$/);
  assert.match(medals.entries[0].avatar, /^\/mobile\/api\/avatar\/[a-f0-9]{32}$/);
  assert.match(medals.entries[1].avatar, /^\/mobile\/api\/avatar\/[a-f0-9]{32}$/);
  assert.equal(medals.entries[2].avatar, null, 'sem foto no site: o app mostra a letra');
  assert.ok(!JSON.stringify(res).includes('primearena1.com.br/avatares'), 'o app nunca recebe o endereço do site');
  assert.deepEqual(res.boards[1].entries.map(e => [e.name, e.me]), [['Yves A.', true], ['Power', false]], 'com o campo nick, vale o nick do site (não o nome exibido)');
  assert.equal(res.boards[1].me.position, 1);
  assert.ok(!('nick' in res.boards[1].entries[0]), 'o nick do site não é repassado ao app');
  assert.ok(!('loyalty' in res), '3.0.66: o ranking do site não leva o ciclo do Programa Fidelidade');
});

test('3.0.65: fotos conferidas (tipo, tamanho, redirecionamento e rede interna) e guardadas', async () => {
  let t = 1_000_000;
  const calls = [];
  const images = new Map();
  const fetch = async (url, init) => {
    calls.push({url, init});
    if (url === rankingsService.DEFAULT_URL) return new Response(JSON.stringify({boards: [{id: 'medalhas', title: 'Top 10 Medalhas', entries: [
      {name: 'png', value: 5, avatar: '/f/ok.png'}, {name: 'svg', value: 4, avatar: '/f/svg.png'}, {name: 'big', value: 3, avatar: '/f/big.png'},
      {name: 'redir', value: 2, avatar: '/f/redir.png'}, {name: 'interna', value: 1, avatar: 'https://fotos.interna.com.br/a.png'}, {name: 'httpredir', value: 1, avatar: '/f/http.png'}]}]}), {status: 200});
    return images.get(url)();
  };
  images.set('https://primearena1.com.br/f/ok.png', () => new Response(PNG, {status: 200, headers: {'Content-Type': 'application/octet-stream'}}));
  images.set('https://primearena1.com.br/f/svg.png', () => new Response('<svg onload=alert(1)></svg>', {status: 200, headers: {'Content-Type': 'image/png'}}));
  images.set('https://primearena1.com.br/f/big.png', () => new Response(Readable.toWeb(Readable.from([PNG, Buffer.alloc(600 * 1024)])), {status: 200}));
  images.set('https://primearena1.com.br/f/redir.png', () => new Response(null, {status: 302, headers: {location: 'https://cdn.site-fotos.com/r.png'}}));
  images.set('https://cdn.site-fotos.com/r.png', () => new Response(PNG, {status: 200}));
  images.set('https://primearena1.com.br/f/http.png', () => new Response(null, {status: 301, headers: {location: 'http://primearena1.com.br/f/ok.png'}}));
  const lookup = async host => host === 'fotos.interna.com.br' ? [{address: '192.168.1.20', family: 4}] : [{address: '104.21.32.1', family: 4}];
  const svc = rankingsService(loyaltyStore(), {fetch, lookup, now: () => t});
  const res = await svc.forMember({id: 'm1', username: 'Power'});
  const id = name => res.boards[0].entries.find(e => e.name === name).avatar.split('/').pop();
  const ok = await svc.avatar(id('png'));
  assert.equal(ok.type, 'image/png', 'o tipo vem do conteúdo, não do cabeçalho do site');
  assert.equal(calls.at(-1).init.redirect, 'manual');
  assert.equal(await svc.avatar(id('svg')), null, 'SVG/HTML não é aceito');
  assert.equal(await svc.avatar(id('big')), null, 'acima de 512 KB não é aceito');
  assert.equal((await svc.avatar(id('redir'))).type, 'image/png', 'redirecionamento HTTPS público é seguido');
  assert.equal(await svc.avatar(id('interna')), null, 'nome que aponta para a rede interna é recusado');
  assert.ok(!calls.some(c => c.url.includes('fotos.interna')), 'nem chega a pedir à rede interna');
  assert.equal(await svc.avatar(id('httpredir')), null, 'redirecionamento para HTTP é recusado');
  assert.equal(await svc.avatar('0'.repeat(32)), null, 'código que não está no JSON do site');
  assert.equal(await svc.avatar('../../etc/passwd'), null);
  // guardada: não pede de novo; falha recente não tenta de novo por 10 min
  const before = calls.length;
  await svc.avatar(id('png'));
  await svc.avatar(id('svg'));
  assert.equal(calls.length, before);
  // depois de 6 h tenta de novo; se o site falhar, a foto anterior continua valendo
  t += 6 * 3600 * 1000 + 1;
  images.set('https://primearena1.com.br/f/ok.png', () => { throw Error('ENOTFOUND'); });
  assert.equal((await svc.avatar(id('png'))).type, 'image/png');
});

test('3.0.65: rota /mobile/api/avatar exige login e entrega a imagem com cabeçalhos seguros', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-avatar-'));
  const siteFetch = async url => url === rankingsService.DEFAULT_URL ? new Response(JSON.stringify(medalSample), {status: 200}) : new Response(PNG, {status: 200});
  const server = createServer({directory: dir, noTimer: true, Vidaa: FakeTV, mobile: {rankingsFetch: siteFetch, rankingsLookup: publicDns}});/* GameZoney 1.0.1: API dos apps desligada por padrão; os testes dela ligam aqui */server.store.state.settings.mobile={...server.store.state.settings.mobile,enabled:true};
  t.after(async () => { await server.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  await new Promise(r => server.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.server.address().port;
  server.store.memberSave({name: 'Yves', username: 'power', password: 'abc123'}, 'admin');
  server.store.persist();
  let cookie = '';
  const call = async (route, body, csrf) => {
    const res = await fetch(base + '/mobile/api' + route, {method: body ? 'POST' : 'GET', headers: {...(cookie ? {Cookie: cookie} : {}), ...(body ? {'Content-Type': 'application/json', 'X-Prime-CSRF': csrf} : {})}, body: body && JSON.stringify(body)});
    const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    return res;
  };
  const auth = await (await call('/auth')).json();
  assert.equal((await call('/avatar/' + 'a'.repeat(32))).status, 401);
  await call('/login', {username: 'power', password: 'abc123'}, auth.csrfToken);
  const rankings = await (await call('/rankings')).json();
  assert.equal(rankings.boards[0].me.position, 37);
  const res = await call(rankings.boards[0].me.avatar.replace('/mobile/api', ''));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(res.headers.get('cache-control'), /private/);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
  assert.equal((await call('/avatar/' + 'b'.repeat(32))).status, 404);
});
