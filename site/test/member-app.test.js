'use strict';
// Servidor 1.3.7: app do cliente (app.gamezoney.com) — regras do repasse no site, com uma arena simulada.
// (o teste ponta a ponta com o GameZoney Servidor de verdade fica em servidor/server/test/member-app.test.js)
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), http = require('node:http');
const {createApp} = require('../server');

test('1.3.7: app do cliente — só Pro, endereço de uma conta só, arena sem conexão, pedidos repassados e páginas do app', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-app-')), {privateKey} = crypto.generateKeyPairSync('ed25519');
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, appHoldMs: 200, appReplyMs: 1500, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0',
    LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: '', APP_URL: 'https://app.gamezoney.com'}, mail: {enabled: false, send: async () => true}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { app.locals.close(); server.closeAllConnections?.(); server.close(); fs.rmSync(dir, {recursive: true, force: true, maxRetries: 5}); });
  const post = async (url, body, status = 200, headers = {}) => { const r = await fetch(base + url, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)}); const j = await r.json(); assert.equal(r.status, status, url + ' ' + JSON.stringify(j)); return j; };
  const db = require('../db').open(dir);
  const grant = (email, plan) => db.run("INSERT INTO subscriptions(id,user_id,plan,period,amount_cents,status,source,paid_until,created_at,updated_at) SELECT ?, id, ?, 'mensal', 0, 'granted', 'admin', ?, ?, ? FROM users WHERE email=?", crypto.randomUUID(), plan, Date.now() + 30 * 864e5, Date.now(), Date.now(), email);
  const arena = async (email, plan) => {
    await post('/api/auth/register', {name: email, email, password: 'senha-forte-1'}); grant(email, plan);
    const installId = crypto.randomUUID(), {token} = await post('/api/plan/login', {email, password: 'senha-forte-1', installId});
    return {installId, token};
  };
  const std = await arena('std@a.com', 'standard'), pro = await arena('pro@a.com', 'pro'), outra = await arena('outra@a.com', 'pro');
  const relay = (a, slug, extra = {}, status = 200) => post('/api/app/relay', {token: a.token, installId: a.installId, slug, info: {name: 'Arena <b>X</b>', color: '#3366FF', logoRev: ''}, ...extra}, status);
  assert.match((await relay(std, 'arena-std', {}, 402)).error, /plano Pro/);
  assert.match((await relay(pro, 'Arena X', {}, 400)).error, /Endereço/);
  assert.match((await relay({...pro, installId: outra.installId}, 'arena-x', {}, 401)).error, /Certificado/);
  // 1º contato volta na hora (hello)
  let r = await relay(pro, 'arena-x', {hello: true}); assert.deepEqual(r.requests, []); assert.equal(r.url, 'https://app.gamezoney.com/arena-x');
  assert.match((await relay(outra, 'arena-x', {hello: true}, 409)).error, /outra arena/);
  const info = await (await fetch(base + '/api/app/a/arena-x/info')).json(); assert.equal(info.name, 'Arena <b>X</b>'); assert.equal(info.color, '#3366ff'); assert.equal(info.online, true);

  // celular pede, a arena (simulada) responde no POST seguinte; a ação e o token chegam; nada fica gravado no site
  const phone = fetch(base + '/api/app/a/arena-x/me', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer tok123', Origin: 'https://app.gamezoney.com'}, body: '{}'});
  r = await relay(pro, 'arena-x'); assert.equal(r.requests.length, 1); const q = r.requests[0];
  assert.deepEqual([q.action, q.auth], ['me', 'Bearer tok123']);
  const back = relay(pro, 'arena-x', {replies: [{id: q.id, status: 200, data: {me: {name: 'Joana', medals: 3}}}]});
  const pr = await phone; assert.equal(pr.status, 200); assert.deepEqual(await pr.json(), {me: {name: 'Joana', medals: 3}}); await back;
  assert.doesNotMatch(JSON.stringify(db.all('SELECT * FROM app_arenas')), /Joana|tok123/);
  // ação desconhecida e arena que não responde a tempo
  await post('/api/app/a/arena-x/apagar', {}, 404);
  const slow = post('/api/app/a/arena-x/stations', {}, 504); await relay(pro, 'arena-x'); assert.match((await slow).error, /não respondeu/);
  // trocou o endereço: o antigo deixa de existir
  await relay(pro, 'arena-nova', {hello: true});
  assert.equal((await fetch(base + '/api/app/a/arena-x/info')).status, 404);
  // a outra conta pega o endereço livre; sem a ligação (desligado há mais de 1 min) = sem conexão
  await relay(outra, 'arena-x', {hello: true});
  db.run("UPDATE app_arenas SET updated_at=0"); app.locals.memberApp.stop();
  assert.match((await post('/api/app/a/arena-x/login', {username: 'a', password: 'b'}, 503)).error, /sem conexão/);

  // páginas: gamezoney.com/app/<endereço> e app.gamezoney.com/<endereço>
  const page = (p, host) => new Promise((res, rej) => http.get(base + p, {headers: host ? {Host: host} : {}}, x => { let b = ''; x.on('data', d => b += d); x.on('end', () => res([x.statusCode, b])); }).on('error', rej));
  for (const [p, host] of [['/app/arena-x'], ['/app/'], ['/arena-x', 'app.gamezoney.com'], ['/', 'app.gamezoney.com']]) { const [code, html] = await page(p, host); assert.equal(code, 200, p); assert.match(html, /\/app\/app\.js/); }
  assert.equal((await page('/app/app.js', 'app.gamezoney.com'))[0], 200);
  assert.equal((await page('/logo-gamezoney.png', 'app.gamezoney.com'))[0], 200);
  db.close?.();
});

