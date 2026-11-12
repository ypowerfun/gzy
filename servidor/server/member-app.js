'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.3.7 (plano Pro): APP DO CLIENTE em app.gamezoney.com/<endereço-da-arena>.
// O cliente entra com o mesmo nick e senha do PC e vê: Início (saldo, medalhas, sessão em andamento), Estações (PCs,
// consoles, VR e simuladores livres/ocupados e o tempo que falta), Conquistas e Histórico.
// Como chega até aqui SEM abrir porta na arena e sem guardar dados no nosso VPS:
//  - este Servidor mantém um pedido de SAÍDA aberto com o gamezoney.com (/api/app/relay, até ~25 s; responde e abre o
//    próximo). O site guarda o pedido do celular, entrega aqui, e devolve ao celular a resposta que este Servidor deu.
//  - prova que é a arena com o certificado do plano (o mesmo da Licença): só plano Pro, só o computador atual da conta.
//  - o login do cliente é conferido AQUI (a senha nunca fica no site); o celular recebe um token assinado por este
//    Servidor (vale 30 dias e cai sozinho se a senha do cliente mudar).
//  - só leitura: o app não faz recarga, não abre sessão e não muda cadastro.
const crypto = require('node:crypto');
const {verify, normalizeNick} = require('./store');
const fail = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const SITE = () => (process.env.GZ_SITE_URL || 'https://gamezoney.com').replace(/\/+$/, '');
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(['api', 'app', 'admin', 'servidor', 'www', 'static', 'assets', 'login', 'conta', 'gamezoney', 'suporte', 'ajuda', 'img', 'media', 'health']);
// 1.3.8: VR funciona junto com o console (pedido do dono): um tipo só, Console/VR. O 'vr' gravado na 1.3.7 vale como console.
const CATEGORY = {pc: 'PC', console: 'Console/VR', sim: 'Simulador'};
const categoryOf = s => (s.category === 'vr' ? 'console' : CATEGORY[s.category] ? s.category : s.kind === 'tv' ? 'console' : 'pc');
const TOKEN_DAYS = 30;

