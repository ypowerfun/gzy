'use strict';
// 1.0.8 (plano Pro): Configuração › Gerenciamento do App e Multi-Unidade. Só aparecem para quem tem o plano Pro.
function amRow(c) {
  return `<div class="balance"><span><i aria-hidden="true" style="font-style:normal">${c.ok ? '✅' : c.optional ? '➖' : '⚠️'}</i> ${esc(c.name)}</span><strong style="color:${c.ok ? 'var(--green)' : c.optional ? 'var(--muted)' : '#ffb84d'};font-weight:600;font-size:13px;text-align:right">${esc(c.detail)}</strong></div>`;
}
function appManagerSection(r) {
  const c = r.config, sel = (name, opts, v) => `<select name="${name}">${Object.entries(opts).map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const sec = document.createElement('section'); sec.id = 'app-manager-section'; sec.className = 'panel';
  sec.innerHTML = `<h2>Gerenciamento do App <span class="badge gold">PRO</span></h2>
    <p class="hint">Deixe tudo pronto para o servidor funcionar também na nuvem e o gestor acompanhar a arena de fora da loja. Se você já tem domínio e hospedagem, preencha os dados abaixo. Se preferir, um agente GameZoney finaliza a configuração pelo AnyDesk: preencha o contato e clique em "Pedir configuração ao suporte". <strong>Nunca escreva senhas aqui.</strong> Enquanto isso, o painel continua acessível só na rede local.</p>
    <div class="am-status">${r.ready ? '<p class="hint" style="color:var(--green)"><strong>Tudo pronto.</strong> Peça ao suporte GameZoney para ligar o servidor na nuvem.</p>' : `<p class="hint" style="color:#ffb84d"><strong>Falta:</strong> ${r.missing.map(esc).join(', ')}.</p>`}${r.checks.map(amRow).join('')}</div>
    <form id="am-form" class="am-form">
      <h3>Domínio e HTTPS</h3>
      <div class="row"><label>Domínio do servidor<input name="domain" maxlength="253" placeholder="arena.minhaloja.com.br" value="${esc(c.domain)}" autocomplete="off" spellcheck="false"></label>
      <label>Certificado HTTPS${sel('https', r.options.https, c.https)}</label><label>Porta pública<input name="port" type="number" min="1" max="65535" value="${c.port || 443}"></label></div>
      <h3>Hospedagem / VPS</h3>
      <div class="row"><label>Provedor<input name="hostProvider" maxlength="60" placeholder="Ex.: Oracle Cloud, Hostinger, AWS" value="${esc(c.host.provider)}"></label>
      <label>IP ou nome da VPS<input name="hostAddress" maxlength="253" placeholder="203.0.113.10" value="${esc(c.host.address)}" autocomplete="off" spellcheck="false"></label>
      <label>Sistema${sel('hostOs', r.options.os, c.host.os)}</label><label>Usuário de acesso (sem senha)<input name="hostUser" maxlength="60" placeholder="ubuntu" value="${esc(c.host.user)}" autocomplete="off"></label></div>
      <h3>Acesso do gestor</h3>
      <label class="check"><input type="checkbox" name="remoteAccess" ${c.remoteAccess ? 'checked' : ''}> Permitir que o gestor acesse o painel de fora da loja (pelo celular ou computador), com verificação em duas etapas, quando o servidor estiver na nuvem</label>
      <h3>Suporte GameZoney</h3>
      <div class="row"><label>ID do AnyDesk deste computador<input name="anydesk" maxlength="40" placeholder="123 456 789" value="${esc(c.support.anydesk)}" autocomplete="off"></label>
      <label>WhatsApp / contato<input name="contact" maxlength="80" placeholder="(92) 9 9999-9999" value="${esc(c.support.contact)}"></label></div>
      <label>Observações (sem senhas)<textarea name="notes" maxlength="600" rows="2">${esc(c.notes)}</textarea></label>
      <div class="dialog-actions" style="justify-content:flex-start;gap:10px"><button class="primary" style="flex:0 0 auto">Salvar e conferir</button><button type="button" class="ghost" id="am-support" style="flex:0 0 auto">Pedir configuração ao suporte</button></div>
      <p class="error" id="am-error" role="alert"></p>
    </form>`;
  sec.querySelector('#am-form').onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.disabled = true; sec.querySelector('#am-error').textContent = '';
    const d = Object.fromEntries(new FormData(e.target)); d.remoteAccess = e.target.remoteAccess.checked;
    try { const res = await api('/app-manager', d); sec.replaceWith(appManagerSection(res)); toast(res.ready ? 'Salvo. Tudo pronto para a nuvem.' : 'Salvo. Confira o que falta.'); }
    catch (err) { sec.querySelector('#am-error').textContent = err.message; b.disabled = false; }
  };
  sec.querySelector('#am-support').onclick = async ev => {
    if (!await ask('Enviar ao suporte GameZoney os dados desta tela (sem senhas) para finalizarem a configuração? Eles entram em contato pelo WhatsApp/AnyDesk informado.', {ok: 'Enviar'})) return;
    ev.target.disabled = true;
    try { const res = await api('/app-manager/support', {}); toast(res.sent ? 'Pedido enviado ao suporte GameZoney.' : 'Sem internet agora: o pedido fica guardado e é enviado sozinho.'); }
    catch (err) { toast(err.message); } finally { ev.target.disabled = false; }
  };
  return sec;
}
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
  const r = await api('/app-manager'); if (view !== 'app') return;
  node.innerHTML = ''; node.append(appManagerSection(r));
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
