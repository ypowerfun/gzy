'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Site de venda do GameZoney: contas (e-mail/senha ou Google), compra da licença vitalícia por PIX (Mercado Pago),
// chaves de licença, ativação pelos servidores GameZoney, downloads, suporte, feedback e painel do administrador.
const express = require('express'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const {open} = require('./db');
const integrations = require('./integrations');

const DAY = 86400000;
const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const uid = () => crypto.randomUUID();
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const str = (v, max) => String(v ?? '').trim().slice(0, max);

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(password, salt, 64).toString('hex');
}
function checkPassword(password, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const got = crypto.scryptSync(String(password), Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex'));
}
function newKey() {
  const bytes = crypto.randomBytes(16);
  let s = ''; for (let i = 0; i < 16; i++) s += KEY_CHARS[bytes[i] % KEY_CHARS.length];
  return 'GZ-' + s.match(/.{4}/g).join('-');
}
function normalizeKey(v) {
  const raw = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); const body = raw.startsWith('GZ') ? raw.slice(2) : raw;
  return body.length === 16 ? 'GZ-' + body.match(/.{4}/g).join('-') : '';
}
const money = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');

function createApp(options = {}) {
  const env = {...process.env, ...(options.env || {})};
  const SITE = (env.SITE_URL || 'https://gamezoney.com').replace(/\/+$/, '');
  const PRICE = Number(env.PRICE_CENTS || 8990), LIST_PRICE = Number(env.LIST_PRICE_CENTS || 0);
  const PRICE_LABEL = env.PRICE_LABEL || 'Preço de Black Friday';
  const ADMINS = new Set(String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean));
  const secureCookie = env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : SITE.startsWith('https://');
  const dataDir = env.DATA_DIR || path.join(__dirname, 'data');
  const downloadsDir = env.DOWNLOADS_DIR || path.join(__dirname, 'downloads');
  const db = options.db || open(dataDir);
  const log = options.log || console;
  const pay = integrations.mercadoPago(env, options.fetch);
  const gg = integrations.google(env, options.fetch);
  const mail = options.mail || integrations.mailer(env, log);
  let privateKey = null;
  try { privateKey = crypto.createPrivateKey(env.LICENSE_PRIVATE_KEY || fs.readFileSync(env.LICENSE_PRIVATE_KEY_FILE || path.join(dataDir, 'license-private.pem'), 'utf8')); }
  catch { log.error('ATENÇÃO: chave de assinatura das licenças não encontrada (LICENSE_PRIVATE_KEY_FILE). A ativação de licenças fica indisponível.'); }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use((req, res, next) => {
    res.set({'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com; base-uri 'self'"});
    if (secureCookie) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({limit: '64kb'}));

  // ---------- limite de tentativas (por IP) ----------
  const buckets = new Map();
  const limit = (name, max, windowMs) => (req, res, next) => {
    const k = name + ':' + req.ip, now = Date.now(); let b = buckets.get(k);
    if (!b || b.until < now) { b = {n: 0, until: now + windowMs}; buckets.set(k, b); }
    if (++b.n > max) return res.status(429).json({error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'});
    next();
  };
  const sweep = setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.until < now) buckets.delete(k); db.run('DELETE FROM sessions WHERE expires_at<?', now); db.run('DELETE FROM resets WHERE expires_at<?', now); }, 600000);
  sweep.unref?.();

  // ---------- sessão ----------
  const COOKIE = 'gzs';
  const cookieOf = (req, name) => String(req.headers.cookie || '').split(/;\s*/).map(c => c.split('=')).find(([k]) => k === name)?.[1];
  const setCookie = (res, name, value, maxAge) => res.append('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${secureCookie ? '; Secure' : ''}; Max-Age=${Math.floor(maxAge / 1000)}`);
  function login(res, user) {
    const token = crypto.randomBytes(32).toString('hex');
    db.run('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)', sha(token), user.id, Date.now() + 30 * DAY, Date.now());
    db.run('UPDATE users SET last_login_at=? WHERE id=?', Date.now(), user.id);
    setCookie(res, COOKIE, token, 30 * DAY);
  }
  app.use((req, res, next) => {
    const token = cookieOf(req, COOKIE);
    req.user = token ? db.get('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', sha(token), Date.now()) : null;
    req.admin = !!(req.user && ADMINS.has(req.user.email.toLowerCase()));
    next();
  });
  const needUser = req => req.user || fail(401, 'Entre na sua conta.');
  const needAdmin = req => { needUser(req); if (!req.admin) fail(403, 'Acesso restrito ao administrador.'); };
  // POST do navegador só com JSON (proteção contra envio de formulário de outro site)
  const jsonOnly = (req, res, next) => (req.method === 'POST' && !req.is('application/json')) ? res.status(415).json({error: 'Envie JSON.'}) : next();
  const api = fn => (req, res) => Promise.resolve().then(() => fn(req, res)).then(r => { if (!res.headersSent) res.json(r ?? {ok: true}); })
    .catch(e => { if (!(e instanceof HttpError)) log.error(e); if (!res.headersSent) res.status(e.status || 500).json({error: e instanceof HttpError ? e.message : 'Erro interno. Tente de novo.'}); });

  const publicUser = u => u && ({id: u.id, email: u.email, name: u.name, phone: u.phone, google: !!u.google_sub, hasPassword: !!u.password_hash, createdAt: u.created_at});
  function createUser({email, name, password, googleSub}) {
    const u = {id: uid(), email, name, password_hash: password ? hashPassword(password) : null, google_sub: googleSub || null, created_at: Date.now()};
    db.run('INSERT INTO users(id,email,name,password_hash,google_sub,created_at) VALUES(?,?,?,?,?,?)', u.id, u.email, u.name, u.password_hash, u.google_sub, u.created_at);
    db.audit(email, 'conta', googleSub ? 'conta criada com Google' : 'conta criada');
    return db.get('SELECT * FROM users WHERE id=?', u.id);
  }

  // ---------- configuração pública ----------
  app.get('/api/config', (req, res) => res.json({priceCents: PRICE, listPriceCents: LIST_PRICE, priceLabel: PRICE_LABEL, trialDays: 30, google: gg.enabled, pix: pay.enabled,
    supportWhatsapp: env.SUPPORT_WHATSAPP || '', supportEmail: env.SUPPORT_EMAIL || ''}));

  // ---------- contas ----------
  app.post('/api/auth/register', jsonOnly, limit('auth', 20, 15 * 60000), api((req, res) => {
    const email = str(req.body.email, 200).toLowerCase(), name = str(req.body.name, 100), password = String(req.body.password || '');
    if (!name) fail(400, 'Informe seu nome.');
    if (!EMAIL_RE.test(email)) fail(400, 'Informe um e-mail válido.');
    if (password.length < 8 || password.length > 100) fail(400, 'A senha precisa ter de 8 a 100 caracteres.');
    if (db.get('SELECT id FROM users WHERE email=?', email)) fail(409, 'Já existe uma conta com este e-mail. Use Entrar (ou Esqueci a senha).');
    const user = createUser({email, name, password});
    login(res, user);
    mail.send(email, 'Bem-vindo ao GameZoney', `Olá, ${name}!\n\nSua conta no GameZoney foi criada. Baixe o sistema e use grátis por 30 dias:\n${SITE}/conta\n\nEquipe GameZoney`);
    return {user: publicUser(user)};
  }));
  app.post('/api/auth/login', jsonOnly, limit('auth', 20, 15 * 60000), api((req, res) => {
    const email = str(req.body.email, 200).toLowerCase(), user = db.get('SELECT * FROM users WHERE email=?', email);
    if (!user || !checkPassword(String(req.body.password || ''), user.password_hash)) fail(400, user && !user.password_hash ? 'Esta conta usa o login do Google. Clique em "Entrar com Google" (ou Esqueci a senha para criar uma senha).' : 'E-mail ou senha incorretos.');
    login(res, user); return {user: publicUser(user)};
  }));
  app.post('/api/auth/logout', jsonOnly, api((req, res) => {
    const token = cookieOf(req, COOKIE); if (token) db.run('DELETE FROM sessions WHERE token_hash=?', sha(token));
    setCookie(res, COOKIE, '', 0); return {ok: true};
  }));
  app.post('/api/auth/forgot', jsonOnly, limit('forgot', 5, 15 * 60000), api(async req => {
    const email = str(req.body.email, 200).toLowerCase(), user = db.get('SELECT * FROM users WHERE email=?', email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      db.run('INSERT INTO resets(token_hash,user_id,expires_at) VALUES(?,?,?)', sha(token), user.id, Date.now() + 3600000);
      await mail.send(email, 'GameZoney: redefinir senha', `Olá, ${user.name}!\n\nPara criar uma nova senha, abra o link abaixo (vale por 1 hora):\n${SITE}/redefinir.html?t=${token}\n\nSe não foi você, ignore este e-mail.`);
    }
    return {ok: true, mail: mail.enabled};
  }));
  app.post('/api/auth/reset', jsonOnly, limit('auth', 20, 15 * 60000), api((req, res) => {
    const token = String(req.body.token || ''), password = String(req.body.password || '');
    const row = db.get('SELECT * FROM resets WHERE token_hash=? AND expires_at>?', sha(token), Date.now()); if (!row) fail(400, 'Link inválido ou vencido. Peça outro em Esqueci a senha.');
    if (password.length < 8 || password.length > 100) fail(400, 'A senha precisa ter de 8 a 100 caracteres.');
    db.run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(password), row.user_id);
    db.run('DELETE FROM resets WHERE user_id=?', row.user_id); db.run('DELETE FROM sessions WHERE user_id=?', row.user_id);
    const user = db.get('SELECT * FROM users WHERE id=?', row.user_id); login(res, user); db.audit(user.email, 'conta', 'senha redefinida');
    return {ok: true};
  }));
  app.post('/api/profile', jsonOnly, api(req => {
    const u = needUser(req), name = str(req.body.name, 100), phone = str(req.body.phone, 30);
    if (!name) fail(400, 'Informe seu nome.');
    db.run('UPDATE users SET name=?, phone=? WHERE id=?', name, phone, u.id); return {ok: true};
  }));

  // ---------- Google ----------
  const redirectUri = SITE + '/auth/google/callback';
  app.get('/auth/google', (req, res) => {
    if (!gg.enabled) return res.redirect('/entrar.html?erro=' + encodeURIComponent('Login com Google ainda não configurado.'));
    const state = crypto.randomBytes(16).toString('hex'), next = /^\/[a-z0-9/._-]*$/i.test(String(req.query.next || '')) ? String(req.query.next) : '/conta';
    setCookie(res, 'gzg', state + '.' + Buffer.from(next).toString('base64url'), 600000);
    res.redirect(gg.authUrl(redirectUri, state));
  });
  app.get('/auth/google/callback', async (req, res) => {
    const [state, nextB64] = String(cookieOf(req, 'gzg') || '').split('.'); setCookie(res, 'gzg', '', 0);
    try {
      if (!state || state !== String(req.query.state || '')) throw new Error('Sessão de login expirada. Tente de novo.');
      if (req.query.error) throw new Error('Login com Google cancelado.');
      const p = await gg.profile(String(req.query.code || ''), redirectUri);
      let user = db.get('SELECT * FROM users WHERE google_sub=?', p.sub) || db.get('SELECT * FROM users WHERE email=?', p.email);
      if (user && !user.google_sub) db.run('UPDATE users SET google_sub=? WHERE id=?', p.sub, user.id);
      if (!user) user = createUser({email: p.email, name: p.name || p.email.split('@')[0], googleSub: p.sub});
      login(res, user);
      const next = nextB64 ? Buffer.from(nextB64, 'base64url').toString('utf8') : '/conta';
      res.redirect(/^\/[a-z0-9/._-]*$/i.test(next) ? next : '/conta');
    } catch (e) { res.redirect('/entrar.html?erro=' + encodeURIComponent(e.message)); }
  });

  // ---------- licenças ----------
  function signToken(lic, user) {
    if (!privateKey) fail(503, 'Ativação temporariamente indisponível. Fale com o suporte.');
    const body = Buffer.from(JSON.stringify({v: 1, key: lic.key, installId: lic.install_id, email: user.email, plan: lic.plan, issuedAt: lic.activated_at})).toString('base64url');
    return body + '.' + crypto.sign(null, Buffer.from(body, 'base64url'), privateKey).toString('base64url');
  }
  function issueLicense(userId, orderId, note = '') {
    let key; do key = newKey(); while (db.get('SELECT id FROM licenses WHERE key=?', key));
    const lic = {id: uid(), key};
    db.run('INSERT INTO licenses(id,key,user_id,order_id,created_at,note) VALUES(?,?,?,?,?,?)', lic.id, key, userId, orderId || null, Date.now(), note);
    return db.get('SELECT * FROM licenses WHERE id=?', lic.id);
  }
  // chamado pelo GameZoney Servidor (Configuração › Licença › Ativar)
  app.post('/api/license/activate', limit('activate', 30, 3600000), api(req => {
    const key = normalizeKey(req.body?.key), installId = str(req.body?.installId, 80), machine = str(req.body?.machine, 60), version = str(req.body?.version, 20);
    if (!key || !/^[0-9a-f-]{20,80}$/i.test(installId)) fail(400, 'Chave inválida.');
    const lic = db.get('SELECT * FROM licenses WHERE key=?', key); if (!lic) fail(404, 'Chave não encontrada. Confira a chave em gamezoney.com › Minha conta.');
    if (lic.status !== 'active') fail(403, 'Esta chave está bloqueada. Fale com o suporte do GameZoney.');
    if (lic.install_id && lic.install_id !== installId) fail(409, `Esta chave já está ativada em outro computador (${lic.machine || 'sem nome'}). Para trocar de computador, entre em gamezoney.com › Minha conta › Licenças e clique em Liberar.`);
    if (!lic.install_id) {
      db.run('UPDATE licenses SET install_id=?, machine=?, version=?, activated_at=? WHERE id=?', installId, machine, version, Date.now(), lic.id);
      db.audit(key, 'ativacao', `${machine} (${installId})`);
    } else db.run('UPDATE licenses SET machine=?, version=? WHERE id=?', machine || lic.machine, version || lic.version, lic.id);
    const fresh = db.get('SELECT * FROM licenses WHERE id=?', lic.id), user = db.get('SELECT * FROM users WHERE id=?', lic.user_id);
    return {token: signToken(fresh, user), email: user.email};
  }));
  const publicLicense = l => ({id: l.id, key: l.key, status: l.status, plan: l.plan, machine: l.machine || '', activatedAt: l.activated_at, active: !!l.install_id, createdAt: l.created_at, releases: l.releases});
  app.post('/api/licenses/:id/release', jsonOnly, api(req => {
    const u = needUser(req), lic = db.get('SELECT * FROM licenses WHERE id=? AND user_id=?', req.params.id, u.id) || fail(404, 'Licença não encontrada.');
    if (!lic.install_id) return {ok: true};
    db.run('UPDATE licenses SET install_id=NULL, machine=NULL, activated_at=NULL, releases=releases+1 WHERE id=?', lic.id);
    db.audit(u.email, 'liberar', `${lic.key} liberada de ${lic.machine || '?'}`);
    return {ok: true};
  }));

  // ---------- compra (PIX) ----------
  const publicOrder = o => o && ({id: o.id, amountCents: o.amount_cents, status: o.status, provider: o.provider, pixCode: o.pix_code || '', pixQr: o.pix_qr || '', pixUrl: o.pix_url || '', expiresAt: o.expires_at, createdAt: o.created_at, paidAt: o.paid_at,
    licenseKey: o.license_id ? db.get('SELECT key FROM licenses WHERE id=?', o.license_id)?.key : null, pixKey: o.provider === 'manual' ? (env.PIX_KEY || '') : ''});
  function fulfill(orderId, providerNote = '') {
    const result = db.tx(() => {
      const o = db.get('SELECT * FROM orders WHERE id=?', orderId); if (!o || o.status === 'paid') return null;
      const lic = issueLicense(o.user_id, o.id);
      db.run("UPDATE orders SET status='paid', paid_at=?, license_id=?, note=? WHERE id=?", Date.now(), lic.id, providerNote, o.id);
      return {o, lic};
    });
    if (!result) return;
    const user = db.get('SELECT * FROM users WHERE id=?', result.o.user_id);
    db.audit(user.email, 'compra', `${money(result.o.amount_cents)} • ${result.lic.key}`);
    mail.send(user.email, 'GameZoney: sua licença vitalícia', `Olá, ${user.name}!\n\nPagamento confirmado. Obrigado por escolher o GameZoney!\n\nSua chave de licença (vitalícia, nunca expira):\n\n    ${result.lic.key}\n\nComo ativar: no GameZoney Servidor, abra Configuração › Licença › Ativar licença e digite a chave.\nSuas chaves e downloads: ${SITE}/conta\n\nSuporte: ${SITE}/conta#suporte\n\nEquipe GameZoney`);
  }
  async function refreshOrder(o) {
    if (o.status !== 'pending' || o.provider !== 'mercadopago' || !o.provider_id || !pay.enabled) return o;
    try {
      const p = await pay.getPayment(o.provider_id);
      if (p.status === 'approved' && p.orderId === o.id && p.amountCents >= o.amount_cents) fulfill(o.id, 'Mercado Pago ' + p.id);
      else if (['cancelled', 'rejected', 'refunded', 'charged_back'].includes(p.status)) db.run("UPDATE orders SET status='canceled', note=? WHERE id=? AND status='pending'", 'Mercado Pago: ' + p.status, o.id);
    } catch (e) { log.error('Consulta do pagamento falhou:', e.message); }
    return db.get('SELECT * FROM orders WHERE id=?', o.id);
  }
  app.post('/api/checkout', jsonOnly, limit('checkout', 20, 3600000), api(async req => {
    const u = needUser(req), now = Date.now();
    let o = db.get("SELECT * FROM orders WHERE user_id=? AND status='pending' AND expires_at>? AND amount_cents=? ORDER BY created_at DESC LIMIT 1", u.id, now + 60000, PRICE);
    if (o) return {order: publicOrder(await refreshOrder(o))};
    db.run("UPDATE orders SET status='expired' WHERE user_id=? AND status='pending' AND expires_at<=?", u.id, now);
    const id = uid(), expiresAt = now + 30 * 60000;
    if (pay.enabled) {
      const pix = await pay.createPix({orderId: id, amountCents: PRICE, description: 'GameZoney - Licença vitalícia', email: u.email, name: u.name, notificationUrl: SITE + '/api/mp/webhook', expiresAt});
      db.run('INSERT INTO orders(id,user_id,amount_cents,status,provider,provider_id,pix_code,pix_qr,pix_url,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, u.id, PRICE, 'pending', 'mercadopago', pix.providerId, pix.pixCode, pix.pixQr, pix.pixUrl, expiresAt, now);
    } else {
      // sem Mercado Pago configurado: PIX manual (chave PIX_KEY); o administrador confirma o pagamento no painel /admin
      db.run('INSERT INTO orders(id,user_id,amount_cents,status,provider,expires_at,created_at) VALUES(?,?,?,?,?,?,?)', id, u.id, PRICE, 'pending', 'manual', now + 7 * DAY, now);
    }
    db.audit(u.email, 'pedido', `${money(PRICE)} (${pay.enabled ? 'PIX Mercado Pago' : 'PIX manual'})`);
    return {order: publicOrder(db.get('SELECT * FROM orders WHERE id=?', id))};
  }));
  app.get('/api/orders/:id', api(async req => {
    const u = needUser(req), o = db.get('SELECT * FROM orders WHERE id=? AND user_id=?', req.params.id, u.id) || fail(404, 'Pedido não encontrado.');
    return {order: publicOrder(await refreshOrder(o))};
  }));
  // aviso do Mercado Pago (Webhook): o pagamento é sempre conferido na API do Mercado Pago
  app.post('/api/mp/webhook', limit('webhook', 300, 60000), async (req, res) => {
    res.json({ok: true});
    const id = String(req.body?.data?.id || req.query['data.id'] || req.query.id || '');
    if (!/^\d{1,30}$/.test(id) || !pay.enabled) return;
    const o = db.get('SELECT * FROM orders WHERE provider_id=?', id); if (o) await refreshOrder(o);
  });

  // ---------- conta ----------
  app.get('/api/me', api(req => {
    if (!req.user) return {user: null};
    const u = req.user;
    return {user: publicUser(u), admin: req.admin,
      licenses: db.all('SELECT * FROM licenses WHERE user_id=? ORDER BY created_at DESC', u.id).map(publicLicense),
      orders: db.all('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 20', u.id).map(o => ({...publicOrder(o), pixQr: ''})),
      tickets: db.all('SELECT id,subject,message,status,reply,created_at,replied_at FROM tickets WHERE user_id=? ORDER BY created_at DESC LIMIT 50', u.id),
      downloads: listDownloads()};
  }));
  app.post('/api/support', jsonOnly, limit('support', 10, 3600000), api(req => {
    const u = needUser(req), subject = str(req.body.subject, 120), message = str(req.body.message, 4000);
    if (subject.length < 3) fail(400, 'Informe o assunto.'); if (message.length < 5) fail(400, 'Descreva o que precisa.');
    const id = uid(); db.run('INSERT INTO tickets(id,user_id,subject,message,created_at) VALUES(?,?,?,?,?)', id, u.id, subject, message, Date.now());
    for (const a of ADMINS) mail.send(a, 'GameZoney suporte: ' + subject, `${u.name} <${u.email}> ${u.phone || ''}\n\n${message}\n\nResponder: ${SITE}/admin`);
    return {ok: true, id};
  }));

  // ---------- downloads (instaladores na pasta downloads/) ----------
  function listDownloads() {
    try { return fs.readdirSync(downloadsDir).filter(f => /^[\w.\-]+\.(exe|zip|pdf)$/i.test(f)).map(f => ({file: f, size: fs.statSync(path.join(downloadsDir, f)).size})).sort((a, b) => a.file.localeCompare(b.file)); }
    catch { return []; }
  }
  app.get('/download/:file', (req, res) => {
    if (!req.user) return res.redirect('/entrar.html?next=/conta');
    const f = listDownloads().find(d => d.file === req.params.file); if (!f) return res.status(404).send('Arquivo não encontrado.');
    db.run('INSERT INTO downloads(user_id,file,at) VALUES(?,?,?)', req.user.id, f.file, Date.now());
    res.download(path.join(downloadsDir, f.file), f.file);
  });

  // ---------- feedback enviado pelos servidores GameZoney (Perfil › Feedback) ----------
  app.post('/api/feedback', limit('feedback', 120, 3600000), api(req => {
    const b = req.body || {}, id = str(b.id, 60), comment = str(b.comment, 2000);
    if (!id || comment.length < 3) fail(400, 'Feedback inválido.');
    db.run('INSERT OR IGNORE INTO feedback(id,name,email,comment,at,server_version,install_id,received_at,ip) VALUES(?,?,?,?,?,?,?,?,?)', id, str(b.name, 100), str(b.email, 120), comment, str(b.at, 40), str(b.serverVersion, 20), str(b.installId, 80), Date.now(), req.ip);
    return {ok: true};
  }));

  // ---------- administrador (ADMIN_EMAILS) ----------
  app.get('/api/admin/overview', api(req => {
    needAdmin(req);
    const count = sql => db.get(sql).n;
    return {
      stats: {users: count('SELECT COUNT(*) n FROM users'), licenses: count('SELECT COUNT(*) n FROM licenses'), activeLicenses: count('SELECT COUNT(*) n FROM licenses WHERE install_id IS NOT NULL'),
        paidOrders: count("SELECT COUNT(*) n FROM orders WHERE status='paid'"), revenueCents: db.get("SELECT COALESCE(SUM(amount_cents),0) n FROM orders WHERE status='paid'").n,
        openTickets: count("SELECT COUNT(*) n FROM tickets WHERE status='open'"), downloads: count('SELECT COUNT(*) n FROM downloads')},
      users: db.all('SELECT id,email,name,phone,google_sub IS NOT NULL google,created_at,last_login_at FROM users ORDER BY created_at DESC LIMIT 300'),
      orders: db.all('SELECT o.*,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 300').map(o => ({...publicOrder(o), pixQr: '', email: o.email, note: o.note})),
      licenses: db.all('SELECT l.*,u.email FROM licenses l JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC LIMIT 500').map(l => ({...publicLicense(l), email: l.email, note: l.note, installId: l.install_id || ''})),
      tickets: db.all('SELECT t.*,u.email,u.name FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY (t.status=\'open\') DESC, t.created_at DESC LIMIT 300'),
      feedback: db.all('SELECT * FROM feedback ORDER BY received_at DESC LIMIT 300'),
      audit: db.all('SELECT * FROM audit ORDER BY id DESC LIMIT 200')
    };
  }));
  app.post('/api/admin/orders/:id/approve', jsonOnly, api(req => {
    needAdmin(req); const o = db.get('SELECT * FROM orders WHERE id=?', req.params.id) || fail(404, 'Pedido não encontrado.');
    if (o.status === 'paid') fail(400, 'Pedido já pago.');
    db.run("UPDATE orders SET status='pending' WHERE id=?", o.id); fulfill(o.id, 'Confirmado manualmente por ' + req.user.email);
    return {ok: true};
  }));
  app.post('/api/admin/licenses', jsonOnly, api(req => {
    needAdmin(req); const email = str(req.body.email, 200).toLowerCase(), note = str(req.body.note, 200);
    const user = db.get('SELECT * FROM users WHERE email=?', email) || fail(404, 'Nenhuma conta com este e-mail. Peça para o cliente criar a conta primeiro.');
    const lic = issueLicense(user.id, null, note || 'Emitida pelo administrador');
    db.audit(req.user.email, 'licenca', `${lic.key} emitida para ${email}`);
    mail.send(email, 'GameZoney: sua licença', `Olá, ${user.name}!\n\nSua chave de licença do GameZoney:\n\n    ${lic.key}\n\nAtive em Configuração › Licença no GameZoney Servidor.\n${SITE}/conta`);
    return {ok: true, key: lic.key};
  }));
  app.post('/api/admin/licenses/:id', jsonOnly, api(req => {
    needAdmin(req); const lic = db.get('SELECT * FROM licenses WHERE id=?', req.params.id) || fail(404, 'Licença não encontrada.');
    if (req.body.release) db.run('UPDATE licenses SET install_id=NULL, machine=NULL, activated_at=NULL, releases=releases+1 WHERE id=?', lic.id);
    if (['active', 'blocked'].includes(req.body.status)) db.run('UPDATE licenses SET status=? WHERE id=?', req.body.status, lic.id);
    db.audit(req.user.email, 'licenca', `${lic.key}: ${req.body.release ? 'liberada ' : ''}${req.body.status || ''}`);
    return {ok: true};
  }));
  app.post('/api/admin/tickets/:id', jsonOnly, api(req => {
    needAdmin(req); const t = db.get('SELECT t.*,u.email,u.name FROM tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?', req.params.id) || fail(404, 'Chamado não encontrado.');
    const reply = str(req.body.reply, 4000), status = req.body.status === 'open' ? 'open' : 'closed';
    db.run('UPDATE tickets SET reply=?, status=?, replied_at=? WHERE id=?', reply || t.reply, status, Date.now(), t.id);
    if (reply) mail.send(t.email, 'GameZoney suporte: ' + t.subject, `Olá, ${t.name}!\n\n${reply}\n\nSeus chamados: ${SITE}/conta#suporte`);
    return {ok: true};
  }));

  // ---------- páginas ----------
  app.get('/conta', (req, res) => res.sendFile(path.join(__dirname, 'public', 'conta.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  app.get('/entrar', (req, res) => res.redirect('/entrar.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
  app.use(express.static(path.join(__dirname, 'public'), {extensions: ['html'], maxAge: '1h'}));
  app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));
  app.locals.close = () => { clearInterval(sweep); db.close(); };
  return app;
}

if (require.main === module) {
  const app = createApp(), port = Number(process.env.PORT || 8080);
  app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`GameZoney site em http://${process.env.HOST || '127.0.0.1'}:${port}`));
}
module.exports = {createApp, newKey, normalizeKey, hashPassword, checkPassword};
