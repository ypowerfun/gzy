'use strict';
// 1.0.6: Verificar atualização — site de verdade + servidor de verdade (o instalador e o PowerShell são simulados)
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createServer} = require('../server');
let createApp; try { ({createApp} = require('../../../site/server')); } catch { }

async function boot(t, {serverKey} = {}) {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519'), pub = publicKey.export({type: 'spki', format: 'pem'});
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-upd-site-')), dl = path.join(siteDir, 'downloads'), mails = []; fs.mkdirSync(dl);
  const site = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: siteDir, DOWNLOADS_DIR: dl, ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0',
    LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''}, mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, text}); return true; }}, log: {log() {}, error() {}}});
  const siteServer = await new Promise(r => { const s = site.listen(0, '127.0.0.1', () => r(s)); }); const siteBase = 'http://127.0.0.1:' + siteServer.address().port;
  const old = process.env.GZ_SITE_URL; process.env.GZ_SITE_URL = siteBase;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-upd-srv-')), updDir = path.join(directory + '-updates'), spawned = [], exits = [], backups = [];
  const inst = createServer({directory, noTimer: true, license: {publicKey: serverKey || pub}, update: {platform: 'win32', appDir: path.join(__dirname, '..'), spawn: a => spawned.push(a), onExit: () => exits.push(1),
    backups: {start: () => backups.push(1), wait: async () => { if (backups.fail) throw new Error('disco cheio'); }}}});
  await new Promise(r => inst.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + inst.server.address().port; let cookie = '';
  t.after(async () => { await inst.close(); siteServer.close(); site.locals.close(); for (const d of [siteDir, directory, updDir]) fs.rmSync(d, {recursive: true, force: true}); if (old === undefined) delete process.env.GZ_SITE_URL; else process.env.GZ_SITE_URL = old; });
  const call = async (url, body, status = 200) => { const r = await fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)}); const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; return text ? JSON.parse(text) : null; };
  await call('/api/setup', {name: 'Dono', username: 'admin', password: 'senha123'}); await call('/api/login', {username: 'admin', password: 'senha123'});
  const web = () => { let c = ''; return async (url, body, status = 200) => { const r = await fetch(siteBase + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: c}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const x of r.headers.getSetCookie?.() || []) { const [kv] = x.split(';'); if (kv.startsWith('gzs=')) c = kv.endsWith('=') ? '' : kv; } const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); return text ? JSON.parse(text) : null; }; };
  const dono = web(); await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  await fetch(siteBase + '/api/auth/verify?t=' + mails.find(m => m.to === 'dono@gamezoney.com').text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'});
  return {call, dono, web, dl, updDir, spawned, exits, backups, siteBase, inst};
}

