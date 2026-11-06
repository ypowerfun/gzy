'use strict';
// 1.0.7: teste grátis preso ao computador — reinstalar e apagar os dados não reinicia os 30 dias
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const license = require('../license');
let createApp; try { ({createApp} = require('../../../site/server')); } catch { }

test('1.0.7: o site guarda a primeira data do teste de cada computador; reinstalação continua a contagem', {skip: !createApp && 'site não encontrado'}, async t => {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519'), pub = publicKey.export({type: 'spki', format: 'pem'});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-trial-site-'));
  const site = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com',
    LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''}, mail: {enabled: false, send: async () => true}, log: {log() {}, error() {}}});
  const srv = await new Promise(r => { const s = site.listen(0, '127.0.0.1', () => r(s)); });
  const old = process.env.GZ_SITE_URL; process.env.GZ_SITE_URL = 'http://127.0.0.1:' + srv.address().port;
  t.after(() => { srv.close(); site.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); if (old === undefined) delete process.env.GZ_SITE_URL; else process.env.GZ_SITE_URL = old; });
  const machineId = crypto.createHash('sha256').update('pc-da-arena').digest('hex'), logs = [];
  const mk = (trialStartedAt, reg) => { const store = {state: {runtime: {}, license: trialStartedAt ? {trialStartedAt} : {}}, log() {}, persist() {}, change: (a, k, text, fn) => { logs.push(text); fn(); }};
    return {store, lic: license(store, {noTimer: true, publicKey: pub, machineId, registry: reg || {get: () => 0, set() {}}})}; };
  // 1ª instalação, há 25 dias
  const first = Date.now() - 25 * 86400000, a = mk(first); await a.lic.refresh(); assert.equal(a.store.state.license.trialStartedAt, first);
  // reinstalou e apagou tudo: começaria hoje, mas o site lembra a data
  const b = mk(); assert.equal(b.lic.status().daysLeft, 30); await b.lic.refresh();
  assert.equal(b.store.state.license.trialStartedAt, first); assert.equal(b.lic.status().daysLeft, 5); assert.match(logs.at(-1), /já usava o GameZoney desde/);
  // cópia no registro do Windows também segura a data (sem internet)
  const c = mk(undefined, {get: () => first, set() {}}); assert.equal(c.store.state.license.trialStartedAt, first);
  // outro computador começa do zero; identificação inválida é recusada
  const other = mk(); other.lic = license(other.store, {noTimer: true, publicKey: pub, machineId: crypto.createHash('sha256').update('outro').digest('hex'), registry: {get: () => 0, set() {}}});
  await other.lic.refresh(); assert.equal(other.lic.status().daysLeft, 30);
  const r = await fetch(process.env.GZ_SITE_URL + '/api/trial/anchor', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({installId: crypto.randomUUID(), machineId: 'x'})}); assert.equal(r.status, 400);
});
