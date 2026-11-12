'use strict';
// 3.0.31: Controle de Caixas — abertura, sangria/suprimento, fechamento com conferencia
// e controle de vendas integrado com o estoque.
// Cada recarga e cada venda do PDV feita com o caixa aberto fica ligada a ele (cashId).
const {id, integer, text, fail} = require('./store');

const LABELS = {cash: 'Dinheiro', pix: 'Pix', card: 'Cartão', credit: 'Cartão (Crédito)', debit: 'Cartão (Débito)', unspecified: 'Não informado'};
const GROUP = {cash: 'cash', pix: 'pix', card: 'card', credit: 'card', debit: 'card', unspecified: 'unspecified'};

function init(store) {
  const s = store.state;
  s.cashRegisters ??= []; s.cashSequence ??= 0; s.stockMoves ??= []; s.bills ??= []; s.freeGrants ??= []; s.staffUsage ??= [];
  
}
const current = store => store.state.cashRegisters.find(c => c.status === 'open') || null;
const openId = store => current(store)?.id || null;

function summary(store, reg, now = Date.now()) {
  const sales = store.state.sales.filter(s => s.cashId === reg.id);
  const shop = (store.state.shopSales || []).filter(s => s.cashId === reg.id);
  const moves = reg.moves || [];
  const methods = {cash: 0, pix: 0, card: 0, unspecified: 0};
  let timeCents = 0, shopCents = 0, canceledCents = 0, canceledCount = 0;
  for (const s of sales) { if (s.status === 'canceled') { canceledCents += s.cents; canceledCount++; continue; } timeCents += s.cents; for (const p of require('./payments').parts(s, s.cents)) methods[GROUP[p.method] || 'unspecified'] += p.cents; }
  for (const s of shop) { if (s.status === 'canceled') { canceledCents += s.totalCents; canceledCount++; continue; } shopCents += s.totalCents; for (const p of require('./payments').parts(s, s.totalCents)) methods[GROUP[p.method] || 'unspecified'] += p.cents; }
  const supply = moves.filter(m => m.type === 'suprimento').reduce((a, m) => a + m.cents, 0);
  const withdraw = moves.filter(m => m.type === 'sangria').reduce((a, m) => a + m.cents, 0);
  const products = new Map();
  for (const s of shop) if (s.status !== 'canceled') for (const i of s.items) {
    const k = i.kind + ':' + i.itemId, p = products.get(k) || {kind: i.kind, itemId: i.itemId, name: i.name, category: i.category, qty: 0, totalCents: 0, costCents: 0};
    p.qty += i.qty; p.totalCents += i.totalCents; p.costCents += (i.costCents || 0) * i.qty; products.set(k, p);
  }
  const items = [...products.values()].map(p => ({...p, stock: p.kind === 'product' ? (store.state.products.find(x => x.id === p.itemId)?.stock ?? null) : null})).sort((a, b) => b.totalCents - a.totalCents);
  const expectedCashCents = reg.openingCents + methods.cash + supply - withdraw;
  return {timeCents, shopCents, totalCents: timeCents + shopCents, methods, supplyCents: supply, withdrawCents: withdraw, expectedCashCents,
    canceledCents, canceledCount, recharges: sales.filter(s => s.status !== 'canceled').length, shopCount: shop.filter(s => s.status !== 'canceled').length, items,
    durationSeconds: Math.round(((reg.closedAt || now) - reg.openedAt) / 1000)};
}
const view = (store, reg) => reg && ({...reg, summary: reg.status === 'closed' && reg.closing ? reg.closing : summary(store, reg)});

