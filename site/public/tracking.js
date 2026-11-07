'use strict';
// GameZoney — 2.8: Pixel da Meta e tag do Google, somente com o consentimento do visitante (LGPD).
// Sem IDs configurados em /admin › Anúncios, este arquivo não faz nada (nem mostra o aviso de cookies).
(() => {
  const KEY = 'gz-consent', queue = [];
  let cfg = null, loaded = false, decided = false;
  const getConsent = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const setConsent = v => { try { localStorage.setItem(KEY, v); } catch { } };
  const t = s => (window.gzSite && gzSite.t ? gzSite.t(s) : s);
  const addScript = src => { const s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); };

  function load() {
    if (loaded || !cfg) return; loaded = true;
    if (cfg.meta) {
      const f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
      if (!window._fbq) window._fbq = f; f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
      addScript('https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', cfg.meta); fbq('track', 'PageView');
    }
    if (cfg.google && cfg.google.length) {
      window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
      gtag('js', new Date()); for (const id of cfg.google) gtag('config', id);
      addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.google[0]));
    }
    // cadastro feito agora (o site deixa a marca "gzev=signup" por 10 min)
    if (/(^|;\s*)gzev=signup/.test(document.cookie)) { document.cookie = 'gzev=; Path=/; Max-Age=0; SameSite=Lax'; send('signup', {}); }
    while (queue.length) send(...queue.shift());
  }
  function send(ev, d) {
    const value = Number(d.value) || 0, cur = {currency: 'BRL', value};
    if (window.fbq && cfg.meta) {
      if (ev === 'signup') fbq('track', 'CompleteRegistration');
      if (ev === 'checkout') fbq('track', 'InitiateCheckout', {...cur, content_name: d.plan || ''});
      if (ev === 'subscribe') fbq('track', 'Subscribe', {...cur, predicted_ltv: value, content_name: d.plan || ''});
    }
    if (window.gtag && cfg.google && cfg.google.length) {
      if (ev === 'signup') { gtag('event', 'sign_up', {method: 'site'}); if (cfg.googleSignup) gtag('event', 'conversion', {send_to: cfg.googleSignup}); }
      if (ev === 'checkout') gtag('event', 'begin_checkout', {...cur, items: [{item_name: d.plan || 'Plano'}]});
      if (ev === 'subscribe') { gtag('event', 'purchase', {...cur, transaction_id: d.id || '', items: [{item_name: d.plan || 'Plano'}]}); if (cfg.googlePurchase) gtag('event', 'conversion', {send_to: cfg.googlePurchase, ...cur, transaction_id: d.id || ''}); }
    }
  }
  // usado pelas páginas (carrinho): guarda até o visitante decidir; recusado = descartado
  window.gzTrack = (ev, d = {}) => { if (loaded) send(ev, d); else if (!decided) queue.push([ev, d]); };

  function banner() {
    if (document.querySelector('.cookie-banner')) return;
    const b = document.createElement('div'); b.className = 'cookie-banner'; b.dataset.gzDyn = ''; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', t('Cookies'));
    b.innerHTML = '<p></p><div class="cookie-actions"><a href="/privacidade.html"></a><button type="button" class="btn small ghost" data-c="no"></button><button type="button" class="btn small gold" data-c="yes"></button></div>';
    b.querySelector('p').textContent = t('Usamos cookies da Meta e do Google para medir e melhorar nossos anúncios. Você pode aceitar ou recusar; o site funciona igual.');
    b.querySelector('a').textContent = t('Privacidade'); b.querySelector('[data-c=no]').textContent = t('Recusar'); b.querySelector('[data-c=yes]').textContent = t('Aceitar');
    b.onclick = e => { const c = e.target.closest('[data-c]'); if (!c) return; decided = true; setConsent(c.dataset.c); b.remove(); if (c.dataset.c === 'yes') load(); else { queue.length = 0; if (loaded) location.reload(); } };
    document.body.appendChild(b);
  }
  function footerLink() {
    const place = document.querySelector('.footer-bottom'); if (!place || place.querySelector('.cookie-prefs')) return;
    const a = document.createElement('button'); a.type = 'button'; a.className = 'cookie-prefs'; a.dataset.gzDyn = ''; a.textContent = t('Preferências de cookies');
    a.onclick = () => { decided = false; banner(); };
    place.appendChild(a);
  }
  if (location.pathname.startsWith('/admin')) return;
  fetch('/api/config', {credentials: 'same-origin'}).then(r => r.json()).then(c => {
    cfg = c && c.tracking; if (!cfg || (!cfg.meta && !(cfg.google || []).length)) { decided = true; queue.length = 0; return; }
    footerLink();
    const v = getConsent();
    if (v === 'yes') { decided = true; load(); } else if (v === 'no') { decided = true; queue.length = 0; } else banner();
  }).catch(() => { decided = true; });
})();
