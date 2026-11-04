'use strict';
// 3.0.23: Produtos/Servicos + PDV (venda no balcao) + cupom em PDF.
let shopData = null, shopTab = 'sales', cart = [], shopPay = '', shopQuery = '';
const centsOf = v => Math.round(Number(String(v ?? '').replace(',', '.')) * 100);
// 3.0.64: preço de venda = custo + margem de lucro, sempre arredondado PARA CIMA no real inteiro (mesma conta do servidor)
const marginPriceCents = (costCents, percent) => Math.ceil(costCents * (10000 + Math.round(percent * 100)) / 1000000) * 100;
const marginOf = v => { const s = String(v ?? '').trim().replace(',', '.'); return s === '' ? null : Number(s); };
const reais = c => ((c || 0) / 100).toFixed(2);

function shopFind(q) {
  const t = String(q || '').trim().toLowerCase(); if (!t || !shopData) return [];
  const items = [...shopData.products.map(p => ({...p, kind: 'product'})), ...shopData.services.map(s => ({...s, kind: 'service', category: 'Serviço'}))];
  return items.filter(i => i.name.toLowerCase().includes(t) || (i.barcode && i.barcode === t)).slice(0, 12);
}
function cartTotal() { return cart.reduce((a, l) => a + l.priceCents * l.qty, 0); }
function addToCart(item) {
  const line = cart.find(l => l.kind === item.kind && l.id === item.id);
  if (line) line.qty += 1; else cart.push({kind: item.kind, id: item.id, name: item.name, priceCents: item.priceCents, stock: item.kind === 'product' ? item.stock : null, qty: 1});
  shopQuery = ''; renderCart(); const s = $('#pdv-search'); if (s) { s.value = ''; s.focus(); } $('#pdv-results').innerHTML = '';
}
const ICON = {
  edit: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  del: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
  box: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  cash: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3ecf7a" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
  pix: '<svg viewBox="0 0 24 24" width="20" height="20" fill="#32bcad"><path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" opacity=".25"/><path d="M12 6 18 12 12 18 6 12Z"/></svg>',
  card: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#cfd3dc" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  cart: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 12h11.2L21 7H6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 5 5 9-10"/></svg>'
};
function renderCart() {
  const el = $('#pdv-cart'); if (!el) return;
  el.innerHTML = cart.length ? cart.map((l, i) => `<div class="pdv-line"><div class="pdv-line-name">${esc(l.name)}<small>${money(l.priceCents)}</small></div><input class="pdv-qty" data-i="${i}" type="number" min="1" max="${l.stock ?? 9999}" value="${l.qty}" aria-label="Quantidade"><strong class="pdv-sub">${money(l.priceCents * l.qty)}</strong><button class="icon-btn del" data-pdv-remove="${i}" title="Remover">${ICON.del}</button></div>`).join('')
    : '<p class="pdv-empty">Carrinho vazio.<br>Busque pelo nome ou leia o código de barras.</p>';
  $('#pdv-total').textContent = money(cartTotal());
  $('#pdv-confirm').disabled = !cart.length || !(shopData?.cash || shopData?.canSellClosed);
  document.querySelectorAll('.pdv-qty').forEach(inp => inp.onchange = () => { const l = cart[+inp.dataset.i]; let q = Math.floor(Number(inp.value) || 1); if (q < 1) q = 1; if (l.stock !== null && q > l.stock) { q = l.stock; toast('Estoque disponível: ' + l.stock); } l.qty = q; inp.value = q; inp.closest('.pdv-line').querySelector('.pdv-sub').textContent = money(l.priceCents * q); $('#pdv-total').textContent = money(cartTotal()); });
  document.querySelectorAll('[data-pdv-remove]').forEach(b => b.onclick = () => { cart.splice(+b.dataset.pdvRemove, 1); renderCart(); });
}

