'use strict';
// GameZoney — site gamezoney.com — funções comuns das páginas.
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const money = c => (c / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const fmtDate = t => t ? new Date(t).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'}) : '—';
async function api(url, body) {
  const r = await fetch(url, body === undefined ? {credentials: 'same-origin'} : {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'Erro ' + r.status); e.status = r.status; e.data = data; throw e; }
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
  // 2.0: "a partir de" (menor preço mensal dos planos) e os cartões dos planos na página inicial
  if (Number.isInteger(siteConfig.arenas)) $$('[data-arenas]').forEach(e => e.textContent = '+' + siteConfig.arenas);
  if (siteConfig.plans && siteConfig.plans.some(p => !p.free)) { const from = Math.min(...siteConfig.plans.filter(p => !p.free).map(p => Math.min(p.monthly, Math.round(p.annual / 12)))); $$('[data-plan-from]').forEach(e => e.textContent = money(from)); renderPlans(); }
  document.dispatchEvent(new CustomEvent('gz:config', {detail: siteConfig}));
}
// ---------- 2.0: cartões dos planos (Standard / Pro), mensal ou anual ----------
const PLAN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.6 16.6 5 12l1.4-1.4 3.2 3.2 8-8L19 7.2z"/></svg>';
let planPeriod = 'mensal';
function planView(p, period) {
  const annual = period === 'anual', price = annual ? Math.round(p.annual / 12) : p.monthly;
  const old = annual ? (p.annualList ? Math.round(p.annualList / 12) : p.monthly) : (p.monthlyList || 0);
  const off = old > price ? Math.round((1 - price / old) * 100) : 0;
  return {price, old: old > price ? old : 0, badge: p.badge || (off ? `${off}% de desconto` : ''), total: annual ? p.annual : p.monthly};
}
function renderPlans() {
  const box = $('#plans-grid'); if (!box || !siteConfig || !siteConfig.plans) return;
  $$('[data-period]').forEach(b => b.classList.toggle('on', b.dataset.period === planPeriod));
  box.innerHTML = siteConfig.plans.map(p => { const v = planView(p, planPeriod), annual = planPeriod === 'anual';
    // Free = teste grátis de 30 dias: leva direto para os downloads (quem não está logado entra e volta para lá)
    if (p.free) return `<article class="plan-card free"><div class="plan-body"><div class="plan-head"><h3>${esc(p.name)}</h3><span class="plan-badge free">30 dias grátis</span></div><p class="plan-old empty">&nbsp;</p>
      <p class="plan-price"><strong>${money(0)}</strong><span>/30 dias</span></p><a class="btn outline plan-btn" href="/conta#downloads">Escolher plano</a>
      <p class="plan-terms">Baixe e use as funções essenciais e o autoatendimento por 30 dias, sem cartão. Depois, escolha o Standard ou o Pro.</p>
      <ul class="plan-feats">${p.features.map(f => `<li>${PLAN_ICON}<span>${esc(f)}</span></li>`).join('')}</ul></div></article>`;
    return `<article class="plan-card${p.popular ? ' popular' : ''}">${p.popular ? '<div class="plan-ribbon">Mais popular</div>' : ''}<div class="plan-body">
      <div class="plan-head"><h3>${esc(p.name)}</h3>${v.badge ? `<span class="plan-badge">${esc(v.badge)}</span>` : ''}</div>
      <p class="plan-old${v.old ? '' : ' empty'}">${v.old ? money(v.old) : '&nbsp;'}</p>
      <p class="plan-price"><strong>${money(v.price)}</strong><span>/mês</span></p>
      <a class="btn ${p.popular ? 'gold' : 'outline'} plan-btn" href="/carrinho#${esc(p.id)}-${planPeriod}">Escolher plano</a>
      <p class="plan-terms">${annual ? `Pague ${money(p.annual)} por ano no cartão de crédito.` : `Cobrado ${money(p.monthly)} todo mês no cartão de crédito.`} Renovação automática. Cancele quando quiser.</p>
      <ul class="plan-feats">${p.features.map(f => `<li>${PLAN_ICON}<span>${esc(f)}</span></li>`).join('')}</ul></div></article>`; }).join('');
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-period]'); if (b && $('#plans-grid')) { planPeriod = b.dataset.period; renderPlans(); } });
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
    const a = document.createElement('a'); a.className = 'ig-link'; a.dataset.gzDyn = ''; a.href = IG_URL; a.target = '_blank'; a.rel = 'noopener';
    a.title = 'Instagram @gamezoney_'; a.innerHTML = IG_SVG + '<span>@gamezoney_</span>'; w.appendChild(a);
  });
})();
(function liveChat() {
  if (document.body.dataset.noChat !== undefined) return;
  const box = document.createElement('div'); box.className = 'chat-widget'; box.dataset.gzDyn = '';
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
      <div class="chat-actions"><button type="button" class="chat-human">Falar com especialista</button><button type="button" class="chat-finish">Encerrar e avaliar</button></div>
      <form class="chat-rate hidden"><p class="chat-rate-title">Como foi o atendimento?</p><div class="chat-stars" role="radiogroup" aria-label="Nota de 1 a 5">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" data-star="${n}" aria-label="${n} de 5">★</button>`).join('')}</div>
        <textarea name="comment" maxlength="500" aria-label="Comentário (opcional)" placeholder="Comentário (opcional)"></textarea><div class="chat-rate-buttons"><button type="submit" class="btn small">Enviar avaliação</button><button type="button" class="chat-rate-skip">Encerrar sem avaliar</button></div></form>
      <div class="chat-ended hidden" role="status"><p class="chat-ended-text">Esta conversa foi encerrada pela equipe GameZoney.</p><p class="chat-thanks hidden">Obrigado pela avaliação!</p><button type="button" class="btn small chat-new-ended">Abrir nova conversa</button></div>
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
      const d = document.createElement('div'); d.className = 'chat-bubble ' + (m.sender === 'user' ? 'from-user' : 'from-admin');
      d.innerHTML = `<p></p><small>${m.sender === 'admin' ? 'Especialista GameZoney' : m.sender === 'bot' ? 'Assistente virtual' : ''} ${time(m.at)}</small>`; if (m.sender === 'bot') d.classList.add('from-bot'); d.querySelector('p').textContent = m.text; log.appendChild(d); lastSender = m.sender; }
    // 1.3: abaixo da mensagem do cliente, até o atendente responder
    log.querySelector('.chat-wait')?.remove();
    if (lastSender === 'user' && !typingTimer) { const w = document.createElement('div'); w.className = 'chat-wait'; w.textContent = 'Mensagem recebida, aguarde um momento...'; log.appendChild(w); }
    log.scrollTop = log.scrollHeight;
  }
  // 2.15: o assistente "lê" a mensagem por 2 a 3 s antes de responder: bolinha girando no canto do chat e envio bloqueado até a resposta
  let typingTimer = null;
  function typing(ms) {
    clearTimeout(typingTimer); typingTimer = null; log.querySelector('.chat-typing')?.remove();
    const sendBox = room.querySelector('.chat-send'), on = Number(ms) > 0;
    sendBox.text.disabled = on; sendBox.querySelector('button').disabled = on; room.querySelector('.chat-human').disabled = on;
    if (!on) return;
    log.querySelector('.chat-wait')?.remove();
    const t = document.createElement('div'); t.className = 'chat-typing'; t.setAttribute('role', 'status');
    t.innerHTML = '<span class="chat-spinner" aria-hidden="true"></span><span></span>'; t.lastChild.textContent = 'Assistente está lendo sua mensagem…';
    log.appendChild(t); log.scrollTop = log.scrollHeight;
    typingTimer = setTimeout(() => { typingTimer = null; refresh(); }, Math.min(10000, Number(ms)) + 150);
  }
  const status = online => { box.querySelector('.chat-status').textContent = online ? '● Especialista online' : 'Assistente virtual 24 horas'; box.querySelector('.chat-status').classList.toggle('on', online); };
  // 2.4: conversa encerrada pelo administrador: some o campo de resposta e aparece o botão para abrir outra
  // 2.14: encerrar e avaliar (o cliente encerra; conversa encerrada pela equipe também pode ser avaliada)
  const rate = room.querySelector('.chat-rate'); let stars = 0, rating = false;
  const ended = (closed, chat = {}) => {
    const showRate = rating || (closed && !chat.rated && chat.closedBy !== 'timeout');
    room.querySelector('.chat-ended').classList.toggle('hidden', !closed || showRate); room.querySelector('.chat-send').classList.toggle('hidden', closed || rating);
    room.querySelector('.chat-new').classList.toggle('hidden', closed || rating); room.querySelector('.chat-actions').classList.toggle('hidden', closed || rating);
    rate.classList.toggle('hidden', !showRate);
    room.querySelector('.chat-ended-text').textContent = chat.closedBy === 'user' ? 'Conversa encerrada.' : chat.closedBy === 'timeout' ? 'Conversa encerrada por falta de resposta.' : 'Esta conversa foi encerrada pela equipe GameZoney.';
    room.querySelector('.chat-thanks').classList.toggle('hidden', !(chat.rating > 0));
    room.querySelector('.chat-human').classList.toggle('hidden', !!chat.handoff && !chat.bot);
    if (closed) log.querySelector('.chat-wait')?.remove(); };
  const setStars = n => { stars = n; rate.querySelectorAll('[data-star]').forEach(b => { const on = Number(b.dataset.star) <= n; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(Number(b.dataset.star) === n)); }); };
  rate.querySelectorAll('[data-star]').forEach(b => b.onclick = () => setStars(Number(b.dataset.star)));
  const sendRate = async n => { try { const r = await api('/api/chat/rate', {stars: n, comment: n ? rate.comment.value : ''}); rating = false; rate.comment.value = ''; setStars(0); data.chat = r.chat; ended(true, r.chat); }
    catch (err) { showMsg(box.querySelector('.chat-msg'), err.message); let e = rate.querySelector('.msg'); if (!e) { e = document.createElement('p'); e.className = 'msg err'; e.setAttribute('role', 'alert'); rate.appendChild(e); } e.textContent = err.message; } };
  rate.onsubmit = e => { e.preventDefault(); if (!stars) { let m = rate.querySelector('.msg'); if (!m) { m = document.createElement('p'); m.className = 'msg err'; m.setAttribute('role', 'alert'); rate.appendChild(m); } m.textContent = 'Escolha de 1 a 5 estrelas.'; return; } busy(rate.querySelector('[type=submit]'), () => sendRate(stars)); };
  rate.querySelector('.chat-rate-skip').onclick = () => sendRate(0);
  room.querySelector('.chat-finish').onclick = () => { rating = true; ended(false, data?.chat || {}); rate.querySelector('[data-star="5"]').focus(); };
  const lang = () => (window.gzSite && gzSite.lang) || 'pt';
  async function refresh() {
    try { data = await api('/api/chat' + (last ? '?after=' + last : '')); } catch { return; }
    status(data.online);
    if (data.chat) { start.classList.add('hidden'); room.classList.remove('hidden'); addMessages(data.messages); typing(data.typingMs); if (!rating) ended(data.chat.status === 'closed', data.chat); }
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
    try { const r = await api('/api/chat/start', {name: start.elements.namedItem('name').value, email: start.email.value, phone: start.phone.value, message: (intent === 'suporte' ? '[Suporte] ' : '[Compra] ') + start.message.value, lang: lang()}); start.message.value = ''; last = 0; lastSender = ''; log.innerHTML = ''; status(r.online); start.classList.add('hidden'); room.classList.remove('hidden'); addMessages(r.messages); typing(r.typingMs); data = {...(data || {}), chat: r.chat}; rating = false; ended(false, r.chat); }
    catch (err) { showMsg(box.querySelector('.chat-msg'), err.message); } }); };
  const send = room.querySelector('.chat-send');
  const sendText = text => busy(send.querySelector('button'), async () => {
    try { const r = await api('/api/chat/send', {text, after: last, lang: lang()}); send.text.value = ''; addMessages(r.messages); typing(r.typingMs); if (r.chat) { data = {...(data || {}), chat: r.chat}; ended(false, r.chat); } } catch (err) { let error = room.querySelector('.chat-send-error'); if (!error) { error = document.createElement('p'); error.className = 'msg err chat-send-error'; error.setAttribute('role', 'alert'); room.appendChild(error); } error.textContent = err.message; refresh(); } });
  send.onsubmit = e => { e.preventDefault(); const text = send.text.value.trim(); if (text) sendText(text); };
  room.querySelector('.chat-human').onclick = () => sendText(lang() === 'en' ? 'Talk to a specialist' : lang() === 'es' ? 'Hablar con un especialista' : 'Falar com especialista');
  send.text.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send.requestSubmit(); } });
  const newChat = async () => { await api('/api/chat/end', {}).catch(() => {}); typing(0); last = 0; lastSender = ''; log.innerHTML = ''; room.querySelector('.chat-send-error')?.remove(); rating = false; ended(false); await refresh(); start.message?.focus(); };
  room.querySelector('.chat-new').onclick = newChat; room.querySelector('.chat-new-ended').onclick = newChat;
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
  view.dataset.gzDyn = ''; document.body.appendChild(view); view.showModal(); view.querySelector('.zoom-close').focus();
});

