'use strict';
// 1.0.8 (plano Pro): Notas fiscais de ENTRADA (compras dos fornecedores) para repor o estoque.
//  - Importa o XML da NF-e (nfeProc/NFe, versão 4.00) que o fornecedor envia. Lido sem bibliotecas externas e sem
//    interpretar DTD/entidades externas (só texto entre as tags).
//  - Cada item é ligado a um produto do sistema: sozinho pelo vínculo já usado antes (CNPJ do fornecedor + código dele),
//    pelo código de barras (EAN) ou, se não achar, o gestor digita o CÓDIGO DO PRODUTO (ou o código de barras).
//  - "Dar entrada" só com todos os itens vinculados: soma o estoque (quantidade × unidades por embalagem) e atualiza o
//    preço de custo. Cancelar uma entrada já lançada pede MOTIVO e a SENHA do administrador e desfaz o estoque.
const {id, fail, verify} = require('./store');

const MAX_XML = 2 * 1024 * 1024;
const ENT = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
const decode = v => String(v ?? '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()]).trim();
const tag = (xml, name) => { const m = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml || ''); return m ? decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')) : ''; };
const block = (xml, name) => { const m = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml || ''); return m ? m[1] : ''; };
const num = v => { const n = Number(String(v || '0').trim()); return Number.isFinite(n) ? n : 0; };
const cents = v => Math.round(num(v) * 100);
const validEan = v => /^\d{8}$|^\d{12,14}$/.test(v || '');
// unidade de embalagem (CX, PCT, FD, DZ...): pede quantas UN vêm em cada uma antes de dar entrada
const UNIT_LIKE = new Set(['UN', 'UND', 'UNID', 'UNIDADE', 'U', 'UNI', 'PC', 'PÇ', 'PCA', 'PEÇA', 'PECA', 'LT', 'LATA', 'GF', 'GARRAFA', 'KG', 'G', 'L', 'ML', 'M', 'MT']);
const isPack = unit => !UNIT_LIKE.has(String(unit || '').toUpperCase().replace(/[^A-ZÇ]/g, ''));

function parse(xmlText) {
  const xml = String(xmlText ?? '');
  if (!xml.trim()) fail('Escolha o arquivo XML da nota fiscal.');
  if (Buffer.byteLength(xml) > MAX_XML) fail('Arquivo XML muito grande (máximo 2 MB).');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail('Arquivo XML não aceito.');
  const inf = /<(?:\w+:)?infNFe\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?infNFe>/.exec(xml);
  if (!inf) fail('Este arquivo não é o XML de uma NF-e (nota fiscal eletrônica de produtos).');
  const key = (/Id\s*=\s*"NFe(\d{44})"/.exec(inf[1]) || [])[1] || tag(xml, 'chNFe');
  if (!/^\d{44}$/.test(key || '')) fail('Chave de acesso da nota não encontrada no XML.');
  const body = inf[2], ide = block(body, 'ide'), emit = block(body, 'emit'), tot = block(block(body, 'total'), 'ICMSTot');
  const items = [];
  const re = /<(?:\w+:)?det\b[^>]*nItem\s*=\s*"(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/g; let m;
  while ((m = re.exec(body))) {
    const p = block(m[2], 'prod'), qty = num(tag(p, 'qCom'));
    const ean = [tag(p, 'cEAN'), tag(p, 'cEANTrib')].find(validEan) || '';
    const gross = cents(tag(p, 'vProd')), discount = cents(tag(p, 'vDesc'));
    items.push({n: Number(m[1]), code: tag(p, 'cProd').slice(0, 60), ean, name: tag(p, 'xProd').slice(0, 150) || 'Item ' + m[1], unit: tag(p, 'uCom').slice(0, 10) || 'UN',
      qty, totalCents: Math.max(0, gross - discount), productId: null, factor: 1, pack: isPack(tag(p, 'uCom') || 'UN'), factorSet: false});
  }
  if (!items.length) fail('A nota não tem itens (produtos).');
  if (items.length > 500) fail('Nota com itens demais (máximo 500).');
  const status = tag(block(xml, 'infProt'), 'cStat');
  return {key, number: tag(ide, 'nNF'), series: tag(ide, 'serie'), issuedAt: Date.parse(tag(ide, 'dhEmi') || tag(ide, 'dEmi')) || null, type: tag(ide, 'tpNF'),
    supplier: {cnpj: (tag(emit, 'CNPJ') || tag(emit, 'CPF')).replace(/\D/g, ''), name: (tag(emit, 'xFant') || tag(emit, 'xNome')).slice(0, 120) || 'Fornecedor'},
    totalCents: cents(tag(tot, 'vNF')) || items.reduce((a, i) => a + i.totalCents, 0), authorized: status === '100' || status === '150', protocol: tag(block(xml, 'infProt'), 'nProt'), items};
}

