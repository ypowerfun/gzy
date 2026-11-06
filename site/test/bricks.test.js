'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createApp} = require('../server');

// Mercado Pago simulado: guarda os pagamentos criados e responde como a API real
function fakeMp() {
  const payments = new Map(), calls = [];
  const json = (code, body) => ({ok: code < 300, status: code, json: async () => body});
  const fetch = async (url, opts = {}) => {
    const u = new URL(url); calls.push({path: u.pathname, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : null});
    if (u.pathname === '/v1/payments' && opts.method === 'POST') {
      const b = JSON.parse(opts.body), id = String(5000 + payments.size);
      const status = b.payment_method_id === 'pix' ? 'pending' : b.token === 'TOKEN_RECUSADO' ? 'rejected' : b.token === 'TOKEN_ANALISE' ? 'in_process' : 'approved';
      const p = {id, status, status_detail: status === 'rejected' ? 'cc_rejected_insufficient_amount' : 'accredited', transaction_amount: b.transaction_amount, external_reference: b.external_reference,
        point_of_interaction: b.payment_method_id === 'pix' ? {transaction_data: {qr_code: 'PIXCOPIAECOLA', qr_code_base64: 'QUJD', ticket_url: 'https://mp/ticket'}} : undefined};
      payments.set(id, p); return json(201, p);
    }
    if (u.pathname === '/v1/payments/search') return json(200, {results: [...payments.values()].filter(p => p.external_reference === u.searchParams.get('external_reference'))});
    const m = u.pathname.match(/^\/v1\/payments\/(\d+)$/); if (m && payments.has(m[1])) return json(200, payments.get(m[1]));
    return json(404, {message: 'not found'});
  };
  return {payments, calls, fetch};
}
async function boot(t, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-b-')); const {privateKey} = crypto.generateKeyPairSync('ed25519'); const mails = [], mp = fakeMp();
  const app = createApp({campaignIntervalMs: 0, fetch: mp.fetch, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}),
    MP_ACCESS_TOKEN: 'TESTE', MP_PUBLIC_KEY: 'APP_USR-chave-publica', GOOGLE_CLIENT_ID: '', SMTP_HOST: '', PRICE_CENTS: '', LEGACY_SALES: '1', ...env},
    mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, subject, text}); return true; }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const client = () => { let cookie = ''; return async (url, body, status = 200) => {
    const r = await fetch(base + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); if (kv.startsWith('gzs=')) cookie = kv.endsWith('=') ? '' : kv; }
    const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); try { return JSON.parse(text); } catch { return {text}; } }; };
  return {base, client, mails, mp};
}
const card = (token, extra = {}) => ({payment_method_id: 'master', token, installments: 3, issuer_id: '24', transaction_amount: 1, payer: {email: 'ana@x.com', identification: {type: 'CPF', number: '123.456.789-09'}}, ...extra});

test('1.9: pagamento no site (Checkout Bricks) — cartão aprovado libera a licença; valor sempre do pedido', async t => {
  const s = await boot(t); const ana = s.client(), anon = s.client();
  const cfg = await anon('/api/config'); assert.equal(cfg.bricks, true); assert.equal(cfg.mpPublicKey, 'APP_USR-chave-publica');
  await anon('/api/checkout/brick', {orderId: 'x', formData: card('TOKEN_OK_123456')}, 401);
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  const o = (await ana('/api/checkout', {method: 'brick'})).order; assert.equal(o.method, 'brick'); assert.equal(o.amountCents, 8990);
  assert.equal((await ana('/api/checkout', {method: 'brick'})).order.id, o.id, 'reaproveita o pedido aberto');
  await ana('/api/checkout/brick', {orderId: o.id, formData: card('<script>')}, 400);
  await ana('/api/checkout/brick', {orderId: o.id, formData: {payment_method_id: 'javascript:alert'}}, 400);
  const r = await ana('/api/checkout/brick', {orderId: o.id, formData: card('TOKEN_OK_123456'), deviceId: 'armor.abc123'});
  assert.equal(r.payment.status, 'approved'); assert.equal(r.order.status, 'paid'); assert.match(r.order.licenseKey, /^GZ(-[A-Z0-9]{4}){4}$/);
  const sent = s.mp.calls.find(c => c.path === '/v1/payments' && c.method === 'POST');
  assert.equal(sent.body.transaction_amount, 89.9, 'o valor que o navegador mandou (1) é ignorado'); assert.equal(sent.body.external_reference, o.id); assert.equal(sent.body.installments, 3);
  assert.equal(sent.body.payer.identification.number, '12345678909'); assert.ok(sent.headers['X-Idempotency-Key'].startsWith(o.id)); assert.equal(sent.headers['X-meli-session-id'], 'armor.abc123');
  assert.ok(s.mails.some(m => m.to === 'ana@x.com' && m.text.includes(r.order.licenseKey)));
  // pedido pago não cobra de novo
  const again = await ana('/api/checkout/brick', {orderId: o.id, formData: card('TOKEN_OK_123456')}); assert.equal(again.payment.status, 'approved');
  assert.equal(s.mp.calls.filter(c => c.path === '/v1/payments' && c.method === 'POST').length, 1);
  // outra pessoa não paga pedido alheio
  const bia = s.client(); await bia('/api/auth/register', {name: 'Bia', email: 'bia@x.com', password: 'senha-forte-2'}); await bia('/api/checkout/brick', {orderId: o.id, formData: card('TOKEN_OK_123456')}, 404);
});

