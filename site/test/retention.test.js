'use strict';
// 2.27 (pedido do dono): o site não pode passar de 10–20 GB em 2 anos ou mais. Limpeza automática só do que é registro
// temporário antigo; contas, pedidos, assinaturas, licenças, avaliações e configurações nunca saem.
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createApp} = require('../server');
const DAY = 86400000;
test('2.27: limpeza automática do site — tira só o antigo/temporário, mantém o resto, banco com auto_vacuum e espaço no /admin', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-ret-')); const mails = [];
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0',
    LICENSE_PRIVATE_KEY: crypto.generateKeyPairSync('ed25519').privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''},
    mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, subject, text}); return true; }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true, maxRetries: 5}); });
  const {open} = require('../db'); const db = open(dir); t.after(() => db.close());
  assert.equal(db.raw.prepare('PRAGMA auto_vacuum').get().auto_vacuum, 2, 'auto_vacuum incremental ligado');
  const now = Date.now(), old = now - 800 * DAY, year = now - 400 * DAY, recent = now - 10 * DAY;
  db.run("INSERT INTO users(id,email,name,created_at) VALUES('u1','ana@x.com','Ana',?)", old);
  for (const [at, n] of [[old, 5], [recent, 3]]) for (let i = 0; i < n; i++) { db.audit('x', 'teste', 'a'); db.run('UPDATE audit SET at=? WHERE id=(SELECT MAX(id) FROM audit)', at); db.run("INSERT INTO downloads(user_id,file,at) VALUES('u1','f.exe',?)", at); }
  // conversas: uma de 400 dias (sai com as mensagens), uma recente (fica)
  for (const [id, at] of [['c-old', year], ['c-new', recent]]) { db.run("INSERT INTO chats(id,token_hash,name,email,status,created_at,last_at) VALUES(?,?,'X','x@x.com','closed',?,?)", id, 'h' + id, at, at); for (let i = 0; i < 4; i++) db.run("INSERT INTO chat_messages(chat_id,sender,text,at) VALUES(?,'user','oi',?)", id, at); }
  db.run("INSERT INTO bot_misses(text,at,done) VALUES('a',?,1),('b',?,0),('c',?,0)", now - 100 * DAY, year, recent);
  db.run("INSERT INTO campaigns(id,subject,body,audience,status,created_at,created_by,finished_at,total,sent) VALUES('k1','s','b','all','done',?, 'dono',?,1,1)", year, year);
  db.run("INSERT INTO campaign_recipients(campaign_id,user_id,email,status,at) VALUES('k1','u1','ana@x.com','sent',?)", year);
  db.run("INSERT INTO orders(id,user_id,amount_cents,status,provider,pix_qr,created_at) VALUES('o1','u1',100,'paid','mercadopago','QRBASE64',?),('o2','u1',100,'pending','mercadopago','QR2',?)", year, now);
  const tdir = path.join(dir, 'media', 'tickets'); fs.mkdirSync(tdir, {recursive: true}); fs.writeFileSync(path.join(tdir, 't1-a.jpg'), 'x'); fs.writeFileSync(path.join(tdir, 't2-a.jpg'), 'x');
  db.run(`INSERT INTO tickets(id,user_id,subject,message,status,created_at,replied_at,images) VALUES('t1','u1','s','m','answered',?,?,'["t1-a.jpg"]'),('t2','u1','s','m','answered',?,?,'["t2-a.jpg"]')`, year, year, recent, recent);
  const r = app.locals.retention.run();
  assert.equal(r.audit, 5); assert.equal(r.downloads, 5); assert.equal(r.chats, 1); assert.equal(r.botMisses, 2); assert.equal(r.campaignRecipients, 1); assert.equal(r.pixQr, 1); assert.equal(r.ticketImages, 1);
  assert.equal(db.get('SELECT COUNT(*) n FROM audit WHERE at=?', recent).n, 3);
  assert.equal(db.get("SELECT COUNT(*) n FROM chat_messages WHERE chat_id='c-old'").n, 0, 'mensagens saem junto com a conversa');
  assert.equal(db.get("SELECT COUNT(*) n FROM chat_messages WHERE chat_id='c-new'").n, 4);
  assert.equal(db.get("SELECT pix_qr FROM orders WHERE id='o2'").pix_qr, 'QR2', 'PIX esperando pagamento mantém o QR');
  assert.equal(db.get("SELECT status FROM orders WHERE id='o1'").status, 'paid', 'pedido pago continua');
  assert.equal(db.get("SELECT sent FROM campaigns WHERE id='k1'").sent, 1, 'o comunicado guarda o total enviado');
  assert.ok(!fs.existsSync(path.join(tdir, 't1-a.jpg')) && fs.existsSync(path.join(tdir, 't2-a.jpg')));
  assert.ok(db.get("SELECT 1 FROM users WHERE id='u1'"), 'conta nunca sai');
  assert.deepEqual(Object.values(app.locals.retention.run()).filter(Boolean), [], 'segunda vez não tem nada a tirar');
  // tetos de linhas (o mais antigo sai primeiro)
  const small = require('../retention')({db, dataDir: dir, intervalMs: 0, rules: {auditMax: 2}, log: {log() {}, error() {}}});
  small.run(); assert.equal(db.get('SELECT COUNT(*) n FROM audit').n, 2);
  // teto das imagens: chamados respondidos mais antigos perdem a imagem primeiro; acima do teto geral o envio é recusado
  fs.writeFileSync(path.join(tdir, 't3-a.jpg'), Buffer.alloc(3000)); db.run(`INSERT INTO tickets(id,user_id,subject,message,status,created_at,replied_at,images) VALUES('t3','u1','s','m','open',?,NULL,'["t3-a.jpg"]')`, now);
  const tiny = require('../retention')({db, dataDir: dir, intervalMs: 0, rules: {ticketMediaMaxMB: 0.001, mediaMaxGB: 0.000004}, log: {log() {}, error() {}}});
  tiny.run(); assert.ok(!fs.existsSync(path.join(tdir, 't2-a.jpg')), 'imagem de chamado respondido sai'); assert.ok(fs.existsSync(path.join(tdir, 't3-a.jpg')), 'chamado aberto mantém a imagem');
  assert.equal(tiny.mediaRoom(100), true); assert.equal(tiny.mediaRoom(5000), false, 'acima do teto geral o envio de imagem é recusado');
  assert.match(fs.readFileSync(path.join(__dirname, '../community.js'), 'utf8'), /ctx\.mediaRoom/); assert.match(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8'), /retention\.mediaRoom/);
  // espaço no /admin
  const u = app.locals.retention.usage(path.join(dir, 'dl'));
  for (const k of ['db', 'media', 'backups', 'downloads']) assert.equal(typeof u[k], 'number', k);
  assert.ok(u.db > 0 && u.diskFree > 0);
  const admin = fs.readFileSync(path.join(__dirname, '../public/admin.js'), 'utf8'); assert.match(admin, /Disco livre/); assert.match(admin, /storage/);
  // backup diário: banco compactado, imagens com hard link, teto da pasta
  const sh = fs.readFileSync(path.join(__dirname, '../deploy/backup-site.sh'), 'utf8');
  for (const s of ['gzip -6', '--link-dest', 'MAX_GB', "head -n -14"]) assert.ok(sh.includes(s), s);
  assert.ok(!/tar -czf/.test(sh), 'sem .tgz completo das imagens por dia');
  const inst = fs.readFileSync(path.join(__dirname, '../deploy/instalar-vps.sh'), 'utf8'); assert.match(inst, /SystemMaxUse=500M/); assert.match(inst, /npm cache clean/);
});
