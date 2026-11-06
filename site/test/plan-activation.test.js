'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createApp} = require('../server');

test('2.2: GameZoney Servidor entra com a conta — senha, plano, 1 servidor por conta, renovação, certificado adulterado e sem Origin', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-pa-')), {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519'), mails = [];
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0',
    LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''}, mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, subject, text}); return true; }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const post = async (url, body, status = 200, headers = {}) => { const r = await fetch(base + url, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)}); const j = await r.json(); assert.equal(r.status, status, url + ' ' + JSON.stringify(j)); return j; };
  const cert = tok => { const [b, s] = tok.split('.'); assert.ok(crypto.verify(null, Buffer.from(b, 'base64url'), publicKey, Buffer.from(s, 'base64url'))); return JSON.parse(Buffer.from(b, 'base64url')); };
  await post('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  const pc1 = crypto.randomUUID(), pc2 = crypto.randomUUID();
  await post('/api/plan/login', {email: 'ana@x.com', password: 'senha-forte-1', installId: 'x'}, 400);
  await post('/api/plan/login', {email: 'ana@x.com', password: 'errada', installId: pc1}, 400);
  assert.equal((await post('/api/plan/login', {email: 'ana@x.com', password: 'senha-forte-1', installId: pc1}, 402)).noPlan, true);
  // plano de cortesia direto no banco de teste (o /admin já tem teste próprio)
  const db = require('../db').open(dir); db.run("INSERT INTO subscriptions(id,user_id,plan,period,amount_cents,status,source,paid_until,created_at,updated_at) SELECT 's1', id, 'pro', 'mensal', 0, 'granted', 'admin', ?, ?, ? FROM users WHERE email='ana@x.com'", Date.now() + 20 * 86400000, Date.now(), Date.now()); db.close();
  // vem do GameZoney Servidor (sem Origin do site): permitido; de outro site no navegador: a rota não usa sessão, só e-mail e senha
  const r1 = await post('/api/plan/login', {email: 'ANA@x.com', password: 'senha-forte-1', installId: pc1, machine: 'RECEPCAO'}, 200, {Origin: 'https://evil.com'});
  const c1 = cert(r1.token); assert.deepEqual([c1.v, c1.kind, c1.plan, c1.installId, c1.email], [2, 'plan', 'pro', pc1, 'ana@x.com']); assert.equal(c1.graceUntil - c1.paidUntil, 7 * 86400000);
  const busy = await post('/api/plan/login', {email: 'ana@x.com', password: 'senha-forte-1', installId: pc2, machine: 'NOVO'}, 409); assert.equal(busy.needTransfer, true); assert.equal(busy.machine, 'RECEPCAO');
  const r2 = await post('/api/plan/login', {email: 'ana@x.com', password: 'senha-forte-1', installId: pc2, machine: 'NOVO', transfer: true});
  assert.ok(mails.some(m => m.to === 'ana@x.com' && /outro computador/.test(m.subject)));
  assert.deepEqual(await post('/api/plan/refresh', {token: r1.token, installId: pc1}), {revoked: true, reason: 'moved', machine: 'NOVO'});
  assert.ok(cert((await post('/api/plan/refresh', {token: r2.token, installId: pc2})).token));
  // certificado de outro computador ou adulterado não renova
  await post('/api/plan/refresh', {token: r2.token, installId: pc1}, 401);
  const [b, sg] = r2.token.split('.'), body = JSON.parse(Buffer.from(b, 'base64url')); body.uid = 'outra';
  await post('/api/plan/refresh', {token: Buffer.from(JSON.stringify(body)).toString('base64url') + '.' + sg, installId: pc2}, 401);
  // sair: libera a conta para outro computador sem confirmação
  await post('/api/plan/logout', {token: r2.token, installId: pc2});
  assert.ok((await post('/api/plan/login', {email: 'ana@x.com', password: 'senha-forte-1', installId: pc1})).token);
});
