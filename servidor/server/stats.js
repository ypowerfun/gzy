'use strict';
// 3.0.31: Estatistica — analises de tempo de uso, vendas e fluxo de caixa projetado.
const {id, integer, text, fail} = require('./store');

const DAY = 86400000, HOUR = 3600000;
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function init(store) {
  const s = store.state;
  s.freeGrants ??= []; s.staffUsage ??= []; s.bills ??= [];
  s.settings.cashflow ??= {balanceCents: 0};
  // Registros de uso de funcionario que ficaram abertos quando o servidor parou.
  const lastAlive = Number(s.runtime?.lastAliveAt) || 0;
  for (const r of s.staffUsage) if (!r.endedAt) r.endedAt = Math.max(r.startedAt, lastAlive || r.startedAt);
  if (!s.freeGrantsBackfilled) {   // tempo gratis concedido antes da 3.0.31
    const rewards = new Map((s.rewards || []).map(r => [r.id, r]));
    for (const sale of s.sales) if (sale.autoReward?.minutes > 0) s.freeGrants.push({id: id(), memberId: sale.memberId, memberName: sale.memberName, memberUsername: sale.memberUsername || '', minutes: sale.autoReward.minutes, reason: 'Prêmio automático do programa fidelidade', at: sale.at});
    for (const l of s.loyaltyLedger || []) if (l.amount < 0 && /^Resgate: /.test(l.reason || '') && rewards.get(l.reference)?.minutes > 0) {
      const m = s.members.find(x => x.id === l.memberId);
      s.freeGrants.push({id: id(), memberId: l.memberId, memberName: m?.name || '', memberUsername: m?.username || '', minutes: rewards.get(l.reference).minutes, reason: l.reason, at: l.at});
    }
    s.freeGrantsBackfilled = true;
  }
}

function freeGrant(store, member, minutes, reason, at = Date.now()) {
  if (!member || !(minutes > 0)) return;
  (store.state.freeGrants ??= []).push({id: id(), memberId: member.id, memberName: member.name, memberUsername: member.username || '', minutes, reason, at});
}

// Registra quanto tempo os funcionarios usam as maquinas clientes (modo administrador/manutencao no PC).
function staffTracker(store) {
  const now = () => Date.now();
  const kindOf = v => v.localMaintenance ? 'Manutenção local' : v.remoteRelease ? 'Liberado pela recepção' : 'Administrador';
  const begin = (stationId, v) => {
    let name = stationId; try { name = store.station(stationId).name; } catch {}
    const r = {id: id(), stationId, stationName: name, username: v.username || 'Funcionário', kind: kindOf(v), startedAt: now(), endedAt: null};
    const list = (store.state.staffUsage ??= []); list.push(r); if (list.length > 5000) list.splice(0, list.length - 5000);
    v._usageId = r.id; try { store.persist(); } catch {}
  };
  const end = prev => {
    const r = (store.state.staffUsage || []).find(x => x.id === prev._usageId); if (!r || r.endedAt) return;
    r.endedAt = Math.max(r.startedAt, Math.min(now(), (prev.lastSeen || now()) + 15000)); try { store.persist(); } catch {}
  };
  class Tracked extends Map {
    set(k, v) { const prev = super.get(k); if (prev && prev !== v && prev.username === v.username && prev._usageId) v._usageId = prev._usageId; else if (prev !== v) { if (prev) end(prev); begin(k, v); } return super.set(k, v); }
    delete(k) { const prev = super.get(k); if (prev) end(prev); return super.delete(k); }
  }
  return new Tracked();
}

