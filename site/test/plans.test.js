'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createApp} = require('../server');
const {open} = require('../db');

// Mercado Pago simulado (assinaturas): cria, consulta, cancela e "cobra"
function fakeMp() {
  const subs = new Map(), auths = new Map(), calls = [];
  const json = (code, body) => ({ok: code < 300, status: code, json: async () => body});
  const fetch = async (url, opts = {}) => {
    const u = new URL(url), body = opts.body ? JSON.parse(opts.body) : null; calls.push({path: u.pathname, method: opts.method || 'GET', body});
    if (u.pathname === '/preapproval' && opts.method === 'POST') {
      if (body.card_token_id === 'TOKEN_RECUSADO') return json(400, {message: 'card rejected'});
      const id = 'pre' + (subs.size + 1), s = {id, status: 'authorized', external_reference: body.external_reference, auto_recurring: body.auto_recurring, summarized: {charged_quantity: 0, last_charged_date: null}};
      subs.set(id, s); return json(201, s);
    }
    let m = u.pathname.match(/^\/preapproval\/(\w+)$/);
    if (m && subs.has(m[1])) { const s = subs.get(m[1]); if (opts.method === 'PUT') Object.assign(s, body); return json(200, s); }
    m = u.pathname.match(/^\/authorized_payments\/(\w+)$/); if (m && auths.has(m[1])) return json(200, auths.get(m[1]));
    return json(404, {message: 'not found'});
  };
  const charge = (id, when = new Date().toISOString()) => { const s = subs.get(id); s.summarized.charged_quantity++; s.summarized.last_charged_date = when; const a = 'ap' + (auths.size + 1); auths.set(a, {id: a, preapproval_id: id, status: 'processed'}); return a; };
  return {subs, calls, fetch, charge};
}
async function boot(t, {env = {}, before} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-p-')); const mails = [], mp = fakeMp();
  if (before) { const db = open(dir); before(db); db.close(); }
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, fetch: mp.fetch, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0',
    LICENSE_PRIVATE_KEY: crypto.generateKeyPairSync('ed25519').privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: 'TESTE', MP_PUBLIC_KEY: 'APP_USR-pub', GOOGLE_CLIENT_ID: '', SMTP_HOST: '', ...env},
    mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, subject, text}); return true; }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const client = () => { let cookie = ''; return async (url, body, status = 200) => {
    const r = await fetch(base + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); if (kv.startsWith('gzs=')) cookie = kv.endsWith('=') ? '' : kv; }
    const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); try { return JSON.parse(text); } catch { return {text, headers: r.headers}; } }; };
  const admin = async () => { const c = client(); await c('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'}); const m = mails.find(x => x.to === 'dono@gamezoney.com'); await fetch(base + '/api/auth/verify?t=' + m.text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'}); return c; };
  return {base, client, admin, mails, mp, app};
}

test('2.0: planos — padrão Standard 29,90 e Pro 129,90; preços editáveis no /admin; vitalícia não é mais vendida', async t => {
  const s = await boot(t); const anon = s.client(), ana = s.client();
  const cfg = await anon('/api/config'); assert.equal(cfg.subscriptions, true); assert.equal(cfg.legacySales, false);
  assert.deepEqual(cfg.plans.map(p => [p.id, p.monthly, p.popular]), [['free', 0, false], ['standard', 2990, true], ['pro', 12990, false]]); assert.ok(cfg.plans[2].features.includes('1 app (Servidor/Cliente)')); assert.equal(cfg.plans[0].free, true);
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  const old = await ana('/api/checkout', {}, 410); assert.match(old.error, /não é mais vendida/);
  await ana('/api/subscriptions', {plan: 'free', period: 'mensal', token: 'TOKEN_OK_1234'}, 400);
  await ana('/api/admin/plans', {plans: {}}, 403);
  const dono = await s.admin();
  await dono('/api/admin/plans', {plans: {standard: {monthly: '0,50'}}}, 400);
  await dono('/api/admin/plans', {plans: {standard: {monthly: '29,90', monthlyList: '19,90'}}}, 400);
  const r = await dono('/api/admin/plans', {plans: {standard: {monthly: '34.90', annual: '349,00', annualList: '418,80', badge: 'Oferta especial', features: ['Tudo liberado', '', 'Suporte']}, pro: {monthly: 'R$ 1.299,90'}}, popular: 'standard'});
  const st = r.plans.find(p => p.id === 'standard'), pro = r.plans.find(p => p.id === 'pro');
  assert.equal(r.plans.find(p => p.id === 'free').monthly, 0, 'Free continua sem preço'); await dono('/api/admin/subscriptions/grant', {email: 'ana@x.com', plan: 'free', months: 1}, 400);
  assert.deepEqual([st.monthly, st.annual, st.annualList, st.badge, st.popular, st.features], [3490, 34900, 41880, 'Oferta especial', true, ['Tudo liberado', 'Suporte']]);
  assert.deepEqual([pro.monthly, pro.popular], [129990, false]); assert.equal(r.plans.filter(p => p.popular).length, 1);
  assert.equal((await anon('/api/config')).plans.find(p => p.id === 'standard').monthly, 3490);
  const home = await (await fetch(s.base + '/')).text(); assert.match(home, /id="plans-grid"/);
  assert.match((await fetch(s.base + '/carrinho')).headers.get('content-security-policy'), /sdk\.mercadopago\.com/);
});

