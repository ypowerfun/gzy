'use strict';
// 1.3.7 (plano Pro): app do cliente (app.gamezoney.com) e Conquistas — ponta a ponta com o site de verdade:
// o Servidor liga-se ao site (relay), o celular entra com nick e senha, vê saldo, estações, conquistas e histórico.
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), http = require('node:http');
const {createServer} = require('../server');
let createApp; try { ({createApp} = require('../../../site/server')); } catch { }

async function boot(t) {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519'), pub = publicKey.export({type: 'spki', format: 'pem'});
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-app-site-')), mails = [];
  const site = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, appHoldMs: 300, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: siteDir, DOWNLOADS_DIR: path.join(siteDir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0',
    LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: '', APP_URL: 'https://app.gamezoney.com'}, mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, subject, text}); return true; }}, log: {log() {}, error() {}}});
  const siteServer = await new Promise(r => { const s = site.listen(0, '127.0.0.1', () => r(s)); }); const siteBase = 'http://127.0.0.1:' + siteServer.address().port;
  const old = process.env.GZ_SITE_URL; process.env.GZ_SITE_URL = siteBase;
  const dirs = [siteDir], instances = [];
  t.after(async () => { for (const i of instances) await i.close(); site.locals.close(); siteServer.closeAllConnections?.(); siteServer.close(); for (const d of dirs) fs.rmSync(d, {recursive: true, force: true, maxRetries: 5}); if (old === undefined) delete process.env.GZ_SITE_URL; else process.env.GZ_SITE_URL = old; });
  const web = () => { let cookie = ''; return async (url, body, status = 200) => { const r = await fetch(siteBase + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); if (kv.startsWith('gzs=')) cookie = kv.endsWith('=') ? '' : kv; } const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); return text ? JSON.parse(text) : null; }; };
  const dono = web(); await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  await fetch(siteBase + '/api/auth/verify?t=' + mails.find(m => m.to === 'dono@gamezoney.com').text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'});
  async function gz() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-app-srv-')); dirs.push(directory);
    const inst = createServer({directory, noTimer: true, license: {publicKey: pub}}); instances.push(inst);
    await new Promise(r => inst.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + inst.server.address().port; let cookie = '';
    const call = async (url, body, status = 200) => { const r = await fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)}); const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; return text ? JSON.parse(text) : null; };
    await call('/api/setup', {name: 'Dono', username: 'admin', password: 'senha123'}); await call('/api/login', {username: 'admin', password: 'senha123'});
    return {inst, call, state: inst.store.state};
  }
  return {web, dono, gz, siteBase};
}

