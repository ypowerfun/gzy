'use strict';
// 2.8: Pixel da Meta e tag do Google — IDs validados, CSP só liberada com ID, marca de cadastro e só admin configura
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createApp} = require('../server');

test('2.8: Pixel/Google desligados por padrão; admin configura IDs válidos; CSP libera Meta/Google só depois; cadastro deixa a marca do evento', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-trk-')), mails = [];
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0', MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''},
    mail: {enabled: true, send: async (to, s, text) => { mails.push({to, text}); return true; }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }), base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const client = () => { let c = ''; return async (url, body, status = 200) => { const r = await fetch(base + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: c}, body: body === undefined ? undefined : JSON.stringify(body)});
    const set = r.headers.getSetCookie?.() || []; for (const x of set) { const [kv] = x.split(';'); if (kv.startsWith('gzs=')) c = kv.endsWith('=') ? '' : kv; }
    const text = await r.text(); assert.equal(r.status, status, url + ' ' + text.slice(0, 200)); let j = {}; try { j = JSON.parse(text); } catch { } return {j, r, set}; }; };
  const anon = client(), dono = client(), ana = client();
  const csp = async u => (await fetch(base + u)).headers.get('content-security-policy');
  // desligado: nada da Meta/Google
  assert.equal((await anon('/api/config')).j.tracking, null);
  assert.ok(!/facebook|googletagmanager/.test(await csp('/')));
  // cadastro deixa a marca do evento (lida pelo tracking.js só se o visitante aceitar os cookies)
  const reg = await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  assert.ok(reg.set.some(c => /^gzev=signup;.*Max-Age=600/.test(c) && !/HttpOnly/i.test(c)));
  // só admin configura; IDs validados
  await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  await fetch(base + '/api/auth/verify?t=' + mails.find(m => m.to === 'dono@gamezoney.com').text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'});
  await ana('/api/admin/tracking', {meta: '123456789012345'}, 403);
  await dono('/api/admin/tracking', {meta: '12345"><script>'}, 400);
  await dono('/api/admin/tracking', {google: 'G-ABC123</script>'}, 400);
  await dono('/api/admin/tracking', {googleSignup: 'AW-123/x y'}, 400);
  const saved = (await dono('/api/admin/tracking', {meta: '123456789012345', google: 'G-ABCD1234EF, AW-987654321', googleSignup: 'AW-987654321/AbCdEf12'})).j.tracking;
  assert.deepEqual(saved, {meta: '123456789012345', google: ['G-ABCD1234EF', 'AW-987654321'], googleSignup: 'AW-987654321/AbCdEf12', googlePurchase: ''});
  assert.deepEqual((await anon('/api/config')).j.tracking.google, ['G-ABCD1234EF', 'AW-987654321']);
  // CSP liberada para Meta e Google (inclusive na página de compra com Mercado Pago)
  const p = await csp('/');
  for (const d of ['script-src', 'connect-src', 'img-src', 'frame-src']) assert.match(p, new RegExp(`${d} [^;]*googletagmanager`), d);
  assert.match(p, /script-src 'self' https:\/\/connect.facebook.net/); assert.match(p, /object-src 'none'/);
  // páginas públicas carregam o script; o /admin não
  assert.match(await (await fetch(base + '/')).text(), /<script src="\/tracking.js\?v=/);
  assert.ok(!(await (await fetch(base + '/admin')).text()).includes('/tracking.js'));
  // contêiner do Google Tag Manager também é aceito
  assert.deepEqual((await dono('/api/admin/tracking', {google: 'GTM-5X7WMDC4'})).j.tracking.google, ['GTM-5X7WMDC4']);
  await dono('/api/admin/tracking', {google: 'GTM-5X7"><'}, 400);
  // desligar de novo
  await dono('/api/admin/tracking', {meta: '', google: ''}); assert.equal((await anon('/api/config')).j.tracking, null); assert.ok(!/facebook/.test(await csp('/')));
});
