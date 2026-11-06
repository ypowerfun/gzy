'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createApp} = require('../server');

async function boot(t, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-c-')); const mails = [];
  const app = createApp({campaignIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: '', ...env},
    mail: {enabled: true, send: async (to, subject, text, opts) => { mails.push({to, subject, text, html: opts && opts.html, headers: opts && opts.headers}); return !to.startsWith('falha'); }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const client = () => { let cookie = ''; return async (url, body, status = 200) => {
    const r = await fetch(base + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); if (kv.startsWith('gzs=')) cookie = kv.endsWith('=') ? '' : kv; }
    const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); try { return JSON.parse(text); } catch { return {text}; } }; };
  const confirm = async email => { const m = [...mails].reverse().find(x => x.to === email && /verify\?t=/.test(x.text)); await fetch(base + '/api/auth/verify?t=' + m.text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'}); };
  const drain = async () => { let n = 0; while (await app.locals.campaignTick()) n++; return n; };
  return {base, client, mails, confirm, drain};
}

test('1.8: e-mails da conta saem com o visual GameZoney (HTML) e o texto simples', async t => {
  const s = await boot(t); const ana = s.client();
  await ana('/api/auth/register', {name: 'Ana <b>', email: 'ana@x.com', password: 'senha-forte-1'});
  const m = s.mails.find(x => x.to === 'ana@x.com');
  assert.match(m.text, /verify\?t=[a-f0-9]+/); assert.match(m.html, /logo-gamezoney\.png/); assert.match(m.html, /Confirmar e-mail/);
  assert.match(m.html, /nunca envia e-mails pedindo/); assert.match(m.html, /Ana &lt;b&gt;/, 'nome escapado'); assert.doesNotMatch(m.html, /Ana <b>/);
});

test('1.8: comunicados — só admin, fila um por pessoa, {nome}, cancelar inscrição e Minha conta', async t => {
  const s = await boot(t); const ana = s.client(), bia = s.client(), caio = s.client(), dono = s.client();
  await ana('/api/auth/register', {name: 'Ana Souza', email: 'ana@x.com', password: 'senha-forte-1'}); await s.confirm('ana@x.com');
  await bia('/api/auth/register', {name: 'Bia', email: 'bia@x.com', password: 'senha-forte-2'});
  await caio('/api/auth/register', {name: 'Caio', email: 'falha@x.com', password: 'senha-forte-3'});
  await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'}); await s.confirm('dono@gamezoney.com');
  const msg = {subject: 'Promo para {nome}', title: 'Black Friday', body: 'Olá, {nome}!\n\nAproveite: https://gamezoney.com/#precos', buttonLabel: 'Comprar', buttonUrl: 'https://gamezoney.com/conta#comprar'};
  await ana('/api/admin/campaigns', msg, 403); await ana('/api/admin/campaigns/preview', msg, 403);
  await dono('/api/admin/campaigns', {...msg, buttonUrl: 'javascript:alert(1)'}, 400);
  await dono('/api/admin/campaigns', {...msg, image: 'https://evil.com/x.png'}, 400);
  await dono('/api/admin/campaigns', {...msg, body: ''}, 400);
  let info = await dono('/api/admin/campaigns'); assert.deepEqual(info.audience, {all: 4, verified: 2, optedOut: 0});
  const pv = await dono('/api/admin/campaigns/preview', msg); assert.match(pv.html, /Olá, Dono!/); assert.match(pv.html, /Cancelar inscrição/);
  const before = s.mails.length; await dono('/api/admin/campaigns/test', msg); assert.equal(s.mails.at(-1).to, 'dono@gamezoney.com'); assert.match(s.mails.at(-1).subject, /^\[TESTE\]/); assert.equal(s.mails.length, before + 1);
  // Bia cancela a inscrição pelo próprio Minha conta
  await bia('/api/profile', {name: 'Bia', phone: '', organization: '', marketing: false}); assert.equal((await bia('/api/me')).user.marketing, false);
  info = await dono('/api/admin/campaigns'); assert.equal(info.audience.optedOut, 1); assert.equal(info.audience.all, 3);
  const c = (await dono('/api/admin/campaigns', msg)).campaign; assert.equal(c.total, 3); assert.equal(c.status, 'sending');
  await dono('/api/admin/campaigns', msg, 409);
  assert.equal(await s.drain(), 3);
  const got = s.mails.slice(before + 1).filter(m => m.subject.startsWith('Promo'));
  assert.deepEqual(got.map(m => m.to).sort(), ['ana@x.com', 'dono@gamezoney.com', 'falha@x.com']);
  const toAna = got.find(m => m.to === 'ana@x.com'); assert.equal(toAna.subject, 'Promo para Ana'); assert.match(toAna.html, /Olá, Ana!/); assert.match(toAna.headers['List-Unsubscribe'], /api\/unsubscribe\?u=/);
  info = await dono('/api/admin/campaigns'); assert.deepEqual([info.campaigns[0].status, info.campaigns[0].sent, info.campaigns[0].failed], ['done', 2, 1]);
  // link de cancelar inscrição: assinado (link adulterado não vale)
  const link = toAna.text.match(/Cancelar inscrição: (\S+)/)[1].replace('http://site.test', s.base);
  assert.equal((await fetch(link.replace(/t=\w+/, 't=00'))).status, 400);
  const page = await fetch(link); assert.equal(page.status, 200); assert.match(await page.text(), /Inscrição cancelada/);
  assert.equal((await ana('/api/me')).user.marketing, false);
  // e-mails da conta continuam (não é propaganda)
  await ana('/api/support', {subject: 'Ajuda', message: 'Teste'}); assert.equal((await dono('/api/admin/campaigns')).audience.all, 2);
});

test('1.8: comunicados — limite por dia e cancelar envio', async t => {
  const s = await boot(t, {MAIL_DAILY_LIMIT: '2'}); const dono = s.client();
  await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'}); await s.confirm('dono@gamezoney.com');
  for (const n of [1, 2, 3, 4]) await s.client()('/api/auth/register', {name: 'C' + n, email: `c${n}@x.com`, password: 'senha-forte-1'});
  const c = (await dono('/api/admin/campaigns', {subject: 'Aviso', body: 'Oi {nome}'})).campaign; assert.equal(c.total, 5);
  assert.equal(await s.drain(), 2, 'para no limite de 2 por dia');
  let info = await dono('/api/admin/campaigns'); assert.equal(info.sentToday, 2); assert.equal(info.campaigns[0].pending, 3);
  await dono(`/api/admin/campaigns/${c.id}/cancel`, {}); info = await dono('/api/admin/campaigns'); assert.equal(info.campaigns[0].status, 'canceled'); assert.equal(info.campaigns[0].pending, 0);
});

test('1.8: logo e banners podem aparecer dentro dos e-mails; capturas do sistema continuam protegidas', async t => {
  const s = await boot(t);
  assert.equal((await fetch(s.base + '/logo-gamezoney.png')).headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.equal((await fetch(s.base + '/site.css')).headers.get('cross-origin-resource-policy'), 'same-origin');
});
