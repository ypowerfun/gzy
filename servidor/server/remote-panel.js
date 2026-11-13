'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.4.1 (plano Pro): APP DA RECEPÇÃO em app.gamezoney.com/servidor/<endereço-da-arena>.
// É o próprio painel do Servidor, aberto de fora (celular, notebook), com todas as telas MENOS Configuração e Gerenciar App.
// Como chega até aqui SEM abrir porta na arena:
//  - o pedido do navegador vai ao gamezoney.com, que o entrega pela mesma ligação de SAÍDA do app do cliente
//    (member-app.js, /api/app/relay); este Servidor repete o pedido para ele mesmo (127.0.0.1) com um cabeçalho secreto
//    criado a cada abertura (x-gz-remote) e devolve a resposta ao site.
//  - o pedido marcado como "de fora" só alcança o painel (página, arquivos dele e /api); nunca /pc, /pc-setup, /tv, /internal.
//  - Configuração e Gerenciar App (e o que só existe lá) respondem 403 mesmo que alguém chame a rota direto.
//  - login: usuário e senha do painel; tentativas limitadas por IP de quem acessa e por usuário; a sessão de fora só vale
//    de fora (e a do próprio servidor só vale no servidor) e cai depois de 12 h sem uso.
const http = require('node:http');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

// telas que NÃO abrem pelo app da recepção (Configuração e Gerenciar App) — também bloqueadas no servidor
const BLOCK = [/^\/api\/setup$/, /^\/api\/machine-settings/, /^\/api\/operators/, /^\/api\/backup/, /^\/api\/network/, /^\/api\/self-service/,
  /^\/api\/pc-notices/, /^\/api\/prints\/settings/, /^\/api\/diskless/, /^\/api\/units/, /^\/api\/branding/, /^\/api\/update/, /^\/api\/member-app/,
  /^\/api\/achievements/, /^\/api\/fiscal\/(settings|test)/, /^\/api\/pairing\/import/, /^\/api\/remote-panel/];
const BAD_PATH = /(^|\/)\.\.?(\/|$)|%2e|%2f|%5c|\\|\/\//i;
const STATIC = /^\/[a-z0-9][a-z0-9._-]{0,60}\.(js|css|png|jpg|ico)$/i;
const NOT_HERE = 'Esta área abre só no painel do próprio servidor (Configuração e Gerenciar App não abrem pelo app da recepção).';
const TEXT = /^(text\/|application\/(json|javascript|xml)|image\/svg)/i;
const MAX_BODY = 4 * 1024 * 1024, MAX_OUT = 48 * 1024 * 1024, MAX_SEND = 8 * 1024 * 1024; // a ligação com o site aceita até 12 MB por envio
const REMOTE_TTL = 12 * 3600000;
// auditoria 1.4.2: a página do painel só roda scripts dos próprios arquivos (texto com <script> gravado em nome de cliente,
// produto, nota, impressão etc. nunca executa) e não abre dentro de outro site — no servidor e pelo link
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

