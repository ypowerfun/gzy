'use strict';
// 1.0.6: o GameZoney Servidor usa o plano da conta gamezoney.com (testado contra o site de verdade, rodando junto)
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createServer} = require('../server'), license = require('../license');
let createApp; try { ({createApp} = require('../../../site/server')); } catch { }
const sign = (data, key) => { const body = Buffer.from(JSON.stringify(data)).toString('base64url'); return body + '.' + crypto.sign(null, Buffer.from(body, 'base64url'), key).toString('base64url'); };

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
  return {web, dono, gz, privateKey, pub, mails};
}

test('1.0.6: plano da conta — entrar com e-mail e senha do site, trocar de computador, renovar e bloquear sem plano', {skip: !createApp && 'site não encontrado'}, async t => {
  const s = await boot(t); const ana = s.web(), bia = s.web();
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@arena.com', password: 'senha-forte-1'});
  await bia('/api/auth/register', {name: 'Bia', email: 'bia@arena.com', password: 'senha-forte-2'});
  await s.dono('/api/admin/subscriptions/grant', {email: 'ana@arena.com', plan: 'standard', months: 1});
  const pc1 = await s.gz();
  let L = await pc1.call('/api/license'); assert.equal(L.mode, 'trial');
  assert.match((await pc1.call('/api/license/login', {email: 'ana@arena.com', password: 'errada'}, 400)).error, /incorretos/);
  const np = await pc1.call('/api/license/login', {email: 'bia@arena.com', password: 'senha-forte-2'}, 400); assert.equal(np.noPlan, true); assert.match(np.error, /não tem plano ativo/);
  L = await pc1.call('/api/license/login', {email: ' ana@arena.com ', password: 'senha-forte-1'});
  assert.equal(L.mode, 'plan'); assert.equal(L.planName, 'Standard'); assert.equal(L.email, 'ana@arena.com'); assert.ok(L.paidUntil > Date.now() + 25 * 86400000);
  assert.doesNotMatch(JSON.stringify(pc1.state), /senha-forte-1/, 'a senha do site não fica guardada');
  // a mesma conta em outro computador: pede confirmação; confirmado, o primeiro perde o plano na próxima renovação
  const pc2 = await s.gz();
  const busy = await pc2.call('/api/license/login', {email: 'ana@arena.com', password: 'senha-forte-1'}, 400); assert.equal(busy.needTransfer, true); assert.ok(busy.machine);
  assert.equal((await pc2.call('/api/license/login', {email: 'ana@arena.com', password: 'senha-forte-1', transfer: true})).mode, 'plan');
  assert.ok(s.mails.some(m => m.to === 'ana@arena.com' && /outro computador/.test(m.subject)), 'aviso por e-mail');
  L = await pc1.call('/api/license/refresh', {}); assert.equal(L.mode, 'trial'); assert.match(L.lastError, /outro computador|passou a ser usada/);
  pc1.state.license.trialStartedAt = Date.now() - 31 * 86400000;
  assert.equal((await pc1.call('/api/license')).mode, 'expired');
  const blocked = await pc1.call('/api/members', {name: 'X', username: 'xxx'}, 402); assert.match(blocked.error, /Entre com a sua conta gamezoney\.com/);
  // renovação: o admin dá mais meses e o computador atual recebe a nova validade
  const before = (await pc2.call('/api/license')).paidUntil;
  await s.dono('/api/admin/subscriptions/grant', {email: 'ana@arena.com', plan: 'pro', months: 3});
  L = await pc2.call('/api/license/refresh', {}); assert.equal(L.planName, 'Pro'); assert.ok(L.paidUntil > before);
  // sair da conta: libera o plano para outro computador sem pedir confirmação
  assert.notEqual((await pc2.call('/api/license/logout', {})).mode, 'plan');
  assert.equal((await pc1.call('/api/license/login', {email: 'ana@arena.com', password: 'senha-forte-1'})).mode, 'plan');
});

test('1.0.6: licença vitalícia antiga passa sozinha para o plano da conta (sem senha)', {skip: !createApp && 'site não encontrado'}, async t => {
  const s = await boot(t); const cli = s.web(); await cli('/api/auth/register', {name: 'Caio', email: 'caio@arena.com', password: 'senha-forte-3'});
  const {key} = await s.dono('/api/admin/licenses', {email: 'caio@arena.com', note: 'vitalícia antiga'});
  const pc = await s.gz();
  let L = await pc.call('/api/license/activate', {key}); assert.equal(L.mode, 'licensed'); assert.equal(L.legacy, true); assert.ok(L.legacyUntil > Date.now() + 360 * 86400000);
  // a conta ainda não tem plano: continua como licença antiga e mostra o motivo
  L = await pc.call('/api/license/refresh', {}); assert.equal(L.mode, 'licensed'); assert.match(L.lastError, /plano/);
  await s.dono('/api/admin/subscriptions/grant', {email: 'caio@arena.com', plan: 'standard', months: 12, note: 'vitalícia convertida'});
  L = await pc.call('/api/license/refresh', {}); assert.equal(L.mode, 'plan'); assert.equal(L.email, 'caio@arena.com');
});

test('1.0.6: plano — 7 dias de tolerância, relógio voltado não estende e certificado de outro computador não vale', async t => {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519'), pub = publicKey.export({type: 'spki', format: 'pem'});
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-plan-g-')); const inst = createServer({directory, noTimer: true, license: {publicKey: pub}});
  t.after(async () => { await inst.close(); fs.rmSync(directory, {recursive: true, force: true}); });
  const st = inst.store.state, id = st.runtime.installId, day = 86400000, now = Date.now(); st.license.trialStartedAt = now - 40 * day;
  const lic = () => require('../license')(inst.store, {publicKey: pub});
  const cert = (paid, grace, installId = id) => sign({v: 2, kind: 'plan', uid: 'u', email: 'ana@arena.com', plan: 'standard', planName: 'Standard', period: 'mensal', installId, paidUntil: paid, graceUntil: grace, issuedAt: now}, privateKey);
  st.license.planToken = cert(now + 10 * day, now + 17 * day); assert.equal(lic().status().mode, 'plan');
  st.license.planToken = cert(now - 2 * day, now + 5 * day); let S = lic().status(); assert.equal(S.mode, 'plan-grace'); assert.equal(S.daysLeft, 5); assert.equal(lic().expired(), false);
  st.license.planToken = cert(now - 9 * day, now - 2 * day); S = lic().status(); assert.equal(S.mode, 'expired'); assert.equal(S.planEnded, 'Standard');
  st.license.planToken = cert(now + 10 * day, now + 17 * day, crypto.randomUUID()); assert.equal(lic().status().mode, 'expired', 'certificado de outra instalação');
  { const [b, sg] = cert(now + 10 * day, now + 17 * day).split('.'), body = JSON.parse(Buffer.from(b, 'base64url')); body.paidUntil += 365 * day; st.license.planToken = Buffer.from(JSON.stringify(body)).toString('base64url') + '.' + sg; } assert.equal(lic().status().mode, 'expired', 'certificado adulterado');
  // relógio: o servidor já viu uma data 20 dias à frente; voltar o relógio não faz o plano valer de novo
  st.license.planToken = cert(now + 10 * day, now + 17 * day); st.license.lastSeenAt = now + 20 * day; assert.equal(lic().status().mode, 'expired');
  assert.ok(license.verifyPlan(cert(1, 2), id, pub));
});