function init(store) { store.state.nfe ??= {entries: [], links: {}}; store.state.nfe.links ??= {}; }
const products = store => store.state.products.filter(p => p.active);
const linkKey = (entry, item) => entry.supplier.cnpj + '|' + item.code;
// vínculo automático: o mesmo item deste fornecedor já foi ligado antes; senão, código de barras igual ao do produto
function autoLink(store, entry) {
  for (const item of entry.items) {
    if (item.productId && products(store).some(p => p.id === item.productId)) continue;
    item.productId = null;
    const saved = store.state.nfe.links[linkKey(entry, item)];
    const byLink = saved && products(store).find(p => p.id === saved.productId);
    const byEan = item.ean && products(store).find(p => p.barcode && p.barcode === item.ean);
    const found = byLink || byEan;
    if (found) { item.productId = found.id; item.factor = byLink ? saved.factor || 1 : item.factor || 1; item.auto = byLink ? 'anterior' : 'ean'; if (byLink && saved.factorSet !== false) item.factorSet = true; }
  }
}
const find = (store, entryId) => (store.state.nfe.entries.find(e => e.id === String(entryId || '')) || fail('Nota não encontrada.'));
const units = item => item.qty * (item.factor || 1);
const label = e => `NF-e nº ${e.number || '?'}${e.series ? '/' + e.series : ''} • ${e.supplier.name}`;

function importXml(store, input, actor) {
  init(store);
  const data = parse(input.xml);
  const dup = store.state.nfe.entries.find(e => e.key === data.key && e.status !== 'cancelled' && e.status !== 'discarded');
  if (dup) fail(`Esta nota já foi importada (${label(dup)}).`);
  const entry = {id: id(), ...data, status: 'pending', importedAt: Date.now(), importedBy: actor, fileName: String(input.fileName || '').slice(0, 120)};
  autoLink(store, entry);
  return store.change(actor, 'nota', `Nota fiscal importada: ${label(entry)} • ${entry.items.length} itens • R$ ${(entry.totalCents / 100).toFixed(2)}`, () => { store.state.nfe.entries.push(entry); return view(store, entry); });
}

// liga um item ao produto pelo CÓDIGO DO PRODUTO (ou código de barras); "factor" = unidades por embalagem da nota
function link(store, input, actor) {
  const entry = find(store, input.id); if (entry.status !== 'pending') fail('Só dá para vincular itens de notas que ainda não tiveram entrada.');
  const item = entry.items.find(i => i.n === Number(input.n)) || fail('Item não encontrado.');
  const code = String(input.code ?? '').trim();
  let product = null;
  if (code) {
    product = products(store).find(p => String(p.code) === code) || products(store).find(p => p.barcode && p.barcode === code);
    if (!product) fail(`Nenhum produto com o código ${code}. Cadastre o produto em Gerenciamento de Produtos e use o código dele.`);
  }
  const factor = input.factor === undefined || input.factor === '' ? item.factor || 1 : Number(input.factor);
  if (!Number.isInteger(factor) || factor < 1 || factor > 10000) fail('Unidades por embalagem: informe um número inteiro de 1 a 10000.');
  return store.change(actor, 'nota', product ? `Item ${item.n} (${item.name}) vinculado a ${product.name} (cód. ${product.code})${factor > 1 ? ` • ${factor} un por embalagem` : ''} — ${label(entry)}` : `Vínculo removido do item ${item.n} (${item.name}) — ${label(entry)}`, () => {
    const informed = input.factor !== undefined && input.factor !== '';
    item.productId = product ? product.id : null; item.factor = factor; item.auto = product ? 'manual' : undefined; if (informed) item.factorSet = true;
    if (product) store.state.nfe.links[linkKey(entry, item)] = {productId: product.id, factor, factorSet: !!item.factorSet};
    return view(store, entry);
  });
}

function post(store, input, actor) {
  const entry = find(store, input.id); if (entry.status !== 'pending') fail('Esta nota não está aguardando entrada.');
  autoLink(store, entry);
  const missing = entry.items.filter(i => !i.productId);
  if (missing.length) fail(`Faltam ${missing.length} ${missing.length === 1 ? 'item' : 'itens'} sem produto vinculado. Coloque o código do produto em cada um antes de dar entrada.`);
  const packs = entry.items.filter(i => i.pack && !i.factorSet);
  if (packs.length) fail(`Converta em UN: informe quantas unidades vêm em cada ${packs[0].unit} do item ${packs[0].n} (${packs[0].name})${packs.length > 1 ? ` e em mais ${packs.length - 1} ${packs.length === 2 ? 'item' : 'itens'}` : ''} e clique em Vincular.`);
  for (const i of entry.items) if (!Number.isInteger(Math.round(units(i) * 1000) / 1000) || units(i) <= 0) fail(`Item ${i.n} (${i.name}): a quantidade ${i.qty} × ${i.factor} não dá um número inteiro de unidades. Ajuste as unidades por embalagem.`);
  return store.change(actor, 'nota', `Entrada da nota: ${label(entry)} • ${entry.items.length} itens • R$ ${(entry.totalCents / 100).toFixed(2)}`, () => {
    const now = Date.now(); entry.moves = [];
    for (const i of entry.items) {
      const p = store.state.products.find(x => x.id === i.productId), qty = Math.round(units(i));
      const costBefore = p.costCents, costAfter = Math.round(i.totalCents / qty);
      p.stock += qty; p.costCents = costAfter; p.updatedAt = now;
      (store.state.stockMoves ??= []).push({id: id(), at: now, actor, productId: p.id, productName: p.name, type: 'entrada', qty, stockAfter: p.stock, reason: `Entrada ${label(entry)}`});
      entry.moves.push({productId: p.id, productName: p.name, qty, costBefore, costAfter});
    }
    Object.assign(entry, {status: 'posted', postedAt: now, postedBy: actor});
    return view(store, entry);
  });
}

