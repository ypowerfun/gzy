'use strict';
(() => {
  const ST = {paid: ['Pago', 'ok'], pending: ['Pendente', 'wait'], expired: ['Vencido', 'bad'], canceled: ['Cancelado', 'bad']};
  const table = (head, rows) => rows.length ? `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : '<p class="note">Nada por aqui ainda.</p>';
  async function load() {
    let d; try { d = await api('/api/admin/overview'); } catch (e) { if (e.status === 401) location.href = '/entrar.html?next=/admin'; else document.querySelector('main .wrap').innerHTML = `<p class="msg err" style="display:block">${esc(e.message)}</p>`; return; }
    // 1.4: preço e promoção
    const of = $('#offer-form');
    if (of && !of.dataset.loaded) { of.banner.value = d.offer.banner; of.dataset.loaded = '1'; }
    const s = d.stats;
    $('#stats').innerHTML = [['Clientes', s.users], ['Licenças', s.licenses], ['Ativadas', s.activeLicenses], ['Vendas pagas', s.paidOrders], ['Faturamento', money(s.revenueCents)], ['Chamados abertos', s.openTickets], ['Downloads', s.downloads]].map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
    $('#orders').innerHTML = table(['Data', 'Cliente', 'Valor', 'Forma', 'Situação', 'Chave', ''], d.orders.map(o => `<tr><td>${fmtDate(o.createdAt)}</td><td>${esc(o.email)}</td><td>${money(o.amountCents)}</td><td>${o.provider === 'manual' ? 'PIX manual' : o.method === 'card' ? 'Cartão Mercado Pago' : 'PIX Mercado Pago'}</td><td><span class="pill ${(ST[o.status] || [])[1] || ''}">${(ST[o.status] || [o.status])[0]}</span><br><small class="note">${esc(o.note || '')}</small></td><td>${o.licenseKey ? `<span class="key" style="font-size:13px">${esc(o.licenseKey)}</span>` : '—'}</td><td>${o.status !== 'paid' ? `<button class="btn small" data-approve="${o.id}">Confirmar pagamento</button>` : ''}</td></tr>`));
    $('#licenses').innerHTML = table(['Chave', 'Cliente', 'Situação', 'Computador', ''], d.licenses.map(l => `<tr><td><span class="key" style="font-size:13px">${esc(l.key)}</span><br><small class="note">${fmtDate(l.createdAt)} ${esc(l.note || '')}</small></td><td>${esc(l.email)}</td><td>${l.status === 'active' ? (l.active ? '<span class="pill ok">Ativada</span>' : '<span class="pill wait">Não ativada</span>') : '<span class="pill bad">Bloqueada</span>'}</td><td>${esc(l.machine || '—')}<br><small class="note">${esc(l.installId)} ${l.releases ? '• trocas: ' + l.releases : ''} ${l.machines ? '• ' + l.machines + ' computador(es)' : ''}</small>${l.suspect ? `<br><span class="pill bad" title="3 ou mais trocas de computador em 30 dias">Suspeita de revenda (${l.recentTransfers} trocas em 30 dias)</span>` : ''}</td><td class="row">${l.active ? `<button class="btn small ghost" data-lic="${l.id}" data-op="release">Liberar</button>` : ''}<button class="btn small ${l.status === 'active' ? 'danger' : ''}" data-lic="${l.id}" data-op="${l.status === 'active' ? 'blocked' : 'active'}">${l.status === 'active' ? 'Bloquear' : 'Desbloquear'}</button></td></tr>`));
    renderTickets(d.tickets);
    loadDesign(); loadCampaigns(); loadPlans(); loadUpdates();
    $('#users').innerHTML = table(['Nome', 'E-mail', 'Telefone', 'Login', 'Criado', 'Último acesso'], d.users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td>${u.google ? 'Google' : 'E-mail'}</td><td>${fmtDate(u.created_at)}</td><td>${fmtDate(u.last_login_at)}</td></tr>`));
    $('#feedbacks').innerHTML = table(['Recebido', 'Nome', 'E-mail', 'Comentário', 'Versão'], d.feedback.map(f => `<tr><td>${fmtDate(f.received_at)}</td><td>${esc(f.name)}</td><td>${esc(f.email)}</td><td style="white-space:pre-wrap">${esc(f.comment)}</td><td>${esc(f.server_version)}</td></tr>`));
    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
    $('#reviews').innerHTML = table(['Nota', 'Avaliação', 'Cliente', 'Página inicial', ''], d.reviews.map(r => `<tr><td style="color:var(--gold2);white-space:nowrap">${stars(r.stars)}</td><td style="white-space:pre-wrap;max-width:420px">${esc(r.text)}${r.images.length ? `<div class="row" style="margin-top:8px">${r.images.map(i => `<a href="${esc(i)}" target="_blank"><img src="${esc(i)}" style="width:90px;height:68px;object-fit:cover;border-radius:4px"></a>`).join('')}</div>` : ''}${r.hidden ? '<br><span class="pill bad">Oculta</span>' : ''}</td><td>${esc(r.name)}<br><small class="note">${esc(r.organization)} ${esc(r.email)}<br>${fmtDate(r.createdAt)}</small></td><td><select data-feature="${r.id}" style="width:auto">${[0, 1, 2, 3].map(n => `<option value="${n}" ${r.featured === n ? 'selected' : ''}>${n || '—'}</option>`).join('')}</select></td><td class="row"><button class="btn small ghost" data-rhide="${r.id}" data-v="${r.hidden ? 0 : 1}">${r.hidden ? 'Mostrar' : 'Ocultar'}</button><button class="btn small danger" data-rdel="${r.id}">Excluir</button></td></tr>`));
    $$('[data-feature]').forEach(sel => sel.onchange = () => api('/api/admin/reviews/' + sel.dataset.feature, {featured: Number(sel.value)}).then(load, e => alert(e.message)));
    $$('[data-rhide]').forEach(b => b.onclick = () => busy(b, () => api('/api/admin/reviews/' + b.dataset.rhide, {hidden: b.dataset.v === '1'}).then(load, e => alert(e.message))));
    $$('[data-rdel]').forEach(b => b.onclick = () => { if (window.confirm('Excluir esta avaliação (com as imagens)?')) busy(b, () => api('/api/admin/reviews/' + b.dataset.rdel, {remove: true}).then(load, e => alert(e.message))); });
    $('#audit').innerHTML = table(['Data', 'Quem', 'Ação', 'Detalhe'], d.audit.map(a => `<tr><td>${fmtDate(a.at)}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td></tr>`));
    $$('[data-approve]').forEach(b => b.onclick = () => { if (window.confirm('Confirmar o pagamento deste pedido e emitir a licença?')) busy(b, () => api('/api/admin/orders/' + b.dataset.approve + '/approve', {}).then(load, e => alert(e.message))); });
    $$('[data-lic]').forEach(b => b.onclick = () => busy(b, () => api('/api/admin/licenses/' + b.dataset.lic, b.dataset.op === 'release' ? {release: true} : {status: b.dataset.op}).then(load, e => alert(e.message))));
  }
  // ---------- 2.3: atualização do GameZoney Servidor ----------
  async function loadUpdates() {
    let d; try { d = await api('/api/admin/updates'); } catch { return; }
    const mb = b => (b / 1048576).toFixed(1) + ' MB', p = d.published;
    $('#upd-current').innerHTML = p ? `<div class="plan-now"><div><span class="pill ok">Publicada</span><h4>Versão ${esc(p.version)}</h4><p class="note">${esc(p.file)} • ${mb(p.size)} • publicada em ${fmtDate(p.publishedAt)}<br>SHA-256: <code style="font-size:11px">${esc(p.sha256)}</code></p>${p.notes ? `<p class="note" style="white-space:pre-wrap">${esc(p.notes)}</p>` : ''}</div><button type="button" class="btn small danger" id="upd-unpublish">Retirar publicação</button></div>` : '<p class="note">Nenhuma atualização publicada: o botão Verificar atualização do Servidor responde que já está na versão mais nova.</p>';
    const sel = $('#upd-form').file; sel.innerHTML = d.files.length ? d.files.map(f => `<option value="${esc(f.file)}">${esc(f.file)} (versão ${esc(f.version)}, ${mb(f.size)})</option>`).join('') : '<option value="">Nenhum instalador GameZoney-Servidor-X.Y.Z-Setup.exe na pasta de downloads</option>';
    const un = $('#upd-unpublish'); if (un) un.onclick = () => { if (window.confirm('Retirar a publicação? Os servidores deixam de ver a atualização.')) busy(un, () => api('/api/admin/updates/unpublish', {}).then(loadUpdates, e => alert(e.message))); };
  }
  $('#upd-form').onsubmit = e => { e.preventDefault(); const f = e.target; if (!f.file.value) return;
    if (!window.confirm('Publicar ' + f.file.value + ' como atualização do GameZoney Servidor? Os servidores com plano ativo poderão baixar e instalar.')) return;
    busy(f.querySelector('button'), async () => { try { showMsg($('#upd-msg'), 'Calculando a impressão digital do arquivo…', true); const r = await api('/api/admin/updates/publish', {file: f.file.value, notes: f.notes.value}); showMsg($('#upd-msg'), 'Versão ' + r.published.version + ' publicada.', true); f.notes.value = ''; loadUpdates(); } catch (err) { showMsg($('#upd-msg'), err.message); } }); };
  // ---------- 2.0: planos e assinaturas ----------
  const reais = c => c ? (c / 100).toFixed(2).replace('.', ',') : '';
  const SUBST = {pending: 'wait', authorized: 'ok', granted: 'ok', paused: 'wait', cancelled: 'bad', failed: 'bad'};
  let plansLoaded = false;
  async function loadPlans() {
    let d; try { d = await api('/api/admin/plans'); } catch { return; }
    $('#plans-stats').textContent = `${d.stats.activePlans} conta(s) com plano ativo • receita mensal recorrente aprox. ${money(d.stats.monthlyRevenueCents)}`;
    if (!plansLoaded) { plansLoaded = true;
      $('#plans-admin').innerHTML = d.plans.map(p => `<fieldset class="plan-admin" data-plan="${esc(p.id)}"><legend><input name="name" value="${esc(p.name)}" maxlength="40" aria-label="Nome do plano"></legend>
        ${p.free ? '<p class="note" style="margin:0">Plano gratuito (teste de 30 dias): o botão leva para os downloads. Sem preço.</p><input type="hidden" name="monthly" value=""><input type="hidden" name="monthlyList" value=""><input type="hidden" name="annual" value=""><input type="hidden" name="annualList" value=""><input type="hidden" name="badge" value="">' : `<div class="row" style="gap:8px;flex-wrap:wrap"><label>Mensal R$<input name="monthly" inputmode="decimal" value="${reais(p.monthly)}" required></label><label>Mensal "de" R$<input name="monthlyList" inputmode="decimal" value="${reais(p.monthlyList)}" placeholder="vazio"></label></div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><label>Anual R$ (cobrado 1x por ano)<input name="annual" inputmode="decimal" value="${reais(p.annual)}" required></label><label>Anual "de" R$<input name="annualList" inputmode="decimal" value="${reais(p.annualList)}" placeholder="vazio"></label></div>
        <label>Selo (opcional)<input name="badge" maxlength="40" value="${esc(p.badge)}" placeholder="Ex.: Oferta especial • 61% de desconto"></label>`}
        <label>Itens do plano (um por linha)<textarea name="features" rows="6">${esc(p.features.join('\n'))}</textarea></label>
        <label class="inline"><input type="radio" name="popular" value="${esc(p.id)}" ${p.popular ? 'checked' : ''}> Destacar como "Mais popular"</label></fieldset>`).join(''); }
    $('#subs-list').innerHTML = d.subscriptions.length ? `<div class="table"><table><thead><tr><th>Cliente</th><th>Plano</th><th>Situação</th><th>Valor</th><th>Válido até</th><th></th></tr></thead><tbody>${d.subscriptions.map(s => `<tr><td>${esc(s.name)}<br><small class="note">${esc(s.email)}</small>${s.machine ? `<br><small class="note">Servidor: ${esc(s.machine)} • visto ${fmtDate(s.machineSeenAt)}</small>` : ""}</td><td>${esc(s.planName)} <small class="note">${esc(s.period)}</small><br><small class="note">${s.source === 'mp' ? 'Mercado Pago ' + esc(s.mpId) + ' • ' + s.chargedCount + ' cobrança(s)' : s.source === 'legacy' ? 'Vitalícia convertida' : 'Cortesia'}</small></td><td><span class="pill ${SUBST[s.status] || ''}">${esc(s.statusText)}</span>${s.note ? `<br><small class="note">${esc(s.note)}</small>` : ''}</td><td>${s.amountCents ? money(s.amountCents) : '—'}</td><td>${s.paidUntil ? fmtDate(s.paidUntil) : '—'}</td><td class="row">${s.source === 'mp' && ['pending', 'authorized', 'paused'].includes(s.status) ? `<button class="btn small ghost" data-scancel="${s.id}" title="Para a renovação; vale até o fim do período pago">Cancelar renovação</button>` : ''}${s.active ? `<button class="btn small danger" data-send="${s.id}" title="Cancela e encerra o plano agora">Encerrar agora</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Nenhuma assinatura ainda.</p>';
    $$('[data-scancel]').forEach(b => b.onclick = () => { if (window.confirm('Cancelar a renovação automática? O plano vale até o fim do período já pago.')) busy(b, () => api('/api/admin/subscriptions/' + b.dataset.scancel + '/cancel', {}).then(loadPlans, e => alert(e.message))); });
    $$('[data-send]').forEach(b => b.onclick = () => { if (window.confirm('Encerrar o plano AGORA (sem esperar o fim do período)? Use em caso de fraude, estorno ou revenda.')) busy(b, () => api('/api/admin/subscriptions/' + b.dataset.send + '/cancel', {endNow: true}).then(loadPlans, e => alert(e.message))); });
  }
  $('#plans-form').onsubmit = e => { e.preventDefault(); const plans = {}; let popular = '';
    $$('[data-plan]').forEach(f => { const v = n => f.querySelector(`[name=${n}]`); plans[f.dataset.plan] = {name: v('name').value, monthly: v('monthly').value, monthlyList: v('monthlyList').value || '0', annual: v('annual').value, annualList: v('annualList').value || '0', badge: v('badge').value, features: v('features').value.split('\n')}; if (v('popular').checked) popular = f.dataset.plan; });
    busy(e.target.querySelector('button'), async () => { try { await api('/api/admin/plans', {plans, popular}); showMsg($('#plans-msg'), 'Planos salvos. Já aparecem no site.', true); } catch (err) { showMsg($('#plans-msg'), err.message); } }); };
  $('#grant-form').onsubmit = e => { e.preventDefault(); const f = e.target;
    busy(f.querySelector('button'), async () => { try { await api('/api/admin/subscriptions/grant', {email: f.email.value, plan: f.plan.value, months: Number(f.months.value), note: f.note.value}); showMsg($('#plans-msg'), 'Plano de cortesia dado.', true); f.reset(); loadPlans(); } catch (err) { showMsg($('#plans-msg'), err.message); } }); };
  // ---------- 1.8: comunicados e promoções por e-mail ----------
  let campBanner = '', campTimer = null;
  const campData = () => { const f = $('#camp-form'); return {subject: f.subject.value, title: f.title.value, body: f.body.value, buttonLabel: f.buttonLabel.value, buttonUrl: f.buttonUrl.value.trim(), image: campBanner, audience: f.audience.value}; };
  const CST = {sending: ['Enviando', 'wait'], done: ['Concluído', 'ok'], canceled: ['Cancelado', 'bad']};
  async function loadCampaigns() {
    let d; try { d = await api('/api/admin/campaigns'); } catch { return; }
    $('#aud-all').textContent = d.audience.all; $('#aud-verified').textContent = d.audience.verified;
    $('#aud-note').textContent = `${d.audience.optedOut} conta(s) cancelaram a inscrição e não recebem. Limite: ${d.dailyLimit} e-mails a cada 24 h (enviados agora: ${d.sentToday}); o que passar disso continua sozinho depois.`;
    $('#camp-list').innerHTML = d.campaigns.length ? `<div class="table"><table><thead><tr><th>Data</th><th>Assunto</th><th>Quem recebe</th><th>Andamento</th><th></th></tr></thead><tbody>${d.campaigns.map(c => `<tr><td>${fmtDate(c.createdAt)}</td><td>${esc(c.subject)}</td><td>${c.audience === 'verified' ? 'Confirmados' : 'Todos'}</td><td><span class="pill ${(CST[c.status] || [])[1] || ''}">${(CST[c.status] || [c.status])[0]}</span><br><small class="note">${c.sent} de ${c.total} enviados${c.failed ? ` • ${c.failed} falha(s)` : ''}${c.status === 'sending' ? ` • ${c.pending} na fila` : ''}</small><div class="camp-bar"><i style="width:${c.total ? Math.round(100 * (c.sent + c.failed) / c.total) : 0}%"></i></div></td><td>${c.status === 'sending' ? `<button class="btn small danger" data-ccancel="${c.id}">Cancelar envio</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Nenhum comunicado enviado ainda.</p>';
    $$('[data-ccancel]').forEach(b => b.onclick = () => { if (window.confirm('Cancelar o envio? Quem já recebeu, recebeu; o resto da fila não sai.')) busy(b, () => api('/api/admin/campaigns/' + b.dataset.ccancel + '/cancel', {}).then(loadCampaigns, e => alert(e.message))); });
    clearTimeout(campTimer); if (d.campaigns.some(c => c.status === 'sending')) campTimer = setTimeout(loadCampaigns, 8000);
  }
  async function campPreview() { try { const r = await api('/api/admin/campaigns/preview', campData()); $('#camp-frame').srcdoc = r.html; return true; } catch (e) { showMsg($('#camp-msg'), e.message); return false; } }
  $('#camp-preview').onclick = e => busy(e.target, campPreview);
  $('#camp-test').onclick = e => busy(e.target, async () => { try { const r = await api('/api/admin/campaigns/test', campData()); campPreview(); showMsg($('#camp-msg'), 'Teste enviado para ' + r.to + '. Confira a caixa de entrada (e o lixo eletrônico).', true); } catch (err) { showMsg($('#camp-msg'), err.message); } });
  $('#camp-form').banner.onchange = async e => { const file = e.target.files[0]; if (!file) return; if (file.size > 3 * 1024 * 1024) { e.target.value = ''; return showMsg($('#camp-msg'), 'Banner muito grande (máximo 3 MB).'); }
    try { const data = await new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = err; r.readAsDataURL(file); }); campBanner = (await api('/api/admin/design/image', {data})).url; $('#camp-banner-note').classList.remove('hidden'); campPreview(); } catch (err) { showMsg($('#camp-msg'), err.message); } };
  $('#camp-banner-remove').onclick = () => { campBanner = ''; $('#camp-form').banner.value = ''; $('#camp-banner-note').classList.add('hidden'); campPreview(); };
  $('#camp-form').onsubmit = e => { e.preventDefault(); const d = campData(), n = $(d.audience === 'verified' ? '#aud-verified' : '#aud-all').textContent;
    if (!window.confirm(`Enviar "${d.subject}" para ${n} conta(s)? Depois de começar, dá para cancelar o que ainda estiver na fila.`)) return;
    busy($('#camp-send'), async () => { try { await api('/api/admin/campaigns', d); showMsg($('#camp-msg'), 'Comunicado na fila de envio. O andamento aparece em Enviados.', true); e.target.reset(); campBanner = ''; $('#camp-banner-note').classList.add('hidden'); $('#camp-frame').srcdoc = ''; loadCampaigns(); } catch (err) { showMsg($('#camp-msg'), err.message); } }); };
  // ---------- 1.7: design do site e parceiros ----------
  const PAGE_NAMES = {'/': 'Página inicial', '*h': 'Topo (todas as páginas)', '*f': 'Rodapé (todas as páginas)', '/atendimento': 'Atendimento', '/atualizacoes': 'Atualizações', '/entrar': 'Entrar', '/conta': 'Minha conta', '/guia': 'Guia', '/termos': 'Termos de uso', '/privacidade': 'Privacidade', '/redefinir': 'Redefinir senha'};
  let partnerList = [];
  async function loadDesign() {
    let d; try { d = await api('/api/admin/design'); } catch { return; }
    const pages = Object.entries(d.pages);
    $('#design-pages').innerHTML = pages.length ? `<div class="table"><table><thead><tr><th>Página</th><th>Alterações</th><th></th></tr></thead><tbody>${pages.map(([k, n]) => `<tr><td>${esc(PAGE_NAMES[k] || k)}</td><td>${n}</td><td class="row">${k.startsWith('*') ? '' : `<a class="btn small ghost" href="${esc(k)}?design=1">Editar</a>`}<button class="btn small danger" data-dreset="${esc(k)}">Restaurar original</button></td></tr>`).join('')}</tbody></table></div><p><button class="btn small danger" data-dreset="all">Restaurar o site inteiro</button></p>` : '<p class="note">Nenhuma alteração: o site está como o original.</p>';
    $$('[data-dreset]').forEach(b => b.onclick = () => { if (window.confirm(b.dataset.dreset === 'all' ? 'Restaurar o site inteiro como era originalmente (todas as páginas, topo e rodapé)?' : 'Restaurar esta parte como era originalmente?')) busy(b, () => api('/api/admin/design/reset', {page: b.dataset.dreset}).then(() => { showMsg($('#design-msg'), 'Original restaurado.', true); loadDesign(); }, e => showMsg($('#design-msg'), e.message))); });
    partnerList = d.partners; renderPartners();
  }
  function renderPartners() {
    $('#partner-list').innerHTML = partnerList.length ? `<div class="table"><table><tbody>${partnerList.map((p, i) => `<tr><td style="width:130px"><img src="${esc(p.img)}" alt="" style="max-height:40px;max-width:120px;background:#0e1117;padding:4px;border-radius:4px"></td><td><b>${esc(p.name)}</b><br><small class="note">${esc(p.url || 'sem link')}</small></td><td class="row" style="justify-content:flex-end">${i ? `<button class="btn small ghost" data-pmove="${i}" data-d="-1" title="Subir">↑</button>` : ''}${i < partnerList.length - 1 ? `<button class="btn small ghost" data-pmove="${i}" data-d="1" title="Descer">↓</button>` : ''}<button class="btn small danger" data-pdel="${i}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Nenhum parceiro ainda.</p>';
    $$('[data-pmove]').forEach(b => b.onclick = () => { const i = Number(b.dataset.pmove), j = i + Number(b.dataset.d); [partnerList[i], partnerList[j]] = [partnerList[j], partnerList[i]]; savePartners(b); });
    $$('[data-pdel]').forEach(b => b.onclick = () => { if (window.confirm('Excluir este parceiro do rodapé?')) { partnerList.splice(Number(b.dataset.pdel), 1); savePartners(b); } });
  }
  const savePartners = btn => busy(btn, async () => { try { partnerList = (await api('/api/admin/partners', {partners: partnerList})).partners; renderPartners(); showMsg($('#design-msg'), 'Parceiros salvos.', true); } catch (e) { showMsg($('#design-msg'), e.message); loadDesign(); } });
  $('#partner-form').onsubmit = e => { e.preventDefault(); const f = e.target, file = f.logo.files[0]; if (!file) return;
    if (file.size > 3 * 1024 * 1024) return showMsg($('#design-msg'), 'Logo muito grande (máximo 3 MB).');
    busy(f.querySelector('button'), async () => { try {
      const data = await new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = err; r.readAsDataURL(file); });
      const {url} = await api('/api/admin/design/image', {data});
      partnerList = (await api('/api/admin/partners', {partners: [...partnerList, {name: f.name.value, url: f.url.value.trim(), img: url}]})).partners;
      f.reset(); renderPartners(); showMsg($('#design-msg'), 'Parceiro adicionado. Já aparece no rodapé do site.', true);
    } catch (err) { showMsg($('#design-msg'), err.message); } }); };
  // ---------- chamados: caixa própria (Abertos / Fechados), no mesmo formato do chat ----------
  let tickets = [], ticketTab = 'open', ticketId = null;
  function renderTickets(list) {
    if (list) tickets = list;
    const q = ($('#tk-search').value || '').trim().toLowerCase();
    const open = tickets.filter(t => t.status === 'open'), closed = tickets.filter(t => t.status !== 'open');
    $('#tk-open-n').textContent = open.length; $('#tk-closed-n').textContent = closed.length;
    $$('[data-ttab]').forEach(b => b.classList.toggle('on', b.dataset.ttab === ticketTab));
    const shown = (ticketTab === 'open' ? open : closed).filter(t => !q || [t.subject, t.name, t.email, t.message].join(' ').toLowerCase().includes(q));
    if (!shown.some(t => t.id === ticketId)) ticketId = shown[0]?.id || null;
    $('#ticket-list').innerHTML = shown.length ? shown.map(t => `<button type="button" class="chat-item ${t.id === ticketId ? 'on' : ''}" data-ticket="${t.id}"><b>${esc(t.subject)}</b><small>${esc(t.name)} • ${fmtDate(t.created_at)}</small><small>${esc(t.message.slice(0, 70))}</small></button>`).join('')
      : `<p class="note" style="padding:12px">${ticketTab === 'open' ? 'Nenhum chamado aberto.' : 'Nenhum chamado fechado.'}</p>`;
    $$('[data-ticket]').forEach(b => b.onclick = () => { ticketId = b.dataset.ticket; renderTickets(); });
    const t = tickets.find(x => x.id === ticketId), pane = $('#ticket-pane');
    if (!t) { pane.innerHTML = '<p class="note" style="padding:14px">Escolha um chamado.</p>'; return; }
    const head = `<div class="chat-head"><b>${esc(t.subject)}</b> <span class="pill ${t.status === 'open' ? 'wait' : 'ok'}">${t.status === 'open' ? 'Aberto' : 'Fechado'}</span><small class="note">${esc(t.name)} &lt;${esc(t.email)}&gt; • ${fmtDate(t.created_at)}</small></div>`;
    const body = `<div class="ticket-body"><p class="ticket-label">Mensagem do cliente</p><p class="ticket-text">${esc(t.message)}</p>${(t.images || []).length ? `<div class="thumbs ticket-imgs">${t.images.map(src => `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="Imagem do chamado"></a>`).join('')}</div>` : ''}`;
    pane.innerHTML = head + body + (t.status === 'open'
      ? `</div><form id="ticket-form" class="ticket-form"><textarea name="reply" required placeholder="Resposta (vai por e-mail para o cliente)">${esc(t.reply)}</textarea><div class="row"><button class="btn small">Responder e fechar</button></div></form>`
      : `${t.reply ? `<p class="ticket-label">Sua resposta${t.replied_at ? ' • ' + fmtDate(t.replied_at) : ''}</p><p class="ticket-text reply">${esc(t.reply)}</p>` : '<p class="note">Fechado sem resposta.</p>'}</div><div class="ticket-form"><div class="row"><button type="button" class="btn small ghost" id="ticket-reopen">Reabrir chamado</button></div></div>`);
    const f = $('#ticket-form');
    if (f) f.onsubmit = e => { e.preventDefault(); const reply = f.reply.value.trim(); if (!reply) return;
      busy(f.querySelector('button'), async () => { try { const r = await api('/api/admin/tickets/' + t.id, {reply, status: 'closed'});
        showMsg($('#ticket-msg'), r.emailed === false ? 'Chamado fechado. O e-mail não foi enviado, mas o cliente vê a resposta em Minha conta › Suporte.' : 'Resposta enviada por e-mail e chamado fechado (está em Fechados).', r.emailed !== false);
        ticketId = null; await load(); } catch (err) { showMsg($('#ticket-msg'), err.message); } }); };
    const ro = $('#ticket-reopen');
    if (ro) ro.onclick = () => busy(ro, async () => { try { await api('/api/admin/tickets/' + t.id, {status: 'open'}); ticketTab = 'open'; showMsg($('#ticket-msg'), 'Chamado reaberto (está em Abertos).', true); await load(); } catch (err) { showMsg($('#ticket-msg'), err.message); } });
  }
  $$('[data-ttab]').forEach(b => b.onclick = () => { ticketTab = b.dataset.ttab; ticketId = null; renderTickets(); });
  $('#tk-search').oninput = () => renderTickets();
  $('#issue-form').onsubmit = e => { e.preventDefault(); const f = e.target; busy(f.querySelector('button'), async () => {
    try { const r = await api('/api/admin/licenses', {email: f.email.value, note: f.note.value}); showMsg($('#issue-msg'), 'Licença emitida: ' + r.key, true); f.reset(); load(); } catch (err) { showMsg($('#issue-msg'), err.message); } }); };
  // ---------- chat ao vivo ----------
  let chatId = null, chatLast = 0, chats = [];
  const time = t => new Date(t).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
  async function pollChat() {
    let r; try { r = await api('/api/admin/chats' + (chatId ? `?id=${encodeURIComponent(chatId)}&after=${chatLast}` : '')); } catch { return; }
    chats = r.chats; const unread = chats.reduce((a, c) => a + (c.id === chatId ? 0 : c.unread), 0);
    $('#chat-badge').textContent = unread; $('#chat-badge').classList.toggle('hidden', !unread); document.title = (unread ? `(${unread}) ` : '') + 'Administração | GameZoney';
    $('#chat-list').innerHTML = chats.length ? chats.map(c => `<button type="button" class="chat-item ${c.id === chatId ? 'on' : ''}" data-chat="${c.id}"><b>${esc(c.name)}</b>${c.unread && c.id !== chatId ? ` <span class="pill wait">${c.unread}</span>` : ''}${c.status === 'closed' ? ' <span class="pill">encerrada</span>' : ''}<small>${esc(c.lastText).slice(0, 60)}</small><small>${time(c.lastAt)}${c.customer ? ' • cliente' : ''}</small></button>`).join('') : '<p class="note" style="padding:12px">Nenhuma conversa ainda.</p>';
    $$('[data-chat]').forEach(b => b.onclick = () => openChat(b.dataset.chat));
    addChat(r.messages);
  }
  function addChat(list) {
    const log = $('#admin-log');
    for (const m of list || []) { if (m.id <= chatLast) continue; chatLast = m.id; const d = document.createElement('div'); d.className = 'chat-bubble ' + (m.sender === 'admin' ? 'from-user' : 'from-admin'); d.innerHTML = `<p></p><small>${m.sender === 'admin' ? 'Você' : ''} ${time(m.at)}</small>`; d.querySelector('p').textContent = m.text; log.appendChild(d); }
    log.scrollTop = log.scrollHeight;
  }
  function openChat(id) {
    chatId = id; chatLast = 0; $('#admin-log').innerHTML = ''; const c = chats.find(x => x.id === id);
    $('#chat-head').innerHTML = c ? `<b>${esc(c.name)}</b> <span class="note">${esc(c.email)} ${esc(c.phone)}</span>${c.phone ? ` <a class="btn small ghost" target="_blank" href="https://wa.me/${esc(c.phone.replace(/\D/g, ''))}">WhatsApp</a>` : ''}` : '';
    $('#admin-send').classList.remove('hidden'); pollChat();
  }
  const sendForm = $('#admin-send');
  sendForm.onsubmit = e => { e.preventDefault(); const text = sendForm.text.value.trim(); if (!text || !chatId) return; busy(sendForm.querySelector('button.btn'), async () => {
    try { const r = await api('/api/admin/chats/' + chatId, {text, email: sendForm.email.checked, after: chatLast}); sendForm.text.value = ''; addChat(r.messages); } catch (err) { alert(err.message); } }); };
  sendForm.text.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendForm.requestSubmit(); } });
  $('#chat-close').onclick = () => chatId && api('/api/admin/chats/' + chatId, {status: 'closed'}).then(pollChat);
  pollChat(); setInterval(pollChat, 4000);
  $('#offer-form').onsubmit = e => { e.preventDefault(); const f = e.target; busy(f.querySelector('button'), async () => {
    try { const r = await api('/api/admin/offer', {banner: f.banner.value});
      showMsg($('#offer-msg'), r.offer.banner ? 'Faixa do topo salva.' : 'Faixa do topo retirada.', true); } catch (err) { showMsg($('#offer-msg'), err.message); } }); };
  load();
})();
