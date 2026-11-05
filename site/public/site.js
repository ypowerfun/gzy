'use strict';
// GameZoney — site gamezoney.com — funções comuns das páginas.
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const money = c => (c / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const fmtDate = t => t ? new Date(t).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'}) : '—';
async function api(url, body) {
  const r = await fetch(url, body === undefined ? {credentials: 'same-origin'} : {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'Erro ' + r.status); e.status = r.status; throw e; }
  return data;
}
function showMsg(el, text, ok) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); el.setAttribute('role', ok ? 'status' : 'alert'); }
async function busy(btn, fn) { btn.disabled = true; try { return await fn(); } finally { btn.disabled = false; } }
let siteConfig = null;
async function loadConfig() {
  try { siteConfig = await api('/api/config'); } catch { return; }
  $$('[data-price]').forEach(e => e.textContent = money(siteConfig.priceCents));
  $$('[data-price-label]').forEach(e => e.textContent = siteConfig.priceLabel);
  $$('[data-list-price]').forEach(e => { if (siteConfig.listPriceCents > siteConfig.priceCents) { e.textContent = 'De ' + money(siteConfig.listPriceCents); e.classList.remove('hidden'); } });
  const badge = $('#promo-badge'); if (badge) badge.textContent = siteConfig.priceLabel + ' • Licença vitalícia ' + money(siteConfig.priceCents);
  // 1.4: faixa do topo (texto editável no /admin)
  const strip = $('#promo-strip'); if (strip && siteConfig.banner) { $$('[data-banner]').forEach(e => e.textContent = siteConfig.banner); strip.classList.remove('hidden'); }
  document.dispatchEvent(new CustomEvent('gz:config', {detail: siteConfig}));
}
async function loadMe() { try { return await api('/api/me'); } catch { return {user: null}; } }
(async () => {
  loadConfig();
  if ($('[data-guest]') || $('[data-member]')) {
    const me = await loadMe();
    $$('[data-guest]').forEach(e => e.classList.toggle('hidden', !!me.user));
    $$('[data-member]').forEach(e => e.classList.toggle('hidden', !me.user));
  }
})();