async function renderShop() {
  shopData = await api('/shop'); if (view !== 'shop') return;
  $('#view-title').textContent = 'Produtos e Serviços';
  const admin = isAdmin();
  cart = cart.filter(l => (l.kind === 'product' ? shopData.products : shopData.services).some(i => i.id === l.id))
    .map(l => { const src = (l.kind === 'product' ? shopData.products : shopData.services).find(i => i.id === l.id); return {...l, name: src.name, priceCents: src.priceCents, stock: l.kind === 'product' ? src.stock : null}; });
  const actions = (kind, id) => admin ? `<td class="actions-cell"><button class="icon-btn" data-shop-edit="${kind}" data-id="${id}" title="Editar">${ICON.edit}</button><button class="icon-btn del" data-shop-remove="${kind}" data-id="${id}" title="Remover">${ICON.del}</button></td>` : '<td></td>';
  const productTable = `<table><thead><tr><th>Nome</th><th>Categoria</th>${admin ? '<th>P. Custo</th><th>Margem</th>' : ''}<th>P. Venda</th><th>Cód. Barras</th><th>Estoque</th><th>Ações</th></tr></thead><tbody>${shopData.products.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td>${admin ? `<td>${money(p.costCents)}</td><td>${p.marginPercent != null ? String(p.marginPercent).replace('.', ',') + '%' : '—'}</td>` : ''}<td>${money(p.priceCents)}</td><td>${esc(p.barcode || '—')}</td><td>${p.stock <= 0 ? '<span class="badge red">SEM ESTOQUE</span>' : p.stock + ' un'}</td>${actions('product', p.id)}</tr>`).join('') || `<tr><td colspan="${admin ? 8 : 6}">Nenhum produto cadastrado.</td></tr>`}</tbody></table>`;
  const serviceTable = `<table><thead><tr><th>Nome do Serviço</th><th>Preço por Unidade</th><th>Ações</th></tr></thead><tbody>${shopData.services.map(s => `<tr><td>${esc(s.name)}</td><td>${money(s.priceCents)}</td>${actions('service', s.id)}</tr>`).join('') || '<tr><td colspan="3">Nenhum serviço cadastrado.</td></tr>'}</tbody></table>`;
  // 1.0.5: três áreas — Vendas (só o PDV, primeira opção), Gerenciamento de Produtos e Gerenciamento de Serviços
  const tab = (key, icon, label) => `<button data-shop-tab="${key}" class="${shopTab === key ? 'active' : ''}">${icon} ${label}</button>`;
  const tabs = `<div class="shop-tabs">${tab('sales', ICON.cart, 'Vendas')}${tab('products', ICON.box, 'Gerenciamento de Produtos')}${tab('services', ICON.gear, 'Gerenciamento de Serviços')}</div>`;
  const manage = kind => `<div class="shop-bar">${admin ? `<button class="primary" data-shop-add="${kind}">+ ${kind === 'product' ? 'Novo Produto' : 'Novo Serviço'}</button>` : ''}</div>
    <div class="shop-card table-wrap">${kind === 'product' ? productTable : serviceTable}</div>`;
  $('#view').innerHTML = `<div class="shop-area">${tabs}
   ${shopTab === 'products' ? manage('product') : shopTab === 'services' ? manage('service') : `
    <div class="shop-card pdv pdv-wide">
     <h3>PDV ${shopData.cash ? `<span class="badge on">CAIXA nº ${String(shopData.cash.number).padStart(4, '0')} ABERTO</span>` : '<span class="badge red">CAIXA FECHADO</span>'}</h3>
     ${shopData.cash ? '' : shopData.canSellClosed ? '<p class="hint cash-bypass">Caixa fechado: como administrador principal você pode vender, mas a venda não entra em nenhum caixa. <button type="button" data-cash-goto>Abrir caixa</button></p>' : '<div class="pdv-cash-warn">Abra o caixa para registrar vendas no PDV. <button type="button" data-cash-goto>Abrir caixa</button></div>'}
     <div class="pdv-search"><input id="pdv-search" autocomplete="off" placeholder="Buscar por nome ou código de barras…" value="${esc(shopQuery)}"><span>${ICON.search}</span></div>
     <div id="pdv-results" class="pdv-results"></div>
     <div class="pdv-body">
      <div class="pdv-cartbox"><div class="pdv-head"><span>Carrinho</span><span>Qtd</span><span style="text-align:right">Subtotal</span><span></span></div><div id="pdv-cart"></div></div>
      <div class="pdv-pay">
       ${Object.entries(shopData.payments).map(([k, v]) => `<label class="pay-opt"><input type="radio" name="pdv-pay" value="${k}" ${shopPay === k ? 'checked' : ''}>${ICON[k] || ''}<span>${v}</span></label>`).join('')}
       <div class="pdv-total"><span>Total</span><strong id="pdv-total">R$ 0,00</strong></div>
       <button class="primary pdv-finish" id="pdv-confirm" disabled>${ICON.check} Finalizar Venda</button>
      </div>
     </div>
    </div>
   `}</div>`;
  if (shopTab !== 'sales') return;
  const search = $('#pdv-search');
  const showResults = () => {
    shopQuery = search.value; const found = shopFind(search.value);
    $('#pdv-results').innerHTML = found.map((i, n) => `<button type="button" class="pdv-item" data-n="${n}" ${i.kind === 'product' && i.stock <= 0 ? 'disabled' : ''}><strong>${esc(i.name)}</strong><small>${esc(i.category)} · ${money(i.priceCents)}${i.kind === 'product' ? ' · estoque ' + i.stock : ''}</small></button>`).join('') || (search.value.trim() ? '<p class="hint">Nenhum item encontrado.</p>' : '');
    document.querySelectorAll('.pdv-item').forEach(b => b.onclick = () => addToCart(found[+b.dataset.n]));
  };
  search.oninput = showResults;
  // leitor de codigo de barras digita o codigo e envia Enter
  search.onkeydown = e => { if (e.key !== 'Enter') return; e.preventDefault(); const t = search.value.trim(); const found = shopFind(t); const exact = found.find(i => i.barcode && i.barcode === t) || (found.length === 1 ? found[0] : null); if (exact) { if (exact.kind === 'product' && exact.stock <= 0) toast('Produto sem estoque.'); else addToCart(exact); } };
  document.querySelectorAll('input[name="pdv-pay"]').forEach(r => r.onchange = () => shopPay = r.value);
  $('#pdv-confirm').onclick = askFinishSale;
  if (shopQuery) showResults();
  renderCart(); search.focus({preventScroll: true});
}

// 3.0.64: "Deseja realmente finalizar a venda?" — Cancelar volta ao PDV com o carrinho intacto
function askFinishSale() {
  const pay = document.querySelector('input[name="pdv-pay"]:checked')?.value; if (!pay) { toast('Selecione a forma de pagamento.'); return; }
  if (!cart.length) return;
  const items = cart.reduce((a, l) => a + l.qty, 0);
  modal('Finalizar venda', `<p class="confirm-question">Deseja realmente finalizar a venda?</p><p class="hint">${items} ${items === 1 ? 'item' : 'itens'} · ${esc(shopData.payments[pay] || pay)} · Total <strong>${money(cartTotal())}</strong></p><div class="toolbar-actions confirm-actions"><button type="button" class="primary" id="pdv-yes">${ICON.check} Confirmar</button><button type="button" class="ghost" id="pdv-no">Cancelar</button></div>`);
  $('#pdv-yes').onclick = () => { $('#pdv-yes').disabled = true; $('#modal').close(); confirmSale(); };
  $('#pdv-no').onclick = () => { $('#modal').close(); $('#pdv-search')?.focus({preventScroll: true}); };
  $('#pdv-yes').focus();
}
async function confirmSale() {
  const pay = document.querySelector('input[name="pdv-pay"]:checked')?.value; if (!pay) { toast('Selecione a forma de pagamento.'); return; }
  if (!cart.length) return;
  const button = $('#pdv-confirm'); button.disabled = true;
  try {
    const sale = await api('/shop/sale', {items: cart.map(l => ({kind: l.kind, id: l.id, qty: l.qty})), paymentMethod: pay});
    cart = []; shopPay = ''; showReceipt(sale); await renderShop();
  } catch (e) { toast(e.message); button.disabled = false; }
}
function receiptPreview(sale) {
  if (!sale.items) return '';
  const W = 42, pad = (l, r) => l + ' '.repeat(Math.max(1, W - l.length - r.length)) + r, line = '-'.repeat(W), brl = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
  const rows = ['GameZoney', 'CUPOM DE VENDA - NAO FISCAL', line, pad('Cupom No ' + String(sale.number).padStart(6, '0'), new Date(sale.at).toLocaleString('pt-BR', {timeZone: state?.settings.timeZone || 'America/Manaus'}).replace(',', '')), 'Operador: ' + sale.actor, line];
  for (const i of sale.items) { rows.push(i.name.slice(0, W)); rows.push(pad('  ' + i.qty + ' x ' + brl(i.unitCents), brl(i.totalCents))); }
  rows.push(line, pad('TOTAL', brl(sale.totalCents)), pad('Pagamento', ({cash: 'Dinheiro', pix: 'Pix', card: 'Cartão'})[sale.paymentMethod] || ''));
  if (sale.status === 'canceled') rows.push(line, '*** VENDA CANCELADA ***');
  rows.push(line, 'Documento sem valor fiscal');
  return `<pre style="background:#fff;color:#111;padding:14px 16px;border-radius:10px;font:12px/1.45 Consolas,'Courier New',monospace;max-height:380px;overflow:auto;width:max-content;max-width:100%;margin:0 auto">${esc(rows.join('\n'))}</pre>`;
}
function showReceipt(sale) {
  const url = '/api/shop/receipt?id=' + encodeURIComponent(sale.id), num = String(sale.number).padStart(6, '0');
  modal('Cupom nº ' + num, `<p class="hint">Comprovante interno, <strong>sem valor fiscal</strong>. Para imprimir, abra o PDF e use Imprimir (ou Salvar como PDF).</p>${receiptPreview(sale)}<div class="toolbar-actions" style="margin-top:14px"><a class="button" style="background:#e63946;border-color:#e63946;color:#fff" href="${url}" target="_blank" rel="noopener">Abrir PDF para imprimir</a><a class="button" href="${url}" download="cupom-${num}.pdf">Baixar PDF</a></div>`);
}
function shopForm(kind, item) {
  item = item || {};
  if (kind === 'product') {
    modal(item.id ? 'Editar produto' : 'Adicionar produto', `<form><label>Nome do produto<input name="name" required maxlength="100" value="${esc(item.name)}"></label><label>Categoria<select name="category" required>${shopData.categories.map(c => `<option ${item.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><div class="row"><label>Preço de custo (R$)<input name="cost" type="number" min="0" step="0.01" required value="${item.id ? reais(item.costCents) : ''}"></label><label>Margem de lucro (%)<input name="margin" type="number" min="0" max="1000" step="0.01" inputmode="decimal" placeholder="Ex.: 50" value="${item.id && item.marginPercent != null ? item.marginPercent : ''}"></label></div><label>Preço de venda (R$)<input name="price" type="number" min="0.01" step="0.01" required value="${item.id ? reais(item.priceCents) : ''}"></label><p class="hint" id="margin-hint">Com a margem preenchida, o preço de venda é calculado sozinho (custo + margem) e arredondado para cima no real inteiro. Sem margem, digite o preço de venda.</p><div class="row"><label>Código de barras (opcional)<input name="barcode" maxlength="48" autocomplete="off" value="${esc(item.barcode)}"></label><label>Quantidade em estoque<input name="stock" type="number" min="0" step="1" required value="${item.id ? item.stock : 0}"></label></div><button class="primary">Salvar produto</button></form>`);
    const form = $('#modal-body form'), cost = form.elements.cost, margin = form.elements.margin, price = form.elements.price;
    const recalc = () => {
      const m = marginOf(margin.value), c = centsOf(cost.value);
      price.readOnly = m !== null;
      price.classList.toggle('auto-price', m !== null);
      if (m === null) { $('#margin-hint').textContent = 'Com a margem preenchida, o preço de venda é calculado sozinho (custo + margem) e arredondado para cima no real inteiro. Sem margem, digite o preço de venda.'; return; }
      if (!Number.isFinite(m) || m < 0 || m > 1000 || !Number.isFinite(c) || c < 0) { price.value = ''; $('#margin-hint').textContent = 'Informe o preço de custo e uma margem de 0 a 1000%.'; return; }
      const exact = Math.round(c * (10000 + Math.round(m * 100)) / 10000), rounded = marginPriceCents(c, m);
      price.value = reais(rounded);
      $('#margin-hint').textContent = `Custo ${money(c)} + ${String(m).replace('.', ',')}% = ${money(exact)}` + (rounded !== exact ? ` → arredondado para ${money(rounded)}.` : '.');
    };
    cost.oninput = margin.oninput = recalc;
    recalc();
    formAction(d => api('/shop/product', {id: item.id, name: d.name, category: d.category, costCents: centsOf(d.cost), marginPercent: marginOf(d.margin), priceCents: centsOf(d.price), barcode: d.barcode, stock: Number(d.stock)}).then(() => renderShop()));
  } else {
    modal(item.id ? 'Editar serviço' : 'Adicionar serviço', `<form><label>Nome do serviço<input name="name" required maxlength="100" value="${esc(item.name)}"></label><label>Preço por unidade (R$)<input name="price" type="number" min="0.01" step="0.01" required value="${item.id ? reais(item.priceCents) : ''}"></label><button class="primary">Salvar serviço</button></form>`);
    formAction(d => api('/shop/service', {id: item.id, name: d.name, priceCents: centsOf(d.price)}).then(() => renderShop()));
  }
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-shop-tab],[data-shop-add],[data-shop-edit],[data-shop-remove],[data-shop-cancel],[data-shop-receipt]'); if (!t) return;
  try {
    if (t.dataset.shopTab) { shopTab = t.dataset.shopTab; await renderShop(); }
    else if (t.dataset.shopAdd) shopForm(t.dataset.shopAdd);
    else if (t.dataset.shopEdit) { const k = t.dataset.shopEdit; shopForm(k, (k === 'product' ? shopData.products : shopData.services).find(i => i.id === t.dataset.id)); }
    else if (t.dataset.shopRemove) { const k = t.dataset.shopRemove, item = (k === 'product' ? shopData.products : shopData.services).find(i => i.id === t.dataset.id); if (item && await ask(`Remover "${item.name}" do catálogo? As vendas já registradas não são alteradas.`)) { await api('/shop/remove', {kind: k, id: item.id}); toast('Item removido.'); await renderShop(); } }
    else if (t.dataset.shopReceipt) showReceipt((typeof businessReport !== 'undefined' && businessReport?.shopSales || []).find(x => x.id === t.dataset.shopReceipt) || {id: t.dataset.shopReceipt, number: Number(t.dataset.number)});
    else if (t.dataset.shopCancel) businessForm('Cancelar venda', '<p>A venda será mantida no histórico como cancelada, sairá da receita e os produtos voltarão ao estoque.</p><label>Motivo<input name="reason" required maxlength="300" placeholder="Ex.: cliente desistiu"></label>', d => api('/shop/cancel', {id: t.dataset.shopCancel, ...d}));
  } catch (err) { toast(err.message); }
});

