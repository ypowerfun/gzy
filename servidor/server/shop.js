'use strict';
// 3.0.23: Produtos/Servicos e PDV (venda no balcao) com cupom em PDF e cancelamento no financeiro.
// Vendas de produtos/servicos sao separadas das recargas de tempo, mas entram na receita do financeiro.
const {id, integer, text, fail} = require('./store');

const CATEGORIES = ['Snacks / Alimentos', 'Bebidas', 'Acessórios e Periféricos', 'Produtos Virtuais (Pins e Créditos)'];
const PAYMENTS = {cash: 'Dinheiro', pix: 'Pix', card: 'Cartão'};

function init(store) {
  const s = store.state;
  s.products ??= []; s.services ??= []; s.shopSales ??= []; s.shopSequence ??= 0;
  // 1.0.5: categorias editáveis (Produtos/Serviços > Gerenciamento de Categoria); começa com as padrão + as já usadas
  if (!Array.isArray(s.categories)) s.categories = [...new Set([...CATEGORIES, ...s.products.map(p => p.category).filter(Boolean)])];
  if (!s.shopSeeded) {   // itens de exemplo (podem ser editados ou removidos)
    const now = Date.now();
    for (const [name, category, cost, price, stock] of [['Coca-cola', 'Bebidas', 350, 600, 24], ['Fanta', 'Bebidas', 300, 550, 24], ['Biscoito', 'Snacks / Alimentos', 150, 300, 30]])
      s.products.push({id: id(), name, category, costCents: cost, priceCents: price, barcode: '', stock, active: true, createdAt: now, example: true});
    for (const [name, price] of [['Xerox', 50], ['Impressão', 100], ['Trabalhos Escolares', 1000]])
      s.services.push({id: id(), name, priceCents: price, active: true, createdAt: now, example: true});
    s.shopSeeded = true;
  }
  // 1.0.8: código do produto (número sequencial, nunca reaproveitado) — usado para vincular os itens da nota fiscal de entrada
  s.productSequence ??= 0;
  for (const p of [...s.products].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) if (!p.code) p.code = ++s.productSequence;
}

