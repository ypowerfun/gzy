'use strict';
// 2.5: verificação em duas etapas do /admin — código de 6 dígitos por e-mail, preso à sessão, 10 min, 5 tentativas, vale 12 h
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createApp} = require('../server');

test('2.5: /admin só abre com a senha E o código enviado ao e-mail desta sessão', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-mfa-')), mails = [], logs = [];
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com',
    LICENSE_PRIVATE_KEY: crypto.generateKeyPairSync('ed25519').privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''},
    mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, subject, text}); return true; }}, log: {log: m => logs.push(m), error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }), base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const client = () => { let c = ''; return async (url, body, status = 200) => {
    const r = await fetch(base + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: c}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const x of r.headers.getSetCookie?.() || []) { const [kv] = x.split(';'); if (kv.startsWith('gzs=')) c = kv.endsWith('=') ? '' : kv; }
    const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); return text ? JSON.parse(text) : {}; }; };
  const codeOf = () => mails.filter(m => /código de acesso/i.test(m.subject)).at(-1).text.match(/\b(\d{6})\b/)[1];
  const dono = client(), ana = client();
  await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  await fetch(base + '/api/auth/verify?t=' + mails.find(m => m.to === 'dono@gamezoney.com').text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'});
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  // senha certa, sem código: não entra; o link Admin continua aparecendo na conta
  assert.equal((await dono('/api/admin/overview', undefined, 403)).needCode, true);
  const me = await dono('/api/me'); assert.equal(me.admin, true); assert.equal(me.adminVerified, false);
  // quem não é admin não pede código
  await ana('/api/auth/admin-code/send', {}, 403); assert.equal((await ana('/api/admin/overview', undefined, 403)).needCode, undefined);
  // pede o código: chega por e-mail, vale só nesta sessão
  const s1 = await dono('/api/auth/admin-code/send', {}); assert.equal(s1.sent, true); assert.match(s1.to, /^do\*\*\*@gamezoney\.com$/);
  const code = codeOf(); assert.ok(!logs.some(l => l.includes(code)), 'com e-mail funcionando o código não vai para o registro');
  await dono('/api/auth/admin-code/verify', {code: code === '000000' ? '111111' : '000000'}, 400);
  const outra = client(); await outra('/api/auth/login', {email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  await outra('/api/auth/admin-code/verify', {code}, 400); // código de outra sessão não vale
  await dono('/api/auth/admin-code/verify', {code});
  assert.ok((await dono('/api/admin/overview')).stats); assert.equal((await dono('/api/me')).adminVerified, true);
  await outra('/api/admin/overview', undefined, 403);
  await dono('/api/auth/admin-code/verify', {code}, 400); // código usado não vale de novo
  // 5 tentativas erradas invalidam o código
  await outra('/api/auth/admin-code/send', {}); const c2 = codeOf(), wrong = c2 === '123456' ? '654321' : '123456';
  for (let i = 0; i < 4; i++) await outra('/api/auth/admin-code/verify', {code: wrong}, 400);
  await outra('/api/auth/admin-code/verify', {code: wrong}, 429); await outra('/api/auth/admin-code/verify', {code: c2}, 400);
  // sair encerra a liberação
  await dono('/api/auth/logout', {}); await dono('/api/auth/login', {email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  assert.equal((await dono('/api/admin/overview', undefined, 403)).needCode, true);
  assert.ok(mails.filter(m => /código de acesso/i.test(m.subject)).every(m => m.to === 'dono@gamezoney.com'));
});

test('2.5: sem e-mail funcionando, o código vai para o registro do site na VPS (o dono não fica trancado para fora)', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-mfa2-')), logs = [];
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com',
    LICENSE_PRIVATE_KEY: '', MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''}, mail: {enabled: false, send: async () => false}, log: {log: m => logs.push(String(m)), error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }), base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  let c = ''; const call = async (url, body, status = 200) => { const r = await fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: c}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const x of r.headers.getSetCookie?.() || []) { const [kv] = x.split(';'); if (kv.startsWith('gzs=')) c = kv; } const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); return JSON.parse(text || '{}'); };
  await call('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  const db = require('../db').open(dir); db.run("UPDATE users SET email_verified=1"); db.close();
  const r = await call('/api/auth/admin-code/send', {}); assert.equal(r.sent, false);
  const code = logs.join('\n').match(/administração para dono@gamezoney\.com: (\d{6})/)[1];
  await call('/api/auth/admin-code/verify', {code}); assert.ok((await call('/api/admin/overview')).stats);
});