module.exports = function memberApp(store, deps = {}) {
  const {lic, brand, org, pc, achievements} = deps;
  const fetchImpl = deps.fetch || ((...a) => fetch(...a));
  const allowed = () => (deps.allowed ? !!deps.allowed() : true);
  const cfg = () => (store.state.settings.memberApp ??= {enabled: false, slug: ''});
  const secret = () => { const s = (store.state.secrets ??= {}); if (!s.appSecret) { s.appSecret = crypto.randomBytes(32).toString('hex'); store.persist(); } return s.appSecret; };
  let running = false, ctrl = null, loop = null, restarting = false, hello = true;
  const live = {connected: false, lastAt: 0, lastError: '', url: '', requests: 0};

  // ---------- configuração (Gerenciar App) ----------
  function status() {
    const c = cfg();
    return {allowed: allowed(), enabled: !!c.enabled, slug: c.slug || '', url: c.slug ? (live.url || 'https://app.gamezoney.com/' + c.slug) : '',
      connected: live.connected && Date.now() - live.lastAt < 60000, lastAt: live.lastAt, lastError: live.lastError, hasAccount: !!lic?.planToken?.(),
      categories: CATEGORY};
  }
  function save(input, actor) {
    const enabled = input.enabled === true, slug = String(input.slug ?? '').trim().toLowerCase();
    if (enabled && !allowed()) fail('App do cliente: recurso do plano Pro. Entre com a conta gamezoney.com do plano Pro em Configuração › Licença.');
    if (slug && (!SLUG_RE.test(slug) || slug.includes('--') || RESERVED.has(slug))) fail('Endereço do app: de 3 a 40 letras minúsculas, números ou hífen (ex.: arena-centro).');
    if (enabled && !slug) fail('Escolha o endereço do app (ex.: arena-centro).');
    if (enabled && !lic?.planToken?.()) fail('Entre com a conta gamezoney.com em Configuração › Licença antes de ligar o app.');
    const c = cfg(), changed = c.slug !== slug;
    store.change(actor, 'config', enabled ? `App do cliente ligado: app.gamezoney.com/${slug}` : 'App do cliente desligado', () => { c.enabled = enabled; c.slug = slug; });
    if (changed) { live.url = ''; live.connected = false; }
    live.lastError = ''; restart();
    return status();
  }

  // ---------- token do cliente ----------
  const fp = m => crypto.createHash('sha256').update(String(m.passwordHash || '')).digest('hex').slice(0, 16);
  const sign = (mid, exp, m) => crypto.createHmac('sha256', secret()).update(`${mid}.${exp}.${fp(m)}`).digest('base64url');
  function issue(m) { const exp = Date.now() + TOKEN_DAYS * 86400000; return `v1.${m.id}.${exp}.${sign(m.id, exp, m)}`; }
  function memberOf(auth) {
    const t = String(auth || '').replace(/^Bearer\s+/i, ''), [v, mid, exp, sig] = t.split('.');
    if (v !== 'v1' || !mid || !/^\d+$/.test(exp || '') || Number(exp) < Date.now() || !sig) fail('Entre de novo.', 401);
    const m = store.state.members.find(x => x.id === mid);
    if (!m || m.guest || m.active === false || !m.passwordHash) fail('Entre de novo.', 401);
    const good = Buffer.from(sign(mid, exp, m)), got = Buffer.from(sig);
    if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) fail('Entre de novo.', 401);
    return m;
  }
  // tentativas de senha: 5 erros por nick ou 20 por IP em 15 min = espera
  const tries = new Map();
  function tooMany(key) { const t = tries.get(key); return t && t.until > Date.now() && t.n >= (key.startsWith('ip:') ? 20 : 5); }
  function miss(key) { const now = Date.now(); let t = tries.get(key); if (!t || t.until < now) { t = {n: 0, until: now + 900000}; tries.set(key, t); } t.n++; }

  // ---------- dados ----------
  function sessionOf(m, now = Date.now()) {
    const s = store.activeForMember(m.id); if (!s) return null;
    const st = store.state.stations.find(x => x.id === s.stationId);
    return {station: s.stationName, category: st ? categoryOf(st) : 'pc', startedAt: s.startedAt, endsAt: s.endsAt, remainingSeconds: store.remaining(s, now)};
  }
  function me(m) {
    const l = store.state.settings.loyalty || {};
    return {name: m.name, username: m.username, balanceSeconds: Math.max(0, Math.round(m.creditSeconds || 0)), medals: (m.pointsMilli || 0) / 1000,
      session: sessionOf(m), loyalty: {enabled: m.loyaltyEnabled !== false && (l.thresholdMilli || 0) > 0 && (l.rewardMinutes || 0) > 0, threshold: (l.thresholdMilli || 0) / 1000, rewardMinutes: l.rewardMinutes || 0},
      achievements: achievements ? achievements.progressOf(m.id).filter(a => a.done).length : 0};
  }
  function stations(now = Date.now()) {
    return store.state.stations.filter(s => s.active !== false && !s.removedAt).map(s => {
      const session = store.activeForStation(s.id), admin = pc?.isAdmin?.(s.id);
      const status = session ? 'busy' : admin ? 'maintenance' : (s.kind === 'computer' && pc?.connected && !pc.connected(s.id)) ? 'offline' : 'free';
      return {name: s.name, category: categoryOf(s), status, remainingSeconds: session ? store.remaining(session, now) : 0};
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', {numeric: true}));
  }
  // histórico do cliente: o que está no estado + o arquivado (tabela hist), mais recentes primeiro
  function mine(kind, m, limit = 30) {
    const fresh = (store.state[kind] || []).filter(x => x.memberId === m.id);
    let old = [];
    try {
      const like = '%"memberId":' + JSON.stringify(m.id).replace(/[%_\\]/g, c => '\\' + c) + '%';
      old = store.db.prepare("SELECT data FROM hist WHERE kind=? AND data LIKE ? ESCAPE '\\' ORDER BY at DESC LIMIT ?").all(kind, like, limit).map(r => JSON.parse(r.data));
    } catch { }
    const seen = new Set(fresh.map(x => x.id)), at = x => x.finishedAt || x.startedAt || x.at || 0;
    return [...fresh, ...old.filter(x => !seen.has(x.id))].sort((a, b) => at(b) - at(a)).slice(0, limit);
  }
  function history(m) {
    return {
      sessions: mine('sessions', m).filter(s => s.status === 'finished').map(s => ({at: s.startedAt, endedAt: s.finishedAt, station: s.stationName, usedSeconds: Math.max(0, Number(s.usedSeconds) || 0)})),
      recharges: mine('sales', m).filter(x => (x.cents || 0) > 0 || (x.minutes || 0) > 0).map(x => ({at: x.at, cents: x.cents || 0, minutes: x.minutes || 0, canceled: x.status === 'canceled'})),
      medals: mine('loyaltyLedger', m).map(x => ({at: x.at, medals: (x.amount || 0) / 1000, reason: String(x.reason || '').slice(0, 80)})),
    };
  }
  function handle(r) {
    const body = r.body && typeof r.body === 'object' ? r.body : {};
    switch (r.action) {
      case 'login': {
        const ipKey = 'ip:' + String(r.ip || ''), nick = normalizeNick(body.username).toLowerCase(), nickKey = 'nick:' + nick;
        if (tooMany(ipKey) || tooMany(nickKey)) fail('Muitas tentativas. Aguarde 15 minutos e tente de novo.', 429);
        const m = nick && store.state.members.find(x => !x.guest && normalizeNick(x.username).toLowerCase() === nick);
        if (!m || m.active === false || !m.passwordHash || typeof body.password !== 'string' || body.password.length > 128 || !verify(body.password, m.passwordHash)) {
          miss(ipKey); miss(nickKey);
          if (m && m.active !== false && !m.passwordHash) fail('Cadastre a sua senha no primeiro acesso em um PC da arena e depois entre no app.', 400);
          fail('Usuário ou senha incorretos.', 400);
        }
        tries.delete(nickKey);
        return {token: issue(m), me: me(m)};
      }
      case 'me': return {me: me(memberOf(r.auth))};
      case 'stations': memberOf(r.auth); return {stations: stations()};
      case 'achievements': { const m = memberOf(r.auth); return {achievements: achievements ? achievements.progressOf(m.id) : []}; }
      case 'history': return history(memberOf(r.auth));
      case 'logo': { const file = brand?.tvLogoFile?.(); if (!file) return {rev: '', png: ''}; return {rev: brand.version(), png: require('node:fs').readFileSync(file).toString('base64')}; }
      default: fail('Ação inválida.', 404);
    }
  }
  function answer(r) {
    try { return {id: r.id, status: 200, data: handle(r)}; }
    catch (e) { const status = Number.isInteger(e.status) ? e.status : 400; return {id: r.id, status, data: {error: String(e.message || 'Erro').slice(0, 200)}}; }
  }
  function info() {
    const b = brand?.status?.() || {};
    return {name: org ? org.name(store) : (store.state.settings.organization || 'GameZoney'), color: b.active ? b.color : '', logoRev: brand?.tvLogoFile?.() ? String(brand.version()) : ''};
  }

  // ---------- ligação com o gamezoney.com ----------
  let wake = null; // espera que acorda na hora quando o app é ligado ou o endereço muda
  const sleep = ms => new Promise(r => { const t = setTimeout(() => { wake = null; r(); }, ms); t.unref?.(); wake = () => { clearTimeout(t); wake = null; r(); }; });
  async function cycle(replies) {
    const c = cfg(), token = lic?.planToken?.();
    ctrl = new AbortController(); const kill = setTimeout(() => ctrl.abort(), 40000); kill.unref?.();
    try {
      const res = await fetchImpl(SITE() + '/api/app/relay', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: ctrl.signal,
        body: JSON.stringify({token, installId: store.state.runtime.installId, slug: c.slug, info: info(), replies, hello})}); // hello: 1º contato volta na hora (o painel mostra "Conectado" logo)
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'O gamezoney.com recusou a ligação do app (HTTP ' + res.status + ').'), {status: res.status});
      Object.assign(live, {connected: true, lastAt: Date.now(), lastError: '', url: data.url || live.url}); hello = false;
      return Array.isArray(data.requests) ? data.requests.slice(0, 50) : [];
    } finally { clearTimeout(kill); }
  }
  async function run() {
    let replies = [], wait = 2000;
    while (running) {
      const c = cfg();
      if (!c.enabled || !c.slug || !allowed() || !lic?.planToken?.()) { live.connected = false; await sleep(5000); continue; }
      try {
        const requests = await cycle(replies); replies = requests.map(answer); live.requests += requests.length; wait = 2000;
      } catch (e) {
        if (!running) break;
        replies = []; hello = true;
        if (restarting) { restarting = false; continue; } // endereço trocado/ligado agora: liga de novo na hora
        live.connected = false; live.lastError = String(e.name === 'AbortError' ? 'Sem resposta do gamezoney.com.' : e.message || e).slice(0, 200);
        await sleep(e.status === 409 || e.status === 402 || e.status === 401 ? 60000 : wait); wait = Math.min(wait * 2, 60000);
      }
    }
  }
  function start() { if (running || deps.noTimer) return; running = true; loop = run(); }
  function stop() { running = false; try { ctrl?.abort(); } catch { } if (wake) wake(); }
  function restart() { if (!running) return; restarting = true; hello = true; try { ctrl?.abort(); } catch { } if (wake) { restarting = false; wake(); } }
  return {status, save, handle, answer, info, start, stop, cycle, stations, issue, memberOf, CATEGORY};
};
module.exports.CATEGORY = CATEGORY;
module.exports.categoryOf = categoryOf;