const cents = (v, label, min = 0) => integer(v, min, 100000000, label);
// 3.0.64: margem de lucro (%) opcional. Preço de venda = custo + margem, sempre arredondado PARA CIMA no real inteiro
// (ex.: 5,50 → 6,00; 4,30 → 5,00; 6,00 continua 6,00). Conta em centésimos de ponto percentual, sem erro de arredondamento.
function marginPercent(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 1000) fail('Margem de lucro: informe de 0 a 1000%.');
  return Math.round(n * 100) / 100;
}
function marginPrice(costCents, percent) {
  const raw = costCents * (10000 + Math.round(percent * 100));          // centavos × 10000
  return Math.ceil(raw / 1000000) * 100;                                  // real inteiro, para cima
}
function saveProduct(store, input, actor) {
  const name = text(input.name, 'Nome do produto', 100);
  const category = store.state.categories.includes(input.category) ? input.category : fail('Escolha a categoria.');
  const costCents = cents(input.costCents, 'Preço de custo'), margin = marginPercent(input.marginPercent);
  const priceCents = margin === null ? cents(input.priceCents, 'Preço de venda', 1) : marginPrice(costCents, margin);
  if (priceCents < 1) fail('Preço de venda: com margem de lucro, informe um preço de custo maior que zero.');
  const barcode = String(input.barcode ?? '').trim();
  if (barcode && !/^[\x20-\x7E]{3,200}$/.test(barcode)) fail('Código de barras/QR Code inválido (3 a 200 caracteres, sem acentos).'); /* 1.1.0: aceita também o texto de QR Code */
  const stock = integer(input.stock, 0, 1000000, 'Quantidade em estoque');
  const existing = input.id ? store.state.products.find(p => p.id === input.id) || fail('Produto não encontrado.') : null;
  if (barcode && store.state.products.some(p => p.active && p.id !== existing?.id && p.barcode === barcode)) fail('Este código de barras já está em outro produto.');
  if (store.state.products.some(p => p.active && p.id !== existing?.id && p.name.toLowerCase() === name.toLowerCase())) fail('Já existe um produto com este nome.');
  return store.change(actor, 'produto', (existing ? 'Produto atualizado: ' : 'Produto cadastrado: ') + name + ` • estoque ${stock}`, () => {
    const p = existing || {id: id(), createdAt: Date.now(), active: true, code: ++store.state.productSequence};
    if (!existing) store.state.products.push(p);
    const before = existing ? existing.stock : 0;
    if (stock !== before) (store.state.stockMoves ??= []).push({id: id(), at: Date.now(), actor, productId: p.id, productName: name, type: existing ? 'ajuste' : 'cadastro', qty: stock - before, stockAfter: stock, reason: existing ? 'Ajuste no cadastro do produto' : 'Estoque inicial'});
    Object.assign(p, {name, category, costCents, marginPercent: margin, priceCents, barcode, stock, active: true, example: false, updatedAt: Date.now()});
    return p;
  });
}
function saveService(store, input, actor) {
  const name = text(input.name, 'Nome do serviço', 100), priceCents = cents(input.priceCents, 'Preço por unidade', 1);
  const existing = input.id ? store.state.services.find(p => p.id === input.id) || fail('Serviço não encontrado.') : null;
  if (store.state.services.some(p => p.active && p.id !== existing?.id && p.name.toLowerCase() === name.toLowerCase())) fail('Já existe um serviço com este nome.');
  return store.change(actor, 'servico', (existing ? 'Serviço atualizado: ' : 'Serviço cadastrado: ') + name, () => {
    const p = existing || {id: id(), createdAt: Date.now(), active: true};
    if (!existing) store.state.services.push(p);
    Object.assign(p, {name, priceCents, active: true, example: false, updatedAt: Date.now()});
    return p;
  });
}
function removeItem(store, input, actor) {
  const list = input.kind === 'service' ? store.state.services : input.kind === 'product' ? store.state.products : fail('Tipo inválido.');
  const item = list.find(p => p.id === input.id && p.active) || fail('Item não encontrado.');
  // O item sai do catalogo, mas continua nas vendas ja registradas.
  return store.change(actor, input.kind === 'service' ? 'servico' : 'produto', 'Removido do catálogo: ' + item.name, () => { item.active = false; item.removedAt = Date.now(); return item; });
}

function catalog(store, isAdmin) {
  const strip = p => isAdmin ? p : (({costCents, marginPercent, ...rest}) => rest)(p);
  return {categories: store.state.categories, categoryUse: Object.fromEntries(store.state.categories.map(c => [c, store.state.products.filter(p => p.active && p.category === c).length])), payments: PAYMENTS, products: store.state.products.filter(p => p.active).map(strip), services: store.state.services.filter(s => s.active)};
}

