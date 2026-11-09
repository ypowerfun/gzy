'use strict';
// 3.0.31: Estatistica — analises de tempo de uso, vendas e financeira.
const STATS_TREE = [
  {key: 'A', title: 'A - Análise de tempo de uso', items: [
    ['machines', '1 - por Máquina', 'Saiba quais são as máquinas mais e menos utilizadas'],
    ['hours', '2 - por Horário', 'Saiba quais são os horários de pico e os momentos que a loja fica mais vazia'],
    ['staff', '3 - por Funcionário', 'Saiba a quantidade de vezes e o tempo total que os funcionários utilizaram as máquinas clientes'],
    ['clients', '4 - por Cliente', 'Ranking de clientes por valor gasto na loja'],
    ['free', '5 - por Cliente Grátis', 'Saiba a quantidade de vezes e o tempo total de uso por clientes gratuitos'],
    ['durations', '6 - por Duração do Acesso', 'Faça uma análise do tempo médio das sessões']]},
  {key: 'B', title: 'B - Análise de vendas', items: [
    ['sales', '7 - por Categoria/Produto/Funcionário', 'Saiba como foram as vendas']]},
  {key: 'D', title: 'D - Análise financeira', items: [
    ['cashflow', '1 - Fluxo de Caixa Projetado', 'Saiba se você terá dinheiro para pagar suas contas nos próximos 30, 60 ou 90 dias']]}
];
let statsKind = 'machines', statsFrom = '', statsTo = '', statsSalesTab = 'categories', statsCollapsed = {}, statsRequest = 0, statsLast = null;
const hm = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`; };
const pct = (v, max) => max > 0 ? Math.max(0, Math.min(100, v / max * 100)) : 0;
const bar = (v, max, label, cls = '') => `<div class="st-bar ${cls}"><span style="width:${pct(v, max).toFixed(1)}%"></span><em>${label}</em></div>`;
const tile = (label, value, note = '') => `<div class="stat"><small>${esc(label)}</small><strong>${value}</strong><em>${esc(note)}</em></div>`;
const isoDay = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function statsTreeHtml() {
  return STATS_TREE.map(g => `<div class="st-group"><button class="st-head" data-stats-toggle="${g.key}"><span class="st-box">${statsCollapsed[g.key] ? '+' : '−'}</span>${esc(g.title)}</button>${statsCollapsed[g.key] ? '' : g.items.map(([k, t, d]) => `<button class="st-item ${statsKind === k ? 'active' : ''}" data-stats-kind="${k}"><b>${esc(t)}</b><small>${esc(d)}</small></button>`).join('')}</div>`).join('');
}
function statsTitle() { for (const g of STATS_TREE) for (const [k, t, d] of g.items) if (k === statsKind) return {t, d}; return {t: '', d: ''}; }

async function renderStats() {
  $('#view-title').textContent = 'Estatística';
  if (!statsTo) { const now = new Date(); statsTo = isoDay(now); statsFrom = isoDay(new Date(now.getTime() - 29 * 86400000)); }
  const info = statsTitle(), cash = statsKind === 'cashflow';
  $('#view').innerHTML = `<div class="st-layout"><div class="st-tree">${statsTreeHtml()}</div><section class="st-report"><div class="st-title"><div><h2>${esc(info.t.replace(/^\d+ - /, ''))}</h2><p class="hint">${esc(info.d)}</p></div></div>${cash ? '' : `<form id="stats-filter" class="filters st-filters"><label>De<input type="date" name="from" value="${statsFrom}"></label><label>Até<input type="date" name="to" value="${statsTo}"></label><div class="st-quick"><button type="button" data-stats-range="0">Hoje</button><button type="button" data-stats-range="6">7 dias</button><button type="button" data-stats-range="29">30 dias</button><button type="button" data-stats-range="month">Este mês</button></div><button class="primary">Atualizar</button></form>`}<div id="stats-body"><p class="hint">Carregando…</p></div></section></div>`;
  const f = $('#stats-filter');
  if (f) f.onsubmit = e => { e.preventDefault(); statsFrom = f.from.value; statsTo = f.to.value; loadStats(); };
  await loadStats();
}
async function loadStats() {
  const request = ++statsRequest, body = $('#stats-body');
  try {
    const r = await api('/stats?' + new URLSearchParams({kind: statsKind, from: statsFrom, to: statsTo}));
    if (view !== 'stats' || request !== statsRequest) return;
    statsLast = r; body.innerHTML = (STATS_RENDER[statsKind] || (() => ''))(r.data, r);
  } catch (e) { if (request === statsRequest && body) body.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}

const STATS_RENDER = {
  machines(d) {
    const max = Math.max(1, ...d.rows.map(r => r.usedSeconds));
    return `<div class="stats">${tile('Mais utilizada', d.most ? esc(d.most.name) : '—', d.most ? hm(d.most.usedSeconds) + ' de uso' : '')}${tile('Menos utilizada', d.least ? esc(d.least.name) : '—', d.least ? hm(d.least.usedSeconds) + ' de uso' : '')}${tile('Tempo total de uso', hm(d.totalSeconds), d.rows.length + ' máquina(s)')}${tile('Sessões no período', d.rows.reduce((a, r) => a + r.sessions, 0), 'iniciadas no período')}</div>
    <div class="table-wrap"><table><thead><tr><th>Máquina</th><th>Sessões</th><th style="width:38%">Tempo de uso</th><th>Ocupação</th><th>Uso por funcionários</th></tr></thead><tbody>${d.rows.map(r => `<tr><td>${esc(r.name)}${r.removed ? '<small class="subtext">removida</small>' : ''}</td><td>${r.sessions}</td><td>${bar(r.usedSeconds, max, hm(r.usedSeconds))}</td><td>${String(r.occupancy).replace('.', ',')}%</td><td>${r.staffCount ? hm(r.staffSeconds) + ` <small class="subtext">${r.staffCount} vez(es)</small>` : '—'}</td></tr>`).join('') || '<tr><td colspan="5">Nenhuma máquina.</td></tr>'}</tbody></table></div>
    <p class="hint">Ocupação = tempo em uso dividido pelo tempo do período (até agora).</p>`;
  },
  hours(d) {
    const max = Math.max(0.01, ...d.byHour.map(h => h.avgMachines)), hmax = Math.max(0.01, ...d.heat.flat());
    const hh = h => String(h).padStart(2, '0') + 'h';
    return `<div class="stats">${tile('Horário de pico', d.peak ? hh(d.peak.hour) + ' às ' + hh((d.peak.hour + 1) % 24) : '—', d.peak ? 'média de ' + String(d.peak.avgMachines).replace('.', ',') + ' máquina(s) em uso' : 'sem uso no período')}${tile('Horário mais vazio', d.quiet ? hh(d.quiet.hour) + ' às ' + hh((d.quiet.hour + 1) % 24) : '—', d.quiet ? 'média de ' + String(d.quiet.avgMachines).replace('.', ',') + ' máquina(s) em uso' : '')}${tile('Dia mais movimentado', esc([...d.byWeekday].sort((a, b) => b.avgMachines - a.avgMachines)[0]?.name || '—'), 'pela média de máquinas em uso')}${tile('Sessões iniciadas', d.byHour.reduce((a, h) => a + h.sessions, 0), 'no período')}</div>
    <h3>Média de máquinas em uso por horário</h3><div class="st-columns">${d.byHour.map(h => `<div title="${hh(h.hour)}: ${String(h.avgMachines).replace('.', ',')} máquina(s) em média • ${h.sessions} sessão(ões) iniciada(s)"><span style="height:${pct(h.avgMachines, max).toFixed(1)}%" class="${d.peak && h.hour === d.peak.hour ? 'peak' : ''}"></span><small>${h.hour}</small></div>`).join('')}</div>
    <h3 style="margin-top:22px">Mapa de calor (dia da semana × hora)</h3><div class="table-wrap"><table class="st-heat"><thead><tr><th></th>${d.byHour.map(h => `<th>${h.hour}</th>`).join('')}</tr></thead><tbody>${d.heat.map((row, wd) => `<tr><th>${esc(d.weekdays[wd].slice(0, 3))}</th>${row.map((v, h) => `<td title="${esc(d.weekdays[wd])} ${hh(h)}: ${String(v).replace('.', ',')} máquina(s) em média" style="background:rgba(239,51,69,${(v / hmax * .9 + (v ? .08 : 0)).toFixed(2)})"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Dia da semana</th><th style="width:50%">Média de máquinas em uso</th><th>Tempo total</th></tr></thead><tbody>${d.byWeekday.map(w => `<tr><td>${esc(w.name)}</td><td>${bar(w.avgMachines, Math.max(0.01, ...d.byWeekday.map(x => x.avgMachines)), String(w.avgMachines).replace('.', ','))}</td><td>${hm(w.seconds)}</td></tr>`).join('')}</tbody></table></div>`;
  },
  staff(d) {
    const max = Math.max(1, ...d.rows.map(r => r.seconds));
    return `<div class="stats">${tile('Funcionários', d.rows.length, 'que usaram máquinas clientes')}${tile('Vezes', d.rows.reduce((a, r) => a + r.count, 0), 'acessos administrativos/manutenção')}${tile('Tempo total', hm(d.rows.reduce((a, r) => a + r.seconds, 0)), 'no período')}</div>
    <div class="table-wrap"><table><thead><tr><th>Funcionário</th><th>Vezes</th><th style="width:40%">Tempo total</th><th>Máquinas</th></tr></thead><tbody>${d.rows.map(r => `<tr><td>${esc(r.username)}</td><td>${r.count}</td><td>${bar(r.seconds, max, hm(r.seconds))}</td><td>${esc(r.stations.join(', '))}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum uso de funcionário no período.</td></tr>'}</tbody></table></div>
    <h3 style="margin-top:22px">Acessos registrados</h3><div class="table-wrap"><table><thead><tr><th>Funcionário</th><th>Máquina</th><th>Tipo</th><th>Início</th><th>Fim</th><th>Duração</th></tr></thead><tbody>${d.records.map(u => `<tr><td>${esc(u.username)}</td><td>${esc(u.stationName)}</td><td>${esc(u.kind)}</td><td>${datetime(u.startedAt)}</td><td>${u.endedAt ? datetime(u.endedAt) : 'Em uso'}</td><td>${hm(((u.endedAt || Date.now()) - u.startedAt) / 1000)}</td></tr>`).join('') || '<tr><td colspan="6">Nenhum registro.</td></tr>'}</tbody></table></div>
    <p class="hint">Conta o tempo em que a máquina cliente ficou em modo administrador, manutenção ou liberada pela recepção.</p>`;
  },
  clients(d) {
    const max = Math.max(1, ...d.rows.map(r => r.spentCents));
    return `<div class="stats">${tile('Clientes no período', d.total, 'com compra ou uso')}${tile('Total gasto', money(d.totalCents), 'em recargas de tempo')}${tile('Maior cliente', d.rows[0] ? esc(d.rows[0].name) : '—', d.rows[0] ? money(d.rows[0].spentCents) : '')}${tile('Ticket médio', money(d.total ? Math.round(d.totalCents / Math.max(1, d.rows.reduce((a, r) => a + r.purchases, 0))) : 0), 'por recarga')}</div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Cliente</th><th style="width:30%">Valor gasto</th><th>Recargas</th><th>Minutos comprados</th><th>Tempo de uso</th><th>Sessões</th><th>Última visita</th></tr></thead><tbody>${d.rows.map((r, i) => `<tr><td>${i + 1}º</td><td>${esc(r.name)}</td><td>${bar(r.spentCents, max, money(r.spentCents))}</td><td>${r.purchases}</td><td>${r.minutes}</td><td>${hm(r.usedSeconds)}</td><td>${r.sessions}</td><td>${r.lastVisit ? datetime(r.lastVisit) : '—'}</td></tr>`).join('') || '<tr><td colspan="8">Nenhum cliente no período.</td></tr>'}</tbody></table></div>`;
  },
  free(d) {
    const max = Math.max(1, ...d.rows.map(r => r.minutes));
    return `<div class="stats">${tile('Clientes beneficiados', d.rows.length, 'no período')}${tile('Vezes', d.count, 'tempo grátis concedido')}${tile('Tempo grátis total', hm(d.minutes * 60), 'prêmios e recargas de R$ 0,00')}</div>
    <div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Vezes</th><th style="width:45%">Tempo grátis</th><th>Última vez</th></tr></thead><tbody>${d.rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.count}</td><td>${bar(r.minutes, max, hm(r.minutes * 60))}</td><td>${datetime(r.last)}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum tempo grátis no período.</td></tr>'}</tbody></table></div>
    <h3 style="margin-top:22px">Detalhamento</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Motivo</th><th>Tempo</th></tr></thead><tbody>${d.entries.map(e => `<tr><td>${datetime(e.at)}</td><td>${esc(e.name)}</td><td>${esc(e.reason)}</td><td>${hm(e.minutes * 60)}</td></tr>`).join('') || '<tr><td colspan="4">—</td></tr>'}</tbody></table></div>
    <p class="hint">Considera prêmios do programa fidelidade (automáticos e resgates) e recargas/promoções de valor R$ 0,00.</p>`;
  },
  durations(d) {
    const max = Math.max(1, ...d.buckets.map(b => b.count)), smax = Math.max(1, ...d.byStation.map(s => s.avgSeconds));
    return `<div class="stats">${tile('Tempo médio', hm(d.avgSeconds), d.count + ' sessão(ões) finalizada(s)')}${tile('Mediana', hm(d.medianSeconds), 'metade das sessões dura até')}${tile('Menor sessão', hm(d.minSeconds), '')}${tile('Maior sessão', hm(d.maxSeconds), '')}</div>
    <h3>Distribuição por duração</h3><div class="table-wrap"><table><tbody>${d.buckets.map(b => `<tr><td style="width:160px">${esc(b.label)}</td><td>${bar(b.count, max, b.count + ' sessão(ões)' + (d.count ? ' • ' + Math.round(b.count / d.count * 100) + '%' : ''))}</td></tr>`).join('')}</tbody></table></div>
    <h3 style="margin-top:22px">Tempo médio por tipo e por máquina</h3><div class="table-wrap"><table><thead><tr><th>Tipo / máquina</th><th>Sessões</th><th style="width:45%">Tempo médio</th></tr></thead><tbody>${d.byKind.map(k => `<tr><td><strong>${esc(k.name)}</strong></td><td>${k.count}</td><td>${hm(k.avgSeconds)}</td></tr>`).join('')}${d.byStation.map(s => `<tr><td>${esc(s.name)}</td><td>${s.count}</td><td>${bar(s.avgSeconds, smax, hm(s.avgSeconds))}</td></tr>`).join('') || '<tr><td colspan="3">Nenhuma sessão finalizada no período.</td></tr>'}</tbody></table></div>`;
  },
  sales(d) {
    const list = d[statsSalesTab] || [], max = Math.max(1, ...list.map(r => r.revenueCents)), label = {categories: 'Categoria', products: 'Produto', employees: 'Funcionário'}[statsSalesTab];
    return `<div class="stats">${tile('Total vendido', money(d.totalCents), 'recargas + produtos/serviços')}${tile('Lucro bruto', money(d.profitCents), 'venda − custo dos produtos')}${tile('Mais vendido', d.products[0] ? esc(d.products[0].name) : '—', d.products[0] ? money(d.products[0].revenueCents) : '')}${tile('Melhor funcionário', d.employees[0] ? esc(d.employees[0].name) : '—', d.employees[0] ? money(d.employees[0].revenueCents) : '')}</div>
    <div class="shop-tabs"><button data-stats-sales="categories" class="${statsSalesTab === 'categories' ? 'active' : ''}">por Categoria</button><button data-stats-sales="products" class="${statsSalesTab === 'products' ? 'active' : ''}">por Produto</button><button data-stats-sales="employees" class="${statsSalesTab === 'employees' ? 'active' : ''}">por Funcionário</button></div>
    <div class="table-wrap"><table><thead><tr><th>${label}</th>${statsSalesTab === 'products' ? '<th>Categoria</th>' : ''}<th>${statsSalesTab === 'employees' ? 'Vendas' : 'Qtd'}</th><th style="width:30%">Faturamento</th><th>Custo</th><th>Lucro</th></tr></thead><tbody>${list.map(r => `<tr><td>${esc(r.name)}</td>${statsSalesTab === 'products' ? `<td>${esc(r.category)}</td>` : ''}<td>${statsSalesTab === 'employees' ? r.transactions : r.qty}</td><td>${bar(r.revenueCents, max, money(r.revenueCents))}</td><td>${money(r.costCents)}</td><td>${money(r.profitCents)}</td></tr>`).join('') || '<tr><td colspan="6">Nenhuma venda no período.</td></tr>'}</tbody></table></div>
    <p class="hint">Vendas canceladas não entram. Recargas aparecem na categoria "Tempo de uso (recargas)".</p>`;
  },
  cashflow(d) {
    const admin = isAdmin();
    return `<div class="st-horizons">${d.horizons.map(h => `<div class="stat st-hz ${h.ok ? 'ok' : 'bad'}"><small>Próximos ${h.days} dias (até ${h.until.split('-').reverse().join('/')})</small><strong>${money(h.finalCents)}</strong><em>${h.ok ? 'Dinheiro suficiente para as contas' : 'Faltará dinheiro para as contas'}</em><div class="st-hz-lines"><span>Saldo atual</span><b>${money(d.balanceCents)}</b><span>+ Entradas previstas</span><b>${money(h.inflowCents)}</b><span>− Contas a pagar (${h.billsCount})</span><b>${money(h.billsCents)}</b></div></div>`).join('')}</div>
    <p class="hint">Entradas previstas = média diária de vendas dos últimos 30 dias (${money(d.dailyRevenueCents)}/dia; total ${money(d.revenue30Cents)}). Despesas lançadas nos últimos 30 dias: ${money(d.expenses30Cents)} (${money(d.dailyExpensesCents)}/dia, apenas informativo). As saídas são as contas a pagar cadastradas abaixo.</p>
    ${admin ? `<form id="cf-balance" class="filters"><label>Saldo atual disponível (R$)<input name="balance" type="number" step="0.01" value="${(d.balanceCents / 100).toFixed(2)}"></label><button>Salvar saldo</button><button type="button" class="primary" id="cf-add">+ Nova conta a pagar</button></form>` : '<p class="hint">Somente o administrador cadastra contas e o saldo.</p>'}
    <h3>Contas a pagar</h3><div class="table-wrap"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Repetição</th>${admin ? '<th>Ações</th>' : ''}</tr></thead><tbody>${d.bills.map(b => `<tr><td>${b.dueDate.split('-').reverse().join('/')}${b.dueDate < d.today ? ' <span class="badge red">VENCIDA</span>' : ''}</td><td>${esc(b.description)}</td><td>${esc(b.category)}</td><td>${money(b.cents)}</td><td>${b.recurring === 'monthly' ? 'Mensal' : 'Única'}</td>${admin ? `<td class="toolbar-actions"><button data-bill-pay="${b.id}">Pagar</button><button data-bill-edit="${b.id}">Editar</button><button class="danger" data-bill-remove="${b.id}">Remover</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="6">Nenhuma conta a pagar cadastrada.</td></tr>`}</tbody></table></div>
    <h3 style="margin-top:22px">Próximos vencimentos (90 dias)</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Conta</th><th>Valor</th></tr></thead><tbody>${d.upcoming.map(u => `<tr><td>${u.date.split('-').reverse().join('/')}${u.overdue ? ' <span class="badge red">VENCIDA</span>' : ''}</td><td>${esc(u.description)}${u.recurring === 'monthly' ? ' <small class="subtext">mensal</small>' : ''}</td><td>${money(u.cents)}</td></tr>`).join('') || '<tr><td colspan="3">Nenhum vencimento nos próximos 90 dias.</td></tr>'}</tbody></table></div>
    <p class="hint">Ao clicar em Pagar, a conta é lançada como despesa em Faturas. Contas mensais passam para o próximo vencimento.</p>`;
  }
};

function billForm(b) {
  b = b || {};
  modal(b.id ? 'Editar conta a pagar' : 'Nova conta a pagar', `<form><label>Descrição<input name="description" required maxlength="200" value="${esc(b.description || '')}" placeholder="Ex.: Aluguel, Internet, Energia"></label><div class="row"><label>Valor (R$)<input name="value" type="number" min="0.01" step="0.01" required value="${b.id ? (b.cents / 100).toFixed(2) : ''}"></label><label>Vencimento<input name="dueDate" type="date" required value="${b.dueDate || isoDay(new Date())}"></label></div><div class="row"><label>Categoria<input name="category" maxlength="80" value="${esc(b.category || 'Contas a pagar')}"></label><label>Repetição<select name="recurring"><option value="none">Única</option><option value="monthly" ${b.recurring === 'monthly' ? 'selected' : ''}>Mensal</option></select></label></div><button class="primary">Salvar conta</button></form>`);
  formAction(async d => { await api('/bills', {id: b.id, description: d.description, cents: Math.round(Number(String(d.value).replace(',', '.')) * 100), dueDate: d.dueDate, category: d.category, recurring: d.recurring}); toast('Conta salva.'); loadStats(); });
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-stats-kind],[data-stats-toggle],[data-stats-range],[data-stats-sales],[data-bill-pay],[data-bill-edit],[data-bill-remove],#cf-add'); if (!t || view !== 'stats') return;
  try {
    if (t.dataset.statsKind) { statsKind = t.dataset.statsKind; await renderStats(); }
    else if (t.dataset.statsToggle) { statsCollapsed[t.dataset.statsToggle] = !statsCollapsed[t.dataset.statsToggle]; document.querySelector('.st-tree').innerHTML = statsTreeHtml(); }
    else if (t.dataset.statsRange) { const now = new Date(), v = t.dataset.statsRange; statsTo = isoDay(now); statsFrom = v === 'month' ? statsTo.slice(0, 8) + '01' : isoDay(new Date(now.getTime() - Number(v) * 86400000)); const f = $('#stats-filter'); f.from.value = statsFrom; f.to.value = statsTo; await loadStats(); }
    else if (t.dataset.statsSales) { statsSalesTab = t.dataset.statsSales; $('#stats-body').innerHTML = STATS_RENDER.sales(statsLast.data); }
    else if (t.id === 'cf-add') billForm();
    else if (t.dataset.billEdit) billForm(statsLast.data.bills.find(b => b.id === t.dataset.billEdit));
    else if (t.dataset.billPay) { const b = statsLast.data.bills.find(x => x.id === t.dataset.billPay); if (b && await ask(`Registrar o pagamento de "${b.description}" (${money(b.cents)})? A despesa será lançada em Faturas.`)) { await api('/bills/pay', {id: b.id}); toast('Pagamento registrado.'); await loadStats(); } }
    else if (t.dataset.billRemove) { const b = statsLast.data.bills.find(x => x.id === t.dataset.billRemove); if (b && await ask(`Remover a conta "${b.description}"?`)) { await api('/bills/remove', {id: b.id}); toast('Conta removida.'); await loadStats(); } }
  } catch (err) { toast(err.message); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'cf-balance') return; e.preventDefault();
  try { await api('/cashflow/balance', {balanceCents: Math.round(Number(String(e.target.balance.value).replace(',', '.')) * 100)}); toast('Saldo salvo.'); await loadStats(); } catch (err) { toast(err.message); }
});
