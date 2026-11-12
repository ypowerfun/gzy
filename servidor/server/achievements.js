'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.3.7 (plano Pro, junto com o app do cliente): CONQUISTAS. O admin cria conquistas (ex.: "10 horas jogadas",
// "5 Corujões") e define quantas medalhas cada uma dá. Quando o cliente completa, as medalhas entram na Fidelidade
// (mesmo extrato das outras medalhas) e, se ele estiver jogando num PC, aparece o aviso na tela.
// Como conta, sem mexer em nada do que já funciona (sessões, recargas e Corujão continuam iguais):
//  - a cada 30 s olha só o que é NOVO (sessões encerradas, recargas e Corujão/Viradão iniciados nos últimos 7 dias que
//    ainda não foram contados) e soma nos contadores de cada cliente;
//  - na primeira vez soma todo o histórico (inclusive o arquivado), então quem já jogava muito completa na hora;
//  - contadores e ids já contados ficam numa linha pequena do banco (tabela live, 'achv'): nada de regravar o estado
//    inteiro a cada volta (regra da 1.2.1). Só a entrega de uma conquista grava o estado (store.change).
const {fail, id} = require('./store');
const METRICS = {
  hours: {label: 'Horas jogadas', unit: 'h', of: c => (c.seconds || 0) / 3600},
  sessions: {label: 'Sessões jogadas', unit: '', of: c => c.sessions || 0},
  events: {label: 'Participações em Corujão/Viradão', unit: '', of: c => c.events || 0},
  spent: {label: 'Recargas (R$)', unit: 'R$', of: c => (c.cents || 0) / 100},
};
const ICONS = ['🏆', '🎮', '⏱️', '🔥', '⭐', '🎯', '🥇', '💎', '🚀', '👑'];
const WINDOW = 7 * 86400000, EVERY = 30000;

