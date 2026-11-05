'use strict';
// 1.0.5: Corujão/Viradão (criar > adicionar participantes > confirmar pagamento > iniciar) e Ranking (Top 10).
// O pagamento entra no caixa como venda de Produtos/Serviços (item "Corujão/Viradão"); cancelar a venda desfaz o pagamento.
const {id, integer, text, fail} = require('./store');
const PAYMENTS = {cash: 'Dinheiro', pix: 'Pix', card: 'Cartão'};
const KIND = {corujao: 'Corujão', viradao: 'Viradão'};
const localDate = (t, tz) => new Intl.DateTimeFormat('en-CA', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'}).format(t);

function init(store) { const s = store.state; s.events ??= []; s.settings.eventMedalsMilli ??= 1000; }
const sale = (store, p) => p.saleId ? (store.state.shopSales || []).find(s => s.id === p.saleId && s.status !== 'canceled') : null;
const isPaid = (store, p) => !!(p.free || sale(store, p));
function find(store, eventId) { return store.state.events.find(e => e.id === String(eventId) && !e.removedAt) || fail('Corujão/Viradão não encontrado.'); }
function participant(e, memberId) { return e.participants.find(p => p.memberId === String(memberId)) || fail('Participante não encontrado.'); }
// 1.0.5: sem campo Tipo — o nome já diz se é Corujão ou Viradão; eventos antigos (corujao/viradao) mantêm o prefixo.
const title = e => (KIND[e.kind] ? KIND[e.kind] + ' ' : '') + e.name;

function list(store) {
  return {
    medalsMilli: store.state.settings.eventMedalsMilli, payments: PAYMENTS,
    events: store.state.events.filter(e => !e.removedAt).sort((a, b) => b.createdAt - a.createdAt).map(e => ({...e, participants: e.participants.map(p => ({...p, paid: isPaid(store, p)}))}))
  };
}
function create(store, input, actor) {
  const kind = KIND[input.kind] ? input.kind : 'evento', name = text(input.name, 'Nome', 80), date = String(input.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Informe a data.');
  const priceCents = integer(input.priceCents, 0, 100000000, 'Valor por participante');
  return store.change(actor, 'corujao', `Corujão/Viradão criado: ${name} (${date}) • R$ ${(priceCents / 100).toFixed(2)} por participante`, () => {
    const e = {id: id(), kind, name, date, priceCents, status: 'open', participants: [], createdAt: Date.now(), createdBy: actor};
    store.state.events.push(e); return e;
  });
}
function addParticipant(store, input, actor) {
  const e = find(store, input.eventId); if (e.status !== 'open') fail('Já iniciado: não é possível adicionar participantes.');
  const m = store.member(String(input.memberId)); if (!m.active || m.guest) fail('Escolha um cliente cadastrado e ativo.');
  if (e.participants.some(p => p.memberId === m.id)) fail('Este cliente já está na lista.');
  if (e.participants.length >= 500) fail('Limite de 500 participantes.');
  return store.change(actor, 'corujao', `Participante adicionado (${title(e)}): ${m.username}`, () => { e.participants.push({memberId: m.id, memberUsername: m.username, addedAt: Date.now()}); return {memberId: m.id}; });
}
function removeParticipant(store, input, actor) {
  const e = find(store, input.eventId); if (e.status !== 'open') fail('Já iniciado: não é possível remover participantes.');
  const p = participant(e, input.memberId); if (isPaid(store, p)) fail('Pagamento já confirmado. Cancele a venda em Caixa > Vendas antes de remover.');
  return store.change(actor, 'corujao', `Participante removido (${title(e)}): ${p.memberUsername}`, () => { e.participants.splice(e.participants.indexOf(p), 1); return {memberId: p.memberId}; });
}
function pay(store, input, actor) {
  const e = find(store, input.eventId); if (e.status !== 'open') fail('Já iniciado: pagamento não pode mais ser registrado.');
  const p = participant(e, input.memberId); if (isPaid(store, p)) fail('Pagamento já confirmado.');
  if (e.priceCents === 0) return store.change(actor, 'corujao', `Participação gratuita confirmada (${title(e)}): ${p.memberUsername}`, () => { p.free = true; p.paidAt = Date.now(); return {memberId: p.memberId}; });
  const paymentMethod = Object.hasOwn(PAYMENTS, input.paymentMethod) ? input.paymentMethod : fail('Selecione a forma de pagamento (Dinheiro, Pix ou Cartão).');
  return store.change(actor, 'venda', `Pagamento ${title(e)}: ${p.memberUsername} • R$ ${(e.priceCents / 100).toFixed(2)} • ${PAYMENTS[paymentMethod]}`, () => {
    const s = {id: id(), number: ++store.state.shopSequence, at: Date.now(), actor, items: [{kind: 'event', itemId: e.id, name: `${title(e)} — ${p.memberUsername}`, category: 'Corujão/Viradão', qty: 1, unitCents: e.priceCents, costCents: 0, totalCents: e.priceCents}], totalCents: e.priceCents, paymentMethod, status: 'paid', cashId: require('./cash').openId(store), eventId: e.id, memberId: p.memberId};
    store.state.shopSales.push(s); p.saleId = s.id; p.paidAt = s.at; delete p.free; return {...s, memberId: p.memberId};
  });
}
function start(store, input, actor, now = Date.now()) {
  const e = find(store, input.eventId); if (e.status !== 'open') fail('Já iniciado.');
  const paid = e.participants.filter(p => isPaid(store, p)); if (!paid.length) fail('Confirme o pagamento de pelo menos um participante antes de iniciar.');
  const medals = Number(store.state.settings.eventMedalsMilli) || 0, business = require('./business');
  return store.change(actor, 'corujao', `${title(e)} iniciado: ${paid.length} participante(s) • ${medals / 1000} medalha(s) cada`, () => {
    e.status = 'running'; e.startedAt = now; e.startedBy = actor; e.medalsMilli = medals;
    for (const p of e.participants) {
      p.participated = isPaid(store, p); if (!p.participated) continue;
      const m = store.state.members.find(m => m.id === p.memberId);
      if (m && medals > 0 && m.loyaltyEnabled !== false) { business.points(store, m, medals, 'Participação: ' + title(e), e.id, now); p.medalsMilli = medals; business.autoRedeem(store, m, now); }
    }
    return {ok: true, participants: paid.length};
  });
}
function finish(store, input, actor) {
  const e = find(store, input.eventId); if (e.status !== 'running') fail('Só é possível encerrar depois de iniciar.');
  return store.change(actor, 'corujao', `${title(e)} encerrado`, () => { e.status = 'finished'; e.finishedAt = Date.now(); e.finishedBy = actor; return {ok: true}; });
}
function remove(store, input, actor) {
  const e = find(store, input.eventId); if (e.status !== 'open') fail('Já iniciado: não pode ser excluído (o histórico de participação é mantido).');
  if (e.participants.some(p => isPaid(store, p))) fail('Há pagamentos confirmados. Cancele as vendas em Caixa > Vendas antes de excluir.');
  return store.change(actor, 'corujao', `${title(e)} excluído`, () => { e.removedAt = Date.now(); return {ok: true}; });
}
function medalSettings(store, input, actor) {
  const medalsMilli = Math.round(Number(String(input.medals ?? '').replace(',', '.')) * 1000);
  if (!Number.isFinite(medalsMilli) || medalsMilli < 0 || medalsMilli > 1000000000) fail('Informe a quantidade de medalhas (0 ou mais).');
  return store.change(actor, 'fidelidade', `Medalhas por participação no Corujão/Viradão: ${medalsMilli / 1000}`, () => { store.state.settings.eventMedalsMilli = medalsMilli; return {medalsMilli}; });
}
// Cancelar no Caixa/Faturas a venda de um Corujão já iniciado não é permitido (as medalhas já foram entregues).
function blockCancel(store, shopSale) { if (!shopSale.eventId) return; const e = store.state.events.find(e => e.id === shopSale.eventId); if (e && e.status !== 'open') fail('Este pagamento é de um Corujão/Viradão já iniciado e não pode ser cancelado.'); }

function ranking(store, q = {}) {
  const tz = store.state.settings.timeZone, month = /^\d{4}-\d{2}$/.test(q.month) ? q.month : localDate(Date.now(), tz).slice(0, 7);
  const members = new Map(store.state.members.filter(m => !m.guest).map(m => [m.id, m])), nick = mid => members.get(mid)?.username || '';
  const top = (map, key) => [...map.entries()].filter(([mid, v]) => members.has(mid) && v[key] > 0).sort((a, b) => b[1][key] - a[1][key] || (b[1].cents || 0) - (a[1].cents || 0) || nick(a[0]).localeCompare(nick(b[0]))).slice(0, 10).map(([mid, v]) => ({username: nick(mid), ...v}));
  const medals = new Map(); // medalhas conquistadas (resgates não descontam)
  for (const l of store.state.loyaltyLedger || []) { if (/^Resgate/.test(l.reason)) continue; const v = medals.get(l.memberId) || {medalsMilli: 0}; v.medalsMilli += l.amount; medals.set(l.memberId, v); }
  const parts = new Map();
  for (const e of store.state.events || []) if (!e.removedAt && e.status !== 'open') for (const p of e.participants) if (p.participated) { const v = parts.get(p.memberId) || {count: 0}; v.count++; parts.set(p.memberId, v); }
  const recharges = new Map();
  for (const s of store.state.sales || []) if (s.status !== 'canceled' && s.cents > 0 && localDate(s.at, tz).startsWith(month)) { const v = recharges.get(s.memberId) || {count: 0, cents: 0}; v.count++; v.cents += s.cents; recharges.set(s.memberId, v); }
  return {month, timeZone: tz, medals: top(medals, 'medalsMilli'), participations: top(parts, 'count'), recharges: top(recharges, 'count')};
}
module.exports = {init, list, create, addParticipant, removeParticipant, pay, start, finish, remove, medalSettings, blockCancel, ranking, PAYMENTS};