function sell(store, input, actor) {
  const P = require('./payments'), mixed = P.wants(input); // 1.0.5: pagamento combinado (2 a 3 formas)
  const paymentMethod = mixed ? 'mixed' : Object.hasOwn(PAYMENTS, input.paymentMethod) ? input.paymentMethod : fail('Selecione a forma de pagamento (Dinheiro, Pix ou Cartão).');
  const lines = Array.isArray(input.items) ? input.items : [];
  if (!lines.length) fail('Adicione pelo menos um item.');
  if (lines.length > 100) fail('Itens demais em uma venda.');
  const merged = new Map();
  for (const l of lines) {
    const kind = l.kind === 'service' ? 'service' : l.kind === 'product' ? 'product' : fail('Item inválido.');
    const qty = integer(l.qty, 1, 9999, 'Quantidade'), key = kind + ':' + l.id;
    merged.set(key, {kind, id: String(l.id), qty: (merged.get(key)?.qty || 0) + qty});
  }
  const items = [...merged.values()].map(l => {
    const src = (l.kind === 'product' ? store.state.products : store.state.services).find(p => p.id === l.id && p.active) || fail('Item não está mais disponível. Atualize a tela.');
    if (l.kind === 'product' && src.stock < l.qty) fail(`Estoque insuficiente para ${src.name}: disponível ${src.stock}.`);
    return {kind: l.kind, itemId: src.id, name: src.name, category: src.category || 'Serviço', qty: l.qty, unitCents: src.priceCents, costCents: l.kind === 'product' ? src.costCents : 0, totalCents: src.priceCents * l.qty};
  });
  const totalCents = items.reduce((a, i) => a + i.totalCents, 0);
  const summary = items.map(i => `${i.qty}x ${i.name}`).join(', ');
  const payments = mixed ? P.combined(input.payments, totalCents, P.SHOP) : null;
  return store.change(actor, 'venda', `Venda de produtos/serviços: ${summary} • R$ ${(totalCents / 100).toFixed(2)} • ${P.label({paymentMethod, payments})}`, () => {
    for (const i of items) if (i.kind === 'product') {
      const p = store.state.products.find(p => p.id === i.itemId);
      if (p.stock < i.qty) fail(`Estoque insuficiente para ${p.name}.`);
      p.stock -= i.qty;
    }
    const sale = {id: id(), number: ++store.state.shopSequence, at: Date.now(), actor, items, totalCents, paymentMethod, ...(payments ? {payments} : {}), status: 'paid', cashId: require('./cash').openId(store)};
    store.state.shopSales.push(sale);
    return sale;
  });
}

function cancelSale(store, input, actor) {
  const sale = store.state.shopSales.find(s => s.id === input.id) || fail('Venda não encontrada.');
  if (sale.status === 'canceled') fail('Esta venda já foi cancelada.');
  require('./events').blockCancel(store, sale);
  const reason = text(input.reason, 'Motivo', 300);
  return store.change(actor, 'cancelamento', `Cancelamento do cupom ${sale.number}: ${reason} • estoque devolvido`, () => {
    for (const i of sale.items) if (i.kind === 'product') { const p = store.state.products.find(p => p.id === i.itemId); if (p) p.stock += i.qty; }
    Object.assign(sale, {status: 'canceled', canceledAt: Date.now(), canceledBy: actor, cancelReason: reason, canceledCashId: require('./cash').openId(store)});
    return sale;
  });
}

