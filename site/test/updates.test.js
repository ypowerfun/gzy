'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createApp} = require('../server');

test('2.3: atualização do Servidor — só o admin publica, manifesto assinado, download só com plano e link do próprio computador', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-up-')), dl = path.join(dir, 'dl'), {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519'), mails = []; fs.mkdirSync(dl);
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: dl, ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0', LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''},
    mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, text}); return true; }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const client = () => { let c = ''; return async (url, body, status = 200) => { const r = await fetch(base + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: c}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const x of r.headers.getSetCookie?.() || []) { const [kv] = x.split(';'); if (kv.startsWith('gzs=')) c = kv.endsWith('=') ? '' : kv; } const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); try { return JSON.parse(text); } catch { return {text}; } }; };
  const ana = client(), dono = client(), id = crypto.randomUUID();
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'}); await fetch(base + '/api/auth/verify?t=' + mails.find(m => m.to === 'dono@gamezoney.com').text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'});
  const bytes = crypto.randomBytes(5000); fs.writeFileSync(path.join(dl, 'GameZoney-Servidor-1.0.7-Setup.exe'), bytes); fs.writeFileSync(path.join(dl, 'leia.pdf'), 'x'); fs.writeFileSync(path.join(dl, 'GameZoney-Instalador-Servidor-1.0.8-Cliente-1.0.5.exe'), 'unico');
  await ana('/api/admin/updates/publish', {file: 'GameZoney-Servidor-1.0.7-Setup.exe'}, 403);
  assert.deepEqual((await dono('/api/admin/updates')).files.map(f => f.file), ['GameZoney-Servidor-1.0.7-Setup.exe'], 'só o instalador do Servidor aparece (o único fica de fora: em modo silencioso poderia instalar o Cliente na recepção)');
  await dono('/api/admin/updates/publish', {file: 'GameZoney-Instalador-Servidor-1.0.8-Cliente-1.0.5.exe'}, 404);
  assert.equal((await ana('/api/update/check', {installId: id, version: '1.0.6'})).available, false, 'nada publicado');
  await dono('/api/admin/updates/publish', {file: 'GameZoney-Servidor-1.0.7-Setup.exe', notes: 'Novidades'});
  await ana('/api/update/check', {installId: 'x', version: '1.0.6'}, 400);
  assert.equal((await ana('/api/update/check', {installId: id, version: '1.0.7'})).available, false, 'mesma versão');
  const c = await ana('/api/update/check', {installId: id, version: '1.0.6'});
  assert.equal(c.available, true); assert.equal(c.download, null); assert.equal(c.reason, 'plan');
  const [b, sg] = c.manifest.split('.'); assert.ok(crypto.verify(null, Buffer.from(b, 'base64url'), publicKey, Buffer.from(sg, 'base64url')));
  const m = JSON.parse(Buffer.from(b, 'base64url')); assert.deepEqual([m.kind, m.product, m.version, m.sha256], ['update', 'servidor', '1.0.7', crypto.createHash('sha256').update(bytes).digest('hex')]);
  // com plano e certificado deste computador: recebe link de 30 min, só deste computador
  const db = require('../db').open(dir); db.run("INSERT INTO subscriptions(id,user_id,plan,period,amount_cents,status,source,paid_until,created_at,updated_at) SELECT 's1', id, 'standard', 'mensal', 0, 'granted', 'admin', ?, ?, ? FROM users WHERE email='ana@x.com'", Date.now() + 9e8, Date.now(), Date.now()); db.close();
  const tok = (await ana('/api/plan/login', {email: 'ana@x.com', password: 'senha-forte-1', installId: id})).token;
  const c2 = await ana('/api/update/check', {installId: id, version: '1.0.6', token: tok}); assert.match(c2.download, /^\/api\/update\/file\?i=/);
  assert.equal((await ana('/api/update/check', {installId: crypto.randomUUID(), version: '1.0.6', token: tok})).download, null, 'certificado de outro computador');
  const r = await fetch(base + c2.download); assert.equal(r.status, 200); assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes);
  assert.equal((await fetch(base + c2.download.replace(/i=[^&]+/, 'i=' + crypto.randomUUID()))).status, 403, 'link de outro computador');
  // retirar a publicação
  await dono('/api/admin/updates/unpublish', {}); assert.equal((await ana('/api/update/check', {installId: id, version: '1.0.6'})).available, false);
});
