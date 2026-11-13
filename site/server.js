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
class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };
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
const DUMMY_HASH = hashPassword('gamezoney-tempo-constante'); // mesma demora quando o e-mail não existe

function createApp(options = {}) {
  const env = {...process.env, ...(options.env || {})};
  const SITE = (env.SITE_URL || 'https://gamezoney.com').replace(/\/+$/, '');
  // 1.4: oferta (preço "por", preço "de" riscado, texto da promoção e faixa do topo) editável em /admin; o .env vale como padrão
  const OFFER_DEFAULT = {priceCents: Number(env.PRICE_CENTS || 8990), listPriceCents: Number(env.LIST_PRICE_CENTS || 0) || 18990, priceLabel: env.PRICE_LABEL || 'Preço de Black Friday', banner: env.PROMO_BANNER || 'Black Friday GameZoney'};
  function offer() { let saved = {}; try { saved = JSON.parse(db.get("SELECT value FROM settings WHERE key='offer'")?.value || '{}'); } catch { } return {...OFFER_DEFAULT, ...saved}; }
  const ADMINS = new Set(String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean));
  const secureCookie = env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : SITE.startsWith('https://');
  const dataDir = env.DATA_DIR || path.join(__dirname, 'data');
  const downloadsDir = env.DOWNLOADS_DIR || path.join(__dirname, 'downloads');
  const db = options.db || open(dataDir);
  const track = require('./tracking')(db); // 2.8: Pixel da Meta e tag do Google (IDs em /admin › Anúncios)
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
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': track.csp(/^\/(conta|carrinho)(\.html)?\/?$/.test(req.path) && env.MP_PUBLIC_KEY
        // 1.9: só Minha conta (compra) carrega o quadro de pagamento do Mercado Pago (script, campos do cartão e imagens das bandeiras)
        ? "default-src 'self'; img-src 'self' data: https://*.mlstatic.com https://*.mercadopago.com https://*.mercadolibre.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.mlstatic.com; font-src 'self' data: https://fonts.gstatic.com https://*.mlstatic.com; script-src 'self' https://sdk.mercadopago.com https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com; connect-src 'self' https://*.mercadopago.com https://*.mercadolibre.com https://*.mercadolivre.com https://*.mlstatic.com; frame-src https://*.mercadopago.com https://*.mercadolibre.com https://*.mercadolivre.com; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com; base-uri 'self'"
        : "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com; base-uri 'self'")}); // 2.8: + Meta/Google só com ID configurado
    // 1.3: sem includeSubDomains (mail. e webmail. continuam na HostGator/Titan)
    if (secureCookie) res.set('Strict-Transport-Security', 'max-age=31536000');
    // 1.8: a logo e as imagens do design/comunicados aparecem dentro dos e-mails (Outlook, Hotmail, Gmail): só elas saem do 'same-origin'
    if (req.method === 'GET' && (req.path === '/logo-gamezoney.png' || req.path.startsWith('/media/design/') || req.path.startsWith('/share/'))) res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
    next();
  });
  const smallJson = express.json({limit: '64kb'});
  app.use((req, res, next) => (req.path === '/api/reviews' || req.path === '/api/support' || req.path === '/api/admin/design/image' || req.path === '/api/app/relay' || req.path.startsWith('/servidor/')) ? next() : smallJson(req, res, next)); // 1.4.1: app da recepção (/servidor/<endereço>) repassa o corpo como veio // 1.3.7: a ligação do app (relay) traz a logo da arena // avaliações, chamados com imagens e imagens do design têm limite próprio

  // ---------- limite de tentativas (por IP) ----------
  const buckets = new Map();
  const limit = (name, max, windowMs) => (req, res, next) => {
    const k = name + ':' + req.ip, now = Date.now(); let b = buckets.get(k);
    if (!b || b.until < now) { b = {n: 0, until: now + windowMs}; buckets.set(k, b); }
    if (++b.n > max) return res.status(429).json({error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'});
    next();
  };
  // 1.3: limite geral da API por IP (abuso/robôs)
  app.use('/api', limit('api', 600, 60000));
  // 1.3: POST que usa a sessão só vale vindo do próprio site (Origin/Referer); aviso do Mercado Pago, ativação e feedback dos servidores não usam sessão
  const MACHINE = new Set(['/api/mp/webhook', '/api/license/activate', '/api/feedback', '/api/unsubscribe', '/api/plan/login', '/api/plan/refresh', '/api/plan/logout', '/api/plan/from-license', '/api/update/check', '/api/trial/anchor', '/api/units/report']);
  const siteOrigin = new URL(SITE).origin;
  app.use((req, res, next) => {
    if (req.method !== 'POST' || MACHINE.has(req.path) || req.path.startsWith('/api/app/') || req.path.startsWith('/servidor/')) return next(); // 1.4.1: o app da recepção confere a própria origem (app.gamezoney.com) // 1.3.7: app do cliente usa token no cabeçalho (sem cookie de sessão) e vem de app.gamezoney.com
    const from = req.headers.origin || (req.headers.referer ? (() => { try { return new URL(req.headers.referer).origin; } catch { return 'x'; } })() : '');
    if (from && from !== siteOrigin && !(options.allowOrigin && options.allowOrigin(from))) return res.status(403).json({error: 'Origem não permitida.'});
    next();
  });
  const sweep = setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.until < now) buckets.delete(k); db.run('DELETE FROM sessions WHERE expires_at<?', now); db.run('DELETE FROM resets WHERE expires_at<?', now); db.run('DELETE FROM verifications WHERE expires_at<?', now); db.run('DELETE FROM feedback WHERE id IN (SELECT id FROM feedback ORDER BY received_at DESC LIMIT -1 OFFSET 5000)'); }, 600000);
  sweep.unref?.();

  // ---------- sessão ----------
  const COOKIE = 'gzs';
  const cookieOf = (req, name) => String(req.headers.cookie || '').split(/;\s*/).map(c => c.split('=')).find(([k]) => k === name)?.[1];
  const setCookie = (res, name, value, maxAge) => res.append('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${secureCookie ? '; Secure' : ''}; Max-Age=${Math.floor(maxAge / 1000)}`);
  const ADMIN_MFA = env.ADMIN_MFA !== '0'; // 2.5: verificação em duas etapas do /admin (ADMIN_MFA=0 desliga, só para testes)
  const markSignup = res => res.append('Set-Cookie', `gzev=signup; Path=/; SameSite=Lax; Max-Age=600${secureCookie ? '; Secure' : ''}`); // 2.8: evento de cadastro para os anúncios
  function login(res, user) {
    const token = crypto.randomBytes(32).toString('hex');
    db.run('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)', sha(token), user.id, Date.now() + 30 * DAY, Date.now());
    db.run('UPDATE users SET last_login_at=? WHERE id=?', Date.now(), user.id);
    setCookie(res, COOKIE, token, 30 * DAY);
  }
  app.use((req, res, next) => {
    const token = cookieOf(req, COOKIE);
    req.sessionHash = token ? sha(token) : '';
    req.user = token ? db.get('SELECT u.*, s.admin_until AS session_admin_until FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', req.sessionHash, Date.now()) : null;
    req.adminAccount = !!(req.user && req.user.email_verified && ADMINS.has(req.user.email.toLowerCase())); // 1.3: admin só com e-mail confirmado
    // 2.5: e, além da senha (ou Google), o código de 6 dígitos enviado ao e-mail nesta sessão (vale 12 h)
    req.admin = req.adminAccount && (!ADMIN_MFA || req.user.session_admin_until > Date.now());
    next();
  });
  const needUser = req => req.user || fail(401, 'Entre na sua conta.');
  const needAdmin = req => { needUser(req); if (!req.admin && req.adminAccount) fail(403, 'Digite o código enviado ao seu e-mail para entrar na administração.', {needCode: true}); if (!req.admin) fail(403, ADMINS.has(req.user.email.toLowerCase()) && !req.user.email_verified ? 'Confirme o seu e-mail para acessar a administração (Minha conta › Reenviar confirmação).' : 'Acesso restrito ao administrador.'); };
  // POST do navegador só com JSON (proteção contra envio de formulário de outro site)
  const jsonOnly = (req, res, next) => (req.method === 'POST' && !req.is('application/json')) ? res.status(415).json({error: 'Envie JSON.'}) : next();
  const api = fn => (req, res) => Promise.resolve().then(() => fn(req, res)).then(r => { if (!res.headersSent) res.json(r ?? {ok: true}); })
    .catch(e => { if (!(e instanceof HttpError)) log.error(e); if (!res.headersSent) res.status(e.status || 500).json(e instanceof HttpError ? {...(e.extra || {}), error: e.message} : {error: 'Erro interno. Tente de novo.'}); });

  // 1.8: e-mails com o visual GameZoney (email-template.js): texto simples + HTML no mesmo envio
  const tpl = require('./email-template');
  const notify = (to, subject, o) => { const m = {site: SITE, subject, ...o}; return mail.send(to, subject, tpl.renderText(m), {html: tpl.renderEmail(m), ...(o.mailOpts || {})}); };
  const publicUser = u => u && ({id: u.id, email: u.email, name: u.name, phone: u.phone, organization: u.organization || '', marketing: !u.marketing_opt_out, emailVerified: !!u.email_verified, google: !!u.google_sub, hasPassword: !!u.password_hash, createdAt: u.created_at});
  function createUser({email, name, password, googleSub}) {
    const u = {id: uid(), email, name, password_hash: password ? hashPassword(password) : null, google_sub: googleSub || null, created_at: Date.now()};
    db.run('INSERT INTO users(id,email,name,password_hash,google_sub,created_at,email_verified) VALUES(?,?,?,?,?,?,?)', u.id, u.email, u.name, u.password_hash, u.google_sub, u.created_at, googleSub ? 1 : 0);
    db.audit(email, 'conta', googleSub ? 'conta criada com Google' : 'conta criada');
    return db.get('SELECT * FROM users WHERE id=?', u.id);
  }

  // ---------- 1.3: confirmação de e-mail ----------
  async function sendVerification(user) {
    const token = crypto.randomBytes(32).toString('hex');
    db.run('INSERT INTO verifications(token_hash,user_id,expires_at) VALUES(?,?,?)', sha(token), user.id, Date.now() + 7 * DAY);
    return notify(user.email, 'GameZoney: confirme seu e-mail', {preheader: 'Confirme seu e-mail para usar sua conta GameZoney.', lines: [`Olá, ${user.name}!`, 'Confirme o seu endereço de e-mail para usar todos os recursos da sua conta GameZoney.'],
      title: 'Confirme seu e-mail', button: {label: 'Confirmar e-mail', url: `${SITE}/api/auth/verify?t=${token}`}, codeNote: 'O link vale por 7 dias.', after: ['Se não foi você que criou a conta, ignore este e-mail.']});
  }
  app.get('/api/auth/verify', (req, res) => {
    const row = db.get('SELECT * FROM verifications WHERE token_hash=? AND expires_at>?', sha(String(req.query.t || '')), Date.now());
    if (!row) return res.redirect('/conta?verificado=0');
    db.run('UPDATE users SET email_verified=1 WHERE id=?', row.user_id); db.run('DELETE FROM verifications WHERE user_id=?', row.user_id);
    db.audit(db.get('SELECT email FROM users WHERE id=?', row.user_id)?.email || '?', 'conta', 'e-mail confirmado');
    res.redirect('/conta?verificado=1');
  });

  // ---------- configuração pública ----------
  // "+N arenas confiam" no topo da inicial (pedido do dono): 5000 + 100 a cada 100 contas criadas (105 contas = 5100); conta guardada por 1 min
  let arenasCache = {at: 0, n: 5000};
  const arenasTrust = () => { if (Date.now() - arenasCache.at > 60000) arenasCache = {at: Date.now(), n: arenasFor(db.get('SELECT COUNT(*) n FROM users').n)}; return arenasCache.n; };
  app.get('/api/config', (req, res) => { const o = offer(); res.json({priceCents: o.priceCents, listPriceCents: o.listPriceCents, priceLabel: o.priceLabel, banner: o.banner, trialDays: 30, google: gg.enabled, pix: pay.enabled, card: pay.enabled, bricks: !!(pay.enabled && env.MP_PUBLIC_KEY), subscriptions: !!(pay.enabled && env.MP_PUBLIC_KEY), legacySales: env.LEGACY_SALES === '1', plans: plans.publicPlans(), mpPublicKey: pay.enabled ? (env.MP_PUBLIC_KEY || '') : '',
    supportWhatsapp: env.SUPPORT_WHATSAPP || '', supportEmail: env.SUPPORT_EMAIL || '', tracking: track.publicConfig(), arenas: arenasTrust()}); });

  // ---------- contas ----------
  app.post('/api/auth/register', jsonOnly, limit('auth', 20, 15 * 60000), api((req, res) => {
    const email = str(req.body.email, 200).toLowerCase(), name = str(req.body.name, 100), password = String(req.body.password || '');
    if (!name) fail(400, 'Informe seu nome.');
    if (!EMAIL_RE.test(email)) fail(400, 'Informe um e-mail válido.');
    if (password.length < 8 || password.length > 100) fail(400, 'A senha precisa ter de 8 a 100 caracteres.');
    if (db.get('SELECT id FROM users WHERE email=?', email)) fail(409, 'Já existe uma conta com este e-mail. Use Entrar (ou Esqueci a senha).');
    const user = createUser({email, name, password});
    login(res, user); markSignup(res);
    // 1.3: boas-vindas + link de confirmação do e-mail
    const token = crypto.randomBytes(32).toString('hex');
    db.run('INSERT INTO verifications(token_hash,user_id,expires_at) VALUES(?,?,?)', sha(token), user.id, Date.now() + 7 * DAY);
    notify(email, 'Bem-vindo ao GameZoney', {preheader: 'Sua conta foi criada. Confirme seu e-mail e teste grátis por 30 dias.', lines: [`Olá, ${name}!`, 'Sua conta no GameZoney foi criada. Confirme o seu e-mail para começar.'],
      title: 'Confirme seu e-mail', button: {label: 'Confirmar e-mail', url: `${SITE}/api/auth/verify?t=${token}`}, after: [`Depois, baixe o sistema e use grátis por 30 dias em Minha conta: ${SITE}/conta`]});
    return {user: publicUser(user)};
  }));
  // 1.3: no máximo 10 senhas erradas por conta a cada 15 min (contra tentativa de adivinhar a senha de vários lugares)
  function checkAccount(rawEmail, password) {
    const email = str(rawEmail, 200).toLowerCase(), user = db.get('SELECT * FROM users WHERE email=?', email);
    const fk = 'fail:' + email, now = Date.now(); let fb = buckets.get(fk);
    if (fb && fb.until > now && fb.n >= 10) fail(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
    const ok = user ? checkPassword(String(password || ''), user.password_hash) : (checkPassword('x', DUMMY_HASH), false);
    if (!ok) { if (!fb || fb.until < now) { fb = {n: 0, until: now + 15 * 60000}; buckets.set(fk, fb); } fb.n++; }
    else buckets.delete(fk);
    if (!user || !ok) fail(400, user && !user.password_hash ? 'Esta conta usa o login do Google. Crie uma senha em gamezoney.com › Entrar › Esqueci a senha e use o e-mail e essa senha aqui.' : 'E-mail ou senha incorretos.');
    return user;
  }
  app.post('/api/auth/login', jsonOnly, limit('auth', 20, 15 * 60000), api((req, res) => {
    const user = checkAccount(req.body.email, req.body.password);
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
      await notify(email, 'GameZoney: redefinir senha', {preheader: 'Crie uma nova senha para sua conta GameZoney.', lines: [`Olá, ${user.name}!`, 'Recebemos um pedido para criar uma nova senha na sua conta GameZoney.'],
        title: 'Criar nova senha', button: {label: 'Criar nova senha', url: `${SITE}/redefinir.html?t=${token}`}, codeNote: 'O link vale por 1 hora.', after: ['Se não foi você, ignore este e-mail: sua senha continua a mesma.']});
    }
    return {ok: true, mail: mail.enabled};
  }));
  app.post('/api/auth/reset', jsonOnly, limit('auth', 20, 15 * 60000), api((req, res) => { // 1.3: redefinir pelo link do e-mail também confirma o e-mail
    const token = String(req.body.token || ''), password = String(req.body.password || '');
    const row = db.get('SELECT * FROM resets WHERE token_hash=? AND expires_at>?', sha(token), Date.now()); if (!row) fail(400, 'Link inválido ou vencido. Peça outro em Esqueci a senha.');
    if (password.length < 8 || password.length > 100) fail(400, 'A senha precisa ter de 8 a 100 caracteres.');
    db.run('UPDATE users SET password_hash=?, email_verified=1 WHERE id=?', hashPassword(password), row.user_id);
    db.run('DELETE FROM resets WHERE user_id=?', row.user_id); db.run('DELETE FROM sessions WHERE user_id=?', row.user_id);
    const user = db.get('SELECT * FROM users WHERE id=?', row.user_id); login(res, user); db.audit(user.email, 'conta', 'senha redefinida');
    return {ok: true};
  }));
  // ---------- 2.5: verificação em duas etapas do /admin ----------
  // Depois de entrar (senha ou Google), o administrador pede um código de 6 dígitos que vai para o e-mail da conta.
  // O código vale 10 minutos e 5 tentativas, fica guardado só como resumo (hash) preso a ESTA sessão e libera o /admin
  // por 12 horas. Sair da conta, trocar ou redefinir a senha encerra a sessão e pede código de novo.
  const mfaHash = (session, code) => sha('gz-admin-code:' + session + ':' + code);
  app.post('/api/auth/admin-code/send', jsonOnly, limit('admincode', 5, 15 * 60000), api(async req => {
    needUser(req); if (!req.adminAccount) fail(403, 'Acesso restrito ao administrador.');
    if (req.admin) return {ok: true, already: true};
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'), u = req.user;
    db.run('UPDATE sessions SET mfa_hash=?, mfa_expires=?, mfa_tries=0 WHERE token_hash=?', mfaHash(req.sessionHash, code), Date.now() + 10 * 60000, req.sessionHash);
    const sent = await Promise.resolve(notify(u.email, 'GameZoney: código de acesso à administração', {preheader: 'Seu código para entrar na administração do GameZoney.', lines: [`Olá, ${u.name}!`, 'Use o código abaixo para entrar na administração do site GameZoney.'],
      title: 'Código de acesso', code, codeNote: 'O código vale por 10 minutos e só funciona no navegador onde foi pedido.', after: ['Se não foi você, troque a sua senha em Minha conta › Meus dados › Redefinir senha: alguém pode ter a sua senha.']})).then(r => r !== false, () => false);
    // sem e-mail funcionando, o dono não fica trancado para fora: o código vai para o registro do serviço na VPS
    if (!sent || !mail.enabled) log.log(`Código de acesso à administração para ${u.email}: ${code} (e-mail indisponível; vale 10 minutos)`);
    db.audit(u.email, 'admin', 'código de acesso pedido');
    return {ok: true, sent: sent && mail.enabled, to: u.email.replace(/^(.{2}).*(@.*)$/, '$1***$2')};
  }));
  app.post('/api/auth/admin-code/verify', jsonOnly, limit('admincodev', 20, 15 * 60000), api(req => {
    needUser(req); if (!req.adminAccount) fail(403, 'Acesso restrito ao administrador.');
    const code = String(req.body?.code || '').replace(/\D/g, ''), s = db.get('SELECT mfa_hash, mfa_expires, mfa_tries FROM sessions WHERE token_hash=?', req.sessionHash);
    if (!s || !s.mfa_hash || s.mfa_expires < Date.now()) fail(400, 'Código vencido. Peça um novo código.');
    if (s.mfa_tries >= 5) fail(429, 'Muitas tentativas erradas. Peça um novo código.');
    const want = Buffer.from(s.mfa_hash), got = Buffer.from(mfaHash(req.sessionHash, code));
    if (code.length !== 6 || !crypto.timingSafeEqual(want, got)) {
      db.run('UPDATE sessions SET mfa_tries=mfa_tries+1 WHERE token_hash=?', req.sessionHash);
      if (s.mfa_tries + 1 >= 5) { db.run("UPDATE sessions SET mfa_hash='' WHERE token_hash=?", req.sessionHash); db.audit(req.user.email, 'admin', 'código de acesso: 5 tentativas erradas'); fail(429, 'Muitas tentativas erradas. Peça um novo código.'); }
      fail(400, 'Código incorreto.');
    }
    db.run("UPDATE sessions SET admin_until=?, mfa_hash='', mfa_expires=0, mfa_tries=0 WHERE token_hash=?", Date.now() + 12 * 3600000, req.sessionHash);
    db.audit(req.user.email, 'admin', 'entrou na administração (código por e-mail)');
    return {ok: true};
  }));
  app.post('/api/auth/verify/resend', jsonOnly, limit('verify', 5, 3600000), api(async req => {
    const u = needUser(req); if (u.email_verified) return {ok: true, verified: true};
    return {ok: true, sent: await sendVerification(u)};
  }));
  app.post('/api/profile', jsonOnly, api(req => {
    const u = needUser(req), name = str(req.body.name, 100), phone = str(req.body.phone, 30), organization = str(req.body.organization, 100);
    if (!name) fail(400, 'Informe seu nome.');
    db.run('UPDATE users SET name=?, phone=?, organization=? WHERE id=?', name, phone, organization, u.id);
    if (typeof req.body.marketing === 'boolean') db.run('UPDATE users SET marketing_opt_out=? WHERE id=?', req.body.marketing ? 0 : 1, u.id); // 1.8: receber comunicados e promoções
    return {ok: true};
  }));

  // ---------- Google ----------
  const redirectUri = SITE + '/auth/google/callback';
  app.get('/auth/google', (req, res) => {
    if (!gg.enabled) return res.redirect('/entrar.html?erro=' + encodeURIComponent('Login com Google ainda não configurado.'));
    const state = crypto.randomBytes(16).toString('hex'), next = /^\/(?!\/)[a-z0-9/._#-]*$/i.test(String(req.query.next || '')) ? String(req.query.next) : '/conta';
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
      if (user && !user.google_sub) db.run('UPDATE users SET google_sub=?, email_verified=1 WHERE id=?', p.sub, user.id);
      if (!user) { user = createUser({email: p.email, name: p.name || p.email.split('@')[0], googleSub: p.sub}); markSignup(res); }
      login(res, user);
      const next = nextB64 ? Buffer.from(nextB64, 'base64url').toString('utf8') : '/conta';
      res.redirect(/^\/(?!\/)[a-z0-9/._#-]*$/i.test(next) ? next : '/conta');
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
    // 1.6: chave já ativada em outro computador — só troca com o e-mail e a senha da conta dona da chave (a mesma do site)
    if (lic.install_id && lic.install_id !== installId) {
      if (req.body?.email === undefined && req.body?.password === undefined)
        fail(409, `Esta chave já está ativada em outro computador (${lic.machine || 'sem nome'}). Para ativar neste computador, entre com o e-mail e a senha da sua conta gamezoney.com.`, {needLogin: true, machine: lic.machine || ''});
      const owner = db.get('SELECT * FROM users WHERE id=?', lic.user_id), u = checkAccount(req.body.email, req.body.password);
      if (u.id !== owner.id) fail(403, 'Esta chave pertence a outra conta. Entre com o e-mail e a senha da conta que comprou a licença.');
      db.run('INSERT INTO license_transfers(license_id,at,how,from_install,from_machine,to_install,to_machine,ip) VALUES(?,?,?,?,?,?,?,?)', lic.id, Date.now(), 'servidor', lic.install_id, lic.machine || '', installId, machine, req.ip || '');
      db.run('UPDATE licenses SET install_id=NULL, machine=NULL, activated_at=NULL, releases=releases+1 WHERE id=?', lic.id);
      db.audit(owner.email, 'troca', `${key} trocada de ${lic.machine || '?'} para ${machine || '?'}`);
      Promise.resolve(notify(owner.email, 'GameZoney: licença ativada em outro computador', {preheader: 'Sua licença foi ativada em outro computador.', lines: [`Olá, ${owner.name}!`, `Sua licença foi ativada no computador "${machine || 'sem nome'}" e deixou de valer no computador "${lic.machine || 'sem nome'}".`],
        title: 'Licença', code: `${key.slice(0, 7)}-****-****-${key.slice(-4)}`, after: ['Se não foi você, troque a senha da sua conta agora e fale com o suporte.'], button: {label: 'Trocar minha senha', url: `${SITE}/entrar.html`}})).catch(() => {});
      lic.install_id = null;
    }
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
    db.run('INSERT INTO license_transfers(license_id,at,how,from_install,from_machine,ip) VALUES(?,?,?,?,?,?)', lic.id, Date.now(), 'site', lic.install_id, lic.machine || '', req.ip || '');
    db.run('UPDATE licenses SET install_id=NULL, machine=NULL, activated_at=NULL, releases=releases+1 WHERE id=?', lic.id);
    db.audit(u.email, 'liberar', `${lic.key} liberada de ${lic.machine || '?'}`);
    return {ok: true};
  }));

  // ---------- compra (PIX) ----------
  const publicOrder = o => o && ({id: o.id, amountCents: o.amount_cents, status: o.status, provider: o.provider, pixCode: o.pix_code || '', pixQr: o.pix_qr || '', pixUrl: o.pix_url || '', checkoutUrl: o.checkout_url || '', method: o.provider === 'mercadopago-card' ? 'card' : (o.provider === 'mercadopago-brick' && !o.pix_code ? 'brick' : 'pix'), expiresAt: o.expires_at, createdAt: o.created_at, paidAt: o.paid_at,
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
    notify(user.email, 'GameZoney: sua licença vitalícia', {preheader: 'Pagamento confirmado. Aqui está a sua chave de licença.', lines: [`Olá, ${user.name}!`, 'Pagamento confirmado. Obrigado por escolher o GameZoney!'],
      title: 'Sua chave de licença', code: result.lic.key, codeNote: 'Licença vitalícia: nunca expira.', button: {label: 'Downloads', url: `${SITE}/conta#downloads`},
      after: ['Como ativar: no GameZoney Servidor, abra Configuração › Licença › Ativar licença e digite a chave.', `Precisa de ajuda? ${SITE}/conta#suporte`]});
  }
  const approved = (o, p) => p.status === 'approved' && p.orderId === o.id && p.amountCents >= o.amount_cents;
  async function refreshOrder(o) {
    if (o.status !== 'pending' || !pay.enabled || !String(o.provider).startsWith('mercadopago')) return o;
    try {
      if (o.provider === 'mercadopago-card' || o.provider === 'mercadopago-brick') {
        // cartão: o cliente pode tentar mais de um cartão no mesmo pedido; vale o primeiro aprovado
        const ok = (await pay.findPayments(o.id)).find(p => approved(o, p));
        if (ok) fulfill(o.id, (o.provider === 'mercadopago-brick' ? 'Mercado Pago (no site) ' : 'Mercado Pago cartão ') + ok.id);
      } else if (o.provider_id) {
        const p = await pay.getPayment(o.provider_id);
        if (approved(o, p)) fulfill(o.id, 'Mercado Pago ' + p.id);
        else if (['cancelled', 'rejected', 'refunded', 'charged_back'].includes(p.status)) db.run("UPDATE orders SET status='canceled', note=? WHERE id=? AND status='pending'", 'Mercado Pago: ' + p.status, o.id);
      }
    } catch (e) { log.error('Consulta do pagamento falhou:', e.message); }
    return db.get('SELECT * FROM orders WHERE id=?', o.id);
  }
  app.post('/api/checkout', jsonOnly, limit('checkout', 20, 3600000), api(async req => {
    const u = needUser(req), now = Date.now(), card = req.body?.method === 'card', brick = req.body?.method === 'brick', PRICE = offer().priceCents;
    // 2.0: a licença vitalícia não é mais vendida (só com LEGACY_SALES=1); agora são os planos por assinatura
    if (env.LEGACY_SALES !== '1') fail(410, 'A licença vitalícia não é mais vendida. Escolha um plano em gamezoney.com/#precos.');
    if (card && !pay.enabled) fail(400, 'Pagamento com cartão indisponível no momento. Use o PIX.');
    if (brick && !(pay.enabled && env.MP_PUBLIC_KEY)) fail(400, 'Pagamento no site indisponível no momento.');
    const provider = brick ? 'mercadopago-brick' : card ? 'mercadopago-card' : (pay.enabled ? 'mercadopago' : 'manual');
    let o = db.get("SELECT * FROM orders WHERE user_id=? AND status='pending' AND provider=? AND expires_at>? AND amount_cents=? ORDER BY created_at DESC LIMIT 1", u.id, provider, now + 60000, PRICE);
    if (o) return {order: publicOrder(await refreshOrder(o))};
    db.run("UPDATE orders SET status='expired' WHERE user_id=? AND status='pending' AND expires_at<=?", u.id, now);
    const id = uid(), expiresAt = now + 30 * 60000;
    if (brick) {
      // 1.9: o pedido nasce sem pagamento; o cliente paga no quadro do Mercado Pago dentro do site (/api/checkout/brick)
      db.run('INSERT INTO orders(id,user_id,amount_cents,status,provider,expires_at,created_at) VALUES(?,?,?,?,?,?,?)', id, u.id, PRICE, 'pending', 'mercadopago-brick', now + 2 * DAY, now);
    } else if (card) {
      const c = await pay.createCardCheckout({orderId: id, amountCents: PRICE, title: 'GameZoney - Licença vitalícia', email: u.email, notificationUrl: SITE + '/api/mp/webhook', backUrl: SITE + '/conta?pedido=' + id + '#comprar'});
      db.run('INSERT INTO orders(id,user_id,amount_cents,status,provider,provider_id,checkout_url,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)', id, u.id, PRICE, 'pending', 'mercadopago-card', c.providerId, c.url, now + 2 * DAY, now);
    } else if (pay.enabled) {
      const pix = await pay.createPix({orderId: id, amountCents: PRICE, description: 'GameZoney - Licença vitalícia', email: u.email, name: u.name, notificationUrl: SITE + '/api/mp/webhook', expiresAt});
      db.run('INSERT INTO orders(id,user_id,amount_cents,status,provider,provider_id,pix_code,pix_qr,pix_url,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, u.id, PRICE, 'pending', 'mercadopago', pix.providerId, pix.pixCode, pix.pixQr, pix.pixUrl, expiresAt, now);
    } else {
      // sem Mercado Pago configurado: PIX manual (chave PIX_KEY); o administrador confirma o pagamento no painel /admin
      db.run('INSERT INTO orders(id,user_id,amount_cents,status,provider,expires_at,created_at) VALUES(?,?,?,?,?,?,?)', id, u.id, PRICE, 'pending', 'manual', now + 7 * DAY, now);
    }
    db.audit(u.email, 'pedido', `${money(PRICE)} (${brick ? 'Mercado Pago no site' : card ? 'cartão Mercado Pago' : pay.enabled ? 'PIX Mercado Pago' : 'PIX manual'})`);
    return {order: publicOrder(db.get('SELECT * FROM orders WHERE id=?', id))};
  }));
  // 1.9: pagamento enviado pelo quadro do Mercado Pago (Checkout Bricks) dentro de Minha conta
  const CARD_MSG = {cc_rejected_bad_filled_card_number: 'Confira o número do cartão.', cc_rejected_bad_filled_date: 'Confira a validade do cartão.', cc_rejected_bad_filled_security_code: 'Confira o código de segurança (CVV).',
    cc_rejected_bad_filled_other: 'Confira os dados do cartão.', cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente. Tente outro cartão ou o PIX.', cc_rejected_call_for_authorize: 'O banco pediu autorização: fale com o banco e tente de novo.',
    cc_rejected_card_disabled: 'Cartão não habilitado: fale com o banco.', cc_rejected_duplicated_payment: 'Pagamento duplicado: confira se você já não foi cobrado.', cc_rejected_high_risk: 'Pagamento recusado pela análise de segurança. Tente outro cartão ou o PIX.',
    cc_rejected_max_attempts: 'Limite de tentativas atingido. Tente outro cartão ou o PIX.', cc_rejected_blacklist: 'Pagamento recusado. Tente outro cartão ou o PIX.'};
  app.post('/api/checkout/brick', jsonOnly, limit('brickpay', 15, 3600000), api(async req => {
    const u = needUser(req), o = db.get("SELECT * FROM orders WHERE id=? AND user_id=? AND provider='mercadopago-brick'", str(req.body.orderId, 60), u.id) || fail(404, 'Pedido não encontrado.');
    if (o.status === 'paid') return {order: publicOrder(o), payment: {status: 'approved'}};
    if (o.status !== 'pending' || o.expires_at < Date.now()) fail(400, 'Este pedido venceu. Recarregue a página para começar de novo.');
    if (!(pay.enabled && env.MP_PUBLIC_KEY)) fail(400, 'Pagamento no site indisponível no momento.');
    let p;
    try { p = await pay.createBrickPayment({orderId: o.id, amountCents: o.amount_cents, description: 'GameZoney - Licença vitalícia', email: u.email, notificationUrl: SITE + '/api/mp/webhook', formData: req.body.formData, deviceId: str(req.body.deviceId, 120), attempt: crypto.randomBytes(6).toString('hex')}); }
    catch (e) { log.error('Pagamento no site:', e.message); fail(400, /inválida|incompletos/.test(e.message) ? e.message : 'O Mercado Pago não aceitou o pagamento. Confira os dados ou tente o PIX.'); }
    db.audit(u.email, 'pagamento', `Mercado Pago (no site) ${p.pix ? 'PIX' : 'cartão'} ${p.providerId}: ${p.status} ${p.detail}`);
    if (p.pix && p.pixCode) db.run('UPDATE orders SET provider_id=?, pix_code=?, pix_qr=?, pix_url=?, expires_at=? WHERE id=?', p.providerId, p.pixCode, p.pixQr, p.pixUrl, Date.now() + 30 * 60000, o.id);
    else if (!p.pix) db.run('UPDATE orders SET provider_id=? WHERE id=?', p.providerId, o.id);
    if (approved(o, p)) fulfill(o.id, 'Mercado Pago (no site) ' + p.providerId);
    const fresh = publicOrder(db.get('SELECT * FROM orders WHERE id=?', o.id));
    if (['rejected', 'cancelled'].includes(p.status)) return {order: fresh, payment: {status: 'rejected', message: CARD_MSG[p.detail] || 'Pagamento recusado. Tente outro cartão ou o PIX.'}};
    return {order: fresh, payment: {status: p.status === 'approved' ? 'approved' : 'pending'}};
  }));
  app.get('/api/orders/:id', api(async req => {
    const u = needUser(req), o = db.get('SELECT * FROM orders WHERE id=? AND user_id=?', req.params.id, u.id) || fail(404, 'Pedido não encontrado.');
    return {order: publicOrder(await refreshOrder(o))};
  }));
  // aviso do Mercado Pago (Webhook): o pagamento é sempre conferido na API do Mercado Pago
  app.post('/api/mp/webhook', limit('webhook', 300, 60000), async (req, res) => {
    res.json({ok: true});
    const id = String(req.body?.data?.id || req.query['data.id'] || req.query.id || '');
    // 2.0: avisos de assinatura (preapproval / cobrança da assinatura)
    const type = String(req.body?.type || req.query.type || req.query.topic || '');
    if (/preapproval|subscription|authorized_payment/.test(type)) { await plans.webhook(type, id); return; }
    if (!/^\d{1,30}$/.test(id) || !pay.enabled) return;
    let o = db.get('SELECT * FROM orders WHERE provider_id=?', id);
    if (!o) { // cartão: o pagamento é criado no Mercado Pago; o pedido vem na referência do pagamento
      try { const p = await pay.getPayment(id); o = p.orderId && db.get("SELECT * FROM orders WHERE id=? AND provider IN ('mercadopago-card','mercadopago-brick')", p.orderId); } catch (e) { log.error('Aviso do Mercado Pago:', e.message); }
    }
    if (o) await refreshOrder(o);
  });

  // ---------- conta ----------
  app.get('/api/me', api(async req => {
    if (!req.user) return {user: null};
    const u = req.user;
    return {user: publicUser(u), admin: req.adminAccount, adminVerified: req.admin, ...(await plans.forUser(u.id)),
      licenses: db.all('SELECT * FROM licenses WHERE user_id=? ORDER BY created_at DESC', u.id).map(publicLicense),
      orders: db.all('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 20', u.id).map(o => ({...publicOrder(o), pixQr: ''})),
      tickets: db.all('SELECT id,subject,message,status,reply,created_at,replied_at,images FROM tickets WHERE user_id=? ORDER BY created_at DESC LIMIT 50', u.id).map(ticketOut),
      downloads: listDownloads()};
  }));
  // 2.4: até 2 imagens (.jpg/.png, até 1 MB cada) por chamado, guardadas fora da pasta pública (só o dono do chamado e o admin veem);
  // um chamado por vez: enquanto houver chamado aguardando resposta, não abre outro
  const ticketDir = path.join(dataDir, 'media', 'tickets'); fs.mkdirSync(ticketDir, {recursive: true});
  const TICKET_IMAGE = 1024 * 1024;
  function ticketOut(t) { return {...t, images: JSON.parse(t.images || '[]').map((f, i) => `/api/tickets/${t.id}/image/${i}`)}; }
  app.post('/api/support', (req, res, next) => req.user ? next() : res.status(401).json({error: 'Entre na sua conta.'}), express.json({limit: '3mb'}), jsonOnly, limit('support', 10, 3600000), api(req => {
    const u = needUser(req), subject = str(req.body.subject, 120).replace(/[\r\n]+/g, ' '), message = str(req.body.message, 4000);
    if (db.get("SELECT 1 FROM tickets WHERE user_id=? AND status='open'", u.id)) fail(409, 'Você já tem um chamado aguardando resposta. Assim que respondermos, você poderá abrir outro.');
    if (subject.length < 3) fail(400, 'Informe o assunto.'); if (message.length < 5) fail(400, 'Descreva o que precisa.');
    const imgs = Array.isArray(req.body.images) ? req.body.images : [];
    if (imgs.length > 2) fail(400, 'No máximo 2 imagens.');
    const decoded = imgs.map(d => require('./image-util').decodeImage(d, TICKET_IMAGE, fail));
    const id = uid(), files = decoded.map((d, i) => { const f = `${id}-${i}-${crypto.randomBytes(6).toString('hex')}.${d.ext}`; fs.writeFileSync(path.join(ticketDir, f), d.buf); return f; });
    db.run('INSERT INTO tickets(id,user_id,subject,message,created_at,images) VALUES(?,?,?,?,?,?)', id, u.id, subject, message, Date.now(), JSON.stringify(files));
    for (const a of ADMINS) mail.send(a, 'GameZoney suporte: ' + subject, `${u.name} <${u.email}> ${u.phone || ''}\n\n${message}${files.length ? `\n\n(${files.length} imagem(ns) anexada(s): veja no /admin)` : ''}\n\nResponder: ${SITE}/admin`);
    return {ok: true, id};
  }));
  app.get('/api/tickets/:id/image/:n', (req, res) => {
    const t = req.user && db.get('SELECT user_id, images FROM tickets WHERE id=?', String(req.params.id));
    if (!t || (t.user_id !== req.user.id && !req.admin)) return res.status(404).json({error: 'Imagem não encontrada.'});
    const f = JSON.parse(t.images || '[]')[Number(req.params.n)];
    if (!f || !/^[\w-]+\.(png|jpg)$/.test(f)) return res.status(404).json({error: 'Imagem não encontrada.'});
    res.set('Cache-Control', 'private, no-store'); res.type(f.endsWith('.png') ? 'png' : 'jpeg'); res.sendFile(path.join(ticketDir, f));
  });

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
  app.post('/api/feedback', limit('feedback', 30, 3600000), api(req => {
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
      licenses: db.all('SELECT l.*,u.email,(SELECT COUNT(*) FROM license_transfers t WHERE t.license_id=l.id AND t.at>?) recent,(SELECT COUNT(DISTINCT COALESCE(t.to_install,t.from_install)) FROM license_transfers t WHERE t.license_id=l.id) machines FROM licenses l JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC LIMIT 500', Date.now() - 30 * DAY).map(l => ({...publicLicense(l), email: l.email, note: l.note, installId: l.install_id || '', recentTransfers: l.recent, machines: l.machines, suspect: l.recent >= 3})),
      tickets: db.all('SELECT t.*,u.email,u.name FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY (t.status=\'open\') DESC, t.created_at DESC LIMIT 300').map(ticketOut),
      feedback: db.all('SELECT * FROM feedback ORDER BY received_at DESC LIMIT 300'),
      audit: db.all('SELECT * FROM audit ORDER BY id DESC LIMIT 200'),
      reviews: extra.adminReviews(), unreadChats: extra.unreadChats(), offer: offer()
    };
  }));
  app.post('/api/admin/offer', jsonOnly, api(req => {
    needAdmin(req); const b = req.body || {}, cur = offer();
    // 2.4: o /admin edita só a faixa do topo; os preços da venda antiga (vitalícia) ficam como estão
    if (b.priceCents === undefined) { b.priceCents = cur.priceCents; b.listPriceCents = cur.listPriceCents; b.priceLabel = cur.priceLabel; }
    const priceCents = Math.round(Number(b.priceCents)), listPriceCents = Math.round(Number(b.listPriceCents || 0));
    if (!Number.isFinite(priceCents) || priceCents < 100 || priceCents > 10000000) fail(400, 'Preço inválido (mínimo R$ 1,00).');
    if (!Number.isFinite(listPriceCents) || listPriceCents < 0 || (listPriceCents && listPriceCents <= priceCents)) fail(400, 'O preço "de" precisa ser maior que o preço "por" (ou 0 para não mostrar).');
    const o = {priceCents, listPriceCents, priceLabel: str(b.priceLabel, 60) || OFFER_DEFAULT.priceLabel, banner: str(b.banner, 60)};
    db.run("INSERT INTO settings(key,value) VALUES('offer',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", JSON.stringify(o));
    db.audit(req.user.email, 'oferta', `de ${money(listPriceCents)} por ${money(priceCents)} • ${o.priceLabel} • ${o.banner}`);
    return {offer: offer()};
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
    notify(email, 'GameZoney: sua licença', {preheader: 'Sua chave de licença do GameZoney.', lines: [`Olá, ${user.name}!`], title: 'Sua chave de licença', code: lic.key, codeNote: 'Licença vitalícia: nunca expira.',
      button: {label: 'Downloads', url: `${SITE}/conta#downloads`}, after: ['Ative em Configuração › Licença no GameZoney Servidor.']});
    return {ok: true, key: lic.key};
  }));
  app.post('/api/admin/licenses/:id', jsonOnly, api(req => {
    needAdmin(req); const lic = db.get('SELECT * FROM licenses WHERE id=?', req.params.id) || fail(404, 'Licença não encontrada.');
    if (req.body.release && lic.install_id) { db.run('INSERT INTO license_transfers(license_id,at,how,from_install,from_machine,ip) VALUES(?,?,?,?,?,?)', lic.id, Date.now(), 'admin', lic.install_id, lic.machine || '', req.ip || ''); db.run('UPDATE licenses SET install_id=NULL, machine=NULL, activated_at=NULL, releases=releases+1 WHERE id=?', lic.id); }
    if (['active', 'blocked'].includes(req.body.status)) db.run('UPDATE licenses SET status=? WHERE id=?', req.body.status, lic.id);
    db.audit(req.user.email, 'licenca', `${lic.key}: ${req.body.release ? 'liberada ' : ''}${req.body.status || ''}`);
    return {ok: true};
  }));
  app.post('/api/admin/tickets/:id', jsonOnly, api(async req => {
    needAdmin(req); const t = db.get('SELECT t.*,u.email,u.name FROM tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?', req.params.id) || fail(404, 'Chamado não encontrado.');
    const reply = str(req.body.reply, 4000), status = req.body.status === 'open' ? 'open' : 'closed';
    db.run('UPDATE tickets SET reply=?, status=?, replied_at=? WHERE id=?', reply || t.reply, status, Date.now(), t.id);
    // o envio do e-mail não derruba o pedido se falhar; o cliente também vê a resposta em Minha conta › Suporte
    const emailed = reply && reply !== t.reply ? await Promise.resolve(notify(t.email, 'GameZoney suporte: ' + t.subject, {preheader: 'Resposta do suporte GameZoney.', lines: [`Olá, ${t.name}!`, reply], button: {label: 'Ver meus chamados', url: `${SITE}/conta#suporte`}})).then(r => r !== false, () => false) : undefined;
    db.audit(req.user.email, 'chamado', `${t.subject} (${t.email}): ${status === 'open' ? 'reaberto' : 'respondido e fechado'}`);
    return {ok: true, emailed};
  }));

  // ---------- avaliações e chat ao vivo (community.js) ----------
  const extra = require('./community')(app, {db, needUser, needAdmin, jsonOnly, api, limit, fail, str, uid, mail, ADMINS, SITE, dataDir, log, secureCookie, plansInfo: () => plans.publicPlans(), chatIdleMs: options.chatIdleMs, botDelayMs: options.botDelayMs});
  // 1.7: design do site (editor visual) e parceiros do rodapé
  require('./design')(app, {db, needAdmin, jsonOnly, api, fail, str, dataDir});
  // 1.8: comunicados e promoções por e-mail (fila) e cancelar inscrição
  const campaigns = require('./campaigns')(app, {db, needAdmin, jsonOnly, api, fail, str, uid, mail, SITE, env, log, intervalMs: options.campaignIntervalMs});
  app.locals.campaignTick = campaigns.tick;
  // 2.0: planos Standard/Pro por assinatura (mensal/anual, cobrança automática no cartão)
  const plans = require('./plans')(app, {db, needUser, needAdmin, jsonOnly, api, limit, fail, str, uid, pay, env, SITE, log, notify, intervalMs: options.planSyncIntervalMs ?? options.campaignIntervalMs});
  app.locals.plans = plans;
  // 2.2: GameZoney Servidor entra com a conta do site e recebe o certificado do plano
  const planActivation = require('./plan-activation')(app, {db, api, fail, str, limit, plans, checkAccount, privateKey, notify, SITE, log});
  // 2.3: atualização do GameZoney Servidor (manifesto assinado + download só com plano ativo)
  require('./updates')(app, {db, needAdmin, jsonOnly, api, fail, str, limit, privateKey, downloadsDir, plans, planActivation, SITE, log});
  // 2.9: Multi-Unidade (plano Pro): resumo de cada loja em Minha conta › Unidades
  require('./units')(app, {db, needUser, needAdmin, jsonOnly, api, fail, str, limit, plans, planActivation, log});
  // Servidor 1.3.7: app do cliente em app.gamezoney.com (repasse até o GameZoney Servidor da arena; nada de clientes gravado aqui)
  const memberApp = require('./member-app')(app, {db, api, fail, str, limit, plans, planActivation, log, express, env, notify, mail, publicDir: path.join(__dirname, 'public'), holdMs: options.appHoldMs, replyTimeoutMs: options.appReplyMs, panelHosts: options.panelHosts, panelReplyMs: options.panelReplyMs});
  app.locals.memberApp = memberApp;

  // 1.3: capturas do sistema só são entregues para exibir na página (<img>); abrir/baixar o endereço direto é recusado
  app.use('/img', (req, res, next) => { // 1.4: vale para todas as imagens do site (capturas e foto do topo)
    const dest = req.headers['sec-fetch-dest'], site = req.headers['sec-fetch-site'];
    if ((dest && dest !== 'image') || site === 'cross-site') return res.status(403).send('Imagem protegida.'); // abrir em nova aba/baixar ou usar em outro site
    res.set('Cache-Control', 'private, max-age=86400'); next();
  });
  // ---------- 1.4: Guia (só para quem fez login) ----------
  const privateDir = path.join(__dirname, 'private');
  app.get(['/guia', '/guia.html'], (req, res) => req.user ? res.set('Cache-Control', 'no-store').sendFile(path.join(privateDir, 'guia.html')) : res.redirect('/entrar.html?next=/guia'));
  app.get('/guia-img/:file', (req, res) => {
    if (!req.user) return res.status(401).send('Entre na sua conta.');
    const dest = req.headers['sec-fetch-dest'];
    if ((dest && dest !== 'image') || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).send('Imagem protegida.');
    if (!/^[a-z0-9-]+-(pt|en|es)\.jpg$/.test(req.params.file)) return res.status(404).send('');
    res.set('Cache-Control', 'private, max-age=86400').sendFile(path.join(privateDir, 'guia-img', req.params.file), err => { if (err && !res.headersSent) res.status(404).send(''); });
  });
  app.get('/guia/modelo-clientes.csv', (req, res) => req.user ? res.download(path.join(privateDir, 'modelo-clientes.csv'), 'modelo-clientes.csv') : res.redirect('/entrar.html?next=/guia'));

  // ---------- páginas ----------
  track.routes(app, {needAdmin, jsonOnly, api, fail});
  // 2.6: páginas públicas com SEO por idioma (/, /en/, /es/), robots.txt e sitemap.xml
  require('./seo')(app, {publicDir: path.join(__dirname, 'public'), SITE, plans});
  app.get('/conta', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, 'public', 'conta.html')));
  app.get('/admin', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, 'public', 'admin.html')));
  app.get('/entrar', (req, res) => res.redirect('/entrar.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
  // 2.18: página HTML sempre conferida (no-cache + ETag) para nunca juntar página nova com .js/.css antigo guardado no navegador
  // (Minha conta ficava em "Carregando sua conta…"); .js/.css com ?v= ficam guardados 1 dia; sem ?v= são conferidos a cada abertura
  app.use(express.static(path.join(__dirname, 'public'), {extensions: ['html'], maxAge: '1h', setHeaders: (res, file) => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.html') res.setHeader('Cache-Control', 'no-cache');
    else if (ext === '.js' || ext === '.css') res.setHeader('Cache-Control', /[?&]v=/.test(res.req.originalUrl || '') ? 'public, max-age=86400' : 'no-cache');
  }}));
  app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));
  // 1.3: qualquer erro não tratado (JSON inválido, arquivo inexistente…) responde sem detalhes internos
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) log.error(err);
    if (res.headersSent) return next(err);
    if (req.path.startsWith('/api')) return res.status(status).json({error: status === 413 ? 'Arquivo grande demais.' : status < 500 ? 'Requisição inválida.' : 'Erro interno. Tente de novo.'});
    res.status(status === 404 ? 404 : status).sendFile(path.join(__dirname, 'public', '404.html'));
  });
  app.locals.close = () => { memberApp.stop(); clearInterval(sweep); extra.stop(); campaigns.stop(); plans.stop(); db.close(); };
  return app;
}

if (require.main === module) {
  const app = createApp(), port = Number(process.env.PORT || 8080);
  app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`GameZoney site em http://${process.env.HOST || '127.0.0.1'}:${port}`));
}
// 5000 + 100 a cada 100 contas criadas no site (0–99 = 5000; 105 = 5100; 200 = 5200)
const arenasFor = users => 5000 + Math.floor((Number(users) || 0) / 100) * 100;
module.exports = {createApp, arenasFor, newKey, normalizeKey, hashPassword, checkPassword};
