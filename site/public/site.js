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
function showMsg(el, text, ok) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); }
async function busy(btn, fn) { btn.disabled = true; try { return await fn(); } finally { btn.disabled = false; } }
let siteConfig = null;
async function loadConfig() {
  try { siteConfig = await api('/api/config'); } catch { return; }
  $$('[data-price]').forEach(e => e.textContent = money(siteConfig.priceCents));
  $$('[data-price-label]').forEach(e => e.textContent = siteConfig.priceLabel);
  $$('[data-list-price]').forEach(e => { if (siteConfig.listPriceCents > siteConfig.priceCents) { e.textContent = 'De ' + money(siteConfig.listPriceCents); e.classList.remove('hidden'); } });
  const badge = $('#promo-badge'); if (badge) badge.textContent = siteConfig.priceLabel + ' • Licença vitalícia ' + money(siteConfig.priceCents);
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
  document.querySelectorAll('footer.site .wrap').forEach(w => {
    if (w.querySelector('.ig-link')) return;
    const a = document.createElement('a'); a.className = 'ig-link'; a.href = IG_URL; a.target = '_blank'; a.rel = 'noopener';
    a.title = 'Instagram @gamezoney_'; a.innerHTML = IG_SVG + '<span>@gamezoney_</span>'; w.appendChild(a);
  });
})();
(function liveChat() {
  if (document.body.dataset.noChat !== undefined) return;
  const box = document.createElement('div'); box.className = 'chat-widget';
  box.innerHTML = `<button type="button" class="chat-open"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm0 2v11.2L7.2 16H20V6H4zm3 3h10v2H7V9zm0 3h7v2H7v-2z"/></svg><span>Fale conosco</span></button>
  <section class="chat-panel hidden" aria-label="Chat">
    <header><div><b>Fale conosco</b><small class="chat-status"></small></div><button type="button" class="chat-close" aria-label="Fechar">✕</button></header>
    <form class="chat-start"><p class="note">Antes de iniciar, precisamos de algumas informações:</p>
      <input name="name" required maxlength="80" placeholder="Nome completo"><input name="email" type="email" required maxlength="200" placeholder="E-mail">
      <input name="phone" maxlength="30" placeholder="WhatsApp / telefone"><textarea name="message" required maxlength="2000" placeholder="Como podemos ajudar?"></textarea>
      <button class="btn">Iniciar conversa</button><p class="msg chat-msg"></p></form>
    <div class="chat-room hidden"><div class="chat-log"></div><form class="chat-send"><textarea name="text" required maxlength="2000" placeholder="Escreva sua mensagem…"></textarea><button class="btn small">Enviar</button></form>
      <button type="button" class="chat-new">Iniciar nova conversa</button></div>
  </section>`;
  document.body.appendChild(box);
  const panel = box.querySelector('.chat-panel'), log = box.querySelector('.chat-log'), start = box.querySelector('.chat-start'), room = box.querySelector('.chat-room');
  let last = 0, timer = null, data = null, lastSender = '';
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
      if (data.user) { start.name.value ||= data.user.name || ''; start.email.value ||= data.user.email || ''; start.phone.value ||= data.user.phone || ''; } }
  }
  box.querySelector('.chat-open').onclick = () => { panel.classList.toggle('hidden'); if (!panel.classList.contains('hidden')) { refresh(); clearInterval(timer); timer = setInterval(refresh, 4000); } else clearInterval(timer); };
  box.querySelector('.chat-close').onclick = () => { panel.classList.add('hidden'); clearInterval(timer); };
  start.onsubmit = e => { e.preventDefault(); busy(start.querySelector('button'), async () => {
    try { const r = await api('/api/chat/start', {name: start.name.value, email: start.email.value, phone: start.phone.value, message: start.message.value}); start.message.value = ''; last = 0; lastSender = ''; log.innerHTML = ''; status(r.online); start.classList.add('hidden'); room.classList.remove('hidden'); addMessages(r.messages); }
    catch (err) { showMsg(box.querySelector('.chat-msg'), err.message); } }); };
  const send = room.querySelector('.chat-send');
  send.onsubmit = e => { e.preventDefault(); const text = send.text.value.trim(); if (!text) return; busy(send.querySelector('button'), async () => {
    try { const r = await api('/api/chat/send', {text, after: last}); send.text.value = ''; addMessages(r.messages); } catch (err) { alert(err.message); } }); };
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
  const z = e.target.closest && e.target.closest('[data-zoom]'); if (!z) return;
  const img = z.querySelector('img'); if (!img) return;
  const v = document.createElement('div'); v.className = 'zoom-view'; v.setAttribute('role', 'dialog');
  v.innerHTML = '<button type="button" class="zoom-close" aria-label="Fechar">✕</button><div class="zoom-img"></div>';
  const big = document.createElement('img'); big.src = img.currentSrc || img.src; big.alt = img.alt || ''; big.draggable = false; v.querySelector('.zoom-img').appendChild(big);
  const close = () => { v.remove(); document.removeEventListener('keydown', esc); };
  const esc = k => { if (k.key === 'Escape') close(); };
  v.addEventListener('click', ev => { if (ev.target === v || ev.target.closest('.zoom-close')) close(); });
  document.addEventListener('keydown', esc); document.body.appendChild(v);
});
