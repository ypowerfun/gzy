'use strict';
(() => {
  const ST = {paid: ['Pago', 'ok'], pending: ['Pendente', 'wait'], expired: ['Vencido', 'bad'], canceled: ['Cancelado', 'bad']};
  const table = (head, rows) => rows.length ? `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : '<p class="note">Nada por aqui ainda.</p>';
  async function load() {
    let d; try { d = await api('/api/admin/overview'); } catch (e) { if (e.status === 401) location.href = '/entrar.html?next=/admin'; else document.querySelector('main .wrap').innerHTML = `<p class="msg err" style="display:block">${esc(e.message)}</p>`; return; }
    // 1.4: preço e promoção
    const of = $('#offer-form'), cents = c => c ? (c / 100).toFixed(2).replace('.', ',') : '';
    if (of && !of.dataset.loaded) { of.list.value = cents(d.offer.listPriceCents); of.price.value = cents(d.offer.priceCents); of.label.value = d.offer.priceLabel; of.banner.value = d.offer.banner; of.dataset.loaded = '1'; }
    const s = d.stats;
    $('#stats').innerHTML = [['Clientes', s.users], ['Licenças', s.licenses], ['Ativadas', s.activeLicenses], ['Vendas pagas', s.paidOrders], ['Faturamento', money(s.revenueCents)], ['Chamados abertos', s.openTickets], ['Downloads', s.downloads]].map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
    $('#orders').innerHTML = table(['Data', 'Cliente', 'Valor', 'Forma', 'Situação', 'Chave', ''], d.orders.map(o => `<tr><td>${fmtDate(o.createdAt)}</td><td>${esc(o.email)}</td><td>${money(o.amountCents)}</td><td>${o.provider === 'manual' ? 'PIX manual' : o.method === 'card' ? 'Cartão Mercado Pago' : 'PIX Mercado Pago'}</td><td><span class="pill ${(ST[o.status] || [])[1] || ''}">${(ST[o.status] || [o.status])[0]}</span><br><small class="note">${esc(o.note || '')}</small></td><td>${o.licenseKey ? `<span class="key" style="font-size:13px">${esc(o.licenseKey)}</span>` : '—'}</td><td>${o.status !== 'paid' ? `<button class="btn small" data-approve="${o.id}">Confirmar pagamento</button>` : ''}</td></tr>`));
    $('#licenses').innerHTML = table(['Chave', 'Cliente', 'Situação', 'Computador', ''], d.licenses.map(l => `<tr><td><span class="key" style="font-size:13px">${esc(l.key)}</span><br><small class="note">${fmtDate(l.createdAt)} ${esc(l.note || '')}</small></td><td>${esc(l.email)}</td><td>${l.status === 'active' ? (l.active ? '<span class="pill ok">Ativada</span>' : '<span class="pill wait">Não ativada</span>') : '<span class="pill bad">Bloqueada</span>'}</td><td>${esc(l.machine || '—')}<br><small class="note">${esc(l.installId)} ${l.releases ? '• trocas: ' + l.releases : ''} ${l.machines ? '• ' + l.machines + ' computador(es)' : ''}</small>${l.suspect ? `<br><span class="pill bad" title="3 ou mais trocas de computador em 30 dias">Suspeita de revenda (${l.recentTransfers} trocas em 30 dias)</span>` : ''}</td><td class="row">${l.active ? `<button class="btn small ghost" data-lic="${l.id}" data-op="release">Liberar</button>` : ''}<button class="btn small ${l.status === 'active' ? 'danger' : ''}" data-lic="${l.id}" data-op="${l.status === 'active' ? 'blocked' : 'active'}">${l.status === 'active' ? 'Bloquear' : 'Desbloquear'}</button></td></tr>`));
    renderTickets(d.tickets);
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
    const body = `<div class="ticket-body"><p class="ticket-label">Mensagem do cliente</p><p class="ticket-text">${esc(t.message)}</p>`;
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
  const toCents = v => { let t = String(v || '0').trim(); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); return Math.round(Number(t) * 100); }; // aceita 89,90 / 89.90 / 1.189,90
  $('#offer-form').onsubmit = e => { e.preventDefault(); const f = e.target; busy(f.querySelector('button'), async () => {
    try { const r = await api('/api/admin/offer', {listPriceCents: toCents(f.list.value), priceCents: toCents(f.price.value), priceLabel: f.label.value, banner: f.banner.value});
      showMsg($('#offer-msg'), `Salvo: de ${money(r.offer.listPriceCents)} por ${money(r.offer.priceCents)}.`, true); } catch (err) { showMsg($('#offer-msg'), err.message); } }); };
  load();
})();
