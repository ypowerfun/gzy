'use strict';
// 1.1.0: leitor de código de barras e de QR Code (USB ou Bluetooth). Esses leitores funcionam como teclado: "digitam" o
// código muito rápido e apertam Enter. Aqui o painel reconhece o bipe em QUALQUER tela, mesmo sem clicar num campo:
//  - Vendas (PDV): adiciona o produto ao carrinho;
//  - Gerenciamento de Produtos / Estoque: abre o produto para editar (código novo: oferece cadastrar com o código já preenchido);
//  - outras telas: mostra nome, preço e estoque (consulta de preço).
// Dentro de um campo de texto o bipe continua indo para o campo (ex.: busca do PDV, código de barras do cadastro, nota fiscal).
// Acha pelo código de barras/QR Code do produto ou pelo código do produto (Cód.). QR Code com endereço/texto: também
// aceita quando o texto lido TERMINA com o código cadastrado (ex.: https://loja/p/7894900011517).
(function () {
  let buf = '', first = 0, last = 0;
  const MAX_GAP = 60, MIN_LEN = 3;
  const typing = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || typing(document.activeElement)) { buf = ''; return; }
    const now = performance.now();
    if (e.key === 'Enter') {
      const code = buf, fast = code.length >= MIN_LEN && (now - first) / Math.max(1, code.length) < MAX_GAP;
      buf = '';
      if (fast) { e.preventDefault(); e.stopPropagation(); scanned(code.trim()).catch(err => toast(err.message)); }
      return;
    }
    if (e.key.length !== 1) return;
    if (!buf || now - last > MAX_GAP * 2) { buf = ''; first = now; }
    buf += e.key; last = now;
  }, true);

  async function catalog() { if (typeof shopData !== 'undefined' && shopData?.products) return shopData; return await api('/shop'); }
  function find(products, code) {
    const c = code.toLowerCase();
    return products.find(p => p.barcode && p.barcode.toLowerCase() === c) || products.find(p => String(p.code) === code)
      || products.find(p => p.barcode && p.barcode.length >= 6 && c.endsWith(p.barcode.toLowerCase()));
  }
  async function scanned(code) {
    if (!state || !code) return;
    if ($('#modal')?.open) return;                                 // janela aberta: não interfere
    const data = await catalog(), p = find(data.products || [], code);
    const sales = view === 'shop' && typeof shopTab !== 'undefined' && shopTab === 'sales';
    const manage = (view === 'shop' && shopTab === 'products') || (view === 'cash' && typeof cashTab !== 'undefined' && cashTab === 'stock');
    if (sales && typeof addToCart === 'function') {
      if (!p) return toast(`Código ${code} não cadastrado.`);
      if (p.stock <= 0) return toast(`${p.name}: sem estoque.`);
      addToCart({...p, kind: 'product'}); toast(`${p.name} adicionado.`); return;
    }
    if (manage && isAdmin() && typeof shopForm === 'function') {
      if (p) return shopForm('product', p);
      if (await ask(`Código ${code} não cadastrado. Cadastrar um produto com este código?`, {ok: 'Cadastrar'})) shopForm('product', {barcode: code});
      return;
    }
    toast(p ? `${p.name} • ${money(p.priceCents)} • estoque ${p.stock} un • cód. ${p.code}` : `Código ${code} não cadastrado.`);
  }
  window.gzScanner = {find, scanned};
})();
