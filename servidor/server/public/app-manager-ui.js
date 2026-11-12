'use strict';
// 1.0.8 (plano Pro): Multi-Unidade (Configuração) e a tela Gerenciar App. Só aparecem para quem tem o plano Pro.
// 1.3.8: a aba "Servidor em nuvem" saiu (o app do cliente passa pelo app.gamezoney.com).
function unitsSection(u) {
  const sec = document.createElement('section'); sec.id = 'units-section'; sec.className = 'panel';
  const p = u.preview, last = u.lastSentAt ? new Date(u.lastSentAt).toLocaleString() : 'nunca';
  sec.innerHTML = `<h2>Multi-Unidade <span class="badge gold">PRO</span></h2>
    <p class="hint">Acompanhe o faturamento, o caixa, os PCs em uso e as estatísticas desta loja à distância, pelo celular ou computador, em <strong>gamezoney.com › Minha conta › Unidades</strong>. Ligado, este servidor envia um resumo a cada 5 minutos (não envia nomes, CPF ou telefone de clientes). Para ver várias filiais numa só conta, gere o <strong>código de vínculo</strong> na conta do gestor e cole aqui em cada unidade.</p>
    <form id="units-form"><div class="row"><label>Nome da unidade<input name="name" maxlength="60" placeholder="Ex.: Loja Centro" value="${esc(u.name)}"></label><label>Código de vínculo do gestor (opcional)<input name="linkCode" maxlength="14" placeholder="GZU-XXXX-XXXX" value="${esc(u.linkCode)}" autocomplete="off" spellcheck="false"></label></div>
    <label class="check"><input type="checkbox" name="enabled" ${u.enabled ? 'checked' : ''}> Enviar o resumo desta unidade para a Minha conta do gamezoney.com</label>
    <div class="balance"><span>Último envio</span><strong style="font-size:15px">${esc(last)}${u.ownerEmail ? ' • ' + esc(u.ownerEmail) : ''}</strong></div>${u.lastError ? `<p class="hint" style="color:#ff8793">${esc(u.lastError)}</p>` : ''}
    <div class="balance"><span>Hoje (prévia)</span><strong style="font-size:15px">${money(p.day.totalCents)} • ${p.stations.inUse}/${p.stations.total} em uso • caixa ${p.cash.open ? 'nº ' + String(p.cash.number).padStart(4, '0') + ' aberto' : 'fechado'}</strong></div>
    <div class="dialog-actions" style="justify-content:flex-start;gap:10px"><button class="primary" style="flex:0 0 auto">Salvar</button>${u.enabled ? '<button type="button" class="ghost" id="units-send" style="flex:0 0 auto">Enviar agora</button>' : ''}</div><p class="error" id="units-error" role="alert"></p></form>`;
  sec.querySelector('#units-form').onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.disabled = true; sec.querySelector('#units-error').textContent = '';
    const d = Object.fromEntries(new FormData(e.target)); d.enabled = e.target.enabled.checked;
    try { let res = await api('/units', d); if (res.enabled) { try { res = await api('/units/send', {}); toast('Salvo e enviado para a Minha conta.'); } catch (err) { res = await api('/units'); toast('Salvo. ' + err.message); } } else toast('Salvo.'); sec.replaceWith(unitsSection(res)); }
    catch (err) { sec.querySelector('#units-error').textContent = err.message; b.disabled = false; }
  };
  const send = sec.querySelector('#units-send');
  if (send) send.onclick = async () => { send.disabled = true; try { sec.replaceWith(unitsSection(await api('/units/send', {}))); toast('Resumo enviado.'); } catch (err) { toast(err.message); const res = await api('/units').catch(() => null); if (res) sec.replaceWith(unitsSection(res)); } };
  return sec;
}
// 1.2.0: Gerenciar App tem item próprio no menu (abaixo do Ranking, só Pro); Multi-Unidade continua na Configuração.
async function renderAppManager() {
  const node = $('#view'); $('#view-title').textContent = 'Gerenciar App';
  if (!isAdmin() || !state?.pro) { node.innerHTML = '<div class="panel"><h2>Gerenciar App</h2><p class="hint">Recurso do plano Pro.</p></div>'; return; }
  // 1.3.7: abas App do cliente / Conquistas / Servidor em nuvem (member-app-ui.js)
  const tab = typeof gzAppTab === 'string' ? gzAppTab : 'cloud';
  const r = tab === 'achievements' ? achievementsSection(await api('/achievements')) : memberAppSection(await api('/member-app'));
  if (view !== 'app') return;
  node.innerHTML = typeof gzAppTabs === 'function' ? gzAppTabs() : ''; node.append(r);
}
(function () {
  const original = renderSettings;
  renderSettings = function () {
    original.apply(this, arguments);
    if (!isAdmin() || !state?.pro) return;
    api('/units').then(u => {
      if (view !== 'settings') return; $('#units-section')?.remove();
      const us = unitsSection(u), anchor = $('#net-section');
      if (anchor) anchor.after(us); else $('#view').append(us);
    }).catch(() => {});
  };
})();
