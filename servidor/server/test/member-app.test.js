'use strict';
// 1.3.7 (plano Pro): app do cliente (app.gamezoney.com) e Conquistas — ponta a ponta com o site de verdade:
// o Servidor liga-se ao site (relay), o celular entra com nick e senha, vê saldo, estações, conquistas e histórico.
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), http = require('node:http'), zlib = require('node:zlib');
// PNG de teste (cor sólida) para a logo da arena
function png(w, h, rgb) {
  const crcT = Array.from({length: 256}, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = 255; }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const dataUrl = b => 'data:image/png;base64,' + b.toString('base64');
const {createServer} = require('../server');
let createApp; try { ({createApp} = require('../../../site/server')); } catch { }

async function boot(t) {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519'), pub = publicKey.export({type: 'spki', format: 'pem'});
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-app-site-')), mails = [];
  const site = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, appHoldMs: 300, panelHosts: ['127.0.0.1'], env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: siteDir, DOWNLOADS_DIR: path.join(siteDir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0',
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
  // 1.3.9: Ranking no app — os mesmos Top 10 do painel, só com nicks (sem nome completo nem valores em R$)
  const rk = await app('ranking', {}, login.token), panelRk = await call('/api/ranking');
  assert.deepEqual(rk.medals.map(x => [x.nick, x.value]), panelRk.medals.map(x => [x.username, x.medalsMilli / 1000]));
  assert.equal(rk.medals[0].nick, 'joana'); assert.equal(rk.medals[0].me, true); assert.equal(rk.recharges[0].value, 1); assert.equal(rk.me, 'joana');
  assert.ok(rk.medals.length <= 10 && rk.participations.length <= 10 && rk.recharges.length <= 10);
  assert.doesNotMatch(JSON.stringify(rk), /Joana Silva|cents|memberId/);
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

  // Personalizar visual: a logo e a cor que a arena envia aparecem no app do link dela; trocar a logo troca no app; voltar ao padrão tira
  const info2 = async () => (await fetch(s.siteBase + '/api/app/a/arena-x/info')).json();
  const until = async (ok, what) => { for (let i = 0; i < 80; i++) { const v = await info2(); if (ok(v)) return v; await new Promise(r => setTimeout(r, 50)); } assert.fail('o app não atualizou: ' + what); };
  const logoOf = async rev => { const r = await fetch(s.siteBase + '/api/app/a/arena-x/logo?v=' + encodeURIComponent(rev)); return [r.status, r.headers.get('content-type'), Buffer.from(await r.arrayBuffer())]; };
  assert.equal((await info2()).logo, false, 'sem Personalizar visual: ícone GZ');
  const logoA = png(64, 64, [200, 30, 30]), logoB = png(96, 96, [30, 200, 90]);
  await call('/api/branding', {color: '#2f7bff', serverLogo: dataUrl(logoA), sameLogo: true});
  const a1 = await until(v => v.logo && v.color === '#2f7bff', 'logo A e cor azul');
  let [st1, ct1, img1] = await logoOf(a1.logoRev); assert.equal(st1, 200); assert.equal(ct1, 'image/png'); assert.ok(img1.equals(logoA), 'app mostra a logo enviada');
  await call('/api/branding', {color: '#2f7bff', clientLogo: dataUrl(logoB)}); // troca só a logo dos PCs (a do app)
  const a2 = await until(v => v.logo && v.logoRev !== a1.logoRev, 'logo nova');
  [st1, , img1] = await logoOf(a2.logoRev); assert.equal(st1, 200); assert.ok(img1.equals(logoB), 'app mostra a logo NOVA depois da troca');
  await call('/api/branding/reset', {});
  const a3 = await until(v => !v.logo && v.color === '', 'voltar ao padrão');
  assert.equal(a3.logoRev, ''); assert.equal((await logoOf('x'))[0], 404, 'padrão GameZoney: sem logo da arena (o app volta ao ícone GZ)');

  // desligar: o app avisa que a arena está sem conexão
  await call('/api/member-app', {enabled: false, slug: 'arena-x'});
  running = false; inst.memberApp.stop(); await loop;
});

test('1.4.1: app da recepção (Pro) — painel de fora pelo site, sem Configuração/Gerenciar App, sessão própria e limites', {skip: !createApp && 'site não encontrado'}, async t => {
  const s = await boot(t); const ana = s.web();
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@arena.com', password: 'senha-forte-1'});
  await s.dono('/api/admin/subscriptions/grant', {email: 'ana@arena.com', plan: 'standard', months: 1});
  const loja = await s.gz(); const {inst, call} = loja;
  await call('/api/license/login', {email: 'ana@arena.com', password: 'senha-forte-1'});
  assert.match((await call('/api/remote-panel', {enabled: true}, 400)).error, /plano Pro/);
  await s.dono('/api/admin/subscriptions/grant', {email: 'ana@arena.com', plan: 'pro', months: 1});
  await call('/api/license/refresh', {});
  assert.match((await call('/api/remote-panel', {enabled: true}, 400)).error, /endereço na aba App do cliente/);
  await call('/api/member-app', {enabled: false, slug: 'arena-r'}); // só o endereço: o app do cliente fica desligado
  let st = await call('/api/remote-panel', {enabled: true, who: 'all'}); assert.equal(st.enabled, true);
  assert.match((await call('/api/member-app', {enabled: false, slug: ''}, 400)).error, /app da recepção usa este endereço/);
  let running = true, replies = [];
  const loop = (async () => { while (running) { try { replies = inst.memberApp.serve(await inst.memberApp.cycle(replies)); } catch (e) { if (running) await new Promise(r => setTimeout(r, 50)); } } })();
  t.after(async () => { running = false; inst.memberApp.stop(); await loop; });
  await new Promise(r => setTimeout(r, 150));

  const origin = s.siteBase; let jar = '';
  const rp = async (p, body, status = 200, headers = {}) => {
    const r = await fetch(s.siteBase + '/servidor/arena-r' + p, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Origin: origin, ...(jar ? {Cookie: jar} : {}), ...headers}, body: body === undefined ? undefined : JSON.stringify(body)});
    const sc = r.headers.getSetCookie?.() || []; for (const c of sc) if (c.startsWith('gz_session=')) jar = c.split(';')[0];
    const buf = Buffer.from(await r.arrayBuffer()); assert.equal(r.status, status, p + ' ' + buf.toString().slice(0, 200));
    return {r, buf, sc, json: () => JSON.parse(buf.toString())};
  };
  // página e arquivos do painel, com <base> no endereço de fora e CSP rígida
  let x = await rp('', undefined, 302); assert.equal(x.r.headers.get('location'), '/servidor/arena-r/');
  x = await rp('/'); const html = x.buf.toString();
  assert.match(html, /<base href="\/servidor\/arena-r\/">/); assert.match(html, /name="gz-remote"/); assert.match(html, /src="app\.js"/); assert.doesNotMatch(html.replace(/<base[^>]*>/, ''), /(src|href)="\//, 'endereços relativos');
  assert.match(x.r.headers.get('content-security-policy'), /script-src 'self';/); assert.match(x.r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  x = await rp('/app.js'); assert.match(x.buf.toString(), /GZ_REMOTE/); assert.match(x.r.headers.get('content-type'), /javascript/);
  x = await rp('/remote-ui.js'); assert.match(x.buf.toString(), /Conectado pelo app da recepção/);
  // fora do painel: nada
  await rp('/pc/state', undefined, 404); await rp('/cliente.html', undefined, 404); await rp('/internal/stop', {}, 404); await rp('/pc-setup/request', {}, 404);
  // sem login
  assert.match((await rp('/api/state', undefined, 401)).json().error, /Entre/);
  // a sessão do painel do servidor NÃO vale de fora
  const lr = await fetch(inst.server.address().port ? 'http://127.0.0.1:' + inst.server.address().port + '/api/login' : '', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'admin', password: 'senha123'})});
  const localCookie = lr.headers.get('set-cookie').split(';')[0];
  await rp('/api/state', undefined, 401, {Cookie: localCookie});
  // POST de outra origem: recusado no site
  await rp('/api/login', {username: 'admin', password: 'senha123'}, 403, {Origin: 'https://ataque.example'});
  // senha errada: 401 e Log com o IP
  await rp('/api/login', {username: 'admin', password: 'errada'}, 401);
  assert.ok(inst.store.db.prepare("SELECT COUNT(*) n FROM logs WHERE detail LIKE '%app da recepção, IP%'").get().n > 0);
  // login certo: cookie só neste endereço
  x = await rp('/api/login', {username: 'admin', password: 'senha123'});
  assert.match(x.sc.join('\n'), /gz_session=[a-f0-9]{64}; Path=\/servidor\/arena-r\/; HttpOnly; SameSite=Strict/);
  const remoteCookie = jar;
  assert.deepEqual([(await rp('/api/auth')).json().remote, (await rp('/api/auth')).json().operator.username], [true, 'admin']);
  const state = (await rp('/api/state')).json(); assert.ok(Array.isArray(state.stations));
  assert.equal(inst.store.db.prepare("SELECT COUNT(*) n FROM logs WHERE detail LIKE 'Operador entrou pelo app da recepção%'").get().n, 1);
  // a sessão de fora NÃO vale no servidor
  assert.equal((await fetch('http://127.0.0.1:' + inst.server.address().port + '/api/state', {headers: {Cookie: remoteCookie}})).status, 401);
  // Configuração e Gerenciar App: bloqueados mesmo chamando a rota direto
  for (const [p, b] of [['/api/operators'], ['/api/member-app', {enabled: false, slug: 'x'}], ['/api/remote-panel', {enabled: false}], ['/api/remote-panel/disconnect', {}], ['/api/backup', {}], ['/api/branding'],
    ['/api/license/logout', {}], ['/api/achievements'], ['/api/network'], ['/api/self-service'], ['/api/machine-settings', {}], ['/api/setup', {username: 'x', password: '1234'}], ['/api/update']])
    assert.match((await rp(p, b, 403)).json().error, /Configuração e Gerenciar App/, p);
  assert.match((await rp('/api/settings', {serverUrl: 'http://1.2.3.4:3000'}, 400)).json().error, /endereço do servidor/);
  // o resto do painel funciona: cadastro de cliente e planilha (binário)
  await rp('/api/members', {name: 'Cliente Remoto', username: 'remoto'});
  assert.ok(loja.state.members.some(m => m.username === 'remoto'));
  x = await rp('/api/members/export.xlsx'); assert.match(x.r.headers.get('content-disposition'), /attachment/); assert.equal(x.buf.subarray(0, 2).toString(), 'PK');
  // sem cookie de outro endereço/host: o painel só existe no app.gamezoney.com
  const other = await new Promise((res, rej) => http.get(s.siteBase + '/servidor/arena-r/', {headers: {Host: 'gamezoney.com'}}, r => { r.resume(); res(r.statusCode); }).on('error', rej));
  assert.equal(other, 404);
  // cabeçalho secreto falso direto no servidor: não passa
  assert.equal((await fetch('http://127.0.0.1:' + inst.server.address().port + '/api/state', {headers: {'x-gz-remote': 'chute', Cookie: remoteCookie}})).status, 404);
  // só administradores: operador não entra de fora
  await call('/api/operators', {username: 'caixa', password: 'caixa123', role: 'operator'});
  await call('/api/remote-panel', {enabled: true, who: 'admins'});
  jar = ''; assert.match((await rp('/api/login', {username: 'caixa', password: 'caixa123'}, 403)).json().error, /só para administradores/);
  // 5 senhas erradas no mesmo usuário = espera (mesmo com a certa depois)
  for (let i = 0; i < 5; i++) await rp('/api/login', {username: 'admin', password: 'x' + i}, 401);
  assert.match((await rp('/api/login', {username: 'admin', password: 'senha123'}, 429)).json().error, /Muitas tentativas/);
  // desconectar todos derruba a sessão de fora
  jar = remoteCookie; await rp('/api/state');
  st = await call('/api/remote-panel/disconnect', {}); assert.equal(st.disconnected, 1);
  await rp('/api/state', undefined, 401);
  // desligar: o endereço do painel deixa de responder
  await call('/api/remote-panel', {enabled: false});
  x = await rp('/', undefined, 404); assert.match(x.buf.toString(), /desligado/);
  running = false; inst.memberApp.stop(); await loop;
});
