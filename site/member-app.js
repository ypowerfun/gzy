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
    if (req.hostname === APP_HOST && !req.path.startsWith('/api/') && !req.path.startsWith('/app/') && req.path !== '/app' && !req.path.startsWith('/servidor/') && req.path !== '/servidor' && !PASS.has(req.path)) req.url = '/app' + req.url;
    next();
  });
  const page = (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(publicDir, 'app', 'index.html'));
  app.get(['/app', '/app/'], page);
  app.get('/app/:slug', (req, res, next) => (SLUG_RE.test(req.params.slug) ? page(req, res) : next()));

  // ---------- ligação do Servidor da arena ----------
  const bigJson = express.json({limit: '12mb'}); // 1.4.1: respostas do app da recepção (painel) vêm por aqui (o Caddy aceita até 12 MB)
  app.post('/api/app/relay', limit('apprelay', 1500, 60000), bigJson, api((req, res) => {
    const b = req.body || {}, installId = str(b.installId, 80), slug = str(b.slug, 40);
    if (!/^[0-9a-f-]{20,80}$/i.test(installId)) fail(400, 'Instalação inválida.');
    if (!SLUG_RE.test(slug)) fail(400, 'Endereço do app inválido.');
    const cert = planActivation.verify(b.token);
    if (!cert || cert.v !== 2 || cert.kind !== 'plan' || cert.installId !== installId || !cert.uid) fail(401, 'Certificado do plano inválido. Entre de novo com a conta em Configuração › Licença.');
    if (plans.planOf(cert.uid)?.plan !== 'pro') fail(402, 'O app do cliente faz parte do plano Pro.');
    const bound = db.get('SELECT install_id FROM plan_installs WHERE user_id=?', cert.uid);
    if (!bound || bound.install_id !== installId) fail(409, 'Esta conta passou a ser usada em outro computador. Entre de novo com a conta em Configuração › Licença.');
    // 1.4.1: só devolve respostas (app da recepção) sem mexer na espera da ligação principal
    if (b.replyOnly) {
      const r0 = db.get('SELECT plan_uid FROM app_arenas WHERE slug=?', slug); if (!r0 || r0.plan_uid !== cert.uid) fail(409, 'Endereço do app não registrado.');
      const a0 = arena(slug); a0.lastAt = Date.now();
      for (const r of Array.isArray(b.replies) ? b.replies.slice(0, 100) : []) deliver(a0, r);
      return {ok: true};
    }
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
  function ask(slug, action, body, auth, ip, wait = replyTimeout) {
    return new Promise(resolve => {
      if (!online(slug)) return resolve([503, {error: 'A arena está sem conexão com a internet agora. Tente de novo em instantes.'}]);
      const a = arena(slug);
      if (a.queue.length + a.pending.size > 200) return resolve([503, {error: 'A arena está ocupada. Tente de novo em instantes.'}]);
      const id = crypto.randomBytes(12).toString('hex');
      const p = {id, done: (status, data) => resolve([status, data]), timer: null};
      p.timer = setTimeout(() => { a.pending.delete(id); a.queue = a.queue.filter(q => q.id !== id); resolve([504, {error: 'A arena não respondeu. Tente de novo em instantes.'}]); }, wait);
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
  // ---------- 1.4.1: APP DA RECEPÇÃO — app.gamezoney.com/servidor/<endereço> ----------
  // O painel do GameZoney Servidor da arena, aberto de fora. O site só repassa (nada é gravado aqui): página, arquivos e
  // /api do painel vão para a arena pela ligação acima e a resposta volta igual. Só no app.gamezoney.com (origem
  // separada do gamezoney.com: o cookie da conta do site nunca chega ao painel e vice-versa).
  const PANEL_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
  const secure = APP_URL.startsWith('https:');
  const panelHost = req => req.hostname === APP_HOST || (ctx.panelHosts || []).includes(req.hostname);
  const panelRaw = express.raw({type: () => true, limit: '4mb'});
  app.get(/^\/servidor\/([a-z0-9-]{3,40})$/, (req, res, next) => (panelHost(req) && SLUG_RE.test(req.params[0]) ? res.redirect(302, '/servidor/' + req.params[0] + '/') : next()));
  app.all(/^\/servidor\/([a-z0-9-]{3,40})(\/.*)$/, (req, res, next) => (panelHost(req) ? next() : res.status(404).type('text').send('Não encontrado.')),
    limit('panel', 900, 60000), (req, res, next) => (req.params[1] === '/api/login' ? limit('panellogin', 30, 900000)(req, res, next) : next()), panelRaw, async (req, res) => {
      res.set({'Content-Security-Policy': PANEL_CSP, 'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow'});
      const slug = req.params[0], r = row(slug), sub = req.params[1];
      if (!r) return res.status(404).type('text').send('Arena não encontrada. Confira o endereço.');
      if (!['GET', 'HEAD', 'POST'].includes(req.method)) return res.status(405).end();
      // POST só da própria página (o painel usa cookie de sessão)
      if (req.method === 'POST') {
        const from = req.headers.origin || '';
        let ok = false; try { ok = new URL(from).host === req.headers.host; } catch { }
        if (!ok || req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return res.status(403).json({error: 'Origem não permitida.'});
      }
      const q = req.originalUrl.indexOf('?'), query = q >= 0 ? req.originalUrl.slice(q) : '';
      const session = String(req.headers.cookie || '').match(/(?:^|;\s*)gz_session=([a-f0-9]{64})/)?.[1] || '';
      const body = {method: req.method, path: sub + query, session, type: req.headers['content-type'] || '', 'if-none-match': req.headers['if-none-match'] || '', 'if-modified-since': req.headers['if-modified-since'] || '',
        body: req.method === 'POST' && Buffer.isBuffer(req.body) ? req.body.toString('base64') : ''};
      const [status, data] = await ask(r.slug, 'http', body, '', req.ip, ctx.panelReplyMs || 25000);
      res.set('Cache-Control', 'no-store');
      if (status !== 200 || !data || typeof data.body !== 'string') {
        const msg = data?.error || 'A arena não respondeu.';
        return res.status(status === 200 ? 502 : status).type(sub.startsWith('/api/') ? 'json' : 'html').send(sub.startsWith('/api/') ? JSON.stringify({error: msg})
          : `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GameZoney • App da recepção</title><body style="background:#101115;color:#eee;font-family:system-ui;padding:40px;text-align:center"><h2>App da recepção</h2><p>${String(msg).replace(/[<>&"]/g, '')}</p><p>Confira se o GameZoney Servidor da arena está aberto e com internet.</p>`);
      }
      const h = data.headers && typeof data.headers === 'object' ? data.headers : {};
      for (const k of ['content-type', 'cache-control', 'etag', 'last-modified', 'content-disposition']) if (typeof h[k] === 'string' && !/[\r\n]/.test(h[k])) res.set(k, h[k]);
      // cookie da sessão do painel: só neste endereço, HttpOnly, Secure, SameSite=Strict
      const cookies = (Array.isArray(h['set-cookie']) ? h['set-cookie'] : []).map(c => String(c).match(/^gz_session=([a-f0-9]{64})\b/)).filter(Boolean)
        .map(m => `gz_session=${m[1]}; Path=/servidor/${r.slug}/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure ? '; Secure' : ''}`);
      if (cookies.length) res.set('Set-Cookie', cookies);
      let out = Buffer.from(data.body, 'base64');
      if (data.gzip) {
        if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) res.set({'Content-Encoding': 'gzip', Vary: 'Accept-Encoding'});
        else { try { out = require('node:zlib').gunzipSync(out); } catch { return res.status(502).end(); } }
      }
      const code = Number.isInteger(data.status) && data.status >= 200 && data.status < 600 ? data.status : 502;
      res.status(code); if (req.method === 'HEAD' || code === 304) return res.end(); res.end(out);
    });

  // /admin: quais arenas usam o app (sem dados de clientes)
  return {list: () => db.all('SELECT slug,name,plan_uid,updated_at FROM app_arenas ORDER BY updated_at DESC').map(r => ({...r, online: online(r.slug)})), APP_URL, APP_HOST,
    stop() { for (const slug of [...live.keys()]) drop(slug); }};
};
