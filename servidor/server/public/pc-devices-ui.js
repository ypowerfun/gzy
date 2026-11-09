'use strict';
// 1.0.9: Ligar computadores (Wake-on-LAN), fila de impressões no Painel de controle, Configuração › Controle de impressão
// e Configuração › Boot pela rede (diskless).
const PAY_LABEL = {cash: 'Dinheiro', pix: 'Pix', card: 'Cartão'};
function printQueueHtml() {
  const list = state?.prints || [];
  if (!state?.printControl && !list.length) return '';
  if (!list.length) return '';
  return `<div class="panel print-queue"><div class="toolbar"><div><h2>Impressões aguardando aprovação (${list.length})</h2><p class="hint">Nada é impresso sem a sua aprovação. Recusar apaga o documento da fila do PC.</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>PC</th><th>Cliente</th><th>Documento</th><th>Páginas</th><th>Impressora</th><th>Enviado</th><th>Ações</th></tr></thead><tbody>
    ${list.map(j => `<tr><td>${esc(j.stationName)}</td><td>${esc(j.nick || '—')}</td><td>${esc(j.document)}</td><td>${j.pages ? j.pages + (j.copies > 1 ? ' × ' + j.copies : '') : (j.spooling ? 'preparando…' : '?')}</td><td>${esc(j.printer)}</td><td>${datetime(j.at)}</td>
      <td class="actions-cell"><button class="primary" data-print-charge="${esc(j.key)}">Aprovar e cobrar</button><button data-print-approve="${esc(j.key)}">Aprovar</button><button class="danger" data-print-reject="${esc(j.key)}">Recusar</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
}
async function printCharge(job) {
  const shop = await api('/shop'), conf = (await api('/prints')).settings || {};
  const services = shop.services; if (!services.length) throw new Error('Cadastre o serviço Impressão em Gerenciamento de Serviços.');
  const def = services.find(s => s.id === conf.serviceId) || services.find(s => /impress/i.test(s.name)) || services[0];
  const qty = Math.max(1, (job.pages || 1) * (job.copies || 1));
  modal('Aprovar e cobrar impressão', `<form><p class="hint"><strong>${esc(job.document)}</strong> • ${esc(job.stationName)}${job.nick ? ' • ' + esc(job.nick) : ''}</p>
    <div class="row"><label>Serviço<select name="serviceId">${services.map(s => `<option value="${esc(s.id)}" data-price="${s.priceCents}" ${s.id === def.id ? 'selected' : ''}>${esc(s.name)} — ${money(s.priceCents)}</option>`).join('')}</select></label><label>Quantidade (páginas)<input name="qty" type="number" min="1" max="100000" step="1" value="${qty}" required></label></div>
    <label>Forma de pagamento<select name="paymentMethod">${Object.entries(PAY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <p class="hint">Total: <strong id="print-total"></strong> (entra no caixa como venda do PDV)</p><button class="primary">Aprovar e cobrar</button></form>`);
  const form = $('#modal-body form'), total = () => { const o = form.serviceId.selectedOptions[0]; $('#print-total').textContent = money(Number(o.dataset.price) * Math.max(0, Number(form.qty.value) || 0)); };
  form.serviceId.onchange = total; form.qty.oninput = total; total();
  formAction(d => api('/prints/decide', {key: job.key, action: 'approve', charge: true, serviceId: d.serviceId, qty: Number(d.qty), paymentMethod: d.paymentMethod}));
}
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-print-approve],[data-print-reject],[data-print-charge],[data-pc-wake]'); if (!t) return;
  try {
    if (t.dataset.pcWake) {
      const scope = t.dataset.pcWake, stationId = scope === 'one' ? ($('#pc-action-station')?.value || '') : '';
      if (scope === 'one' && !stationId) throw new Error('Escolha um computador específico.');
      if (!await ask(scope === 'all' ? 'Ligar todos os computadores desligados pela rede?' : 'Ligar o computador selecionado pela rede?', {ok: 'Ligar'})) return;
      t.disabled = true;
      try { const r = await api('/pc/wake', {scope, stationId}); const box = $('#pc-action-result'); if (box) box.innerHTML = `<p><strong>${r.success} sinal(is) para ligar enviado(s)</strong>${r.skipped ? ` · ${r.skipped} já ligado(s)` : ''}${r.failed ? ` · ${r.failed} sem MAC` : ''}</p><ul>${r.results.map(x => `<li><strong>${esc(x.name)}</strong>: ${x.ok ? '✓' : '✕'} ${esc(x.message)}</li>`).join('') || '<li>Nenhum computador cadastrado.</li>'}</ul>`; toast('Sinal enviado. O PC leva alguns segundos para ligar.'); }
      finally { t.disabled = false; }
      return;
    }
    const key = t.dataset.printApprove || t.dataset.printReject || t.dataset.printCharge, job = (state.prints || []).find(j => j.key === key); if (!job) return;
    if (t.dataset.printCharge) return await printCharge(job);
    const approve = !!t.dataset.printApprove;
    if (!await ask(approve ? `Aprovar a impressão de "${job.document}" (${job.pages || '?'} pág.) sem cobrar?` : `Recusar a impressão de "${job.document}"? O documento é apagado da fila do PC.`, {ok: approve ? 'Aprovar' : 'Recusar'})) return;
    await api('/prints/decide', {key, action: approve ? 'approve' : 'reject'}); toast(approve ? 'Impressão aprovada: o PC imprime em instantes.' : 'Impressão recusada.'); await refresh(true);
  } catch (err) { toast(err.message); }
});

