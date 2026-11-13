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
  const c0 = cfg;
  // 1.4.1: a mesma ligação leva o app da recepção (painel de fora, remote-panel.js)
  const panelOn = () => !!cfg().panel?.enabled;
  const secret = () => { const s = (store.state.secrets ??= {}); if (!s.appSecret) { s.appSecret = crypto.randomBytes(32).toString('hex'); store.persist(); } return s.appSecret; };
  let running = false, ctrl = null, loop = null, restarting = false, hello = true;
  const live = {connected: false, lastAt: 0, lastError: '', url: '', requests: 0};

  // ---------- configuração (Gerenciar App) ----------
  function status() {
    const c = cfg();
    return {allowed: allowed(), enabled: !!c.enabled, slug: c.slug || '', url: c.slug ? (live.url || 'https://app.gamezoney.com/' + c.slug) : '',
      connected: live.connected && Date.now() - live.lastAt < 60000, lastAt: live.lastAt, lastError: live.lastError, hasAccount: !!lic?.planToken?.(),
      categories: CATEGORY, whatsapp: c.whatsapp || ''};
  }
  function save(input, actor) {
    const enabled = input.enabled === true, slug = String(input.slug ?? '').trim().toLowerCase();
    // 1.4.5: WhatsApp do suporte (botão Suporte na engrenagem do app); vazio = opção desligada no app
    const whatsapp = input.whatsapp === undefined ? (cfg().whatsapp || '') : phone(input.whatsapp);
    if (enabled && !allowed()) fail('App do cliente: recurso do plano Pro. Entre com a conta gamezoney.com do plano Pro em Configuração › Licença.');
    if (slug && (!SLUG_RE.test(slug) || slug.includes('--') || RESERVED.has(slug))) fail('Endereço do app: de 3 a 40 letras minúsculas, números ou hífen (ex.: arena-centro).');
    if ((enabled || c0().panel?.enabled) && !slug) fail(enabled ? 'Escolha o endereço do app (ex.: arena-centro).' : 'O app da recepção usa este endereço: desligue o app da recepção antes de apagar o endereço.');
    if (enabled && !lic?.planToken?.()) fail('Entre com a conta gamezoney.com em Configuração › Licença antes de ligar o app.');
    const c = cfg(), changed = c.slug !== slug;
    const phoneChanged = whatsapp !== (c.whatsapp || '');
    store.change(actor, 'config', enabled ? `App do cliente ligado: app.gamezoney.com/${slug}` : 'App do cliente desligado', () => { c.enabled = enabled; c.slug = slug; if (whatsapp) c.whatsapp = whatsapp; else delete c.whatsapp; });
    if (phoneChanged) store.log(actor, 'config', whatsapp ? `WhatsApp do suporte do app: ${whatsapp}` : 'WhatsApp do suporte do app removido');
    if (changed) { live.url = ''; live.connected = false; }
    live.lastError = ''; restart();
    return status();
  }

  // 1.4.5: número do WhatsApp: só dígitos; 10–11 dígitos (DDD + número) ganham o 55 do Brasil
  function phone(v) {
    const d = String(v ?? '').replace(/\D/g, ''); if (!d) return '';
    const n = d.length <= 11 ? '55' + d : d;
    if (n.length < 12 || n.length > 15) fail('WhatsApp do suporte: informe DDD + número (ex.: 11 91234-5678) ou deixe em branco.');
    return n;
  }
  // ---------- 1.4.5: notificações no app (Ações › Enviar mensagem › "Enviar também no app") ----------
  const NOTICE_DAYS = 30;
  const noticeList = () => (store.state.appNotices ??= []);
  // to = 'all' (todos os clientes do app) ou lista de ids de clientes (quem está jogando nos PCs escolhidos)
  function addNotice(to, text, actor) {
    const now = Date.now(), n = {id: crypto.randomUUID(), at: now, text: String(text).slice(0, 200), to: to === 'all' ? 'all' : [...new Set(to)].slice(0, 500)};
    store.change(actor, 'mensagem-app', to === 'all' ? `Notificação no app (todos os clientes): ${n.text}` : `Notificação no app (${n.to.length} cliente(s)): ${n.text}`, () => {
      const list = noticeList(); list.push(n);
      const keep = list.filter(x => x.at > now - NOTICE_DAYS * 86400000).slice(-200); list.splice(0, list.length, ...keep);
    });
    return n;
  }
  function noticesFor(m, now = Date.now()) {
    return noticeList().filter(n => n.at > now - NOTICE_DAYS * 86400000 && (n.to === 'all' || (Array.isArray(n.to) && n.to.includes(m.id))))
      .slice(-30).reverse().map(n => ({id: n.id, at: n.at, text: n.text}));
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
  function tooMany(key) { if (tries.size > 5000) return true; // ataque em massa: espera (bloqueios feitos não são apagados antes da hora)
    const t = tries.get(key); return t && t.until > Date.now() && t.n >= (key.startsWith('ip:') ? 20 : 5); }
  function miss(key) { const now = Date.now(); if (tries.size > 2000) for (const [k, v] of tries) if (v.until < now) tries.delete(k); if (tries.size > 5000) return; let t = tries.get(key); if (!t || t.until < now) { t = {n: 0, until: now + 900000}; tries.set(key, t); } t.n++; }

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
      achievements: achievements ? achievements.progressOf(m.id).filter(a => a.done).length : 0,
      support: {whatsapp: cfg().whatsapp || ''}};
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
    if (r.action !== 'logo' && !cfg().enabled) fail('O app do cliente está desligado nesta arena.', 404); // 1.4.1: a ligação pode estar aberta só pelo app da recepção
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
      case 'notices': return {notices: noticesFor(memberOf(r.auth))};
      // 1.3.9: Ranking (os mesmos Top 10 do painel): só o nick de cada cliente; nas recargas, a quantidade (sem valores em R$)
      case 'ranking': {
        const m = memberOf(r.auth), rk = require('./events').ranking(store, {}), me = String(m.username || '');
        const row = (x, value) => ({nick: x.username, value, me: !!me && x.username === me});
        return {month: rk.month, me,
          medals: rk.medals.filter(x => x.username).map(x => row(x, Math.round(x.medalsMilli) / 1000)),
          participations: rk.participations.filter(x => x.username).map(x => row(x, x.count)),
          recharges: rk.recharges.filter(x => x.username).map(x => row(x, x.count))};
      }
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
      if (!(c.enabled || panelOn()) || !c.slug || !allowed() || !lic?.planToken?.()) { live.connected = false; await sleep(5000); continue; }
      try {
        kick(); const requests = await cycle(replies); live.requests += requests.length; wait = 2000;
        replies = serve(requests);
      } catch (e) {
        if (!running) break;
        replies = []; hello = true;
        if (restarting) { restarting = false; continue; } // endereço trocado/ligado agora: liga de novo na hora
        live.connected = false; live.lastError = String(e.name === 'AbortError' ? 'Sem resposta do gamezoney.com.' : e.message || e).slice(0, 200);
        await sleep(e.status === 409 || e.status === 402 || e.status === 401 ? 60000 : wait); wait = Math.min(wait * 2, 60000);
      }
    }
  }
  // 1.4.1: pedido do app da recepção (painel): repete no próprio servidor e devolve assim que fica pronto, num POST à parte
  //        (replyOnly) — um pedido demorado não segura os outros nem a espera de novos pedidos
  const outbox = []; let flushing = false;
  function http(r) {
    const remote = deps.remote, port = deps.port?.();
    const p = remote && port && panelOn() ? remote.forward(r, port) : Promise.resolve({id: r.id, status: 404, data: {error: 'O app da recepção está desligado nesta arena.'}});
    p.then(rep => { outbox.push({rep, at: Date.now()}); kick(); });
  }
  // pedidos de uma volta: os do app do cliente respondem na próxima ligação; os do app da recepção, assim que ficam prontos
  function serve(requests) { const out = []; for (const r of requests) { if (r.action === 'http') http(r); else out.push(answer(r)); } return out; }
  function kick() { if (!flushing && outbox.length) { flushing = true; setImmediate(flush); } }
  async function flush() {
    while (outbox.length && Date.now() - outbox[0].at > 30000) outbox.shift(); // o site já desistiu desse pedido
    let n = 0, size = 0; while (n < outbox.length && n < 40 && (n === 0 || size + String(outbox[n].rep.data?.body || '').length < 8e6)) size += String(outbox[n++].rep.data?.body || '').length;
    const list = outbox.splice(0, n);
    if (!list.length) { flushing = false; return; }
    let ok = false;
    try {
      const c = cfg(), res = await fetchImpl(SITE() + '/api/app/relay', {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token: lic?.planToken?.(), installId: store.state.runtime.installId, slug: c.slug, replies: list.map(x => x.rep), replyOnly: true})});
      await res.arrayBuffer().catch(() => null); ok = res.ok;
    } catch { }
    if (!ok) outbox.unshift(...list); // tenta de novo na próxima volta da ligação
    flushing = false; if (ok) kick();
  }
  // 1.4.2: Testar conexão (Gerenciar App): mostra em português o que falta para o app funcionar, sem precisar de suporte.
  //        Não precisa abrir porta: só a SAÍDA HTTPS (443) até o gamezoney.com.
  async function diagnose() {
    const out = [], add = (ok, label, detail) => out.push({ok, label, detail});
    const host = new URL(SITE()).hostname, dns = require('node:dns').promises;
    try { await dns.lookup(host); add(true, 'Internet e DNS', host + ' encontrado.'); }
    catch { add(false, 'Internet e DNS', 'Não foi possível encontrar ' + host + '. Confira se este computador está com internet (abra gamezoney.com no navegador).'); }
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000); t.unref?.();
    try {
      const r = await fetchImpl(SITE() + '/api/config', {signal: ctl.signal}); await r.arrayBuffer().catch(() => null);
      add(r.ok, 'Saída HTTPS (porta 443)', r.ok ? 'O servidor conversa com o gamezoney.com. Nenhuma porta de entrada precisa ser aberta no roteador.' : 'O gamezoney.com respondeu com erro (HTTP ' + r.status + '). Tente de novo em alguns minutos.');
    } catch (e) {
      const code = String(e?.cause?.code || e?.code || e?.name || '');
      const why = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|TLS/i.test(code) ? 'Um antivírus ou proxy está interceptando o HTTPS deste computador. Libere o GameZoney (pasta do programa) na proteção web/HTTPS do antivírus.'
        : /Abort|TIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/i.test(code) ? 'A saída pela porta 443 está bloqueada (firewall do Windows, antivírus ou firewall da rede). Use "Reparar conexão de rede" no menu Iniciar do GameZoney ou libere o GameZoney no antivírus.'
        : 'Sem acesso ao gamezoney.com (' + (code || 'erro') + '). Confira a internet deste computador.';
      add(false, 'Saída HTTPS (porta 443)', why);
    } finally { clearTimeout(t); }
    const token = lic?.planToken?.();
    add(!!token && allowed(), 'Conta do plano Pro', !token ? 'Entre com a conta gamezoney.com em Configuração › Licença.' : allowed() ? 'Plano Pro ativo neste computador.' : 'A conta deste computador não está no plano Pro. Assine o Pro em gamezoney.com e clique em Atualizar plano.');
    const c = cfg(), on = !!c.enabled || panelOn();
    add(!!c.slug, 'Endereço do app', c.slug ? 'app.gamezoney.com/' + c.slug : 'Escolha o endereço na aba App do cliente.');
    const st = status();
    add(on && st.connected, 'Ligação com o app.gamezoney.com', !on ? 'Ligue o app do cliente ou o app da recepção.' : st.connected ? 'Conectado.' : (live.lastError || 'Conectando… aguarde alguns segundos e teste de novo.'));
    return {ok: out.every(x => x.ok), checks: out};
  }
  // 1.4.3: pede ao gamezoney.com o envio do código do login do app da recepção ao e-mail da conta do plano
  async function sendPanelCode({code, operator, ip}) {
    const c = cfg(), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000); t.unref?.();
    try {
      const res = await fetchImpl(SITE() + '/api/app/panel-code', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: ctl.signal,
        body: JSON.stringify({token: lic?.planToken?.(), installId: store.state.runtime.installId, slug: c.slug, code, operator: String(operator || '').slice(0, 40), ip: String(ip || '').slice(0, 60)})});
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sent) throw new Error(data.error || 'Não foi possível enviar o código por e-mail agora. Tente de novo em alguns minutos.');
      return {to: String(data.to || '')};
    } catch (e) { throw new Error(e.name === 'AbortError' ? 'O gamezoney.com não respondeu ao enviar o código. Tente de novo.' : e.message); }
    finally { clearTimeout(t); }
  }
  function start() { if (running || deps.noTimer) return; running = true; loop = run(); }
  function stop() { running = false; try { ctrl?.abort(); } catch { } if (wake) wake(); }
  function restart() { if (!running) return; restarting = true; hello = true; try { ctrl?.abort(); } catch { } if (wake) { restarting = false; wake(); } }
  return {status, save, handle, addNotice, noticesFor, answer, serve, diagnose, sendPanelCode, info, start, stop, restart, cycle, stations, issue, memberOf, CATEGORY};
};
module.exports.CATEGORY = CATEGORY;
module.exports.categoryOf = categoryOf;
