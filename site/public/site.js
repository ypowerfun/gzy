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
