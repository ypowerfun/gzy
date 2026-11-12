'use strict';
// 1.0.8 + site 2.9 (plano Pro): Multi-Unidade — o Servidor envia o resumo da loja e o gestor vê as unidades em Minha conta › Unidades;
// Gerenciamento do App guarda os dados da nuvem (sem senhas) e só aparece no Pro.
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createServer} = require('../server');
let createApp; try { ({createApp} = require('../../../site/server')); } catch { }

async function boot(t) {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519'), pub = publicKey.export({type: 'spki', format: 'pem'});
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-plan-site-')), mails = [];
  const site = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: siteDir, DOWNLOADS_DIR: path.join(siteDir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0',
    LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: '', LEGACY_SALES: '1'}, mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, subject, text}); return true; }}, log: {log() {}, error() {}}});
  const siteServer = await new Promise(r => { const s = site.listen(0, '127.0.0.1', () => r(s)); }); const siteBase = 'http://127.0.0.1:' + siteServer.address().port;
  const old = process.env.GZ_SITE_URL; process.env.GZ_SITE_URL = siteBase;
  const dirs = [siteDir], instances = [];
  t.after(async () => { for (const i of instances) await i.close(); siteServer.close(); site.locals.close(); for (const d of dirs) fs.rmSync(d, {recursive: true, force: true}); if (old === undefined) delete process.env.GZ_SITE_URL; else process.env.GZ_SITE_URL = old; });
  const web = () => { let cookie = ''; return async (url, body, status = 200) => { const r = await fetch(siteBase + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); if (kv.startsWith('gzs=')) cookie = kv.endsWith('=') ? '' : kv; } const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); return text ? JSON.parse(text) : null; }; };
  const dono = web(); await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  await fetch(siteBase + '/api/auth/verify?t=' + mails.find(m => m.to === 'dono@gamezoney.com').text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'});
  async function gz() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-plan-srv-')); dirs.push(directory);
    const inst = createServer({directory, noTimer: true, license: {publicKey: pub}}); instances.push(inst);
    await new Promise(r => inst.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + inst.server.address().port; let cookie = '';
    const call = async (url, body, status = 200) => { const r = await fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)}); const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; return text ? JSON.parse(text) : null; };
    await call('/api/setup', {name: 'Dono', username: 'admin', password: 'senha123'}); await call('/api/login', {username: 'admin', password: 'senha123'});
    return {inst, call, state: inst.store.state};
  }
  return {web, dono, gz, privateKey, pub, mails, siteBase};
}