// ---------- datas no fuso da loja ----------
const fmtCache = new Map();
function parts(t, tz) {
  let f = fmtCache.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short'}); fmtCache.set(tz, f); }
  const p = Object.fromEntries(f.formatToParts(t).map(x => [x.type, x.value]));
  return {y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)};
}
const offset = (t, tz) => { const p = parts(t, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(t / 1000) * 1000; };
function startOf(date, tz) { const [y, m, d] = date.split('-').map(Number), g = Date.UTC(y, m - 1, d); let t = g - offset(g, tz); return g - offset(t, tz); }
const localDate = (t, tz) => { const p = parts(t, tz); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
function addMonths(d, n) { const [y, m, day] = d.split('-').map(Number), t = new Date(Date.UTC(y, m - 1 + n, 1)), last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`; }

function range(store, q, now = Date.now()) {
  const tz = store.state.settings.timeZone || 'America/Manaus', today = localDate(now, tz);
  const to = validDate(String(q.to || '')) ? String(q.to) : today, from = validDate(String(q.from || '')) ? String(q.from) : addDays(to, -29);
  if (from > to) fail('A data inicial deve ser anterior à data final.');
  if (Date.parse(to) - Date.parse(from) > 366 * DAY) fail('Escolha um período de até 1 ano.');
  const start = startOf(from, tz), end = startOf(addDays(to, 1), tz);
  return {tz, from, to, start, end, until: Math.min(end, now), now};
}
const clip = (a, b, R) => Math.max(0, Math.min(b, R.until) - Math.max(a, R.start));
const sessionEnd = (s, now) => s.status === 'active' ? Math.min(now, s.endsAt) : (s.finishedAt ?? s.startedAt + (s.usedSeconds || 0) * 1000);
const inRange = (t, R) => t >= R.start && t < R.end;
const memberName = (store, id, fallback) => { const m = store.state.members.find(x => x.id === id); return m ? (m.username ? m.username : m.name) : fallback || '—'; };

// A1 por maquina
function machines(store, R) {
  const rows = new Map(), get = (sid, name) => { if (!rows.has(sid)) { const st = store.state.stations.find(s => s.id === sid); rows.set(sid, {stationId: sid, name: st?.name || name || sid, kind: st?.kind || '', removed: !!st?.removedAt, sessions: 0, usedSeconds: 0, staffSeconds: 0, staffCount: 0}); } return rows.get(sid); };
  for (const st of store.state.stations) if (!st.removedAt) get(st.id, st.name);
  for (const s of store.state.sessions) { const sec = clip(s.startedAt, sessionEnd(s, R.now), R) / 1000; if (!sec && !inRange(s.startedAt, R)) continue; const r = get(s.stationId, s.stationName); r.usedSeconds += sec; if (inRange(s.startedAt, R)) r.sessions++; }
  for (const u of store.state.staffUsage || []) { const sec = clip(u.startedAt, u.endedAt || R.now, R) / 1000; if (!sec) continue; const r = get(u.stationId, u.stationName); r.staffSeconds += sec; r.staffCount++; }
  const span = Math.max(1, (R.until - R.start) / 1000);
  const list = [...rows.values()].map(r => ({...r, usedSeconds: Math.round(r.usedSeconds), staffSeconds: Math.round(r.staffSeconds), occupancy: Math.round(r.usedSeconds / span * 1000) / 10})).sort((a, b) => b.usedSeconds - a.usedSeconds);
  return {rows: list, most: list[0] || null, least: list.length ? list[list.length - 1] : null, totalSeconds: list.reduce((a, r) => a + r.usedSeconds, 0)};
}

// A2 por horario
function hours(store, R) {
  const grid = Array.from({length: 7}, () => Array(24).fill(0)), starts = Array(24).fill(0), slots = Array.from({length: 7}, () => Array(24).fill(0));
  for (let t = R.start; t < R.until; t += HOUR) { const p = parts(t, R.tz); slots[p.wd][p.h]++; }
  const cache = new Map(), slot = t => { const k = Math.floor(t / HOUR); if (!cache.has(k)) { const p = parts(k * HOUR, R.tz); cache.set(k, [p.wd, p.h]); } return cache.get(k); };
  for (const s of store.state.sessions) {
    let a = Math.max(s.startedAt, R.start); const b = Math.min(sessionEnd(s, R.now), R.until);
    if (inRange(s.startedAt, R)) starts[slot(s.startedAt)[1]]++;
    while (a < b) { const next = Math.min(b, (Math.floor(a / HOUR) + 1) * HOUR), [wd, h] = slot(a); grid[wd][h] += (next - a) / 1000; a = next; }
  }
  const byHour = Array.from({length: 24}, (_, h) => { const sec = grid.reduce((x, row) => x + row[h], 0), n = slots.reduce((x, row) => x + row[h], 0); return {hour: h, seconds: Math.round(sec), sessions: starts[h], avgMachines: n ? Math.round(sec / (n * 3600) * 100) / 100 : 0}; });
  const byWeekday = grid.map((row, wd) => { const sec = row.reduce((a, b) => a + b, 0), n = slots[wd].reduce((a, b) => a + b, 0); return {weekday: wd, name: WEEKDAYS[wd], seconds: Math.round(sec), avgMachines: n ? Math.round(sec / (n * 3600) * 100) / 100 : 0}; });
  const heat = grid.map((row, wd) => row.map((sec, h) => slots[wd][h] ? Math.round(sec / (slots[wd][h] * 3600) * 100) / 100 : 0));
  const active = byHour.filter(h => h.seconds > 0), sorted = [...byHour].sort((a, b) => b.avgMachines - a.avgMachines);
  return {byHour, byWeekday, heat, weekdays: WEEKDAYS, peak: active.length ? sorted[0] : null, quiet: active.length ? [...active].sort((a, b) => a.avgMachines - b.avgMachines)[0] : null};
}

// A3 por funcionario
function staff(store, R) {
  const rows = new Map();
  for (const u of store.state.staffUsage || []) {
    const sec = clip(u.startedAt, u.endedAt || R.now, R) / 1000; if (!sec && !inRange(u.startedAt, R)) continue;
    const r = rows.get(u.username) || {username: u.username, count: 0, seconds: 0, stations: new Set(), last: 0};
    r.count++; r.seconds += sec; r.stations.add(u.stationName); r.last = Math.max(r.last, u.startedAt); rows.set(u.username, r);
  }
  const records = (store.state.staffUsage || []).filter(u => clip(u.startedAt, u.endedAt || R.now, R) > 0 || inRange(u.startedAt, R)).slice(-300).reverse();
  return {rows: [...rows.values()].map(r => ({...r, seconds: Math.round(r.seconds), stations: [...r.stations]})).sort((a, b) => b.seconds - a.seconds), records};
}

// A4 por cliente (ranking por valor gasto)
function clients(store, R) {
  const rows = new Map(), row = (key, name, guest) => { if (!rows.has(key)) rows.set(key, {memberId: guest ? null : key, name, guest, spentCents: 0, purchases: 0, minutes: 0, usedSeconds: 0, sessions: 0, lastVisit: 0}); return rows.get(key); };
  const isGuest = id => !!store.state.members.find(m => m.id === id)?.guest;
  for (const s of store.state.sales) { if (s.status === 'canceled' || !inRange(s.at, R)) continue; const g = isGuest(s.memberId), r = row(g ? 'guests' : s.memberId, g ? 'Visitantes (sem cadastro)' : memberName(store, s.memberId, s.memberUsername || s.memberName), g); r.spentCents += s.cents; r.purchases++; r.minutes += s.minutes || 0; }
  for (const s of store.state.sessions) { const sec = clip(s.startedAt, sessionEnd(s, R.now), R) / 1000; if (!sec) continue; const g = isGuest(s.memberId) || s.guest, r = row(g ? 'guests' : s.memberId, g ? 'Visitantes (sem cadastro)' : memberName(store, s.memberId, s.memberUsername || s.memberName), g); r.usedSeconds += sec; if (inRange(s.startedAt, R)) r.sessions++; r.lastVisit = Math.max(r.lastVisit, s.startedAt); }
  const list = [...rows.values()].map(r => ({...r, usedSeconds: Math.round(r.usedSeconds)})).sort((a, b) => b.spentCents - a.spentCents || b.usedSeconds - a.usedSeconds);
  return {rows: list.slice(0, 200), total: list.length, totalCents: list.reduce((a, r) => a + r.spentCents, 0)};
}

// A5 por cliente gratis (tempo concedido sem pagamento)
function free(store, R) {
  const entries = [];
  for (const g of store.state.freeGrants || []) if (inRange(g.at, R)) entries.push({at: g.at, memberId: g.memberId, name: memberName(store, g.memberId, g.memberUsername || g.memberName), minutes: g.minutes, reason: g.reason});
  for (const s of store.state.sales) if (s.status !== 'canceled' && s.cents === 0 && inRange(s.at, R)) entries.push({at: s.at, memberId: s.memberId, name: memberName(store, s.memberId, s.memberUsername || s.memberName), minutes: s.minutes, reason: 'Recarga gratuita: ' + s.label});
  const rows = new Map();
  for (const e of entries) { const r = rows.get(e.memberId) || {memberId: e.memberId, name: e.name, count: 0, minutes: 0, last: 0}; r.count++; r.minutes += e.minutes; r.last = Math.max(r.last, e.at); rows.set(e.memberId, r); }
  return {rows: [...rows.values()].sort((a, b) => b.minutes - a.minutes), entries: entries.sort((a, b) => b.at - a.at).slice(0, 300), count: entries.length, minutes: entries.reduce((a, e) => a + e.minutes, 0)};
}

// A6 por duracao do acesso
function durations(store, R) {
  const list = store.state.sessions.filter(s => s.status === 'finished' && inRange(s.startedAt, R)).map(s => ({s, sec: Math.max(0, s.usedSeconds || 0)}));
  const secs = list.map(x => x.sec).sort((a, b) => a - b), n = secs.length;
  const buckets = [['Até 15 min', 0, 900], ['15 a 30 min', 900, 1800], ['30 min a 1 h', 1800, 3600], ['1 a 2 h', 3600, 7200], ['2 a 4 h', 7200, 14400], ['Mais de 4 h', 14400, Infinity]].map(([label, a, b]) => ({label, count: secs.filter(x => x >= a && x < b).length}));
  const byKind = {}, byStation = new Map();
  for (const {s, sec} of list) {
    const st = store.state.stations.find(x => x.id === s.stationId), kind = st?.kind === 'computer' ? 'Computadores' : st?.kind === 'tv' ? 'TVs / Consoles' : 'Outros';
    (byKind[kind] ??= {name: kind, count: 0, seconds: 0}); byKind[kind].count++; byKind[kind].seconds += sec;
    const r = byStation.get(s.stationId) || {name: st?.name || s.stationName, count: 0, seconds: 0}; r.count++; r.seconds += sec; byStation.set(s.stationId, r);
  }
  const avg = r => ({...r, avgSeconds: r.count ? Math.round(r.seconds / r.count) : 0});
  return {count: n, avgSeconds: n ? Math.round(secs.reduce((a, b) => a + b, 0) / n) : 0, medianSeconds: n ? (n % 2 ? secs[(n - 1) / 2] : Math.round((secs[n / 2 - 1] + secs[n / 2]) / 2)) : 0, minSeconds: n ? secs[0] : 0, maxSeconds: n ? secs[n - 1] : 0, buckets, byKind: Object.values(byKind).map(avg), byStation: [...byStation.values()].map(avg).sort((a, b) => b.avgSeconds - a.avgSeconds)};
}

// B7 vendas por categoria / produto / funcionario
function sales(store, R) {
  const cat = new Map(), prod = new Map(), emp = new Map();
  const add = (map, key, base, qty, revenue, cost) => { const r = map.get(key) || {...base, qty: 0, transactions: 0, revenueCents: 0, costCents: 0}; r.qty += qty; r.revenueCents += revenue; r.costCents += cost; map.set(key, r); return r; };
  for (const s of store.state.sales) {
    if (s.status === 'canceled' || !inRange(s.at, R)) continue;
    const product = s.promotionId ? 'Promoção: ' + s.label : s.byValue ? 'Recarga por valor' : 'Recarga em minutos';
    add(cat, 'Tempo de uso (recargas)', {name: 'Tempo de uso (recargas)'}, 1, s.cents, 0);
    add(prod, 'time:' + product, {name: product, category: 'Tempo de uso (recargas)'}, 1, s.cents, 0);
    add(emp, s.actor, {name: s.actor}, 1, s.cents, 0).transactions++;
  }
  for (const s of store.state.shopSales || []) {
    if (s.status === 'canceled' || !inRange(s.at, R)) continue;
    let qty = 0, cost = 0;
    for (const i of s.items) {
      const c = (i.costCents || 0) * i.qty; qty += i.qty; cost += c;
      add(cat, i.category, {name: i.category}, i.qty, i.totalCents, c);
      add(prod, i.kind + ':' + i.itemId, {name: i.name, category: i.category}, i.qty, i.totalCents, c);
    }
    add(emp, s.actor, {name: s.actor}, qty, s.totalCents, cost).transactions++;
  }
  const fin = m => [...m.values()].map(r => ({...r, profitCents: r.revenueCents - r.costCents})).sort((a, b) => b.revenueCents - a.revenueCents);
  const categories = fin(cat);
  return {categories, products: fin(prod), employees: fin(emp), totalCents: categories.reduce((a, r) => a + r.revenueCents, 0), profitCents: categories.reduce((a, r) => a + r.profitCents, 0)};
}

// D1 fluxo de caixa projetado
function occurrences(bill, today, limit) {
  if (bill.status === 'paid') return [];
  if (bill.recurring !== 'monthly') return bill.dueDate <= limit ? [bill.dueDate] : [];
  const out = []; for (let d = bill.dueDate, i = 0; d <= limit && i < 60; d = addMonths(bill.dueDate, ++i)) out.push(d);
  return out;
}
function cashflow(store, R) {
  const tz = R.tz, today = localDate(R.now, tz), base = addDays(today, -30), start = startOf(addDays(today, -29), tz);
  const revenue = store.state.sales.filter(s => s.status !== 'canceled' && s.at >= start).reduce((a, s) => a + s.cents, 0) + (store.state.shopSales || []).filter(s => s.status !== 'canceled' && s.at >= start).reduce((a, s) => a + s.totalCents, 0);
  const expenses = (store.state.expenses || []).filter(e => e.status !== 'canceled' && e.date > base && e.date <= today).reduce((a, e) => a + e.cents, 0);
  const dailyRevenue = Math.round(revenue / 30), dailyExpenses = Math.round(expenses / 30);
  const balance = Number(store.state.settings.cashflow?.balanceCents) || 0;
  const bills = (store.state.bills || []).filter(b => b.status !== 'removed');
  const horizons = [30, 60, 90].map(days => {
    const limit = addDays(today, days); let due = 0, count = 0;
    for (const b of bills) { const occ = occurrences(b, today, limit); due += occ.length * b.cents; count += occ.length; }
    const inflow = dailyRevenue * days, final = balance + inflow - due;
    return {days, until: limit, inflowCents: inflow, billsCents: due, billsCount: count, finalCents: final, ok: final >= 0};
  });
  const upcoming = [];
  for (const b of bills) for (const d of occurrences(b, today, addDays(today, 90))) upcoming.push({billId: b.id, description: b.description, category: b.category, cents: b.cents, date: d, overdue: d < today, recurring: b.recurring});
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return {today, balanceCents: balance, dailyRevenueCents: dailyRevenue, dailyExpensesCents: dailyExpenses, revenue30Cents: revenue, expenses30Cents: expenses, horizons, upcoming, bills: bills.filter(b => b.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate))};
}

const REPORTS = {machines, hours, staff, clients, free, durations, sales, cashflow};
function report(store, q = {}) {
  const fn = REPORTS[q.kind] || fail('Relatório inválido.');
  const R = range(store, q);
  return {kind: q.kind, from: R.from, to: R.to, timeZone: R.tz, data: fn(store, R)};
}

// ---------- contas a pagar (fluxo de caixa) ----------
function saveBill(store, input, actor) {
  const description = text(input.description, 'Descrição', 200), cents = integer(input.cents, 1, 100000000, 'Valor');
  const dueDate = validDate(String(input.dueDate || '')) ? String(input.dueDate) : fail('Data de vencimento inválida.');
  const category = String(input.category || 'Contas a pagar').trim().slice(0, 80) || 'Contas a pagar', recurring = input.recurring === 'monthly' ? 'monthly' : 'none';
  const existing = input.id ? store.state.bills.find(b => b.id === input.id && b.status === 'open') || fail('Conta não encontrada.') : null;
  return store.change(actor, 'conta', `${existing ? 'Conta atualizada' : 'Conta a pagar cadastrada'}: ${description} • R$ ${(cents / 100).toFixed(2)} • vence ${dueDate}${recurring === 'monthly' ? ' (mensal)' : ''}`, () => {
    const b = existing || {id: id(), status: 'open', createdAt: Date.now(), createdBy: actor};
    if (!existing) store.state.bills.push(b);
    Object.assign(b, {description, cents, dueDate, category, recurring});
    return b;
  });
}
function payBill(store, input, actor) {
  const b = store.state.bills.find(x => x.id === input.id && x.status === 'open') || fail('Conta não encontrada.');
  const today = localDate(Date.now(), store.state.settings.timeZone || 'America/Manaus');
  // Pagar gera a despesa no financeiro. Conta mensal avanca para o proximo vencimento.
  const expense = require('./business').expense(store, {cents: b.cents, description: b.description + ' (venc. ' + b.dueDate + ')', category: b.category, date: today}, actor);
  return store.change(actor, 'conta', `Conta paga: ${b.description} • R$ ${(b.cents / 100).toFixed(2)}`, () => {
    if (b.recurring === 'monthly') { b.dueDate = addMonths(b.dueDate, 1); b.lastPaidAt = Date.now(); }
    else Object.assign(b, {status: 'paid', paidAt: Date.now(), paidBy: actor, expenseId: expense.id});
    return b;
  });
}
function removeBill(store, input, actor) {
  const b = store.state.bills.find(x => x.id === input.id && x.status === 'open') || fail('Conta não encontrada.');
  return store.change(actor, 'conta', 'Conta removida: ' + b.description, () => { Object.assign(b, {status: 'removed', removedAt: Date.now()}); return b; });
}
function setBalance(store, input, actor) {
  const cents = Number(input.balanceCents); if (!Number.isSafeInteger(cents) || Math.abs(cents) > 10000000000) fail('Saldo inválido.');
  return store.change(actor, 'conta', `Saldo atual do fluxo de caixa: R$ ${(cents / 100).toFixed(2)}`, () => { store.state.settings.cashflow = {...store.state.settings.cashflow, balanceCents: cents}; return store.state.settings.cashflow; });
}

module.exports = {init, freeGrant, staffTracker, report, saveBill, payBill, removeBill, setBalance, startOf, localDate, WEEKDAYS};
