'use strict';
// 1.1.0: importar produtos por planilha (.csv ou .xlsx) em Gerenciamento de Produtos.
// Colunas (cabeçalho em qualquer ordem): Código, Nome, Categoria, Custo, Preço de venda, Margem (%), e opcionais Código de
// barras e Estoque. Cada linha ATUALIZA o produto que já tem o mesmo código do produto (número do GameZoney) ou o mesmo
// código de barras (ou o mesmo nome); senão CRIA um produto novo. O "Código" que não é um código do GameZoney (ex.: código
// do sistema antigo ou EAN) vira o código de barras do produto, para achar no PDV e no leitor.
// Com margem, o preço de venda é calculado (custo + margem, arredondado para cima no real inteiro), igual ao cadastro.
const {id, fail} = require('./store');
const {readCsv, readXlsx} = require('./import');
const {marginPrice} = require('./shop');
const MAX_ROWS = 5000;
const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const BARCODE = /^[\x20-\x7E]{3,200}$/;

function detect(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const h = rows[i].cells.map(c => typeof c === 'object' ? '' : norm(c)), col = {};
    h.forEach((t, j) => {
      if (!t) return;
      if (col.ncm === undefined && /\bncm\b/.test(t)) col.ncm = j;               // 1.3.0: dados fiscais para a NFC-e
      else if (col.cfop === undefined && /\bcfop\b/.test(t)) col.cfop = j;
      else if (col.cst === undefined && /\b(cst|csosn)\b/.test(t)) col.cst = j;
      else if (col.barcode === undefined && /(barra|ean|gtin|qr)/.test(t)) col.barcode = j;
      else if (col.margin === undefined && /(margem|markup|lucro)/.test(t)) col.margin = j;
      else if (col.cost === undefined && /(custo|compra)/.test(t)) col.cost = j;
      else if (col.price === undefined && /(venda|preco|valor)/.test(t)) col.price = j;
      else if (col.stock === undefined && /(estoque|quantidade|qtd|saldo)/.test(t)) col.stock = j;
      else if (col.category === undefined && /(categ|grupo|departamento|secao)/.test(t)) col.category = j;
      else if (col.code === undefined && /(codigo|cod\b|cod\.|sku|referencia|ref\b|id\b)/.test(t)) col.code = j;
      else if (col.name === undefined && /(nome|produto|descri)/.test(t)) col.name = j;
    });
    if (col.name !== undefined && (col.price !== undefined || col.cost !== undefined)) return {header: i, ...col};
  }
  return {header: -1, code: 0, name: 1, category: 2, cost: 3, price: 4, margin: 5};   // sem cabeçalho: Código | Nome | Categoria | Custo | Preço de venda | Margem
}
// dinheiro: 3,50 • 3.50 • R$ 1.250,90 • 1250.9 • número do Excel
function money(v) {
  if (v === '' || v === null || v === undefined) return undefined;
  if (typeof v === 'object') return Number.isFinite(v.number) && v.number >= 0 ? Math.round(v.number * 100) : null;
  let t = String(v).replace(/r\$|\s/gi, '');
  if (!t || t === '-') return undefined;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  t = t.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Math.round(Number(t) * 100) : null;
}
function percent(v) {
  if (v === '' || v === null || v === undefined) return undefined;
  if (typeof v === 'object') { const n = v.number; return Number.isFinite(n) && n >= 0 ? Math.round((n > 0 && n <= 1 ? n * 100 : n) * 100) / 100 : null; }   // célula de % do Excel guarda 0,5 para 50%
  const t = String(v).replace(/%|\s/g, '').replace(',', '.');
  if (!t || t === '-') return undefined;
  return /^\d+(\.\d+)?$/.test(t) && Number(t) <= 1000 ? Math.round(Number(t) * 100) / 100 : null;
}
const str = v => typeof v === 'object' && v ? String(v.number) : String(v ?? '').trim();