function open(store, input, actor) {
  if (current(store)) fail('Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.');
  const openingCents = integer(input.openingCents ?? 0, 0, 100000000, 'Valor de abertura');
  const note = String(input.note ?? '').trim().slice(0, 300);
  return store.change(actor, 'caixa', `Caixa aberto • troco inicial R$ ${(openingCents / 100).toFixed(2)}`, () => {
    const reg = {id: id(), number: ++store.state.cashSequence, status: 'open', openedAt: Date.now(), openedBy: actor, openingCents, note, moves: []};
    store.state.cashRegisters.push(reg);
    return reg;
  });
}
function move(store, input, actor) {
  const reg = current(store) || fail('Abra o caixa primeiro.');
  const type = ['sangria', 'suprimento'].includes(input.type) ? input.type : fail('Movimento inválido.');
  const cents = integer(input.cents, 1, 100000000, 'Valor');
  const reason = text(input.reason, 'Motivo', 300);
  if (type === 'sangria' && cents > summary(store, reg).expectedCashCents) fail('A sangria é maior que o dinheiro esperado na gaveta.');
  return store.change(actor, 'caixa', `${type === 'sangria' ? 'Sangria' : 'Suprimento'} no caixa ${reg.number}: R$ ${(cents / 100).toFixed(2)} • ${reason}`, () => {
    const m = {id: id(), type, cents, reason, actor, at: Date.now()};
    reg.moves.push(m);
    return m;
  });
}
function close(store, input, actor) {
  const reg = current(store) || fail('Não há caixa aberto.');
  const countedCents = integer(input.countedCents, 0, 100000000, 'Valor contado na gaveta');
  const note = String(input.note ?? '').trim().slice(0, 300);
  const sum = summary(store, reg);
  const diff = countedCents - sum.expectedCashCents;
  return store.change(actor, 'caixa', `Caixa ${reg.number} fechado • esperado R$ ${(sum.expectedCashCents / 100).toFixed(2)} • contado R$ ${(countedCents / 100).toFixed(2)} • diferença R$ ${(diff / 100).toFixed(2)}`, () => {
    Object.assign(reg, {status: 'closed', closedAt: Date.now(), closedBy: actor, countedCents, differenceCents: diff, closeNote: note});
    reg.closing = summary(store, reg);
    return reg;
  });
}
function requireOpen(store, what) { if (!current(store)) fail(`Abra o caixa antes de ${what}. Vá em Caixa > Abrir caixa.`); }

// ---------- estoque ----------
function stockEntry(store, input, actor) {
  const p = store.state.products.find(x => x.id === String(input.productId || '') && x.active) || fail('Produto não encontrado.');
  const qty = integer(input.qty, 1, 1000000, 'Quantidade');
  const reason = String(input.reason ?? '').trim().slice(0, 200) || 'Entrada de mercadoria';
  const costCents = input.costCents === undefined || input.costCents === '' || input.costCents === null ? null : integer(input.costCents, 0, 100000000, 'Preço de custo');
  return store.change(actor, 'estoque', `Entrada de estoque: +${qty} ${p.name} • ${reason}`, () => {
    p.stock += qty; if (costCents !== null) p.costCents = costCents; p.updatedAt = Date.now();
    const m = {id: id(), at: Date.now(), actor, productId: p.id, productName: p.name, type: 'entrada', qty, stockAfter: p.stock, reason, cashId: openId(store)};
    store.state.stockMoves.push(m);
    return m;
  });
}
// Movimentacoes: entradas/ajustes gravados + saidas por venda e devolucoes por cancelamento (derivadas das vendas).
function stockMoves(store, limit = 200) {
  const out = [...store.state.stockMoves];
  for (const s of store.state.shopSales || []) for (const i of s.items) if (i.kind === 'product') {
    out.push({id: s.id + ':' + i.itemId, at: s.at, actor: s.actor, productId: i.itemId, productName: i.name, type: 'venda', qty: -i.qty, reason: 'Cupom ' + String(s.number).padStart(6, '0')});
    if (s.status === 'canceled') out.push({id: s.id + ':' + i.itemId + ':c', at: s.canceledAt, actor: s.canceledBy, productId: i.itemId, productName: i.name, type: 'cancelamento', qty: i.qty, reason: 'Cupom ' + String(s.number).padStart(6, '0') + ' cancelado'});
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}

function state(store) {
  const reg = current(store);
  const products = store.state.products.filter(p => p.active).map(p => ({id: p.id, name: p.name, category: p.category, stock: p.stock, priceCents: p.priceCents}));
  return {current: view(store, reg), history: store.state.cashRegisters.filter(c => c.status === 'closed').sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0)).slice(0, 80).map(c => view(store, c)), products, lowStock: products.filter(p => p.stock <= 5), moves: stockMoves(store, 100), labels: LABELS, systemDays: systemDays(store)};
}
// 3.0.41: dias (data local) que ja tem caixa registrado pelo sistema (aberto/fechado pelo servidor).
// Esses dias nao aceitam CAIXA ANTERIOR: o registro do servidor e sempre mantido.
function systemDays(store, now = Date.now()) {
  const {localDate} = require('./stats'), tz = store.state.settings.timeZone || 'America/Manaus', days = new Set();
  for (const c of store.state.cashRegisters) {
    if (c.historical || !c.openedAt) continue;
    let d = localDate(c.openedAt, tz); const last = localDate(c.closedAt || now, tz);
    for (let guard = 0; d <= last && guard < 4000; guard++) { days.add(d); d = nextDay(d); }
  }
  return [...days].sort();
}