// ---------- Configuração ----------
function printSettingsSection(data, services) {
  const c = data.settings || {}, sec = document.createElement('section'); sec.id = 'print-section'; sec.className = 'panel';
  sec.innerHTML = `<h2>Controle de impressão</h2><p class="hint">Ligado, todo documento que o cliente manda imprimir fica <strong>parado no PC</strong> até a recepção aprovar no Painel de controle (com ou sem cobrança). Evita desperdício de papel e tinta. Vale para as impressoras instaladas nos PCs, com o GameZoney Cliente atualizado. No modo administrador nada é parado.</p>
    <form id="print-form"><label class="check"><input type="checkbox" name="enabled" ${c.enabled ? 'checked' : ''}> Exigir aprovação da recepção para imprimir</label>
    <label>Serviço usado na cobrança<select name="serviceId"><option value="">Escolher na hora</option>${services.map(s => `<option value="${esc(s.id)}" ${c.serviceId === s.id ? 'selected' : ''}>${esc(s.name)} — ${money(s.priceCents)}</option>`).join('')}</select></label>
    <div class="dialog-actions" style="justify-content:flex-start"><button class="primary" style="flex:0 0 auto">Salvar</button></div></form>
    ${(data.history || []).length ? `<h3 style="margin-top:18px">Últimas impressões</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>PC</th><th>Documento</th><th>Páginas</th><th>Situação</th><th>Por</th></tr></thead><tbody>${data.history.slice(0, 20).map(h => `<tr><td>${datetime(h.decidedAt)}</td><td>${esc(h.stationName)}</td><td>${esc(h.document)}</td><td>${h.pages || '?'}</td><td>${esc(h.result)}${h.cents ? ' • ' + money(h.cents) : ''}</td><td>${esc(h.by)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  sec.querySelector('#print-form').onsubmit = async e => { e.preventDefault(); const b = e.submitter; b.disabled = true; try { await api('/prints/settings', {enabled: e.target.enabled.checked, serviceId: e.target.serviceId.value}); toast(e.target.enabled.checked ? 'Controle de impressão ligado.' : 'Controle de impressão desligado.'); await refresh(true); } catch (err) { toast(err.message); } finally { b.disabled = false; } };
  return sec;
}
function disklessSection(d) {
  const c = d.config, sec = document.createElement('section'); sec.id = 'diskless-section'; sec.className = 'panel';
  sec.innerHTML = `<h2>Boot pela rede (diskless)</h2><p class="hint">Pré-configuração para PCs sem disco que carregam o Windows de um <strong>servidor de imagem</strong> na rede (iSCSI + PXE, instalado à parte). O GameZoney Cliente vai instalado dentro da imagem. Com o Wake-on-LAN, "Ligar todos" (Ações dos computadores) liga os PCs e eles dão boot pela rede.</p>
    <div>${d.checks.map(x => `<div class="balance"><span><i aria-hidden="true" style="font-style:normal">${x.ok ? '✅' : '⚠️'}</i> ${esc(x.name)}</span><strong style="color:${x.ok ? 'var(--green)' : '#ffb84d'};font-weight:600;font-size:13px;text-align:right">${esc(x.detail)}</strong></div>`).join('')}</div>
    <form id="diskless-form" class="am-form"><label class="check"><input type="checkbox" name="enabled" ${c.enabled ? 'checked' : ''}> Usar boot pela rede nesta arena</label>
    <div class="row"><label>Sistema do servidor de imagem<select name="product">${Object.entries(d.products).map(([k, v]) => `<option value="${k}" ${c.product === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label><label>IP do servidor de imagem<input name="serverIp" maxlength="15" placeholder="192.168.0.10" value="${esc(c.serverIp)}"></label><label>Porta iSCSI<input name="port" type="number" min="1" max="65535" value="${c.port || 3260}"></label></div>
    <div class="row"><label>IP do servidor PXE (se for outro)<input name="pxeIp" maxlength="15" placeholder="igual ao servidor de imagem" value="${esc(c.pxeIp)}"></label><label>Nome da imagem<input name="image" maxlength="80" placeholder="Ex.: Windows11-Jogos" value="${esc(c.image)}"></label></div>
    <h3>PCs que dão boot pela rede</h3><div class="diskless-pcs">${d.computers.map(p => `<label class="check"><input type="checkbox" name="pc" value="${esc(p.id)}" ${c.stations.includes(p.id) ? 'checked' : ''}> ${esc(p.name)} <small class="subtext">${p.mac ? p.mac.match(/../g).join(':') : 'sem MAC ainda'}</small></label>`).join('') || '<p class="hint">Nenhum computador cadastrado.</p>'}</div>
    <label>Observações (sem senhas)<textarea name="notes" maxlength="600" rows="2">${esc(c.notes)}</textarea></label>
    <div class="dialog-actions" style="justify-content:flex-start"><button class="primary" style="flex:0 0 auto">Salvar e conferir</button></div><p class="error" id="diskless-error"></p></form>`;
  sec.querySelector('#diskless-form').onsubmit = async e => {
    e.preventDefault(); const f = e.target, b = e.submitter; b.disabled = true; sec.querySelector('#diskless-error').textContent = '';
    try { const r = await api('/diskless', {enabled: f.enabled.checked, product: f.product.value, serverIp: f.serverIp.value.trim(), port: Number(f.port.value), pxeIp: f.pxeIp.value.trim(), image: f.image.value, notes: f.notes.value, stations: [...f.querySelectorAll('[name=pc]:checked')].map(x => x.value)}); sec.replaceWith(disklessSection(r)); toast('Salvo.'); }
    catch (err) { sec.querySelector('#diskless-error').textContent = err.message; b.disabled = false; }
  };
  return sec;
}
(function () {
  const original = renderSettings;
  renderSettings = function () {
    original.apply(this, arguments);
    if (!isAdmin()) return;
    Promise.all([api('/prints'), api('/shop'), api('/diskless')]).then(([p, shop, d]) => {
      if (view !== 'settings') return; $('#print-section')?.remove(); $('#diskless-section')?.remove();
      const ps = printSettingsSection(p, shop.services), ds = disklessSection(d), anchor = $('#net-section');
      if (anchor) { anchor.after(ps); ps.after(ds); } else { $('#view').append(ps); $('#view').append(ds); }
    }).catch(() => {});
  };
})();
