'use strict';
// 3.0.31: Controle de Caixas — abertura, sangria/suprimento, fechamento e estoque integrado.
let cashData = null, cashTab = 'current', cashStockFilter = '';
const cashCents = v => Math.round(Number(String(v ?? '').replace(',', '.')) * 100);
const cashPdf = id => '/api/cash/report?id=' + encodeURIComponent(id);

function cashSummaryHtml(reg) {
  const s = reg.summary, L = cashData.labels;
  return `<div class="stats">
    <div class="stat"><small>Total vendido</small><strong>${money(s.totalCents)}</strong><em>${s.recharges} recarga(s) • ${s.shopCount} venda(s) no PDV</em></div>
    <div class="stat"><small>Dinheiro esperado na gaveta</small><strong>${money(s.expectedCashCents)}</strong><em>troco ${money(reg.openingCents)} + dinheiro ${money(s.methods.cash)} + suprimentos − sangrias</em></div>
    <div class="stat"><small>Pix / Cartão</small><strong>${money(s.methods.pix + s.methods.card)}</strong><em>Pix ${money(s.methods.pix)} • Cartão ${money(s.methods.card)}</em></div>
    <div class="stat"><small>Cancelamentos</small><strong>${s.canceledCount}</strong><em>${money(s.canceledCents)} fora do caixa</em></div></div>
  <div class="cash-grid"><div class="shop-card"><h3>Resumo por origem</h3><table><tbody>
    <tr><td>Troco inicial</td><td class="num">${money(reg.openingCents)}</td></tr>
    <tr><td>Recargas de tempo</td><td class="num">${money(s.timeCents)}</td></tr>
    <tr><td>Produtos e serviços (PDV)</td><td class="num">${money(s.shopCents)}</td></tr>
    <tr><td>${esc(L.cash)}</td><td class="num">${money(s.methods.cash)}</td></tr>
    <tr><td>${esc(L.pix)}</td><td class="num">${money(s.methods.pix)}</td></tr>
    <tr><td>Cartão (crédito/débito)</td><td class="num">${money(s.methods.card)}</td></tr>
    ${s.methods.unspecified ? `<tr><td>${esc(L.unspecified)}</td><td class="num">${money(s.methods.unspecified)}</td></tr>` : ''}
    <tr><td>Suprimentos</td><td class="num">${money(s.supplyCents)}</td></tr>
    <tr><td>Sangrias</td><td class="num">− ${money(s.withdrawCents)}</td></tr>
    ${reg.status === 'closed' ? `<tr><td><strong>Dinheiro contado</strong></td><td class="num"><strong>${money(reg.countedCents)}</strong></td></tr><tr><td><strong>Diferença</strong></td><td class="num"><strong class="${reg.differenceCents < 0 ? 'neg' : reg.differenceCents > 0 ? 'pos' : ''}">${reg.differenceCents > 0 ? '+' : ''}${money(reg.differenceCents)}</strong></td></tr>` : ''}
  </tbody></table></div>
  <div class="shop-card"><h3>Itens vendidos neste caixa</h3><table><thead><tr><th>Item</th><th>Qtd</th><th>Total</th><th>Estoque atual</th></tr></thead><tbody>${s.items.map(i => `<tr><td>${esc(i.name)}<small class="subtext">${esc(i.category)}</small></td><td>${i.qty}</td><td>${money(i.totalCents)}</td><td>${i.stock === null ? '—' : i.stock <= 0 ? '<span class="badge red">SEM ESTOQUE</span>' : i.stock <= 5 ? `<span class="badge red">${i.stock} un</span>` : i.stock + ' un'}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum produto/serviço vendido.</td></tr>'}</tbody></table></div></div>
  ${(reg.moves || []).length ? `<div class="shop-card" style="margin-top:14px"><h3>Sangrias e suprimentos</h3><table><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Motivo</th><th>Funcionário</th></tr></thead><tbody>${reg.moves.slice().reverse().map(m => `<tr><td>${datetime(m.at)}</td><td>${m.type === 'sangria' ? 'Sangria' : 'Suprimento'}</td><td>${m.type === 'sangria' ? '− ' : ''}${money(m.cents)}</td><td>${esc(m.reason)}</td><td>${esc(m.actor)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}

function cashCurrentHtml() {
  const reg = cashData.current;
  if (!reg) return `<div class="shop-card cash-closed"><h3>Caixa fechado</h3><p class="hint">Abra o caixa para começar as vendas do dia. Todas as recargas e vendas do PDV feitas com o caixa aberto entram no fechamento.</p><form id="cash-open" class="filters"><label>Troco inicial (R$)<input name="opening" type="number" min="0" step="0.01" value="0.00" required></label><label style="flex:1">Observação (opcional)<input name="note" maxlength="300"></label><button class="primary">Abrir caixa</button></form></div>`;
  return `<div class="toolbar cash-head"><div><h2>Caixa nº ${String(reg.number).padStart(4, '0')} <span class="badge on">ABERTO</span></h2><p class="hint">Aberto em ${datetime(reg.openedAt)} por ${esc(reg.openedBy)}${reg.note ? ' • ' + esc(reg.note) : ''}</p></div><div class="toolbar-actions"><button data-cash-move="suprimento">+ Suprimento</button><button data-cash-move="sangria">− Sangria</button><button data-cash-sales="${reg.id}">Vendas do caixa</button><a class="button" href="${cashPdf(reg.id)}" target="_blank" rel="noopener">Parcial (PDF)</a><button class="primary" id="cash-close">Fechar caixa</button></div></div>${cashSummaryHtml(reg)}`;
}

function cashStockHtml() {
  const q = cashStockFilter.toLowerCase(), list = cashData.products.filter(p => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  const T = {entrada: 'Entrada', venda: 'Venda', cancelamento: 'Devolução (cancelamento)', ajuste: 'Ajuste', cadastro: 'Estoque inicial'};
  return `${cashData.lowStock.length ? `<div class="panel danger-zone"><strong>Estoque baixo</strong><p>${cashData.lowStock.map(p => esc(p.name) + ': ' + p.stock + ' un').join(' • ')}</p></div>` : ''}
  <div class="toolbar"><h2>Estoque</h2><div class="toolbar-actions"><input id="cash-stock-search" placeholder="Buscar produto ou categoria" value="${esc(cashStockFilter)}" style="width:260px"></div></div>
  <div class="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead><tbody>${list.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${money(p.priceCents)}</td><td>${p.stock <= 0 ? '<span class="badge red">SEM ESTOQUE</span>' : p.stock <= 5 ? `<span class="badge red">${p.stock} un</span>` : p.stock + ' un'}</td><td><button data-stock-entry="${p.id}">+ Entrada</button></td></tr>`).join('') || '<tr><td colspan="5">Nenhum produto. Cadastre em Produtos/Serviços.</td></tr>'}</tbody></table></div>
  <h3 style="margin-top:22px">Movimentações de estoque</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Motivo</th><th>Funcionário</th></tr></thead><tbody>${cashData.moves.map(m => `<tr><td>${datetime(m.at)}</td><td>${esc(m.productName)}</td><td>${esc(T[m.type] || m.type)}</td><td class="${m.qty < 0 ? 'neg' : 'pos'}">${m.qty > 0 ? '+' : ''}${m.qty}</td><td>${esc(m.reason || '')}</td><td>${esc(m.actor || '')}</td></tr>`).join('') || '<tr><td colspan="6">Nenhuma movimentação.</td></tr>'}</tbody></table></div>
  <p class="hint">As vendas do PDV dão baixa no estoque automaticamente e o cancelamento devolve os itens.</p>`;
}

function cashHistoryHtml() {
  // 3.0.39: caixas anteriores (registro manual do administrador principal) aparecem marcados como ANTERIOR.
  const day = d => String(d || '').split('-').reverse().join('/');
  const row = c => c.historical
    ? `<tr><td>nº ${String(c.number).padStart(4, '0')} <span class="badge">ANTERIOR</span></td><td>${day(c.periodFrom)}<small class="subtext">registrado por ${esc(c.openedBy)}</small></td><td>${day(c.periodTo)}<small class="subtext">${esc(c.closeNote || '')}</small></td><td>${money(c.countedCents)}</td><td>—</td><td>—</td><td>—</td><td class="toolbar-actions"><a class="button" href="${cashPdf(c.id)}" target="_blank" rel="noopener">PDF</a>${cashData.canSellClosed ? `<button class="danger" data-cash-previous-remove="${c.id}">Remover</button>` : ''}</td></tr>`
    : `<tr><td>nº ${String(c.number).padStart(4, '0')}</td><td>${datetime(c.openedAt)}<small class="subtext">${esc(c.openedBy)}</small></td><td>${datetime(c.closedAt)}<small class="subtext">${esc(c.closedBy)}</small></td><td>${money(c.summary.totalCents)}</td><td>${money(c.summary.expectedCashCents)}</td><td>${money(c.countedCents)}</td><td class="${c.differenceCents < 0 ? 'neg' : c.differenceCents > 0 ? 'pos' : ''}">${c.differenceCents > 0 ? '+' : ''}${money(c.differenceCents)}</td><td class="toolbar-actions"><button data-cash-detail="${c.id}">Detalhes</button><button data-cash-sales="${c.id}">Vendas</button><a class="button" href="${cashPdf(c.id)}" target="_blank" rel="noopener">PDF</a></td></tr>`;
  return `${cashData.canSellClosed ? '<div class="toolbar"><p class="hint" style="margin:0">Caixas anteriores são lançados manualmente pelo administrador principal (período e valor total), somente em datas sem caixa registrado pelo sistema.</p><div class="toolbar-actions"><button data-cash-previous>Caixas anteriores</button></div></div>' : ''}<div class="table-wrap"><table><thead><tr><th>Caixa</th><th>Abertura / início</th><th>Fechamento / fim</th><th>Total vendido</th><th>Dinheiro esperado</th><th>Contado</th><th>Diferença</th><th>Ações</th></tr></thead><tbody>${cashData.history.map(row).join('') || '<tr><td colspan="8">Nenhum caixa fechado ainda.</td></tr>'}</tbody></table></div>`;
}

async function renderCash() {
  cashData = await api('/cash'); if (view !== 'cash') return;
  $('#view-title').textContent = cashTab === 'stock' ? 'Produtos e Serviços' : 'Controle de Caixas';
  $('#view').innerHTML = `${gzTabs(cashTab === 'stock' ? 'produtos' : 'caixa')}
  <div id="cash-body">${cashTab === 'stock' ? cashStockHtml() : cashTab === 'history' ? cashHistoryHtml() : cashCurrentHtml()}</div>
  ${cashTab === 'current' ? `<p class="hint cash-setting">Adicionar tempo, liberar visitantes e vender produtos/serviços só é permitido com o caixa aberto. ${cashData.canSellClosed ? 'Você é o administrador principal: pode registrar mesmo com o caixa fechado (o valor não entra em nenhum caixa).' : 'Somente o administrador principal pode registrar com o caixa fechado.'}</p>` : ''}`;
  const open = $('#cash-open');
  if (open) open.onsubmit = async e => { e.preventDefault(); try { await api('/cash/open', {openingCents: cashCents(open.opening.value), note: open.note.value}); toast('Caixa aberto.'); await refresh(true); await renderCash(); } catch (err) { toast(err.message); } };
  const close = $('#cash-close');
  if (close) close.onclick = async () => {
    // 3.0.46: confirmação antes de fechar o caixa
    if (!(await askYesNo('Fechar caixa', `Deseja realmente fechar o caixa nº ${String(cashData.current.number).padStart(4, '0')}?`))) return;
    const s = cashData.current.summary;
    modal('Fechar caixa', `<form><p>Conte o dinheiro da gaveta e informe o valor. O sistema compara com o esperado.</p><div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><small>Dinheiro esperado</small><strong>${money(s.expectedCashCents)}</strong></div><div class="stat"><small>Total vendido</small><strong>${money(s.totalCents)}</strong><em>Pix ${money(s.methods.pix)} • Cartão ${money(s.methods.card)}</em></div></div><label>Dinheiro contado na gaveta (R$)<input name="counted" id="cash-counted" type="number" min="0" step="0.01" required value="${(s.expectedCashCents / 100).toFixed(2)}"></label><p class="hint" id="cash-diff">Diferença: R$ 0,00</p><label>Observação (opcional)<input name="note" maxlength="300"></label><button class="primary">Confirmar fechamento</button></form>`);
    const counted = $('#cash-counted'), diff = () => { const d = cashCents(counted.value) - s.expectedCashCents; $('#cash-diff').textContent = 'Diferença: ' + (d > 0 ? '+' : '') + money(d) + (d < 0 ? ' (falta dinheiro)' : d > 0 ? ' (sobra dinheiro)' : ' (confere)'); };
    counted.oninput = diff; diff();
    formAction(async d => { const reg = await api('/cash/close', {countedCents: cashCents(d.counted), note: d.note}); toast('Caixa fechado.'); refresh(true); window.open(cashPdf(reg.id), '_blank', 'noopener'); cashTab = 'history'; await renderCash(); });
  };
  const ss = $('#cash-stock-search');
  if (ss) ss.oninput = () => { cashStockFilter = ss.value; const pos = ss.selectionStart; $('#cash-body').innerHTML = cashStockHtml(); const n = $('#cash-stock-search'); n.focus(); n.setSelectionRange(pos, pos); n.oninput = ss.oninput; };
}

async function cashSalesModal(id) {
  const list = await api('/cash/sales?id=' + encodeURIComponent(id)), L = cashData.labels;
  modal('Vendas do caixa', `<div class="table-wrap" style="max-height:60vh"><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Pagamento</th><th>Status</th></tr></thead><tbody>${list.map(v => `<tr><td>${datetime(v.at)}<small class="subtext">${esc(v.actor)}</small></td><td>${v.kind === 'pdv' ? 'PDV' : 'Recarga'}</td><td>${esc(v.label)}</td><td>${money(v.cents)}</td><td>${esc(v.paymentLabel || L[v.paymentMethod] || v.paymentMethod || '')}</td><td>${v.status === 'canceled' ? '<span class="badge red">CANCELADA</span>' : 'OK'}</td></tr>`).join('') || '<tr><td colspan="6">Nenhuma venda neste caixa.</td></tr>'}</tbody></table></div>`);
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-cash-tab],[data-cash-move],[data-cash-sales],[data-cash-detail],[data-stock-entry],[data-cash-goto]'); if (!t) return;
  try {
    if (t.dataset.cashGoto !== undefined) { const dlg = $('#modal'); if (dlg.open) dlg.close(); cashTab = 'current'; document.querySelector('nav button[data-view="cash"]')?.click(); return; }
    if (view !== 'cash') return;
    if (t.dataset.cashTab) { cashTab = t.dataset.cashTab; await renderCash(); }
    else if (t.dataset.cashMove) {
      const type = t.dataset.cashMove;
      modal(type === 'sangria' ? 'Sangria (retirada de dinheiro)' : 'Suprimento (reforço de troco)', `<form><label>Valor (R$)<input name="value" type="number" min="0.01" step="0.01" required></label><label>Motivo<input name="reason" required maxlength="300" placeholder="${type === 'sangria' ? 'Ex.: depósito no banco' : 'Ex.: reforço de troco'}"></label><button class="primary">Confirmar</button></form>`);
      formAction(async d => { await api('/cash/move', {type, cents: cashCents(d.value), reason: d.reason}); toast(type === 'sangria' ? 'Sangria registrada.' : 'Suprimento registrado.'); await renderCash(); });
    }
    else if (t.dataset.cashSales) await cashSalesModal(t.dataset.cashSales);
    else if (t.dataset.cashDetail) { const reg = cashData.history.find(c => c.id === t.dataset.cashDetail); if (reg) { modal('Caixa nº ' + String(reg.number).padStart(4, '0'), `<p class="hint">Aberto em ${datetime(reg.openedAt)} por ${esc(reg.openedBy)} • fechado em ${datetime(reg.closedAt)} por ${esc(reg.closedBy)}${reg.closeNote ? ' • ' + esc(reg.closeNote) : ''}</p><div class="cash-detail">${cashSummaryHtml(reg)}</div>`); } }
    else if (t.dataset.stockEntry) {
      const p = cashData.products.find(x => x.id === t.dataset.stockEntry); if (!p) return;
      modal('Entrada de estoque', `<form><p><strong>${esc(p.name)}</strong> • estoque atual ${p.stock} un</p><div class="row"><label>Quantidade recebida<input name="qty" type="number" min="1" step="1" required></label><label>Novo preço de custo (R$, opcional)<input name="cost" type="number" min="0" step="0.01"></label></div><label>Motivo / fornecedor<input name="reason" maxlength="200" placeholder="Ex.: compra no fornecedor"></label><button class="primary">Registrar entrada</button></form>`);
      formAction(async d => { await api('/cash/stock', {productId: p.id, qty: Number(d.qty), reason: d.reason, costCents: d.cost === '' ? undefined : cashCents(d.cost)}); toast('Entrada registrada.'); await renderCash(); });
    }
  } catch (err) { toast(err.message); }
});

// 3.0.39: CAIXAS ANTERIORES (somente administrador principal; somente datas anteriores a hoje).
function previousCashDialog() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  const yesterday = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const prev = cashData.history.filter(c => c.historical);
  const sys = cashData.systemDays || [], br = d => d.split('-').reverse().join('/');
  const sysHint = sys.length ? `<br>Primeiro caixa do sistema: <b>${br(sys[0])}</b>. Dias com caixa do sistema ficam bloqueados.` : '';
  modal('Caixas anteriores', `<form><p class="hint">Registre o valor total de um caixa de um período anterior. Somente o administrador principal pode registrar e somente com datas anteriores a hoje <b>que não tenham caixa registrado pelo sistema</b> (os caixas do servidor são sempre mantidos).${sysHint}</p><div class="row"><label>Data inicial<input name="from" type="date" required max="${yesterday}"></label><label>Data final<input name="to" type="date" required max="${yesterday}"></label></div><label>Valor total do caixa (R$)<input name="value" type="number" min="0.01" step="0.01" required placeholder="Ex.: 200,00"></label><label>Observação (opcional)<input name="note" maxlength="300" placeholder="Ex.: caixa de agosto antes do sistema"></label><button class="primary">Registrar caixa anterior</button>${prev.length ? `<h3 style="margin:22px 0 10px">Já registrados</h3><div class="table-wrap"><table><thead><tr><th>Período</th><th>Valor</th></tr></thead><tbody>${prev.map(c => `<tr><td>${c.periodFrom.split('-').reverse().join('/')} a ${c.periodTo.split('-').reverse().join('/')}</td><td>${money(c.countedCents)}</td></tr>`).join('')}</tbody></table></div>` : ''}</form>`);
  const form = $('#modal-body form');
  form.from.onchange = () => { form.to.min = form.from.value; if (form.to.value && form.to.value < form.from.value) form.to.value = form.from.value; };
  formAction(async v => {
    if (v.from > yesterday || v.to > yesterday) throw Error('Use somente datas anteriores a hoje.');
    if (v.from > v.to) throw Error('A data inicial deve ser anterior ou igual à data final.');
    const hit = sys.filter(d => d >= v.from && d <= v.to);
    if (hit.length) throw Error(`Já existe caixa registrado pelo sistema em ${hit.slice(0, 5).map(br).join(', ')}${hit.length > 5 ? ' e mais ' + (hit.length - 5) + ' dia(s)' : ''}. Registre somente datas sem caixa do sistema.`);
    await api('/cash/previous', {from: v.from, to: v.to, cents: cashCents(v.value), note: v.note});
    toast('Caixa anterior registrado.'); cashTab = 'history'; await renderCash();
  });
}
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-cash-previous],[data-cash-previous-remove]'); if (!t || view !== 'cash') return;
  try {
    if (t.dataset.cashPreviousRemove) { const c = cashData.history.find(x => x.id === t.dataset.cashPreviousRemove); if (c && await ask(`Remover o caixa anterior de ${c.periodFrom.split('-').reverse().join('/')} a ${c.periodTo.split('-').reverse().join('/')} (${money(c.countedCents)})?`)) { await api('/cash/previous/remove', {id: c.id}); toast('Caixa anterior removido.'); await renderCash(); } }
    else previousCashDialog();
  } catch (err) { toast(err.message); }
});

// 1.0.5: CAIXA = Caixa atual / Vendas / Caixas fechados; PRODUTOS/SERVIÇOS = Estoque / Gerenciamento de Produtos / Gerenciamento de Serviços.
// Vendas (PDV) continua na tela "shop" e Estoque na tela "cash"; as abas e o menu mostram cada uma no grupo certo.
function gzActiveTab() { return view === 'cash' ? 'cash:' + cashTab : view === 'shop' ? 'shop:' + shopTab : view === 'nfe' ? 'nfe:main' : ''; }
function gzNavView() { if (view === 'nfe') return 'shop'; if (view === 'cash') return cashTab === 'stock' ? 'shop' : 'cash'; if (view === 'shop') return shopTab === 'sales' ? 'cash' : 'shop'; return view; }
function gzTabs(group) {
  const a = gzActiveTab(), t = (key, label) => `<button data-gz-tab="${key}" class="${a === key ? 'active' : ''}">${label}</button>`;
  return group === 'caixa'
    ? `<div class="shop-tabs">${t('cash:current', '▣ Caixa atual')}${t('shop:sales', ICON.cart + ' Vendas')}${t('cash:history', '◷ Caixas fechados')}</div>`
    : `<div class="shop-tabs">${t('cash:stock', '▤ Estoque')}${t('shop:products', ICON.box + ' Gerenciamento de Produtos')}${t('shop:services', ICON.gear + ' Gerenciamento de Serviços')}${t('shop:categories', ICON.box + ' Gerenciamento de Categoria')}${state?.pro ? t('nfe:main', ICON.box + ' Notas Fiscais') : ''}</div>`;
}
// Clique no menu: Caixa abre em "Caixa atual" (se estava no Estoque); Produtos/Serviços abre no Estoque (primeira aba).
function gzNavFix() { if (view === 'cash' && cashTab === 'stock') cashTab = 'current'; if (view === 'shop') { view = 'cash'; cashTab = 'stock'; } }
function gzOpenTab(key) {
  const [v, t] = key.split(':'); if (v === 'cash') cashTab = t; else if (v === 'shop') shopTab = t; view = v;
  const nv = gzNavView(); document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === nv));
  $('#view-title').textContent = nv === 'cash' ? 'Controle de Caixas' : 'Produtos e Serviços'; render();
}
document.addEventListener('click', e => { const t = e.target.closest('[data-gz-tab]'); if (t) gzOpenTab(t.dataset.gzTab); });