// 3.0.39: CAIXAS ANTERIORES — o administrador principal registra o total de um periodo anterior ao sistema
// (ex.: 01/08/2026 a 30/08/2026 = R$ 200,00). Somente datas anteriores a hoje; periodos nao podem se sobrepor.
// O registro aparece em "Caixas fechados" marcado como ANTERIOR e pode ser removido pelo administrador principal.
const validDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
const nextDay = d => new Date(Date.parse(d + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
function addPrevious(store, input, actor, isOwner, now = Date.now()) {
  if (!isOwner) fail('Somente o administrador principal pode registrar caixas anteriores.');
  const {startOf, localDate} = require('./stats'), tz = store.state.settings.timeZone || 'America/Manaus', today = localDate(now, tz);
  const from = String(input.from || ''), to = String(input.to || '');
  if (!validDay(from) || !validDay(to)) fail('Informe as datas inicial e final.');
  if (from > to) fail('A data inicial deve ser anterior ou igual à data final.');
  if (to >= today) fail('Use somente datas anteriores a hoje.');
  const cents = integer(input.cents, 1, 100000000000, 'Valor total do caixa');
  const note = String(input.note ?? '').trim().slice(0, 300);
  const fmtDay = d => d.split('-').reverse().join('/');
  const blocked = systemDays(store, now).filter(d => d >= from && d <= to);
  if (blocked.length) fail(`Já existe caixa registrado pelo sistema em ${blocked.slice(0, 5).map(fmtDay).join(', ')}${blocked.length > 5 ? ` e mais ${blocked.length - 5} dia(s)` : ''}. Caixas do servidor não podem ser substituídos: registre somente datas sem caixa do sistema.`);
  const overlap = store.state.cashRegisters.find(c => c.historical && !(to < c.periodFrom || from > c.periodTo));
  if (overlap) fail(`Já existe caixa anterior registrado neste período (nº ${String(overlap.number).padStart(4, '0')}: ${overlap.periodFrom.split('-').reverse().join('/')} a ${overlap.periodTo.split('-').reverse().join('/')}).`);
  const fmt = d => d.split('-').reverse().join('/');
  return store.change(actor, 'caixa', `Caixa anterior registrado: ${fmt(from)} a ${fmt(to)} • R$ ${(cents / 100).toFixed(2)}`, () => {
    const empty = {timeCents: 0, shopCents: 0, totalCents: cents, methods: {cash: 0, pix: 0, card: 0, unspecified: 0}, supplyCents: 0, withdrawCents: 0, expectedCashCents: 0, canceledCents: 0, canceledCount: 0, recharges: 0, shopCount: 0, items: [], durationSeconds: 0};
    const reg = {id: id(), number: ++store.state.cashSequence, status: 'closed', historical: true, periodFrom: from, periodTo: to,
      openedAt: startOf(from, tz), closedAt: startOf(nextDay(to), tz) - 1000, openedBy: actor, closedBy: actor, registeredAt: now,
      openingCents: 0, moves: [], countedCents: cents, differenceCents: 0, closeNote: note, closing: empty};
    store.state.cashRegisters.push(reg);
    return reg;
  });
}
function removePrevious(store, input, actor, isOwner) {
  if (!isOwner) fail('Somente o administrador principal pode remover caixas anteriores.');
  const i = store.state.cashRegisters.findIndex(c => c.id === String(input.id || '') && c.historical);
  if (i < 0) fail('Caixa anterior não encontrado.');
  const reg = store.state.cashRegisters[i];
  return store.change(actor, 'caixa', `Caixa anterior removido: nº ${reg.number} (${reg.periodFrom} a ${reg.periodTo}) • R$ ${(reg.countedCents / 100).toFixed(2)}`, () => { store.state.cashRegisters.splice(i, 1); return {ok: true}; });
}

function salesOf(store, regId) {
  const reg = store.state.cashRegisters.find(c => c.id === regId) || fail('Caixa não encontrado.');
  // 1.2.2: caixa antigo: lê também o histórico arquivado do período do caixa
  if (typeof store.view === 'function' && reg.openedAt) store = store.view(reg.openedAt - 86400000, (reg.closedAt || Date.now()) + 86400000);
  const time = store.state.sales.filter(s => s.cashId === reg.id).map(s => ({kind: 'recarga', id: s.id, at: s.at, actor: s.actor, label: (s.invoiceNumber ? 'Fatura ' + s.invoiceNumber + ' • ' : '') + (s.memberUsername || s.memberName) + ' • ' + s.label, cents: s.cents, paymentMethod: s.paymentMethod, paymentLabel: require('./payments').label(s), status: s.status}));
  const shop = (store.state.shopSales || []).filter(s => s.cashId === reg.id).map(s => ({kind: 'pdv', id: s.id, number: s.number, at: s.at, actor: s.actor, label: 'Cupom ' + String(s.number).padStart(6, '0') + ' • ' + s.items.map(i => i.qty + 'x ' + i.name).join(', '), cents: s.totalCents, paymentMethod: s.paymentMethod, paymentLabel: require('./payments').label(s), status: s.status}));
  return [...time, ...shop].sort((a, b) => b.at - a.at);
}

function reportPdf(store, regId) {
  const {linesPdf, wrap, pad, center, brl, WIDTH} = require('./shop');
  const reg = store.state.cashRegisters.find(c => c.id === regId) || fail('Caixa não encontrado.');
  const s = reg.closing || summary(store, reg), tz = store.state.settings.timeZone || 'America/Manaus';
  if (reg.historical) { const fmt = d => d.split('-').reverse().join('/'), line = '-'.repeat(WIDTH); const L = [...wrap(require('./organization').name(store)).map(center), center('CAIXA ANTERIOR (REGISTRO MANUAL)'), line, 'Caixa No ' + String(reg.number).padStart(4, '0'), 'Periodo: ' + fmt(reg.periodFrom) + ' a ' + fmt(reg.periodTo), 'Registrado por: ' + reg.openedBy, line, pad('VALOR TOTAL DO CAIXA', brl(reg.countedCents))]; if (reg.closeNote) { L.push(line); for (const w of wrap('Obs.: ' + reg.closeNote)) L.push(w); } L.push(line, center('Documento interno sem valor fiscal')); return {pdf: linesPdf(L, 'Caixa ' + reg.number), number: reg.number}; }
  const dt = t => t ? new Intl.DateTimeFormat('pt-BR', {timeZone: tz, dateStyle: 'short', timeStyle: 'short'}).format(t).replace(',', '') : '-';
  const line = '-'.repeat(WIDTH);
  const L = [...wrap(require('./organization').name(store)).map(center), center(reg.status === 'open' ? 'CAIXA ABERTO - PARCIAL' : 'FECHAMENTO DE CAIXA'), line,
    pad('Caixa No ' + String(reg.number).padStart(4, '0'), reg.status === 'open' ? 'ABERTO' : 'FECHADO'),
    'Abertura: ' + dt(reg.openedAt) + ' ' + reg.openedBy, 'Fechamento: ' + (reg.closedAt ? dt(reg.closedAt) + ' ' + reg.closedBy : '-'), line,
    pad('Troco inicial', brl(reg.openingCents)), pad('Recargas (' + s.recharges + ')', brl(s.timeCents)), pad('Produtos/servicos (' + s.shopCount + ')', brl(s.shopCents)), pad('TOTAL VENDIDO', brl(s.totalCents)), line,
    pad('Dinheiro', brl(s.methods.cash)), pad('Pix', brl(s.methods.pix)), pad('Cartao', brl(s.methods.card))];
  if (s.methods.unspecified) L.push(pad('Nao informado', brl(s.methods.unspecified)));
  L.push(line, pad('Suprimentos', brl(s.supplyCents)), pad('Sangrias', '-' + brl(s.withdrawCents)), pad('DINHEIRO ESPERADO', brl(s.expectedCashCents)));
  if (reg.status === 'closed') L.push(pad('Dinheiro contado', brl(reg.countedCents)), pad('Diferenca', (reg.differenceCents > 0 ? '+' : '') + brl(reg.differenceCents)));
  if (s.canceledCount) L.push(pad('Cancelamentos (' + s.canceledCount + ')', brl(s.canceledCents)));
  for (const m of reg.moves || []) for (const w of wrap(`${m.type === 'sangria' ? 'Sangria' : 'Suprimento'} ${dt(m.at)} ${brl(m.cents)} - ${m.reason}`)) L.push(w);
  if (s.items.length) { L.push(line, pad('ITENS VENDIDOS', 'QTD / ESTOQUE')); for (const i of s.items) { for (const w of wrap(i.name)) L.push(w); L.push(pad('  ' + i.qty + ' un  ' + brl(i.totalCents), i.stock === null ? '' : 'estoque ' + i.stock)); } }
  if (reg.closeNote) { L.push(line); for (const w of wrap('Obs.: ' + reg.closeNote)) L.push(w); }
  L.push(line, center('Documento interno sem valor fiscal'));
  return {pdf: linesPdf(L, 'Caixa ' + reg.number), number: reg.number};
}

module.exports = {init, current, openId, summary, open, move, close, requireOpen, addPrevious, removePrevious, systemDays, stockEntry, stockMoves, state, salesOf, reportPdf, LABELS};