test('1.4.1: app da recepção — repasse do painel só no app.gamezoney.com, origem própria, cookie preso ao endereço e gzip', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-panel-')), {privateKey} = crypto.generateKeyPairSync('ed25519');
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, appHoldMs: 200, appReplyMs: 1500, panelReplyMs: 1500, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0',
    LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: '', APP_URL: 'https://app.gamezoney.com'}, mail: {enabled: false, send: async () => true}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const port = server.address().port, base = 'http://127.0.0.1:' + port;
  t.after(() => { app.locals.close(); server.closeAllConnections?.(); server.close(); fs.rmSync(dir, {recursive: true, force: true, maxRetries: 5}); });
  const post = async (url, body, status = 200) => { const r = await fetch(base + url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}); const j = await r.json(); assert.equal(r.status, status, url + ' ' + JSON.stringify(j)); return j; };
  const db = require('../db').open(dir);
  await post('/api/auth/register', {name: 'pro', email: 'pro@a.com', password: 'senha-forte-1'});
  db.run("INSERT INTO subscriptions(id,user_id,plan,period,amount_cents,status,source,paid_until,created_at,updated_at) SELECT ?, id, 'pro', 'mensal', 0, 'granted', 'admin', ?, ?, ? FROM users WHERE email=?", crypto.randomUUID(), Date.now() + 864e5 * 30, Date.now(), Date.now(), 'pro@a.com');
  const installId = crypto.randomUUID(), {token} = await post('/api/plan/login', {email: 'pro@a.com', password: 'senha-forte-1', installId});
  const relay = extra => post('/api/app/relay', {token, installId, slug: 'arena-p', info: {name: 'P'}, ...extra});
  await relay({hello: true});
  // pedido HTTP cru (para escolher o Host como o Caddy entrega)
  const req = (p, {method = 'GET', host = 'app.gamezoney.com', headers = {}, body} = {}) => new Promise((res, rej) => {
    const r = http.request({host: '127.0.0.1', port, path: p, method, headers: {Host: host, ...headers}}, x => { const c = []; x.on('data', d => c.push(d)); x.on('end', () => res({status: x.statusCode, headers: x.headers, body: Buffer.concat(c)})); });
    r.on('error', rej); r.end(body);
  });
  assert.equal((await req('/servidor/arena-p/', {host: 'gamezoney.com'})).status, 404, 'só no app.gamezoney.com');
  let x = await req('/servidor/arena-p'); assert.equal(x.status, 302); assert.equal(x.headers.location, '/servidor/arena-p/');
  assert.equal((await req('/servidor/nao-existe/')).status, 404);
  // POST sem a origem do próprio app: recusado antes de chegar à arena
  assert.equal((await req('/servidor/arena-p/api/login', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://gamezoney.com'}, body: '{}'})).status, 403);
  // a arena recebe método, caminho, corpo e SÓ o cookie do painel; devolve gzip + cookie
  const pending = req('/servidor/arena-p/api/login?x=1', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://app.gamezoney.com', 'Accept-Encoding': 'gzip', Cookie: 'gzs=conta-do-site; gz_session=' + 'a'.repeat(64)}, body: '{"username":"admin"}'});
  const got = await relay(); assert.equal(got.requests.length, 1); const q = got.requests[0];
  assert.equal(q.action, 'http'); assert.equal(q.body.method, 'POST'); assert.equal(q.body.path, '/api/login?x=1'); assert.equal(q.body.session, 'a'.repeat(64));
  assert.equal(Buffer.from(q.body.body, 'base64').toString(), '{"username":"admin"}'); assert.doesNotMatch(JSON.stringify(q), /conta-do-site/);
  const zipped = require('node:zlib').gzipSync('{"ok":true}');
  await relay({replyOnly: true, replies: [{id: q.id, status: 200, data: {status: 200, gzip: true, body: zipped.toString('base64'), headers: {'content-type': 'application/json', 'set-cookie': ['gz_session=' + 'b'.repeat(64) + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=315360000', 'outro=1; Path=/']}}}]});
  x = await pending; assert.equal(x.status, 200); assert.equal(x.headers['content-encoding'], 'gzip'); assert.equal(require('node:zlib').gunzipSync(x.body).toString(), '{"ok":true}');
  assert.deepEqual(x.headers['set-cookie'], ['gz_session=' + 'b'.repeat(64) + '; Path=/servidor/arena-p/; HttpOnly; SameSite=Strict; Max-Age=2592000; Secure']);
  assert.match(x.headers['content-security-policy'], /script-src 'self';/);
  // navegador sem gzip: o site descompacta
  const p2 = req('/servidor/arena-p/style.css');
  const q2 = (await relay()).requests[0]; assert.equal(q2.body.method, 'GET');
  await relay({replyOnly: true, replies: [{id: q2.id, status: 200, data: {status: 200, gzip: true, body: require('node:zlib').gzipSync('body{}').toString('base64'), headers: {'content-type': 'text/css'}}}]});
  x = await p2; assert.equal(x.headers['content-encoding'], undefined); assert.equal(x.body.toString(), 'body{}');
  // arena que não responde: página de aviso
  x = await req('/servidor/arena-p/'); assert.equal(x.status, 504); assert.match(x.body.toString(), /Servidor da arena está aberto/);
  db.close?.();
});