// ---------- 1.2: Instagram no rodapé e botão "Fale conosco" (chat ao vivo com o administrador) ----------
const IG_URL = 'https://www.instagram.com/gamezoney_';
const IG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.3-.4-.4-.8-.6-1.3-.8-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 8a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2zm6.2-8.2a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0z"/></svg>';
(function footerInstagram() {
  document.querySelectorAll('footer.site').forEach(w => {
    if (w.querySelector('.ig-link')) return;
    const a = document.createElement('a'); a.className = 'ig-link'; a.href = IG_URL; a.target = '_blank'; a.rel = 'noopener';
    a.title = 'Instagram @gamezoney_'; a.innerHTML = IG_SVG + '<span>@gamezoney_</span>'; w.appendChild(a);
  });
})();
(function liveChat() {
  if (document.body.dataset.noChat !== undefined) return;
  const box = document.createElement('div'); box.className = 'chat-widget';
  box.innerHTML = `<button type="button" class="chat-open" aria-label="Fale conosco" aria-expanded="false" aria-controls="chat-panel"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm0 2v11.2L7.2 16H20V6H4zm3 3h10v2H7V9zm0 3h7v2H7v-2z"/></svg><span>Fale conosco</span></button>
  <section class="chat-panel hidden" id="chat-panel" role="dialog" aria-label="Atendimento GameZoney">
    <header><div><b>Equipe GameZoney</b><small class="chat-status"></small></div><button type="button" class="chat-close" aria-label="Fechar">✕</button></header>
    <form class="chat-start"><p class="note">Como podemos ajudar sua arena?</p>
      <div class="chat-intents" role="group" aria-label="Assunto do atendimento"><button type="button" data-chat-intent="compra" aria-pressed="true">Dúvida sobre compra</button><button type="button" data-chat-intent="suporte" aria-pressed="false">Suporte técnico</button></div>
      <label for="chat-name">Seu nome</label><input id="chat-name" name="name" required maxlength="80" autocomplete="name" placeholder="Como podemos chamar você?">
      <label for="chat-email">E-mail para resposta</label><input id="chat-email" name="email" type="email" required maxlength="200" autocomplete="email" placeholder="voce@exemplo.com">
      <label for="chat-message">Sua mensagem</label><textarea id="chat-message" name="message" required maxlength="1950" placeholder="Conte como podemos ajudar."></textarea>
      <details><summary>Adicionar telefone (opcional)</summary><label for="chat-phone">WhatsApp / telefone</label><input id="chat-phone" name="phone" type="tel" maxlength="30" autocomplete="tel"></details>
      <button type="submit" class="btn">Enviar mensagem</button><p class="chat-note">Usamos seus dados para responder ao atendimento. <a href="/privacidade.html">Privacidade</a></p><p class="msg chat-msg" role="status" aria-live="polite"></p></form>
    <div class="chat-room hidden"><div class="chat-log" role="log" aria-live="polite" aria-label="Mensagens"></div><form class="chat-send"><textarea name="text" required maxlength="2000" aria-label="Sua mensagem" placeholder="Escreva sua mensagem…"></textarea><button class="btn small">Enviar</button></form>
      <button type="button" class="chat-new">Iniciar nova conversa</button></div>
  </section>`;
  document.body.appendChild(box);
  const panel = box.querySelector('.chat-panel'), log = box.querySelector('.chat-log'), start = box.querySelector('.chat-start'), room = box.querySelector('.chat-room');
  let last = 0, timer = null, data = null, lastSender = '', intent = 'compra';
  const chooseIntent = value => { intent = value === 'suporte' ? 'suporte' : 'compra'; box.querySelectorAll('[data-chat-intent]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.chatIntent === intent))); };
  box.querySelectorAll('[data-chat-intent]').forEach(b => b.onclick = () => chooseIntent(b.dataset.chatIntent));
  const time = t => new Date(t).toLocaleTimeString(({en: 'en-US', es: 'es'})[window.gzSite && gzSite.lang] || 'pt-BR', {hour: '2-digit', minute: '2-digit'});
  function addMessages(list) {
    for (const m of list || []) { if (m.id <= last) continue; last = m.id;
      const d = document.createElement('div'); d.className = 'chat-bubble ' + (m.sender === 'admin' ? 'from-admin' : 'from-user');
      d.innerHTML = `<p></p><small>${m.sender === 'admin' ? 'GameZoney' : ''} ${time(m.at)}</small>`; d.querySelector('p').textContent = m.text; log.appendChild(d); lastSender = m.sender; }
    // 1.3: abaixo da mensagem do cliente, até o atendente responder
    log.querySelector('.chat-wait')?.remove();
    if (lastSender === 'user') { const w = document.createElement('div'); w.className = 'chat-wait'; w.textContent = 'Mensagem recebida, aguarde um momento...'; log.appendChild(w); }
    log.scrollTop = log.scrollHeight;
  }
  const status = online => { box.querySelector('.chat-status').textContent = online ? '● Online agora' : 'Deixe sua mensagem: respondemos por e-mail'; box.querySelector('.chat-status').classList.toggle('on', online); };
  async function refresh() {
    try { data = await api('/api/chat' + (last ? '?after=' + last : '')); } catch { return; }
    status(data.online);
    if (data.chat) { start.classList.add('hidden'); room.classList.remove('hidden'); addMessages(data.messages); }
    else { start.classList.remove('hidden'); room.classList.add('hidden');
      if (data.user) { start.elements.namedItem('name').value ||= data.user.name || ''; start.email.value ||= data.user.email || ''; start.phone.value ||= data.user.phone || ''; } }
  }
  const opener = box.querySelector('.chat-open');
  const openChat = kind => {
    if (kind) chooseIntent(kind);
    panel.classList.remove('hidden'); opener.setAttribute('aria-expanded', 'true');
    refresh(); clearInterval(timer); timer = setInterval(refresh, 4000);
    box.querySelector('.chat-close').focus();
  };
  const closeChat = () => { panel.classList.add('hidden'); opener.setAttribute('aria-expanded', 'false'); clearInterval(timer); opener.focus(); };
  opener.onclick = () => panel.classList.contains('hidden') ? openChat() : closeChat();
  box.querySelector('.chat-close').onclick = closeChat;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.classList.contains('hidden')) closeChat(); });
  document.addEventListener('click', e => { const trigger = e.target.closest('[data-open-chat]'); if (trigger) openChat(trigger.dataset.openChat); });
  start.onsubmit = e => { e.preventDefault(); busy(start.querySelector('[type=submit]'), async () => {
    try { const r = await api('/api/chat/start', {name: start.elements.namedItem('name').value, email: start.email.value, phone: start.phone.value, message: (intent === 'suporte' ? '[Suporte] ' : '[Compra] ') + start.message.value}); start.message.value = ''; last = 0; lastSender = ''; log.innerHTML = ''; status(r.online); start.classList.add('hidden'); room.classList.remove('hidden'); addMessages(r.messages); }
    catch (err) { showMsg(box.querySelector('.chat-msg'), err.message); } }); };
  const send = room.querySelector('.chat-send');
  send.onsubmit = e => { e.preventDefault(); const text = send.text.value.trim(); if (!text) return; busy(send.querySelector('button'), async () => {
    try { const r = await api('/api/chat/send', {text, after: last}); send.text.value = ''; addMessages(r.messages); } catch (err) { let error = room.querySelector('.chat-send-error'); if (!error) { error = document.createElement('p'); error.className = 'msg err chat-send-error'; error.setAttribute('role', 'alert'); room.appendChild(error); } error.textContent = err.message; } }); };
  send.text.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send.requestSubmit(); } });
  room.querySelector('.chat-new').onclick = async () => { await api('/api/chat/end', {}).catch(() => {}); last = 0; lastSender = ''; log.innerHTML = ''; refresh(); };
})();

