'use strict';
// 1.0.8 (plano Pro): Produtos/Serviços › Notas Fiscais — entrada de mercadoria pelo XML da NF-e do fornecedor.
let nfeData = null, nfeStatus = '', nfeSearch = '';
const NFE_STATUS = {pending: ['Aguardando entrada', 'gold'], posted: ['Entrada feita', 'on'], cancelled: ['Cancelada', 'red'], discarded: ['Descartada', '']};
const nfeBadge = s => { const [t, c] = NFE_STATUS[s] || [s, '']; return `<span class="badge ${c}">${esc(t)}</span>`; };
const nfeKey = k => String(k || '').replace(/(\d{4})(?=\d)/g, '$1 ');
const nfeQty = (q, u) => `${Number(q).toLocaleString('pt-BR', {maximumFractionDigits: 4})} ${esc(u || '')}`;

async function renderNfe() {
  const node = $('#view');
  $('#view-title').textContent = 'Produtos e Serviços';
  if (!state.pro) { node.innerHTML = `<div class="shop-area">${gzTabs('produtos')}<div class="panel"><h2>Notas Fiscais</h2><p class="hint">Recurso do plano Pro. Assine o Pro em gamezoney.com e clique em Atualizar plano em Configuração › Licença.</p></div></div>`; return; }
  if (!isAdmin()) { node.innerHTML = '<div class="empty">Esta área é reservada ao administrador.</div>'; return; }
  const q = new URLSearchParams(); if (nfeStatus) q.set('status', nfeStatus); if (nfeSearch) q.set('search', nfeSearch);
  nfeData = await api('/nfe?' + q); if (view !== 'nfe') return;
  const S = nfeData.summary, card = (t, v, h) => `<div class="stat"><span>${t}</span><strong>${v}</strong>${h ? `<small>${h}</small>` : ''}</div>`;
  node.innerHTML = `<div class="shop-area">${gzTabs('produtos')}
    <div class="stats">${card('Aguardando entrada', S.pending)}${card('Entradas no mês', S.postedMonth, money(S.postedMonthCents))}${card('Fornecedores', S.suppliers)}${card('Canceladas', S.cancelled)}</div>
    <div class="panel"><div class="toolbar"><div><h2>Notas fiscais de entrada</h2><p class="hint">Importe o XML da nota do fornecedor. Os itens são vinculados sozinhos pelo código de barras ou pelo vínculo já usado; os que faltarem pedem o código do produto. Ao dar entrada, o estoque e o preço de custo são atualizados.</p></div>
      <button class="primary" type="button" id="nfe-pick" style="flex:0 0 auto">+ Importar XML da nota</button><input type="file" accept=".xml,text/xml,application/xml" multiple hidden id="nfe-file"></div>
      <div class="filters"><input id="nfe-search" placeholder="Número, fornecedor, CNPJ ou chave" value="${esc(nfeSearch)}"><select id="nfe-status"><option value="">Todas</option>${Object.entries(NFE_STATUS).map(([k, [t]]) => `<option value="${k}" ${nfeStatus === k ? 'selected' : ''}>${t}</option>`).join('')}</select><button id="nfe-filter">Filtrar</button></div>
      <div class="table-wrap"><table><thead><tr><th>Nota</th><th>Fornecedor</th><th>Emissão</th><th>Itens</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
      ${nfeData.entries.map(e => `<tr><td>nº ${esc(e.number)}${e.series ? '/' + esc(e.series) : ''}${e.authorized ? '' : '<small class="subtext">sem protocolo de autorização no XML</small>'}</td><td>${esc(e.supplier.name)}<small class="subtext">${esc(e.supplier.cnpj)}</small></td><td>${e.issuedAt ? datetime(e.issuedAt) : '—'}</td>
        <td>${e.status === 'pending' ? `${e.linked}/${e.itemCount} vinculados` : e.itemCount}</td><td>${money(e.totalCents)}</td><td>${nfeBadge(e.status)}${e.cancelReason ? `<small class="subtext">${esc(e.cancelReason)}</small>` : ''}</td>
        <td class="actions-cell"><button data-nfe-open="${e.id}">${e.status === 'pending' ? 'Vincular e dar entrada' : 'Ver'}</button>${e.status === 'pending' ? `<button class="ghost" data-nfe-discard="${e.id}">Descartar</button>` : e.status === 'posted' ? `<button class="danger" data-nfe-cancel="${e.id}">Cancelar entrada</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7">Nenhuma nota importada.</td></tr>'}
      </tbody></table></div></div></div>`;
  $('#nfe-filter').onclick = () => { nfeSearch = $('#nfe-search').value.trim(); nfeStatus = $('#nfe-status').value; renderNfe().catch(e => toast(e.message)); };
  $('#nfe-search').onkeydown = e => { if (e.key === 'Enter') $('#nfe-filter').click(); };
  $('#nfe-pick').onclick = () => $('#nfe-file').click();
  $('#nfe-file').onchange = async e => {
    const files = [...e.target.files]; e.target.value = ''; let last = null;
    for (const f of files) {
      try { if (f.size > 2 * 1024 * 1024) throw Error('Arquivo muito grande (máximo 2 MB).'); last = await api('/nfe/import', {fileName: f.name, xml: await f.text()}); toast(`Nota nº ${last.number} importada: ${last.linked} de ${last.items.length} itens vinculados.`); }
      catch (err) { toast(`${f.name}: ${err.message}`); }
    }
    await renderNfe(); if (last && files.length === 1) nfeOpen(last.id);
  };
  node.querySelectorAll('[data-nfe-open]').forEach(b => b.onclick = () => nfeOpen(b.dataset.nfeOpen));
  node.querySelectorAll('[data-nfe-discard]').forEach(b => b.onclick = async () => {
    const e = nfeData.entries.find(x => x.id === b.dataset.nfeDiscard);
    if (!await ask(`Descartar a nota nº ${e.number} de ${e.supplier.name}? Nada entra no estoque.`, {ok: 'Descartar'})) return;
    try { await api('/nfe/cancel', {id: e.id}); toast('Nota descartada.'); } catch (err) { toast(err.message); } renderNfe().catch(x => toast(x.message));
  });
  node.querySelectorAll('[data-nfe-cancel]').forEach(b => b.onclick = () => nfeCancel(nfeData.entries.find(x => x.id === b.dataset.nfeCancel)));
}

// detalhe da nota: vincular cada item pelo código do produto e dar entrada
async function nfeOpen(entryId) {
  let e;
  try { e = await api('/nfe/entry?id=' + encodeURIComponent(entryId)); } catch (err) { return toast(err.message); }
  const pending = e.status === 'pending', missing = e.items.filter(i => !i.product || (i.pack && !i.factorSet)).length;
  const how = {ean: 'pelo código de barras', anterior: 'vínculo já usado', manual: 'pelo código'};
  modal(`Nota fiscal nº ${e.number}${e.series ? '/' + e.series : ''}`, `<div class="nfe-detail">
    <p class="hint"><strong>${esc(e.supplier.name)}</strong> • CNPJ ${esc(e.supplier.cnpj)} • emitida em ${e.issuedAt ? datetime(e.issuedAt) : '—'} • ${money(e.totalCents)}<br>Chave: ${esc(nfeKey(e.key))}</p>
    ${pending ? `<p class="hint">${missing ? `<strong style="color:#ff8793">Faltam ${missing} ${missing === 1 ? 'item' : 'itens'} para vincular ou converter em UN.</strong> Digite o código do produto (coluna Cód. em Gerenciamento de Produtos) ou o código de barras e clique em Vincular. Se o produto não existir, cadastre-o primeiro.` : '<strong style="color:var(--green)">Todos os itens estão vinculados.</strong> Confira as quantidades e clique em Dar entrada no estoque.'} "Un. por embalagem": quantas unidades vêm em cada item da nota (ex.: caixa com 12).</p>` : ''}
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Item da nota</th><th>Qtd.</th><th>Valor</th><th>Produto no sistema</th>${pending ? '<th>Código / Un. por embalagem</th>' : '<th>Entrou no estoque</th>'}</tr></thead><tbody>
    ${e.items.map(i => `<tr><td>${i.n}</td><td>${esc(i.name)}<small class="subtext">Cód. fornecedor ${esc(i.code)}${i.ean ? ' • EAN ' + esc(i.ean) : ''}</small></td><td>${nfeQty(i.qty, i.unit)}</td><td>${money(i.totalCents)}</td>
      <td>${i.product ? `${esc(i.product.name)}<small class="subtext">cód. ${i.product.code}${i.auto ? ' • ' + (how[i.auto] || '') : ''} • estoque ${i.product.stock} un</small>` : '<span class="badge red">SEM VÍNCULO</span>'}</td>
      ${pending ? `<td><div class="nfe-link"><input data-nfe-code="${i.n}" placeholder="Cód. do produto" value="${i.product ? i.product.code : ''}" inputmode="numeric" maxlength="48">${i.pack ? `<label class="nfe-factor"><input data-nfe-factor="${i.n}" type="number" min="1" max="10000" step="1" value="${i.factorSet ? i.factor : ''}" placeholder="?" title="Unidades por embalagem" required> <span>UN por ${esc(i.unit)}</span></label>` : `<input data-nfe-factor="${i.n}" type="number" min="1" max="10000" step="1" value="${i.factor || 1}" title="Unidades por embalagem">`}<button data-nfe-link="${i.n}">Vincular</button></div>${i.pack && !i.factorSet ? `<small class="subtext" style="color:#ffb84d">Converter ${esc(i.unit)} em UN: informe quantas unidades vêm em cada ${esc(i.unit)}</small>` : `<small class="subtext">entra: ${Number(i.units).toLocaleString('pt-BR')} un</small>`}</td>`
        : `<td>${(e.moves || []).filter(m => m.productId === i.productId).map(m => `+${m.qty} un • custo ${money(m.costAfter)}`).join('<br>') || '—'}</td>`}</tr>`).join('')}
    </tbody></table></div>
    ${e.status === 'posted' ? `<p class="hint">Entrada feita em ${datetime(e.postedAt)} por ${esc(e.postedBy)}.</p>` : ''}${e.status === 'cancelled' ? `<p class="hint">Cancelada em ${datetime(e.cancelledAt)} por ${esc(e.cancelledBy)}. Motivo: ${esc(e.cancelReason)}${(e.shortfall || []).length ? '<br>' + e.shortfall.map(esc).join('<br>') : ''}</p>` : ''}
    <div class="dialog-actions">${pending ? `<button class="primary" id="nfe-post" ${missing ? 'disabled' : ''}>Dar entrada no estoque</button>` : ''}${e.status === 'posted' ? '<button class="danger" id="nfe-cancel">Cancelar entrada</button>' : ''}</div></div>`);
  const body = $('#modal-body');
  body.querySelectorAll('[data-nfe-link]').forEach(b => b.onclick = async () => {
    const n = b.dataset.nfeLink; b.disabled = true; $('#modal-error').textContent = '';
    try { await api('/nfe/link', {id: e.id, n: Number(n), code: body.querySelector(`[data-nfe-code="${n}"]`).value.trim(), factor: body.querySelector(`[data-nfe-factor="${n}"]`).value}); await nfeOpen(e.id); }
    catch (err) { $('#modal-error').textContent = err.message; b.disabled = false; }
  });
  body.querySelectorAll('[data-nfe-code]').forEach(inp => inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); body.querySelector(`[data-nfe-link="${inp.dataset.nfeCode}"]`).click(); } });
  const postBtn = $('#nfe-post');
  if (postBtn) postBtn.onclick = async () => {
    if (!await ask(`Dar entrada da nota nº ${e.number} (${e.items.length} itens, ${money(e.totalCents)})? O estoque e o preço de custo dos produtos serão atualizados.`, {ok: 'Dar entrada'})) return nfeOpen(e.id);
    try { await api('/nfe/post', {id: e.id}); toast('Entrada feita: estoque atualizado.'); $('#modal').close(); } catch (err) { toast(err.message); return nfeOpen(e.id); }
    renderNfe().catch(x => toast(x.message));
  };
  const cancelBtn = $('#nfe-cancel'); if (cancelBtn) cancelBtn.onclick = () => nfeCancel(e);
}

// cancelar uma entrada já feita: motivo + senha do administrador que está cancelando
function nfeCancel(e) {
  modal('Cancelar entrada da nota', `<form><p class="hint">Nota nº ${esc(e.number)} de <strong>${esc(e.supplier.name)}</strong> (${money(e.totalCents)}). O estoque que entrou com esta nota é retirado e o preço de custo volta ao anterior. Fica registrado no Log com o seu usuário.</p>
    <label>Motivo do cancelamento<textarea name="reason" required minlength="5" maxlength="300" rows="3" placeholder="Ex.: nota lançada em duplicidade, mercadoria devolvida ao fornecedor"></textarea></label>
    <label>Senha do administrador<input name="authPassword" type="text" data-secret autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" required maxlength="128"></label>
    <button class="danger">Cancelar entrada</button></form>`);
  formAction(async d => { await api('/nfe/cancel', {id: e.id, reason: d.reason, authPassword: d.authPassword}); if (view === 'nfe') renderNfe().catch(x => toast(x.message)); });
}
