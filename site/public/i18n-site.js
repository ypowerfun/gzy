'use strict';
// GameZoney — site gamezoney.com — idioma do site (rodapé): Português (Brasil), English, Español.
// Os textos das páginas são escritos em português; este arquivo troca cada texto pela tradução
// (inclusive textos que aparecem depois, como mensagens e listas) e as capturas de tela do sistema.
(function () {
  const LANGS = ['pt', 'en', 'es'], COL = {en: 0, es: 1};
  const D = window.GZ_SITE_DICT || {exact: {}, patterns: []};
  const exact = new Map(Object.entries(D.exact));
  const esc = s => s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  const patterns = D.patterns.map(row => ({re: new RegExp('^' + row[0].split(/\{\d+\}/).map(esc).join('([\\s\\S]+?)') + '$'), out: row.slice(1)}));
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']), ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const texts = new WeakMap(), attrs = new WeakMap();
  let lang = 'pt', busy = false, cache = new Map();
  try {
    const saved = localStorage.getItem('gz-site-lang');
    // padrão: Português (Brasil); muda só quando o visitante escolhe no rodapé (fica lembrado)
    if (LANGS.includes(saved)) lang = saved;
  } catch { }
  function lookup(key) {
    const col = COL[lang], row = exact.get(key); if (row && row[col]) return row[col];
    for (const p of patterns) { const m = p.re.exec(key); if (!m) continue; const out = p.out[col]; if (!out) return null;
      return out.replace(/\{(\d+)\}/g, (_, k) => { const v = m[Number(k) + 1] ?? '', t = exact.get(v.trim()); return t && t[col] ? v.replace(v.trim(), t[col]) : v; }); }
    return null;
  }
  function translate(pt) {
    if (lang === 'pt' || !pt) return pt;
    const key = pt.replace(/\s+/g, ' ').trim(); if (!key || !/[A-Za-zÀ-ú]/.test(key)) return pt;
    let out = cache.get(key); if (out === undefined) { out = lookup(key); cache.set(key, out); }
    if (out == null) return pt;
    return pt.match(/^\s*/)[0] + out + pt.match(/\s*$/)[0];
  }
  function textNode(n) {
    const p = n.parentNode; if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('[data-no-i18n]'))) return;
    let rec = texts.get(n); if (!rec || n.nodeValue !== rec.shown) { rec = {pt: n.nodeValue}; texts.set(n, rec); }
    const out = translate(rec.pt); rec.shown = out; if (n.nodeValue !== out) n.nodeValue = out;
  }
  function element(el) {
    if (el.closest && el.closest('[data-no-i18n]')) return;
    let rec = attrs.get(el);
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue; if (!rec) { rec = {}; attrs.set(el, rec); }
      const v = el.getAttribute(a); let r = rec[a]; if (!r || v !== r.shown) { r = {pt: v}; rec[a] = r; }
      const out = translate(r.pt); r.shown = out; if (v !== out) el.setAttribute(a, out);
    }
    // capturas de tela do sistema no idioma escolhido
    if (el.dataset && el.dataset.tela) { const src = `/img/telas/${el.dataset.tela}-${lang}.jpg`; if (el.getAttribute('src') !== src) el.setAttribute('src', src); }
    if (el.dataset && el.dataset.guia) { const src = `/guia-img/${el.dataset.guia}-${lang}.jpg`; if (el.getAttribute('src') !== src) el.setAttribute('src', src); }
    if (el.dataset && el.dataset.telaLink) { const href = `/img/telas/${el.dataset.telaLink}-${lang}.jpg`; if (el.getAttribute('href') !== href) el.setAttribute('href', href); }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { element(root); if (SKIP.has(root.nodeName)) return; }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) textNode(n); else element(n); }
  }
  let ptTitle = null;
  function apply() {
    if (busy) return; busy = true;
    try { walk(document.body); if (ptTitle === null) ptTitle = document.title; document.title = translate(ptTitle) || ptTitle; } finally { busy = false; }
    document.documentElement.lang = {pt: 'pt-BR', en: 'en', es: 'es'}[lang];
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  }
  const observer = new MutationObserver(list => {
    if (busy) return; busy = true;
    try { for (const m of list) { if (m.type === 'characterData') textNode(m.target); else if (m.type === 'attributes') element(m.target); else m.addedNodes.forEach(walk); } } finally { busy = false; }
  });
  function start() {
    apply();
    observer.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS});
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-lang]'); if (b) { e.preventDefault(); window.gzSite.set(b.dataset.lang); } });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.gzSite = {
    get lang() { return lang; }, t: translate,
    set(next) { if (!LANGS.includes(next) || next === lang) return; lang = next; cache = new Map(); try { localStorage.setItem('gz-site-lang', lang); } catch { } apply(); }
  };
})();