function parse(fileName, data) {
  const buf = Buffer.from(String(data || ''), 'base64');
  if (!buf.length) fail('Arquivo vazio.');
  if (buf.length > 3 * 1024 * 1024) fail('Arquivo muito grande (máximo 3 MB).');
  const isZip = buf.readUInt32LE(0) === 0x04034b50;
  if (/\.xls$/i.test(fileName) && !isZip) fail('Formato .xls antigo não é suportado. No Excel, use Salvar como > Pasta de Trabalho do Excel (.xlsx) ou CSV.');
  const rows = isZip ? readXlsx(buf) : readCsv(buf), col = detect(rows), out = [];
  for (const r of rows.slice(col.header + 1)) {
    const get = k => col[k] === undefined ? '' : r.cells[col[k]];
    if (['code', 'name', 'category', 'cost', 'price', 'margin', 'barcode', 'stock'].every(k => str(get(k)) === '')) continue;
    out.push({line: r.line, code: str(get('code')), name: str(get('name')), category: str(get('category')), costRaw: str(get('cost')), priceRaw: str(get('price')), marginRaw: str(get('margin')), barcode: str(get('barcode')), stockRaw: str(get('stock')), ncm: str(get('ncm')).replace(/\D/g, ''), cfop: str(get('cfop')).replace(/\D/g, ''), cst: str(get('cst')).replace(/\D/g, ''),
      costCents: money(get('cost')), priceCents: money(get('price')), margin: percent(get('margin')), stock: (() => { const s = get('stock'); if (s === '' || s === undefined) return undefined; const n = Number(str(s).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null; })()});
    if (out.length > MAX_ROWS) fail('A planilha tem mais de ' + MAX_ROWS + ' linhas.');
  }
  return {columns: Object.fromEntries(Object.entries(col).filter(([k]) => k !== 'header')), rows: out};
}

function validate(store, rows) {
  const active = store.state.products.filter(p => p.active), seen = new Set();
  return rows.map(r => {
    const item = {...r, name: String(r.name || '').trim().slice(0, 100), category: String(r.category || '').trim().slice(0, 60), code: String(r.code || '').trim().slice(0, 200), barcode: String(r.barcode || '').trim().slice(0, 200)};
    const byCode = item.code && /^\d+$/.test(item.code) ? active.find(p => String(p.code) === item.code) : null;
    const byBar = active.find(p => p.barcode && (p.barcode === item.barcode || (!byCode && p.barcode === item.code)));
    const target = byCode || byBar || (item.name ? active.find(p => p.name.toLowerCase() === item.name.toLowerCase()) : null);
    if (!target && !item.barcode && item.code && !/^\d+$/.test(item.code)) item.barcode = item.code;           // código do sistema antigo vira código de barras
    if (!target && !item.barcode && item.code && /^\d+$/.test(item.code) && item.code.length >= 6) item.barcode = item.code; // EAN numérico
    const key = (target ? 'id:' + target.id : 'nome:' + item.name.toLowerCase());
    if (!item.name && !target) item.error = 'Nome do produto vazio.';
    else if (item.costCents === null) item.error = 'Custo não reconhecido: "' + r.costRaw + '".';
    else if (item.priceCents === null) item.error = 'Preço de venda não reconhecido: "' + r.priceRaw + '".';
    else if (item.margin === null) item.error = 'Margem não reconhecida: "' + r.marginRaw + '" (use 50 ou 50%).';
    else if (item.stock === null) item.error = 'Estoque não reconhecido: "' + r.stockRaw + '".';
    else if (item.ncm && !/^\d{8}$/.test(item.ncm)) item.error = 'NCM inválido (8 dígitos).';
    else if (item.cfop && !/^\d{4}$/.test(item.cfop)) item.error = 'CFOP inválido (4 dígitos).';
    else if (item.cst && !/^\d{2,3}$/.test(item.cst)) item.error = 'CST/CSOSN inválido (2 ou 3 dígitos).';
    else if (item.barcode && !BARCODE.test(item.barcode)) item.error = 'Código de barras inválido.';
    else if (item.barcode && active.some(p => p.barcode === item.barcode && p.id !== target?.id)) item.error = 'Código de barras já usado em outro produto.';
    else if (seen.has(key)) item.error = 'Produto repetido na planilha.';
    else {
      const cost = item.costCents ?? target?.costCents ?? 0, margin = item.margin !== undefined ? item.margin : (item.priceCents !== undefined ? null : target?.marginPercent ?? null);
      const price = margin !== null && margin !== undefined ? marginPrice(cost, margin) : item.priceCents ?? target?.priceCents;
      if (!price || price < 1) item.error = 'Informe o preço de venda ou a margem (com custo maior que zero).';
      else Object.assign(item, {finalCost: cost, finalMargin: margin ?? null, finalPrice: price, finalCategory: item.category || target?.category || 'Sem categoria'});
    }
    seen.add(key);
    item.status = item.error ? 'error' : target ? 'update' : 'new';
    if (target) item.target = {id: target.id, code: target.code, name: target.name};
    return item;
  });
}

function importProducts(store, rows, actor) {
  if (!Array.isArray(rows) || !rows.length) fail('Nenhuma linha para importar.');
  if (rows.length > MAX_ROWS) fail('Muitas linhas.');
  const checked = validate(store, rows.map(r => ({line: Number(r.line) || 0, code: r.code, name: r.name, category: r.category, barcode: r.barcode, ncm: String(r.ncm || '').replace(/\D/g, ''), cfop: String(r.cfop || '').replace(/\D/g, ''), cst: String(r.cst || '').replace(/\D/g, ''), costRaw: r.costRaw, priceRaw: r.priceRaw, marginRaw: r.marginRaw, stockRaw: r.stockRaw,
    costCents: r.costCents === null ? null : r.costCents === undefined || r.costCents === '' ? undefined : Number(r.costCents), priceCents: r.priceCents === null ? null : r.priceCents === undefined || r.priceCents === '' ? undefined : Number(r.priceCents),
    margin: r.margin === null ? null : r.margin === undefined || r.margin === '' ? undefined : Number(r.margin), stock: r.stock === null ? null : r.stock === undefined || r.stock === '' ? undefined : Number(r.stock)})));
  const ok = checked.filter(r => r.status === 'new' || r.status === 'update');
  if (!ok.length) fail('Nenhum produto válido para importar.');
  const created = ok.filter(r => r.status === 'new').length, updated = ok.length - created;
  store.change(actor, 'produto', `Importação de produtos: ${created} novo(s), ${updated} atualizado(s)`, () => {
    const s = store.state, now = Date.now();
    for (const r of ok) {
      if (!s.categories.includes(r.finalCategory)) s.categories.push(r.finalCategory);
      let p = r.target ? s.products.find(x => x.id === r.target.id) : null;
      if (!p) { p = {id: id(), createdAt: now, active: true, code: ++s.productSequence, stock: 0, barcode: ''}; s.products.push(p); }
      const before = p.stock || 0, stock = r.stock !== undefined ? r.stock : before;
      Object.assign(p, {name: r.name || p.name, category: r.finalCategory, costCents: r.finalCost, marginPercent: r.finalMargin, priceCents: r.finalPrice, barcode: r.barcode || p.barcode || '', stock, active: true, example: false, updatedAt: now});
      const fis = Object.fromEntries(['ncm', 'cfop', 'cst'].filter(k => r[k]).map(k => [k, r[k]])); if (Object.keys(fis).length) p.fiscal = {...(p.fiscal || {}), ...fis};
      if (stock !== before || r.status === 'new') (s.stockMoves ??= []).push({id: id(), at: now, actor, productId: p.id, productName: p.name, type: r.status === 'new' ? 'cadastro' : 'ajuste', qty: stock - before, stockAfter: stock, reason: 'Importação de planilha'});
    }
    return null;
  });
  return {created, updated, errors: checked.filter(r => r.status === 'error').length, rows: checked};
}
module.exports = {parse, validate, importProducts, money, percent};