// ---------- 1.2: avaliações (página inicial: as 3 escolhidas pelo administrador, na ordem dele, sem data) ----------
const starsHtml = n => '<span class="stars" aria-label="' + n + ' de 5">' + '★'.repeat(n) + '<span class="off">' + '★'.repeat(5 - n) + '</span></span>';
function reviewCard(r) {
  return `<article class="review">${starsHtml(r.stars)}<p data-no-i18n>${esc(r.text)}</p>${r.images.length ? `<div class="pics protect">${r.images.map(src => `<div class="shot" data-zoom><img src="${esc(src)}" alt="" loading="lazy" draggable="false"></div>`).join('')}</div>` : ''}<div class="who" data-no-i18n><b>${esc(r.name)}</b>${r.organization ? `<span>${esc(r.organization)}</span>` : ''}</div></article>`;
}
(async () => {
  const box = $('#featured-reviews'); if (!box) return;
  try { const r = await api('/api/reviews/featured'); if (!r.reviews.length) return; box.innerHTML = r.reviews.map(reviewCard).join(''); $('#avaliacoes').classList.remove('hidden'); } catch { }
})();

// ---------- 1.3: imagens protegidas (sem clique direito/arrastar) e ampliação na própria página ----------
document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.protect, .zoom-view')) e.preventDefault(); });
document.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('.protect, .zoom-view')) e.preventDefault(); });
document.addEventListener('click', e => {
  const trigger = e.target.closest && e.target.closest('[data-zoom]'); if (!trigger) return;
  const img = trigger.querySelector('img'); if (!img || document.querySelector('dialog.zoom-view')) return;
  const previousFocus = document.activeElement;
  const view = document.createElement('dialog'); view.className = 'zoom-view'; view.setAttribute('aria-label', img.alt || 'Tela do GameZoney');
  view.innerHTML = '<button type="button" class="zoom-close" aria-label="Fechar imagem">×</button><div class="zoom-img"></div><p class="zoom-caption"></p>';
  const big = document.createElement('img'); big.src = img.currentSrc || img.src; big.alt = img.alt || ''; big.draggable = false;
  view.querySelector('.zoom-img').appendChild(big); view.querySelector('.zoom-caption').textContent = img.alt || 'GameZoney';
  view.querySelector('.zoom-close').onclick = () => view.close();
  view.addEventListener('click', event => { if (event.target === view) view.close(); });
  view.addEventListener('close', () => { view.remove(); if (previousFocus?.isConnected) previousFocus.focus(); });
  document.body.appendChild(view); view.showModal(); view.querySelector('.zoom-close').focus();
});