test('1.3.7: Conquistas e app do cliente (Pro) — relay pelo site, login com nick/senha, estações por tipo, histórico, sem dados no site', {skip: !createApp && 'site não encontrado'}, async t => {
  const s = await boot(t); const ana = s.web();
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@arena.com', password: 'senha-forte-1'});
  await s.dono('/api/admin/subscriptions/grant', {email: 'ana@arena.com', plan: 'standard', months: 1});
  const loja = await s.gz(); const {inst, call} = loja;
  await call('/api/license/login', {email: 'ana@arena.com', password: 'senha-forte-1'});
  // Standard: sem conquistas e sem app
  assert.match((await call('/api/achievements', undefined, 400)).error, /plano Pro/);
  assert.match((await call('/api/member-app', {enabled: true, slug: 'arena-x'}, 400)).error, /plano Pro/);
  await s.dono('/api/admin/subscriptions/grant', {email: 'ana@arena.com', plan: 'pro', months: 1});
  await call('/api/license/refresh', {});

  // tipo da estação para o filtro do app
  await call('/api/stations', {id: '2', name: 'PC VR 01', kind: 'computer', category: 'vr'}); // 1.3.8: VR antigo vira Console/VR
  assert.equal(loja.state.stations.find(x => x.id === '2').category, 'console');
  assert.match((await call('/api/stations', {id: '2', name: 'PC VR 01', kind: 'computer', category: 'xyz'}, 400)).error, /Tipo da estação/);
  assert.match((await call('/api/stations', {id: '1', name: 'PS5 Sala 1', kind: 'tv', ip: '192.168.1.111', category: 'pc'}, 400)).error, /Tipo da estação/);
  await call('/api/stations', {id: '1', name: 'PS5 Sala 1', kind: 'tv', ip: '192.168.1.111'}); // sem tipo: Console
  assert.equal(loja.state.stations.find(x => x.id === '1').category, undefined);

  // cliente com 2 h jogadas
  const m = inst.store.memberSave({name: 'Joana Silva', username: 'joana', password: 'senha12'}, 'admin');
  inst.store.credit(m.id, {minutes: 240, paymentMethod: 'pix'}, 'admin');
  const t0 = Date.now() - 5 * 3600000;
  inst.store.start('2', m.id, 'admin', t0); inst.store.finish('2', 'admin', 'manual', t0 + 2 * 3600000);

  // conquista criada depois: quem já cumpre recebe na hora (uma vez só)
  let a = await call('/api/achievements', {name: 'Maratonista', description: 'Jogue 1 hora', metric: 'hours', target: '1', medals: '5', icon: '🔥'});
  assert.equal(a.list.length, 1); assert.equal(a.list[0].completed, 1);
  const medals0 = inst.store.member(m.id).pointsMilli; assert.ok(medals0 >= 5000);
  assert.ok(loja.state.loyaltyLedger.some(x => x.memberId === m.id && x.reason === 'Conquista: Maratonista' && x.amount === 5000));
  inst.achievements.run(); inst.achievements.run(Date.now(), true);
  assert.equal(loja.state.achievementAwards.length, 1, 'não entrega de novo'); assert.equal(inst.store.member(m.id).pointsMilli, medals0);
  // nova sessão: contada uma vez só, mesmo rodando várias vezes
  inst.store.start('2', m.id, 'admin', t0 + 3 * 3600000); inst.store.finish('2', 'admin', 'manual', t0 + 4 * 3600000);
  inst.achievements.run(); inst.achievements.run();
  assert.equal(inst.achievements.counters(m.id).sessions, 2); assert.equal(inst.achievements.counters(m.id).seconds, 3 * 3600);
  a = await call('/api/achievements', {name: 'Frequente', metric: 'sessions', target: 2, medals: 0, icon: '🎮'});
  assert.equal(a.list.find(x => x.name === 'Frequente').completed, 1);
  assert.match((await call('/api/achievements', {name: 'Frequente', metric: 'sessions', target: 3, medals: 1}, 400)).error, /Já existe/);
  assert.match((await call('/api/achievements', {name: 'X', metric: 'hours', target: 1}, 400)).error, /Nome/);

  // ligar o app
  assert.match((await call('/api/member-app', {enabled: true, slug: 'Arena X!'}, 400)).error, /Endereço do app/);
  let st = await call('/api/member-app', {enabled: true, slug: 'arena-x'}); assert.equal(st.enabled, true);
  // o laço do Servidor (no uso real roda sozinho; aqui o teste faz as voltas)
  let running = true, replies = [];
  const loop = (async () => { while (running) { try { replies = (await inst.memberApp.cycle(replies)).map(r => inst.memberApp.answer(r)); } catch (e) { if (running) await new Promise(r => setTimeout(r, 50)); } } })();
  t.after(async () => { running = false; inst.memberApp.stop(); await loop; });
  const app = async (action, body, token, status = 200, origin) => { const r = await fetch(s.siteBase + '/api/app/a/arena-x/' + action, {method: 'POST', headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {}), ...(origin ? {Origin: origin} : {})}, body: JSON.stringify(body || {})}); const j = await r.json(); assert.equal(r.status, status, action + ' ' + JSON.stringify(j)); return j; };
  await new Promise(r => setTimeout(r, 100));
  const info = await (await fetch(s.siteBase + '/api/app/a/arena-x/info')).json();
  assert.equal(info.online, true); assert.equal(info.name, 'GameZoney');
  assert.equal((await fetch(s.siteBase + '/api/app/a/nao-existe/info')).status, 404);
  st = await call('/api/member-app'); assert.equal(st.connected, true); assert.equal(st.url, 'https://app.gamezoney.com/arena-x');

  assert.match((await app('login', {username: 'joana', password: 'errada'}, '', 400)).error, /incorretos/);
  const login = await app('login', {username: 'JOANA', password: 'senha12'}, '', 200, 'https://app.gamezoney.com');
  assert.ok(login.token); assert.equal(login.me.username, 'joana'); assert.equal(login.me.balanceSeconds, 60 * 60);
  const me = (await app('me', {}, login.token)).me; assert.equal(me.achievements, 2); assert.equal(me.medals, inst.store.member(m.id).pointsMilli / 1000);
  const stations = (await app('stations', {}, login.token)).stations;
  assert.deepEqual(stations.map(x => [x.name, x.category, x.status]).sort(), [['PC VR 01', 'console', 'offline'], ['PS5 Sala 1', 'console', 'free']]);
  const ach = (await app('achievements', {}, login.token)).achievements; assert.equal(ach.length, 2); assert.ok(ach.every(x => x.done));
  const h = await app('history', {}, login.token); assert.equal(h.sessions.length, 2); assert.equal(h.recharges[0].minutes, 240); assert.ok(h.medals.some(x => x.reason === 'Conquista: Maratonista'));
  assert.doesNotMatch(JSON.stringify(h) + JSON.stringify(me), /passwordHash|cpf/);
  await app('me', {}, 'v1.x.1.y', 401); await app('me', {}, '', 401);
  // senha trocada derruba o token
  inst.store.memberSave({id: m.id, name: 'Joana Silva', username: 'joana', password: 'nova-senha'}, 'admin');
  await app('me', {}, login.token, 401);
  // 5 erros seguidos no mesmo nick = espera
  for (let i = 0; i < 5; i++) await app('login', {username: 'joana', password: 'x' + i}, '', 400);
  assert.match((await app('login', {username: 'joana', password: 'nova-senha'}, '', 429)).error, /Muitas tentativas/);

  // páginas: gamezoney.com/app/<endereço> e app.gamezoney.com/<endereço>
  const page = (p, host) => new Promise((res, rej) => http.get(s.siteBase + p, {headers: host ? {Host: host} : {}}, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res([r.statusCode, b])); }).on('error', rej));
  let [code, html] = await page('/app/arena-x'); assert.equal(code, 200); assert.match(html, /\/app\/app\.js/);
  [code, html] = await page('/arena-x', 'app.gamezoney.com'); assert.equal(code, 200); assert.match(html, /\/app\/app\.js/);
  [code] = await page('/app/app.js', 'app.gamezoney.com'); assert.equal(code, 200);

  // desligar: o app avisa que a arena está sem conexão
  await call('/api/member-app', {enabled: false, slug: 'arena-x'});
  running = false; inst.memberApp.stop(); await loop;
});