test('1.0.8: Multi-Unidade (Pro) — resumo da loja na Minha conta, código de vínculo do gestor e bloqueios', {skip: !createApp && 'site não encontrado'}, async t => {
  const s = await boot(t); const ana = s.web(), gestor = s.web();
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@arena.com', password: 'senha-forte-1'});
  await gestor('/api/auth/register', {name: 'Gestor', email: 'gestor@rede.com', password: 'senha-forte-3'});
  await s.dono('/api/admin/subscriptions/grant', {email: 'ana@arena.com', plan: 'standard', months: 1});
  const loja = await s.gz();
  await loja.call('/api/license/login', {email: 'ana@arena.com', password: 'senha-forte-1'});
  // Standard: sem Pro, as rotas não abrem
  assert.match((await loja.call('/api/units', undefined, 400)).error, /plano Pro/);
  await s.dono('/api/admin/subscriptions/grant', {email: 'ana@arena.com', plan: 'pro', months: 1});
  await loja.call('/api/license/refresh', {}); assert.equal((await loja.call('/api/state')).pro, true);

  // movimento da loja: uma venda no PDV
  await loja.call('/api/cash/open', {openingCents: 5000});
  const coke = loja.state.products.find(p => p.name === 'Coca-cola');
  await loja.call('/api/shop/sale', {items: [{kind: 'product', id: coke.id, qty: 2}], paymentMethod: 'pix'});
  let u = await loja.call('/api/units'); assert.equal(u.enabled, false); assert.equal(u.preview.day.shopCents, 1200);
  assert.match((await loja.call('/api/units/send', {}, 400)).error, /Ligue o envio/);
  assert.match((await loja.call('/api/units', {enabled: true, name: ''}, 400)).error, /nome da unidade/);
  await loja.call('/api/units', {enabled: true, name: 'Loja Centro'});
  u = await loja.call('/api/units/send', {}); assert.ok(u.lastSentAt); assert.equal(u.ownerEmail, 'ana@arena.com');

  // a dona do plano vê a unidade (sem dados de clientes)
  let v = await ana('/api/units'); assert.equal(v.pro, true); assert.equal(v.units.length, 1);
  const unit = v.units[0]; assert.equal(unit.name, 'Loja Centro'); assert.equal(unit.online, true); assert.equal(unit.summary.day.shopCents, 1200);
  assert.equal(unit.summary.cash.open, true); assert.equal(unit.summary.topProducts[0].name, 'Coca-cola'); assert.equal(v.totals.dayCents, 1200);
  assert.doesNotMatch(JSON.stringify(unit), /cpf|phone|password/i);

  // gestor sem Pro não gera código; com Pro gera e a loja passa para a conta do gestor
  await gestor('/api/units/code', {}, 402);
  await s.dono('/api/admin/subscriptions/grant', {email: 'gestor@rede.com', plan: 'pro', months: 1});
  const {code} = await gestor('/api/units/code', {}); assert.match(code, /^GZU-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await loja.call('/api/units', {enabled: true, name: 'Loja Centro', linkCode: 'GZU-AAAA-AAAA'});
  assert.match((await loja.call('/api/units/send', {}, 400)).error, /Código de vínculo não encontrado/);
  await loja.call('/api/units', {enabled: true, name: 'Loja Centro', linkCode: code.toLowerCase()});
  u = await loja.call('/api/units/send', {}); assert.equal(u.ownerEmail, 'gestor@rede.com');
  v = await gestor('/api/units'); assert.equal(v.units.length, 1); assert.equal(v.units[0].own, false); assert.equal(v.code, code);
  assert.equal((await ana('/api/units')).units.length, 0, 'saiu da conta antiga');
  // remover: a loja deixa de aparecer e os envios com o mesmo vínculo são recusados
  await gestor('/api/units/remove', {id: v.units[0].id}); assert.equal((await gestor('/api/units')).units.length, 0);
  assert.match((await loja.call('/api/units/send', {}, 400)).error, /removida pelo gestor/);

  // site 2.14: limite de unidades por conta (padrão 5); o /admin aumenta
  assert.equal((await gestor('/api/units')).maxUnits, 5);
  await s.dono('/api/admin/units/limit', {email: 'gestor@rede.com', max: 1});
  const sede = await s.gz(); await sede.call('/api/license/login', {email: 'gestor@rede.com', password: 'senha-forte-3'});
  await sede.call('/api/units', {enabled: true, name: 'Sede'}); await sede.call('/api/units/send', {});
  const carla = s.web(); await carla('/api/auth/register', {name: 'Carla', email: 'carla@lan.com', password: 'senha-forte-4'});
  await s.dono('/api/admin/subscriptions/grant', {email: 'carla@lan.com', plan: 'pro', months: 1});
  const filial = await s.gz(); await filial.call('/api/license/login', {email: 'carla@lan.com', password: 'senha-forte-4'});
  await filial.call('/api/units', {enabled: true, name: 'Filial', linkCode: code});
  assert.match((await filial.call('/api/units/send', {}, 400)).error, /Limite de 1 unidades.*suporte@gamezoney\.com/);
  let adm = await s.dono('/api/admin/units'); assert.deepEqual(adm.accounts.find(a => a.email === 'gestor@rede.com'), {id: adm.accounts.find(a => a.email === 'gestor@rede.com').id, email: 'gestor@rede.com', name: 'Gestor', pro: true, used: 1, max: 1});
  await s.dono('/api/admin/units/limit', {email: 'gestor@rede.com', max: 0}, 400);
  await s.dono('/api/admin/units/limit', {email: 'gestor@rede.com', max: 2});
  await filial.call('/api/units/send', {}); v = await gestor('/api/units'); assert.equal(v.units.length, 2); assert.equal(v.maxUnits, 2);
  await ana('/api/admin/units', undefined, 403);

  // envio direto sem certificado válido é recusado
  const r = await fetch(s.siteBase + '/api/units/report', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token: 'x.y', installId: loja.state.runtime.installId, summary: {}})});
  assert.equal(r.status, 401);

  // 1.3.8: a tela "Servidor em nuvem" (Gerenciamento do App antigo) saiu
  assert.ok((await fetch('http://127.0.0.1:' + loja.inst.server.address().port + '/api/app-manager')).status >= 400);
});
