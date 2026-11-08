'use strict';
// 1.1.0: Gerenciamento de Produtos › Importar planilha (.csv ou .xlsx): Código, Nome, Categoria, Custo, Preço de venda, Margem.
function productsImportDialog() {
  const model = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿Código;Nome;Categoria;Custo;Preço de venda;Margem (%);Código de barras;Estoque\n101;Coca-Cola lata 350ml;Bebidas;3,50;;70;7894900011517;24\n102;Pin Free Fire 100;Produtos Virtuais (Pins e Créditos);8,00;10,00;;;\n');
  modal('Importar produtos', `<form id="pimp-form"><p class="hint">Planilha do Excel (.xlsx) ou CSV com as colunas <strong>Código</strong>, <strong>Nome</strong>, <strong>Categoria</strong>, <strong>Custo</strong>, <strong>Preço de venda</strong> e <strong>Margem (%)</strong> (opcionais: <strong>Código de barras</strong> e <strong>Estoque</strong>). Com margem, o preço de venda é calculado (custo + margem, arredondado para cima no real). O produto que já tem o mesmo código, código de barras ou nome é <strong>atualizado</strong>; os outros são <strong>cadastrados</strong>. Categorias novas são criadas. Sem a coluna Estoque, o estoque atual não muda.</p>
    <p><a href="${model}" download="modelo-importacao-produtos.csv">Baixar modelo</a></p><label>Arquivo<input type="file" id="pimp-file" accept=".xlsx,.csv,.txt" required></label><div id="pimp-preview"></div><button class="primary" id="pimp-confirm" disabled>Importar produtos</button></form>`);
  let rows = [];
  $('#pimp-file').onchange = async e => {
    const file = e.target.files[0]; rows = []; $('#pimp-confirm').disabled = true; $('#pimp-preview').innerHTML = '<p class="hint">Lendo a planilha…</p>'; if (!file) return;
    try {
      if (file.size > 3 * 1024 * 1024) throw Error('Arquivo muito grande (máximo 3 MB).');
      const data = btoa(Array.from(new Uint8Array(await file.arrayBuffer()), b => String.fromCharCode(b)).join(''));
      const r = await api('/shop/products/import/preview', {fileName: file.name, data}); rows = r.rows;
      const n = k => rows.filter(x => x.status === k).length;
      $('#pimp-preview').innerHTML = `<p class="hint"><strong>${n('new')} novo(s)</strong> · <strong>${n('update')} atualização(ões)</strong>${n('error') ? ` · <span style="color:#ff8793">${n('error')} com erro (não entram)</span>` : ''}</p>
        <div class="table-wrap" style="max-height:45vh;overflow:auto"><table><thead><tr><th>Linha</th><th>Código</th><th>Nome</th><th>Categoria</th><th>Custo</th><th>Margem</th><th>Preço de venda</th><th>Situação</th></tr></thead><tbody>
        ${rows.map(x => `<tr><td>${x.line}</td><td>${esc(x.code || '')}${x.barcode && x.barcode !== x.code ? `<small class="subtext">${esc(x.barcode)}</small>` : ''}</td><td>${esc(x.name || x.target?.name || '')}</td><td>${esc(x.finalCategory || x.category || '')}</td><td>${x.finalCost != null ? money(x.finalCost) : esc(x.costRaw)}</td><td>${x.finalMargin != null ? String(x.finalMargin).replace('.', ',') + '%' : esc(x.marginRaw || '—')}</td><td>${x.finalPrice ? money(x.finalPrice) : esc(x.priceRaw)}</td>
          <td>${x.status === 'new' ? '<span class="badge on">NOVO</span>' : x.status === 'update' ? `<span class="badge gold">ATUALIZA</span><small class="subtext">cód. ${x.target.code} • ${esc(x.target.name)}</small>` : '<span class="badge red">ERRO</span> ' + esc(x.error)}</td></tr>`).join('')}
        </tbody></table></div>`;
      $('#pimp-confirm').disabled = !rows.some(x => x.status !== 'error');
    } catch (err) { $('#pimp-preview').innerHTML = ''; $('#modal-error').textContent = err.message; }
  };
  $('#pimp-form').onsubmit = async e => {
    e.preventDefault(); const b = $('#pimp-confirm'); b.disabled = true; $('#modal-error').textContent = '';
    try { const r = await api('/shop/products/import', {rows}); $('#modal').close(); toast(`Produtos importados: ${r.created} novo(s), ${r.updated} atualizado(s).`); if (typeof renderShop === 'function' && view === 'shop') await renderShop(); }
    catch (err) { $('#modal-error').textContent = err.message; b.disabled = false; }
  };
}
document.addEventListener('click', e => { if (e.target.closest('[data-products-import]')) productsImportDialog(); });