const localDate = (t, tz) => new Intl.DateTimeFormat('en-CA', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'}).format(t);
function forPeriod(store, key) { return (store.state.shopSales || []).filter(s => localDate(s.at, store.state.settings.timeZone).startsWith(key)); }

// ---------- cupom em PDF (80 mm, sem dependencias) ----------
const WIDTH = 42;
function pdfText(s) {   // WinAnsi (latin1) + escape de PDF
  return String(s).replace(/[•·]/g, '-').replace(/[–—]/g, '-').replace(/[^\x20-\x7E -ÿ]/g, '?').replace(/([\\()])/g, '\\$1');
}
function wrap(s, width = WIDTH) { const out = []; let line = ''; for (const w of String(s).split(/\s+/)) { if ((line + ' ' + w).trim().length > width) { if (line) out.push(line); line = w.slice(0, width); } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out.length ? out : ['']; }
const pad = (l, r, width = WIDTH) => l + ' '.repeat(Math.max(1, width - l.length - r.length)) + r;
const center = s => ' '.repeat(Math.max(0, Math.floor((WIDTH - s.length) / 2))) + s;
const brl = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');

function receiptLines(store, sale) {
  const tz = store.state.settings.timeZone || 'America/Manaus';
  const when = new Intl.DateTimeFormat('pt-BR', {timeZone: tz, dateStyle: 'short', timeStyle: 'medium'}).format(sale.at);
  const L = [center('GameZoney'), center('CUPOM DE VENDA - NAO FISCAL'), '-'.repeat(WIDTH), pad('Cupom No ' + String(sale.number).padStart(6, '0'), when.replace(',', '')), 'Operador: ' + sale.actor, '-'.repeat(WIDTH), pad('ITEM', 'TOTAL')];
  for (const i of sale.items) { for (const w of wrap(i.name)) L.push(w); L.push(pad(`  ${i.qty} x ${brl(i.unitCents)}`, brl(i.totalCents))); }
  L.push('-'.repeat(WIDTH), pad('TOTAL', brl(sale.totalCents)), ...(sale.paymentMethod === 'mixed' ? ['Pagamento combinado:', ...require('./payments').parts(sale, sale.totalCents).map(p => pad('  ' + require('./payments').LABEL[p.method], brl(p.cents)))] : [pad('Pagamento', PAYMENTS[sale.paymentMethod] || '')]));
  if (sale.status === 'canceled') L.push('-'.repeat(WIDTH), center('*** VENDA CANCELADA ***'), ...wrap('Motivo: ' + (sale.cancelReason || '')));
  L.push('-'.repeat(WIDTH), center('Documento sem valor fiscal'), center('Obrigado e bom jogo!'));
  return L;
}
function receiptPdf(store, saleId) {
  const sale = store.state.shopSales.find(s => s.id === saleId) || fail('Venda não encontrada.');
  return {pdf: linesPdf(receiptLines(store, sale), 'Cupom ' + sale.number), number: sale.number};
}
// 3.0.31: gerador de PDF de texto (80 mm) reaproveitado pelo relatorio de fechamento de caixa.
function linesPdf(lines, title) {
  const size = 8, lead = 11, margin = 12;
  const w = 226.77, h = Math.max(200, margin * 2 + lines.length * lead + 10);
  let content = `BT /F1 ${size} Tf ${lead} TL ${margin} ${(h - margin - size).toFixed(2)} Td\n`;
  lines.forEach((l, i) => { content += (i ? 'T* ' : '') + '(' + pdfText(l) + ') Tj\n'; });
  content += 'ET';
  const stream = Buffer.from(content, 'latin1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h.toFixed(2)}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    null,
    `<< /Title (${pdfText(title)}) /Producer (GameZoney) >>`
  ];
  const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')], offsets = [];
  let length = parts[0].length;
  objects.forEach((o, i) => {
    offsets.push(length);
    const body = o === null ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${stream.length} >>\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream\nendobj\n', 'latin1')]) : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
    parts.push(body); length += body.length;
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

// 1.0.5: Gerenciamento de Categoria — criar, renomear (os produtos acompanham) e remover (só sem produtos ativos).
function saveCategory(store, input, actor) {
  const name = text(input.name, 'Nome da categoria', 60), old = input.old === undefined || input.old === '' ? null : String(input.old);
  const list = store.state.categories;
  if (old !== null && !list.includes(old)) fail('Categoria não encontrada.');
  if (list.some(c => c !== old && c.toLowerCase() === name.toLowerCase())) fail('Já existe uma categoria com esse nome.');
  if (old === name) return {name};
  return store.change(actor, 'produto', old ? `Categoria renomeada: ${old} → ${name}` : `Categoria criada: ${name}`, () => {
    if (old) { list[list.indexOf(old)] = name; for (const p of store.state.products) if (p.category === old) p.category = name; }
    else { if (list.length >= 100) fail('Limite de 100 categorias.'); list.push(name); }
    return {name};
  });
}
function removeCategory(store, input, actor) {
  const name = String(input.name ?? ''), list = store.state.categories;
  if (!list.includes(name)) fail('Categoria não encontrada.');
  const used = store.state.products.filter(p => p.active && p.category === name).length;
  if (used) fail(`${used} produto(s) usam esta categoria. Mude a categoria deles antes de remover.`);
  if (list.length <= 1) fail('Mantenha pelo menos uma categoria.');
  return store.change(actor, 'produto', 'Categoria removida: ' + name, () => { list.splice(list.indexOf(name), 1); return {ok: true}; });
}
module.exports = {saveCategory, removeCategory, linesPdf, wrap, pad, center, brl, WIDTH, init, CATEGORIES, PAYMENTS, marginPrice, saveProduct, saveService, removeItem, catalog, sell, cancelSale, forPeriod, receiptLines, receiptPdf};