// ---------- 1.7: design do site (alterações feitas no editor do /admin) e parceiros do rodapé ----------
// Cada alteração aponta para um elemento pelo caminho (posição entre os irmãos) dentro do topo, do rodapé ou da página,
// e guarda uma "assinatura" (texto original em português ou nome da imagem). Se o HTML mudar e a assinatura não bater,
// a alteração é ignorada (nada quebra). Textos entram sempre como texto puro (nunca HTML).
window.gzDesign = (() => {
  const MOBILE = 760, SKIP = '[data-gz-dyn],script,style,noscript,#gz-design';
  const kids = el => [...el.children].filter(c => !c.matches(SKIP));
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const scopeOf = el => { const h = el.closest('header.topbar'); if (h) return ['*h', h]; const f = el.closest('footer'); if (f) return ['*f', f]; return ['page', document.body]; };
  function pathOf(el) {
    const [key, root] = scopeOf(el); const idx = [];
    for (let n = el; n && n !== root; n = n.parentElement) { const p = n.parentElement; if (!p) return null; const i = kids(p).indexOf(n); if (i < 0) return null; idx.unshift(i); }
    return {key, p: idx.join('.') || '0', root};
  }
  function find(root, p) { let el = root; if (p === '0' && root !== document.body) return root; for (const i of p.split('.').map(Number)) { el = kids(el)[i]; if (!el) return null; } return el; }
  function sigOf(el) {
    if (el.dataset.gzSig !== undefined) return el.dataset.gzSig;
    let s;
    if (el.tagName === 'IMG') s = 'img:' + String(el.getAttribute('src') || '').split('?')[0].split('/').pop().replace(/-(pt|en|es)(\.\w+)$/, '$2');
    else { const t = norm(window.gzSite && gzSite.ptOf ? gzSite.ptOf(el) : el.textContent); s = t ? t.slice(0, 60) : el.tagName.toLowerCase() + '.' + (el.classList[0] || ''); }
    el.dataset.gzSig = s; return s;
  }
  // estado original, para o editor conseguir restaurar
  const orig = new WeakMap();
  function snap(el) {
    if (orig.has(el)) return orig.get(el);
    const o = {style: el.getAttribute('style'), noI18n: el.hasAttribute('data-no-i18n'), text: el.children.length || /^(IMG|INPUT|TEXTAREA|SELECT|SVG|VIDEO|IFRAME|BR|HR|PICTURE|SOURCE)$/i.test(el.tagName) ? null : norm(window.gzSite && gzSite.ptOf ? gzSite.ptOf(el) : el.textContent),
      href: el.getAttribute('href'), src: el.getAttribute('src'), alt: el.getAttribute('alt'), tela: el.getAttribute('data-tela'), srcset: el.getAttribute('srcset')};
    orig.set(el, o); return o;
  }
  const lang = () => (window.gzSite && gzSite.lang) || 'pt';
  function applyItem(el, it, editing) {
    sigOf(el); const o = snap(el);
    el.setAttribute('style', o.style || ''); if (!o.style) el.removeAttribute('style');
    el.classList.remove('gz-ghost');
    if (it.x) { if (editing) el.classList.add('gz-ghost'); else el.style.setProperty('display', 'none', 'important'); }
    const b = innerWidth <= MOBILE ? it.m : it.d;
    if (b) { if (b.z && b.z !== 100) el.style.zoom = b.z / 100; if (b.dx || b.dy) el.style.translate = `${b.dx || 0}px ${b.dy || 0}px`; }
    if (it.t && o.text !== null) { const v = it.t[lang()] || it.t.pt; if (v !== undefined) { el.setAttribute('data-no-i18n', ''); if (el.textContent !== v) el.textContent = v; } }
    else if (o.text !== null && !o.noI18n && el.hasAttribute('data-no-i18n')) restoreText(el, o);
    if (el.tagName === 'A') { if (it.h) el.setAttribute('href', it.h); else if (o.href !== null) el.setAttribute('href', o.href); }
    if (el.tagName === 'IMG') {
      if (it.i) { el.removeAttribute('data-tela'); el.removeAttribute('srcset'); el.setAttribute('src', it.i); el.closest('picture')?.querySelectorAll('source').forEach(s => s.remove()); }
      else if (o.src !== null && el.getAttribute('src') !== o.src && !o.tela) el.setAttribute('src', o.src);
      if (typeof it.a === 'string' && it.a) el.setAttribute('alt', it.a);
    }
  }
  function restoreText(el, o) { if (!o.noI18n) el.removeAttribute('data-no-i18n'); el.textContent = o.text; }
  function restore(el) {
    const o = orig.get(el); if (!o) return;
    applyItem(el, {}, true);
    if (o.text !== null) restoreText(el, o);
    if (o.tela) { el.setAttribute('data-tela', o.tela); el.setAttribute('src', `/img/telas/${o.tela}-${lang()}.jpg`); }
    if (o.srcset) el.setAttribute('srcset', o.srcset);
    if (o.alt !== null) el.setAttribute('alt', o.alt);
  }
  const state = {key: null, lists: {page: [], '*h': [], '*f': []}, partners: [], editing: false};
  const roots = () => ({page: document.body, '*h': document.querySelector('header.topbar'), '*f': document.querySelector('footer')});
  function resolve(scope, it) { const root = roots()[scope]; if (!root) return null; const el = find(root, it.p); if (!el || (scope === 'page' && el.closest('header.topbar,footer'))) return null; return sigOf(el) === it.s ? el : null; }
  function applyAll() {
    for (const scope of ['*h', '*f', 'page']) for (const it of state.lists[scope]) { const el = resolve(scope, it); if (el) applyItem(el, it, state.editing); }
  }
  function partners() {
    document.querySelectorAll('footer .footer-trust').forEach(box => {
      box.querySelector('.partners')?.remove(); if (!state.partners.length) return;
      const w = document.createElement('div'); w.className = 'partners'; w.dataset.gzDyn = '';
      const t = document.createElement('span'); t.className = 'partners-title'; t.textContent = 'Parceiros'; w.appendChild(t);
      for (const p of state.partners) {
        const a = document.createElement(p.url ? 'a' : 'span'); a.className = 'partner'; a.title = p.name;
        if (p.url) { a.href = p.url; a.target = '_blank'; a.rel = 'noopener nofollow'; }
        const img = document.createElement('img'); img.src = p.img; img.alt = p.name; img.loading = 'lazy'; img.draggable = false; a.appendChild(img); w.appendChild(a);
      }
      box.prepend(w);
    });
  }
  const CACHE = 'gz-design:' + location.pathname;
  function use(d) { state.key = d.key || null; state.lists = {page: d.page || [], '*h': d.header || [], '*f': d.footer || []}; state.partners = d.partners || []; applyAll(); partners(); }
  async function load() {
    if (location.pathname.startsWith('/admin')) return;
    try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c) use(c); } catch { } // evita "piscar" o original
    try { const d = await api('/api/design?page=' + encodeURIComponent(location.pathname)); use(d); try { localStorage.setItem(CACHE, JSON.stringify(d)); } catch { } } catch { }
    if (/[?&]design=1\b/.test(location.search)) { const s = document.createElement('script'); s.src = '/design-editor.js?v=17'; document.body.appendChild(s); }
  }
  // troca de idioma ou de largura (computador ↔ celular): aplica de novo
  let wide = innerWidth > MOBILE; addEventListener('resize', () => { const w = innerWidth > MOBILE; if (w !== wide) { wide = w; applyAll(); } });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-lang]')) setTimeout(applyAll, 0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
  return {state, pathOf, find, sigOf, snap, applyItem, applyAll, restore, resolve, partners, MOBILE, scopeOf};
})();