module.exports = function achievements(store, options = {}) {
  const allowed = () => (options.allowed ? !!options.allowed() : true);
  const list = () => (store.state.achievements ??= []);
  const awards = () => (store.state.achievementAwards ??= []);
  let data = null, timer = null, first = null;
  function load() {
    if (data) return data;
    try { const r = store.db.prepare("SELECT data FROM live WHERE key='achv'").get(); data = r ? JSON.parse(r.data) : null; } catch { data = null; }
    if (!data || typeof data !== 'object' || !data.members) data = null;
    return data;
  }
  const save = () => store.liveSet('achv', data);
  const add = (c, k, v) => { c[k] = (c[k] || 0) + v; };
  const counter = mid => (data.members[mid] ??= {});
  const guestIds = () => new Set(store.state.members.filter(m => m.guest).map(m => m.id));
  // registros que contam: [tipo, id, quando, membro, aplicar]
  function* records(from, sessions, sales, events) {
    for (const s of sessions) if (s.status === 'finished' && s.memberId && (s.finishedAt || 0) > from) yield ['s', s.id, s.finishedAt, s.memberId, c => { add(c, 'sessions', 1); add(c, 'seconds', Math.max(0, Number(s.usedSeconds) || 0)); }];
    for (const x of sales) if (x.status !== 'canceled' && x.memberId && (x.cents || 0) > 0 && (x.at || 0) > from) yield ['r', x.id, x.at, x.memberId, c => add(c, 'cents', x.cents)];
    for (const e of events) if (e.startedAt && e.startedAt > from) for (const p of e.participants || []) if (p.participated) yield ['e', e.id + ':' + p.memberId, e.startedAt, p.memberId, c => add(c, 'events', 1)];
  }
  // conta o que é novo; devolve os clientes que mudaram
  function count(now = Date.now()) {
    const changed = new Set(), guests = guestIds();
    if (!load()) {
      data = {v: 1, members: {}, seen: {}, since: now};
      const all = store.history ? [store.history('sessions', 0, now + 864e5), store.history('sales', 0, now + 864e5)] : [store.state.sessions, store.state.sales];
      for (const [kind, rid, at, mid, apply] of records(0, all[0], all[1], store.state.events || [])) {
        if (guests.has(mid)) continue; apply(counter(mid)); changed.add(mid);
        if (at > now - WINDOW) data.seen[kind + rid] = at;
      }
      save(); return {changed, all: true};
    }
    const from = now - WINDOW;
    for (const [kind, rid, at, mid, apply] of records(from, store.state.sessions, store.state.sales, store.state.events || [])) {
      const key = kind + rid; if (data.seen[key] || guests.has(mid)) continue;
      data.seen[key] = at; apply(counter(mid)); changed.add(mid);
    }
    for (const [k, at] of Object.entries(data.seen)) if (at <= from) delete data.seen[k];
    if (changed.size) save();
    return {changed, all: false};
  }
  const active = () => list().filter(a => !a.removedAt && a.active !== false);
  const done = (aid, mid) => awards().some(w => w.achievementId === aid && w.memberId === mid);
  // entrega as conquistas completadas (medalhas na Fidelidade + aviso no PC)
  function award(members, now = Date.now()) {
    const todo = [];
    for (const a of active()) {
      const m = METRICS[a.metric]; if (!m) continue;
      for (const mid of members) {
        const c = data.members[mid]; if (!c || m.of(c) < a.target || done(a.id, mid)) continue;
        const member = store.state.members.find(x => x.id === mid); if (!member || member.guest) continue;
        todo.push([a, member]);
      }
    }
    if (!todo.length) return [];
    const business = require('./business');
    const names = todo.map(([a, m]) => `${m.username || m.name}: ${a.name}`).join(' • ');
    const given = store.change('sistema', 'fidelidade', `Conquista completada — ${names}`.slice(0, 1900), () => todo.map(([a, m]) => {
      const medals = m.loyaltyEnabled === false ? 0 : Math.max(0, Number(a.medalsMilli) || 0);
      if (medals > 0) { business.points(store, m, medals, 'Conquista: ' + a.name, a.id, now); business.autoRedeem(store, m, now); }
      awards().push({id: id(), achievementId: a.id, memberId: m.id, at: now, medalsMilli: medals});
      return {achievement: a, member: m, medalsMilli: medals};
    }));
    for (const g of given) {
      const s = store.activeForMember?.(g.member.id); if (!s || !options.notify) continue;
      try { options.notify(s.stationId, `*Conquista desbloqueada!*\n${g.achievement.icon || '🏆'} ${g.achievement.name}${g.medalsMilli ? ` (+${g.medalsMilli / 1000} medalha${g.medalsMilli === 1000 ? '' : 's'})` : ''}`); } catch { }
    }
    return given;
  }
  function run(now = Date.now(), everyone = false) {
    if (!allowed()) return [];
    const r = count(now);
    const who = everyone || r.all ? Object.keys(data.members) : [...r.changed];
    return who.length ? award(who, now) : [];
  }
  // ---------- cadastro (admin) ----------
  function clean(input) {
    const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 60 || /[<>\u0000-\u001f]/.test(name)) fail('Nome da conquista: de 2 a 60 caracteres.');
    const description = String(input.description ?? '').trim().replace(/\s+/g, ' ').slice(0, 160);
    if (/[<>\u0000-\u001f]/.test(description)) fail('Descrição inválida.');
    const metric = String(input.metric || ''); if (!METRICS[metric]) fail('Escolha o que o cliente precisa fazer.');
    const target = Number(String(input.target ?? '').replace(',', '.'));
    if (!Number.isFinite(target) || target <= 0 || target > 1000000) fail('Meta inválida: informe um número maior que zero.');
    const medals = Number(String(input.medals ?? '0').replace(',', '.'));
    if (!Number.isFinite(medals) || medals < 0 || medals > 100000) fail('Medalhas: de 0 a 100000.');
    const icon = ICONS.includes(input.icon) ? input.icon : ICONS[0];
    return {name, description, metric, target: Math.round(target * 100) / 100, medalsMilli: Math.round(medals * 1000), icon, active: input.active !== false};
  }
  function upsert(input, actor) {
    if (!allowed()) fail('Conquistas: recurso do plano Pro.');
    const v = clean(input), old = input.id ? list().find(a => a.id === String(input.id) && !a.removedAt) : null;
    if (input.id && !old) fail('Conquista não encontrada.');
    if (list().some(a => !a.removedAt && a !== old && a.name.toLowerCase() === v.name.toLowerCase())) fail('Já existe uma conquista com esse nome.');
    const saved = store.change(actor, 'fidelidade', `${old ? 'Conquista alterada' : 'Conquista criada'}: ${v.name} (${METRICS[v.metric].label} ≥ ${v.target}, ${v.medalsMilli / 1000} medalhas)`, () => {
      if (old) { Object.assign(old, v, {updatedAt: Date.now()}); return old; }
      const a = {id: id(), ...v, createdAt: Date.now()}; list().push(a); return a;
    });
    run(Date.now(), true); // quem já cumpre a meta recebe na hora
    return saved;
  }
  function remove(input, actor) {
    const a = list().find(x => x.id === String(input.id || '') && !x.removedAt) || fail('Conquista não encontrada.');
    return store.change(actor, 'fidelidade', 'Conquista removida: ' + a.name, () => { a.removedAt = Date.now(); a.active = false; return {ok: true}; });
  }
  function progressOf(memberId) {
    load(); const c = data?.members?.[memberId] || {};
    return active().map(a => {
      const m = METRICS[a.metric], w = awards().find(x => x.achievementId === a.id && x.memberId === memberId), value = m.of(c);
      return {id: a.id, name: a.name, description: a.description, icon: a.icon, metric: a.metric, metricLabel: m.label, unit: m.unit, target: a.target,
        value: Math.round(Math.min(value, a.target) * 100) / 100, medals: a.medalsMilli / 1000, done: !!w, doneAt: w?.at || null};
    });
  }
  function admin() {
    load();
    return {allowed: allowed(), metrics: Object.fromEntries(Object.entries(METRICS).map(([k, m]) => [k, m.label])), icons: ICONS,
      list: list().filter(a => !a.removedAt).map(a => ({...a, medals: a.medalsMilli / 1000, completed: awards().filter(w => w.achievementId === a.id).length}))};
  }
  function start() {
    if (options.noTimer || timer) return;
    first = setTimeout(() => { try { run(); } catch (e) { console.error('Conquistas: ' + e.message); } }, 5000); first.unref?.();
    timer = setInterval(() => { try { run(); } catch (e) { console.error('Conquistas: ' + e.message); } }, EVERY); timer.unref?.();
  }
  function stop() { clearInterval(timer); clearTimeout(first); timer = first = null; }
  return {run, upsert, remove, admin, progressOf, counters: mid => (load()?.members?.[mid] || {}), start, stop, METRICS};
};
module.exports.METRICS = METRICS;