module.exports = function remotePanel(store, deps = {}) {
  const secret = crypto.randomBytes(24).toString('hex');
  const cfg = () => { const m = (store.state.settings.memberApp ??= {enabled: false, slug: ''}); m.panel ??= {enabled: false, who: 'all'}; return m.panel; };
  const enabled = () => !!cfg().enabled && !!store.state.settings.memberApp?.slug && (deps.allowed ? !!deps.allowed() : true);
  const local = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const base = () => '/servidor/' + store.state.settings.memberApp.slug + '/';

  // página do painel com <base> no endereço de fora: todos os endereços do painel são relativos (api/…, style.css…)
  function sendIndex(res) {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8', (e, html) => {
      if (e) return res.status(404).end();
      html = html.replace('<head>', `<head><base href="${base()}"><meta name="gz-remote" content="1">`).replace('<body>', '<body class="gz-remote">');
      res.set({'Cache-Control': 'no-cache', 'Content-Security-Policy': CSP, 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer'}).type('html').send(html);
    });
  }

  // fica logo depois do network-guard: decide o que um pedido vindo de fora pode alcançar
  function middleware(req, res, next) {
    const h = req.headers['x-gz-remote'];
    if (h === undefined) return next();
    if (!local(req) || typeof h !== 'string' || !same(h, secret)) return res.status(404).type('text').send('Não encontrado.');
    req.gzRemote = {ip: String(req.headers['x-gz-remote-ip'] || '').slice(0, 60)};
    const p = req.path;
    if (!enabled()) return res.status(404).json({error: 'O app da recepção está desligado nesta arena.'});
    // auditoria 1.4.2: o Express ignora maiúsculas e a barra do fim nas rotas (/api/OPERATORS = /api/operators):
    // o bloqueio confere o caminho em minúsculas e sem barra no fim; caminho com .., %2e, %2f, \ ou // é recusado
    if (BAD_PATH.test(req.originalUrl.split('?')[0])) return res.status(404).type('text').send('Não encontrado.');
    const lp = p.toLowerCase().replace(/\/+$/, '') || '/';
    if (p === '/' || p === '/index.html') return sendIndex(res);
    if (lp.startsWith('/api/')) {
      if (BLOCK.some(r => r.test(lp)) || (lp.startsWith('/api/license/') && req.method !== 'GET')) return res.status(403).json({error: NOT_HERE});
      return next();
    }
    if (STATIC.test(p) && lp !== '/cliente.html') return next();
    return res.status(404).type('text').send('Não encontrado.');
  }

  // pedido que chegou pelo gamezoney.com → repete aqui mesmo (127.0.0.1) e devolve status, cabeçalhos e corpo
  function forward(r, port) {
    return new Promise(resolve => {
      const b = r.body && typeof r.body === 'object' ? r.body : {};
      const done = (status, data) => resolve({id: r.id, status, data});
      const method = b.method === 'POST' ? 'POST' : b.method === 'HEAD' ? 'HEAD' : 'GET';
      const target = String(b.path || '/');
      if (!enabled()) return done(404, {status: 404, headers: {'content-type': 'application/json'}, body: Buffer.from(JSON.stringify({error: 'O app da recepção está desligado nesta arena.'})).toString('base64')});
      if (!target.startsWith('/') || target.length > 2048 || /[\s\\]/.test(target) || BAD_PATH.test(target.split('?')[0])) return done(400, {error: 'Endereço inválido.'});
      const body = method === 'POST' ? Buffer.from(String(b.body || ''), 'base64') : Buffer.alloc(0);
      if (body.length > MAX_BODY) return done(413, {error: 'Arquivo grande demais.'});
      const cookie = /^[a-f0-9]{64}$/.test(String(b.session || '')) ? 'gz_session=' + b.session : '';
      const headers = {'x-gz-remote': secret, 'x-gz-remote-ip': String(r.ip || '').slice(0, 60), 'accept-encoding': 'identity'};
      if (cookie) headers.cookie = cookie;
      if (method === 'POST') { headers['content-type'] = String(b.type || 'application/json').slice(0, 100); headers['content-length'] = body.length; }
      for (const k of ['if-none-match', 'if-modified-since']) if (typeof b[k] === 'string' && b[k].length < 200) headers[k] = b[k];
      const req = http.request({host: '127.0.0.1', port, method, path: target, headers, timeout: 20000}, res => {
        const parts = []; let size = 0;
        res.on('data', c => { size += c.length; if (size > MAX_OUT) { req.destroy(); return; } parts.push(c); });
        res.on('end', () => {
          if (size > MAX_OUT) return done(502, {error: 'Resposta grande demais para o app da recepção.'});
          let out = Buffer.concat(parts), gzip = false;
          const type = String(res.headers['content-type'] || '');
          if (out.length > 1024 && TEXT.test(type)) { out = zlib.gzipSync(out, {level: 6}); gzip = true; }
          if (out.length > MAX_SEND) return done(502, {error: 'Resposta grande demais para o app da recepção. Use o painel do próprio servidor.'});
          const keep = {};
          for (const k of ['content-type', 'cache-control', 'etag', 'last-modified', 'content-disposition']) if (res.headers[k]) keep[k] = String(res.headers[k]);
          if (res.headers['set-cookie']) keep['set-cookie'] = [].concat(res.headers['set-cookie']).map(String);
          done(200, {status: res.statusCode, headers: keep, body: out.toString('base64'), gzip});
        });
        res.on('error', () => done(502, {error: 'O servidor da arena não respondeu.'}));
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', () => done(504, {error: 'O servidor da arena demorou para responder.'}));
      req.end(body);
    });
  }

  // tela Gerenciar App › App da recepção
  function status() { const c = cfg(); return {enabled: !!c.enabled, who: c.who === 'admins' ? 'admins' : 'all', sessions: deps.sessions ? [...deps.sessions].filter(([, s]) => s.remote).length : 0}; }
  function save(input, actor, allowedNow) {
    const on = input.enabled === true, who = input.who === 'admins' ? 'admins' : 'all';
    if (on && !allowedNow) { const e = new Error('App da recepção: recurso do plano Pro. Entre com a conta gamezoney.com do plano Pro em Configuração › Licença.'); throw e; }
    const c = cfg();
    store.change(actor, 'config', on ? `App da recepção ligado (${who === 'admins' ? 'só administradores' : 'todos os usuários'})` : 'App da recepção desligado', () => { c.enabled = on; c.who = who; });
    if (!on) disconnect(actor, true);
    return status();
  }
  function disconnect(actor, quiet) {
    let n = 0; if (deps.sessions) for (const [key, s] of [...deps.sessions]) if (s.remote) { deps.sessions.delete(key); n++; }
    if (!quiet) store.log(actor, 'config', `App da recepção: ${n} acesso(s) desconectado(s)`);
    return {...status(), disconnected: n};
  }
  // quem pode entrar de fora
  function mayLogin(op) { return cfg().who !== 'admins' || op.role === 'admin'; }
  return {middleware, forward, status, save, disconnect, mayLogin, enabled, REMOTE_TTL, BLOCK, CSP, get secret() { return secret; }};
};
module.exports.BLOCK = BLOCK;
module.exports.REMOTE_TTL = REMOTE_TTL;