test('2.0: assinatura — só vale depois da cobrança; renova, cancela e tem 7 dias de tolerância', async t => {
  const s = await boot(t); const ana = s.client(), anon = s.client();
  await anon('/api/subscriptions', {plan: 'standard', period: 'mensal', token: 'TOKEN_OK_1234'}, 401);
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  await ana('/api/subscriptions', {plan: 'gold', period: 'mensal', token: 'TOKEN_OK_1234'}, 400);
  await ana('/api/subscriptions', {plan: 'standard', period: 'mensal', token: '<x>'}, 400);
  const no = await ana('/api/subscriptions', {plan: 'standard', period: 'mensal', token: 'TOKEN_RECUSADO'}, 400); assert.match(no.error, /não aceitou o cartão/);
  const r = await ana('/api/subscriptions', {plan: 'pro', period: 'anual', token: 'TOKEN_OK_1234', payerEmail: 'ANA@x.com'});
  const sent = s.mp.calls.filter(c => c.path === '/preapproval' && c.method === 'POST').at(-1).body;
  assert.deepEqual(sent.auto_recurring, {frequency: 12, frequency_type: 'months', transaction_amount: 1299, currency_id: 'BRL'}); assert.equal(sent.status, 'authorized'); assert.equal(sent.card_token_id, 'TOKEN_OK_1234'); assert.equal(sent.payer_email, 'ana@x.com');
  assert.equal(r.subscription.active, false, 'sem cobrança ainda não vale'); assert.equal(r.plan, null); assert.match(r.subscription.statusText, /primeira cobrança/);
  await ana('/api/subscriptions', {plan: 'standard', period: 'mensal', token: 'TOKEN_OK_1234'}, 409);
  // Mercado Pago cobra e avisa (aviso de cobrança da assinatura): o site consulta e libera
  const preId = r.subscription && [...s.mp.subs.keys()].at(-1), ap = s.mp.charge(preId);
  await anon('/api/mp/webhook', {type: 'subscription_authorized_payment', data: {id: ap}}); await new Promise(x => setTimeout(x, 50));
  let me = await ana('/api/me'); assert.equal(me.plan.plan, 'pro'); assert.equal(me.plan.period, 'anual'); assert.equal(me.plan.inGrace, false);
  const year = me.plan.paidUntil - Date.now(); assert.ok(year > 360 * 86400000 && year < 370 * 86400000, 'vale 1 ano');
  assert.ok(s.mails.some(m => m.to === 'ana@x.com' && /plano Pro ativado/.test(m.subject)));
  // cancelar: para a cobrança automática; o período pago continua valendo
  await ana(`/api/subscriptions/${me.subscriptions[0].id}/cancel`, {});
  assert.deepEqual(s.mp.calls.filter(c => c.method === 'PUT').at(-1).body, {status: 'cancelled'});
  me = await ana('/api/me'); assert.equal(me.plan.plan, 'pro'); assert.equal(me.plan.autoRenew, false); assert.equal(me.subscriptions[0].status, 'cancelled');
  // tolerância de 7 dias depois do vencimento
  const {planOf} = s.app.locals.plans, uid = me.user.id, until = me.plan.paidUntil;
  assert.equal(planOf(uid, until + 3 * 86400000).inGrace, true); assert.equal(planOf(uid, until + 8 * 86400000), null);
});

test('2.0: vitalícias viram Standard por 12 meses grátis; cortesia e encerrar pelo /admin', async t => {
  const now = Date.now();
  const s = await boot(t, {before: db => {
    db.run("INSERT INTO users(id,email,name,created_at) VALUES('u1','velho@x.com','Cliente Antigo',?)", now);
    db.run("INSERT INTO licenses(id,key,user_id,created_at) VALUES('l1','GZ-AAAA-BBBB-CCCC-DDDD','u1',?)", now);
    db.run("INSERT INTO licenses(id,key,user_id,created_at,status) VALUES('l2','GZ-EEEE-FFFF-GGGG-HHHH','u1',?,'blocked')", now);
  }});
  const dono = await s.admin(); let d = await dono('/api/admin/plans');
  const legacy = d.subscriptions.find(x => x.email === 'velho@x.com'); assert.equal(legacy.planName, 'Standard'); assert.equal(legacy.source, 'legacy'); assert.equal(legacy.active, true);
  const months = (legacy.paidUntil - now) / 86400000; assert.ok(months > 360 && months < 370, '12 meses');
  assert.equal(d.subscriptions.filter(x => x.email === 'velho@x.com').length, 1, 'uma por conta');
  await dono('/api/admin/subscriptions/grant', {email: 'ninguem@x.com', plan: 'pro', months: 1}, 404);
  await dono('/api/admin/subscriptions/grant', {email: 'velho@x.com', plan: 'pro', months: 0}, 400);
  await dono('/api/admin/subscriptions/grant', {email: 'velho@x.com', plan: 'pro', months: 2, note: 'parceiro'});
  assert.equal(s.app.locals.plans.planOf('u1').plan, 'pro', 'o Pro vale mais que o Standard');
  d = await dono('/api/admin/plans'); const pro = d.subscriptions.find(x => x.plan === 'pro');
  await dono(`/api/admin/subscriptions/${pro.id}/cancel`, {endNow: true});
  assert.equal(s.app.locals.plans.planOf('u1').plan, 'standard');
});