// pendente: só descarta (ask() no painel). Já lançada: motivo + senha do administrador que está cancelando.
function cancel(store, input, operator, actor) {
  const entry = find(store, input.id);
  if (entry.status === 'pending') return store.change(actor, 'nota', `Nota descartada (sem entrada no estoque): ${label(entry)}`, () => { Object.assign(entry, {status: 'discarded', cancelledAt: Date.now(), cancelledBy: actor}); return view(store, entry); });
  if (entry.status !== 'posted') fail('Esta nota já foi cancelada.');
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 5) fail('Informe o motivo do cancelamento (mínimo 5 caracteres).');
  if (reason.length > 300) fail('O motivo deve ter até 300 caracteres.');
  if (typeof input.authPassword !== 'string' || !input.authPassword || !verify(input.authPassword, operator.hash)) {
    store.log(actor, 'nota', `Cancelamento recusado (senha do administrador incorreta): ${label(entry)}`);
    fail('Senha do administrador incorreta.');
  }
  return store.change(actor, 'nota', `Entrada CANCELADA: ${label(entry)} • motivo: ${reason}`, () => {
    const now = Date.now(), short = [];
    for (const m of entry.moves || []) {
      const p = store.state.products.find(x => x.id === m.productId); if (!p) continue;
      const take = Math.min(p.stock, m.qty); if (take < m.qty) short.push(`${p.name}: faltaram ${m.qty - take} un (já vendidas)`);
      p.stock -= take; if (p.costCents === m.costAfter) p.costCents = m.costBefore; p.updatedAt = now;
      (store.state.stockMoves ??= []).push({id: id(), at: now, actor, productId: p.id, productName: p.name, type: 'cancelamento', qty: -take, stockAfter: p.stock, reason: `Cancelamento ${label(entry)}: ${reason}`});
    }
    Object.assign(entry, {status: 'cancelled', cancelledAt: now, cancelledBy: actor, cancelReason: reason, shortfall: short});
    return view(store, entry);
  });
}

function view(store, e) {
  const byId = new Map(store.state.products.map(p => [p.id, p]));
  return {...e, items: e.items.map(i => { const p = byId.get(i.productId); return {...i, units: units(i), product: p && p.active ? {id: p.id, code: p.code, name: p.name, stock: p.stock, barcode: p.barcode} : null}; }),
    linked: e.items.filter(i => i.productId && byId.get(i.productId)?.active).length};
}
function list(store, q = {}) {
  init(store);
  const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const all = store.state.nfe.entries;
  const posted = all.filter(e => e.status === 'posted');
  const summary = {pending: all.filter(e => e.status === 'pending').length, postedMonth: posted.filter(e => e.postedAt >= monthStart).length,
    postedMonthCents: posted.filter(e => e.postedAt >= monthStart).reduce((a, e) => a + e.totalCents, 0), cancelled: all.filter(e => e.status === 'cancelled').length, suppliers: new Set(posted.map(e => e.supplier.cnpj)).size};
  const status = ['pending', 'posted', 'cancelled', 'discarded'].includes(q.status) ? q.status : '';
  const term = String(q.search || '').trim().toLowerCase();
  const entries = all.filter(e => (!status || e.status === status) && (!term || (e.number + ' ' + e.supplier.name + ' ' + e.supplier.cnpj + ' ' + e.key).toLowerCase().includes(term)))
    .sort((a, b) => b.importedAt - a.importedAt).slice(0, 300).map(e => { const v = view(store, e); delete v.items; return {...v, itemCount: e.items.length}; });
  return {summary, entries, products: products(store).map(p => ({id: p.id, code: p.code, name: p.name, barcode: p.barcode, stock: p.stock}))};
}
const detail = (store, entryId) => { init(store); const e = find(store, entryId); if (e.status === 'pending') autoLink(store, e); return view(store, e); };

module.exports = {init, parse, importXml, link, post, cancel, list, detail};