// Faturas e relatorios: tabela de vendas de produtos/servicos com cancelamento.
function shopFinanceSection(r) {
  const list = [...(r.shopSales || [])].reverse();
  return `<h2 style="margin-top:28px">Vendas de produtos e serviços</h2><p class="hint">Receita de produtos/serviços no período: ${money(r.shopRevenue || 0)} · custo dos produtos vendidos: ${money(r.shopCost || 0)}. Vendas canceladas não geram receita e devolvem os produtos ao estoque.</p><div class="table-wrap"><table><thead><tr><th>Cupom</th><th>Data / operador</th><th>Itens</th><th>Valor</th><th>Pagamento</th><th>Status</th><th>Ações</th></tr></thead><tbody>${list.map(s => `<tr><td>C${String(s.number).padStart(6, '0')}</td><td>${datetime(s.at)}<small class="subtext">${esc(s.actor)}</small></td><td>${s.items.map(i => esc(i.qty + 'x ' + i.name)).join('<br>')}</td><td>${money(s.totalCents)}</td><td>${esc(({cash: 'Dinheiro', pix: 'Pix', card: 'Cartão'})[s.paymentMethod] || '')}</td><td>${s.status === 'canceled' ? 'Cancelada' : 'Registrada'}<small class="subtext">${esc(s.cancelReason || '')}</small></td><td><button data-shop-receipt="${s.id}" data-number="${s.number}">Cupom</button> <button data-shop-cancel="${s.id}" ${s.status === 'canceled' ? 'disabled' : ''}>Cancelar</button></td></tr>`).join('') || '<tr><td colspan="7">Nenhuma venda de produtos/serviços no período.</td></tr>'}</tbody></table></div>`;
}