test('1.0.6: Verificar atualização — manifesto assinado, download só com plano, SHA-256 conferido, backup antes e instalador aberto pelo GameZoney.exe quando o servidor é encerrado (1.1.3)', {skip: !createApp && 'site não encontrado'}, async t => {
  const s = await boot(t);
  let U = await s.call('/api/update/check', {}); assert.equal(U.status, 'latest');
  // o administrador publica 1.1.5 no site
  const bytes = crypto.randomBytes(300000), name = 'GameZoney-Servidor-1.1.5-Setup.exe'; fs.writeFileSync(path.join(s.dl, name), bytes);
  fs.writeFileSync(path.join(s.dl, 'GameZoney-Servidor-1.0.5-Setup.exe'), 'velho');
  const files = (await s.dono('/api/admin/updates')).files; assert.ok(files.some(f => f.file === name && f.version === '1.1.5'));
  await s.dono('/api/admin/updates/publish', {file: '../../etc/passwd'}, 404);
  const pub = (await s.dono('/api/admin/updates/publish', {file: name, notes: 'Plano na conta'})).published; assert.equal(pub.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  // sem plano: vê a versão nova mas não baixa
  U = await s.call('/api/update/check', {}); assert.equal(U.status, 'available'); assert.equal(U.available.version, '1.1.5'); assert.equal(U.available.canDownload, false); assert.equal(U.available.notes, 'Plano na conta');
  assert.match((await s.call('/api/update/download', {}, 400)).error, /faz parte do plano/);
  // com plano: baixa, confere e instala
  const ana = s.web(); await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  await s.dono('/api/admin/subscriptions/grant', {email: 'ana@x.com', plan: 'standard', months: 1});
  await s.call('/api/license/login', {email: 'ana@x.com', password: 'senha-forte-1'});
  U = await s.call('/api/update/check', {}); assert.equal(U.available.canDownload, true);
  await s.call('/api/update/install', {}, 400);
  await s.call('/api/update/download', {}); await s.inst.upd.wait();
  U = await s.call('/api/update'); assert.equal(U.status, 'ready', JSON.stringify(U)); assert.deepEqual(fs.readFileSync(path.join(s.updDir, name)), bytes);
  // o instalador baixado foi trocado no computador: não instala
  fs.writeFileSync(path.join(s.updDir, name), crypto.randomBytes(300000));
  assert.match((await s.call('/api/update/install', {}, 400)).error, /alterado neste computador/); assert.equal(s.spawned.length, 0); assert.ok(!fs.existsSync(path.join(s.updDir, name)));
  await s.call('/api/update/check', {}); await s.call('/api/update/download', {}); await s.inst.upd.wait();
  // backup falhou: não instala
  s.backups.fail = true; assert.match((await s.call('/api/update/install', {}, 400)).error, /backup/); assert.equal(s.spawned.length, 0); s.backups.fail = false;
  // 1.1.5: Instalar = backup + pedido pendente; o servidor NÃO fecha sozinho: espera ser encerrado (botão ou ícone do relógio)
  await s.call('/api/update/close', {}, 400);
  U = await s.call('/api/update/install', {}); assert.equal(U.status, 'waiting'); assert.equal(s.exits.length, 0);
  const pending = fs.readFileSync(path.join(s.updDir, 'pending-update.txt'), 'utf8').split(/\r?\n/);
  assert.deepEqual(pending.slice(0, 4), ['GZUPDATE1', pub.version, name, pub.sha256]);
  assert.equal((await s.call('/api/update/check', {})).status, 'waiting', 'verificar de novo não perde o pedido');
  // cancelar e pedir de novo
  assert.equal((await s.call('/api/update/cancel', {})).status, 'ready'); assert.ok(!fs.existsSync(path.join(s.updDir, 'pending-update.txt')));
  U = await s.call('/api/update/install', {}); assert.equal(U.status, 'waiting');
  U = await s.call('/api/update/close', {}); assert.equal(U.step, 'closing');
  await new Promise(r => setTimeout(r, 1700));
  assert.equal(s.exits.length, 1, 'servidor fecha com o código de atualização'); assert.equal(s.spawned.length, 0, 'sem PowerShell escondido');
  // servidor reaberto ainda na versão antiga: continua aguardando; aberto na versão nova: apaga o pedido e o instalador
  const updater = require('../updater');
  assert.equal(updater(s.inst.store, null, {version: '1.0.0', dir: s.updDir}).status().status, 'waiting');
  updater(s.inst.store, null, {version: pub.version, dir: s.updDir});
  assert.ok(!fs.existsSync(path.join(s.updDir, 'pending-update.txt'))); assert.ok(!fs.existsSync(path.join(s.updDir, name)));
  assert.ok(s.backups.length >= 2, 'backup antes'); assert.equal(s.exits.length, 1, 'servidor fecha com o código de atualização');
});

test('1.0.6: atualização — arquivo trocado no site, link vencido e manifesto assinado por outra chave são recusados', {skip: !createApp && 'site não encontrado'}, async t => {
  const s = await boot(t); const name = 'GameZoney-Servidor-1.1.5-Setup.exe', bytes = crypto.randomBytes(200000); fs.writeFileSync(path.join(s.dl, name), bytes);
  await s.dono('/api/admin/updates/publish', {file: name});
  const ana = s.web(); await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'}); await s.dono('/api/admin/subscriptions/grant', {email: 'ana@x.com', plan: 'pro', months: 1});
  await s.call('/api/license/login', {email: 'ana@x.com', password: 'senha-forte-1'}); await s.call('/api/update/check', {});
  // alguém troca o arquivo na pasta de downloads do site (mesmo tamanho): o servidor baixa, confere e recusa
  fs.writeFileSync(path.join(s.dl, name), crypto.randomBytes(200000));
  await s.call('/api/update/download', {}); await s.inst.upd.wait();
  const U = await s.call('/api/update'); assert.equal(U.status, 'error'); assert.match(U.error, /não confere com a assinatura/); assert.ok(!fs.existsSync(path.join(s.updDir, name)));
  // link de download adulterado ou sem assinatura do site
  assert.equal((await fetch(s.siteBase + '/api/update/file?i=' + crypto.randomUUID() + '&e=' + (Date.now() + 60000) + '&s=' + 'a'.repeat(40))).status, 403);
  assert.equal((await fetch(s.siteBase + '/api/update/file?i=x&e=1&s=1')).status, 403);
});

test('1.0.6: atualização — servidor com outra chave pública (site falso) não aceita o manifesto', {skip: !createApp && 'site não encontrado'}, async t => {
  const other = crypto.generateKeyPairSync('ed25519').publicKey.export({type: 'spki', format: 'pem'});
  const s = await boot(t, {serverKey: other}); fs.writeFileSync(path.join(s.dl, 'GameZoney-Servidor-2.0.0-Setup.exe'), crypto.randomBytes(1000));
  await s.dono('/api/admin/updates/publish', {file: 'GameZoney-Servidor-2.0.0-Setup.exe'});
  const U = await s.call('/api/update/check', {}); assert.equal(U.status, 'error'); assert.match(U.error, /assinatura não confere/);
});