test('1.9: pagamento no site — cartão recusado mostra o motivo e deixa tentar; PIX mostra o QR; em análise confirma depois', async t => {
  const s = await boot(t); const ana = s.client(); await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  const o = (await ana('/api/checkout', {method: 'brick'})).order;
  const no = await ana('/api/checkout/brick', {orderId: o.id, formData: card('TOKEN_RECUSADO')}); assert.equal(no.payment.status, 'rejected'); assert.match(no.payment.message, /limite insuficiente/); assert.equal(no.order.status, 'pending');
  const pix = await ana('/api/checkout/brick', {orderId: o.id, formData: {payment_method_id: 'pix', payer: {email: 'ana@x.com'}}});
  assert.equal(pix.payment.status, 'pending'); assert.equal(pix.order.pixCode, 'PIXCOPIAECOLA'); assert.equal(pix.order.method, 'pix');
  // o PIX é pago: aviso do Mercado Pago (webhook) é conferido na API e libera a licença
  const pixId = [...s.mp.payments.values()].find(p => p.point_of_interaction).id; s.mp.payments.get(pixId).status = 'approved';
  await s.client()('/api/mp/webhook', {type: 'payment', data: {id: pixId}}); await new Promise(r => setTimeout(r, 50));
  const paid = (await ana('/api/orders/' + o.id)).order; assert.equal(paid.status, 'paid'); assert.ok(paid.licenseKey);
  // cartão em análise: fica pendente e é confirmado na consulta seguinte
  const o2 = (await ana('/api/checkout', {method: 'brick'})).order; assert.notEqual(o2.id, o.id);
  const wait = await ana('/api/checkout/brick', {orderId: o2.id, formData: card('TOKEN_ANALISE')}); assert.equal(wait.payment.status, 'pending'); assert.equal(wait.order.method, 'brick');
  [...s.mp.payments.values()].find(p => p.external_reference === o2.id).status = 'approved';
  assert.equal((await ana('/api/orders/' + o2.id)).order.status, 'paid');
});

test('1.9: sem a chave pública o site continua com o PIX e o cartão de antes; scripts do Mercado Pago só em Minha conta', async t => {
  const s = await boot(t, {MP_PUBLIC_KEY: ''}); const ana = s.client(), anon = s.client();
  const cfg = await anon('/api/config'); assert.equal(cfg.bricks, false); assert.equal(cfg.card, true);
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'}); await ana('/api/checkout', {method: 'brick'}, 400);
  assert.doesNotMatch((await fetch(s.base + '/conta')).headers.get('content-security-policy'), /mercadopago/);
  const s2 = await boot(t);
  assert.match((await fetch(s2.base + '/conta')).headers.get('content-security-policy'), /script-src 'self' https:\/\/sdk\.mercadopago\.com/);
  assert.doesNotMatch((await fetch(s2.base + '/')).headers.get('content-security-policy'), /mercadopago/, 'a página inicial continua sem scripts de fora');
});
