'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Servidor 1.3.7 (plano Pro): APP DO CLIENTE em app.gamezoney.com/<endereço-da-arena> (e gamezoney.com/app/<endereço>).
// O site só REPASSA: os dados dos clientes ficam no GameZoney Servidor da arena.
//  - O Servidor da arena faz POST /api/app/relay (certificado do plano Pro deste computador) e fica esperando até 25 s;
//    quando um celular pede algo, o pedido vai na resposta; o Servidor responde no POST seguinte (replies) e já espera de novo.
//  - Aqui fica só o cadastro do endereço (app_arenas: endereço, conta do plano, computador, nome, cor e versão da logo).
//    Nada de nomes de clientes, saldos ou senhas é gravado no site (só passa pela memória até a resposta).
//  - O login do cliente é conferido no Servidor da arena; o celular guarda o token que a arena assinou.
const crypto = require('node:crypto');
const path = require('node:path');

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const ACTIONS = new Set(['login', 'me', 'stations', 'achievements', 'history', 'ranking']); // 1.3.9: + ranking
const HOLD_MS = 25000, ONLINE_MS = 60000;

module.exports = function memberApp(app, ctx) {
  const {db, api, fail, str, limit, plans, planActivation, log, express, env = {}, publicDir} = ctx;
  const APP_URL = String(env.APP_URL || 'https://app.gamezoney.com').replace(/\/+$/, '');
  const APP_HOST = (() => { try { return new URL(APP_URL).hostname; } catch { return 'app.gamezoney.com'; } })();
  const replyTimeout = ctx.replyTimeoutMs || 15000;
  db.raw.exec(`CREATE TABLE IF NOT EXISTS app_arenas(slug TEXT PRIMARY KEY, plan_uid TEXT NOT NULL, install_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '', logo_rev TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS app_arenas_uid ON app_arenas(plan_uid);`);
  const live = new Map(); // endereço -> {waiter, queue, pending, lastAt, logo}
  const arena = slug => { let a = live.get(slug); if (!a) { a = {waiter: null, queue: [], pending: new Map(), lastAt: 0, logo: null}; live.set(slug, a); } return a; };
  const online = slug => { const a = live.get(slug); return !!a && (!!a.waiter || Date.now() - a.lastAt < ONLINE_MS); };

  // ---------- páginas do app ----------
  // app.gamezoney.com/<endereço> = gamezoney.com/app/<endereço> (o mesmo processo; o Caddy entrega os dois domínios)
  const PASS = new Set(['/logo-gamezoney.png', '/favicon.ico', '/robots.txt']);
  app.use((req, res, next) => {
    if (req.hostname === APP_HOST && !req.path.startsWith('/api/') && !req.path.startsWith('/app/') && req.path !== '/app' && !PASS.has(req.path)) req.url = '/app' + req.url;
    next();
  });
  const page = (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(publicDir, 'app', 'index.html'));
  app.get(['/app', '/app/'], page);
  app.get('/app/:slug', (req, res, next) => (SLUG_RE.test(req.params.slug) ? page(req, res) : next()));

  // ---------- ligação do Servidor da arena ----------
  const bigJson = express.json({limit: '3mb'});
  app.post('/api/app/relay', limit('apprelay', 400, 60000), bigJson, api((req, res) => {
    const b = req.body || {}, installId = str(b.installId, 80), slug = str(b.slug, 40);
    if (!/^[0-9a-f-]{20,80}$/i.test(installId)) fail(400, 'Instalação inválida.');
    if (!SLUG_RE.test(slug)) fail(400, 'Endereço do app inválido.');
    const cert = planActivation.verify(b.token);
    if (!cert || cert.v !== 2 || cert.kind !== 'plan' || cert.installId !== installId || !cert.uid) fail(401, 'Certificado do plano inválido. Entre de novo com a conta em Configuração › Licença.');
    if (plans.planOf(cert.uid)?.plan !== 'pro') fail(402, 'O app do cliente faz parte do plano Pro.');
    const bound = db.get('SELECT install_id FROM plan_installs WHERE user_id=?', cert.uid);
    if (!bound || bound.install_id !== installId) fail(409, 'Esta conta passou a ser usada em outro computador. Entre de novo com a conta em Configuração › Licença.');
    const owner = db.get('SELECT plan_uid FROM app_arenas WHERE slug=?', slug);
    if (owner && owner.plan_uid !== cert.uid) fail(409, 'Este endereço já é usado por outra arena. Escolha outro em Gerenciar App › App do cliente.');
    const info = b.info || {}, now = Date.now();
    const name = str(info.name, 60) || 'Arena', color = /^#[0-9a-f]{6}$/i.test(info.color || '') ? info.color.toLowerCase() : '', logoRev = str(info.logoRev, 40);
    // um endereço por conta: trocou o endereço, o antigo deixa de existir
    for (const old of db.all('SELECT slug FROM app_arenas WHERE plan_uid=? AND slug<>?', cert.uid, slug)) { db.run('DELETE FROM app_arenas WHERE slug=?', old.slug); drop(old.slug); }
    if (owner) db.run('UPDATE app_arenas SET install_id=?, name=?, color=?, logo_rev=?, updated_at=? WHERE slug=?', installId, name, color, logoRev, now, slug);
    else db.run('INSERT INTO app_arenas(slug,plan_uid,install_id,name,color,logo_rev,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', slug, cert.uid, installId, name, color, logoRev, now, now);
    const a = arena(slug); a.lastAt = now;
    for (const r of Array.isArray(b.replies) ? b.replies.slice(0, 100) : []) deliver(a, r);
    const out = {url: APP_URL + '/' + slug};
    if (a.queue.length || b.hello) return {...out, requests: a.queue.splice(0, 50)};
    // espera um pedido do celular (ou 25 s)
    if (a.waiter) finish(a.waiter, []);
    return new Promise(resolve => {
      const w = {resolve: list => resolve({...out, requests: list}), timer: null, done: false};
      w.timer = setTimeout(() => finish(w, []), ctx.holdMs || HOLD_MS); a.waiter = w;
      res.on('close', () => { if (!w.done) { w.done = true; clearTimeout(w.timer); if (a.waiter === w) a.waiter = null; } });
    });
  }));
  function finish(w, list) { if (w.done) return; w.done = true; clearTimeout(w.timer); for (const [slug, a] of live) if (a.waiter === w) a.waiter = null; w.resolve(list); }
  function deliver(a, r) {
    const p = a.pending.get(String(r?.id || '')); if (!p) return;
    a.pending.delete(p.id); clearTimeout(p.timer);
    const status = Number.isInteger(r.status) && r.status >= 200 && r.status < 600 ? r.status : 502;
    p.done(status, r.data && typeof r.data === 'object' ? r.data : {});
  }
  function drop(slug) { const a = live.get(slug); if (!a) return; if (a.waiter) finish(a.waiter, []); for (const p of a.pending.values()) { clearTimeout(p.timer); p.done(503, {error: 'A arena mudou o endereço do app.'}); } live.delete(slug); }
  // pedido do celular → arena
  function ask(slug, action, body, auth, ip) {
    return new Promise(resolve => {
      if (!online(slug)) return resolve([503, {error: 'A arena está sem conexão com a internet agora. Tente de novo em instantes.'}]);
      const a = arena(slug);
      if (a.queue.length + a.pending.size > 200) return resolve([503, {error: 'A arena está ocupada. Tente de novo em instantes.'}]);
      const id = crypto.randomBytes(12).toString('hex');
      const p = {id, done: (status, data) => resolve([status, data]), timer: null};
      p.timer = setTimeout(() => { a.pending.delete(id); a.queue = a.queue.filter(q => q.id !== id); resolve([504, {error: 'A arena não respondeu. Tente de novo em instantes.'}]); }, replyTimeout);
      a.pending.set(id, p);
      const reqObj = {id, action, body, auth: str(auth, 400), ip: str(ip, 60)};
      if (a.waiter) finish(a.waiter, [reqObj]); else a.queue.push(reqObj);
    });
  }

  // ---------- app do celular ----------
  const row = slug => (SLUG_RE.test(slug) ? db.get('SELECT * FROM app_arenas WHERE slug=?', slug) : null);
  app.get('/api/app/a/:slug/info', limit('appinfo', 240, 60000), api(req => {
    const r = row(req.params.slug); if (!r) fail(404, 'Arena não encontrada. Confira o endereço com a recepção.');
    return {name: r.name, color: r.color, logo: !!r.logo_rev, logoRev: r.logo_rev, online: online(r.slug)};
  }));
  app.get('/api/app/a/:slug/logo', limit('applogo', 120, 60000), async (req, res) => {
    const r = row(req.params.slug); if (!r || !r.logo_rev) return res.status(404).end();
    const a = arena(r.slug);
    if (!a.logo || a.logo.rev !== r.logo_rev) {
      const [status, data] = await ask(r.slug, 'logo', {}, '', req.ip);
      if (status !== 200 || !data.png) return res.status(404).end();
      const png = Buffer.from(String(data.png), 'base64');
      if (png.length < 33 || png.readUInt32BE(0) !== 0x89504e47) return res.status(404).end();
      a.logo = {rev: r.logo_rev, png};
    }
    res.set({'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400'}).send(a.logo.png);
  });
  app.post('/api/app/a/:slug/:action', limit('app', 240, 60000), (req, res, next) => (req.params.action === 'login' ? limit('applogin', 30, 900000)(req, res, next) : next()), api(async (req, res) => {
    const r = row(req.params.slug); if (!r) fail(404, 'Arena não encontrada. Confira o endereço com a recepção.');
    const action = req.params.action; if (!ACTIONS.has(action)) fail(404, 'Ação inválida.');
    const body = action === 'login' ? {username: str(req.body?.username, 40), password: typeof req.body?.password === 'string' ? req.body.password.slice(0, 128) : ''} : {};
    const [status, data] = await ask(r.slug, action, body, req.headers.authorization || '', req.ip);
    res.status(status); return data;
  }));
  // /admin: quais arenas usam o app (sem dados de clientes)
  return {list: () => db.all('SELECT slug,name,plan_uid,updated_at FROM app_arenas ORDER BY updated_at DESC').map(r => ({...r, online: online(r.slug)})), APP_URL, APP_HOST,
    stop() { for (const slug of [...live.keys()]) drop(slug); }};
};
