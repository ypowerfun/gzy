'use strict';
// 1.0.5: idioma do painel (Perfil > Idioma): Português (Brasil), English, Español, Français, Русский.
// O dicionário fica em i18n-dict.js (gerado a partir de todos os textos do painel e das mensagens do servidor):
//  - "exact": texto fixo → tradução;
//  - "patterns": frases com valores, ex.: "{0} máquina(s)" → "{0} machine(s)" (os valores são mantidos).
// Toda a tela é traduzida automaticamente, inclusive janelas e listas que aparecem depois (MutationObserver).
// Nomes, nicks, valores e datas (dados) não são traduzidos.
(function () {
  const LANGS = {'pt-BR': 'Português (Brasil)', en: 'English', es: 'Español', fr: 'Français', ru: 'Русский'};
  const COL = {en: 0, es: 1, fr: 2, ru: 3};
  const D = window.GZ_I18N_DICT || {exact: {}, patterns: []};
  const exact = new Map(Object.entries(D.exact));
  const esc = s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const patterns = D.patterns.map(row => ({re: new RegExp('^' + row[0].split(/\{\d+\}/).map(esc).join('([\\s\\S]+?)') + '$'), out: row.slice(1)}));
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'PRE', 'CODE']); // conteúdo não traduzido (o placeholder do campo é)
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const texts = new WeakMap(), attrs = new WeakMap();
  let lang = 'pt-BR', busy = false, cache = new Map();
  try { const saved = localStorage.getItem('gz-lang'); if (saved && LANGS[saved]) lang = saved; } catch {}
  function lookup(key) {
    const col = COL[lang];
    const row = exact.get(key); if (row && row[col]) return row[col];
    if (!/[A-Za-zÀ-ú]{2}/.test(key)) return null;
    for (const p of patterns) {
      const m = p.re.exec(key); if (!m) continue;
      const out = p.out[col]; if (!out) return null;
      return out.replace(/\{(\d+)\}/g, (_, k) => { const v = m[Number(k) + 1] ?? ''; const t = exact.get(v.trim()); return t && t[col] ? v.replace(v.trim(), t[col]) : v; });
    }
    return null;
  }
  function translate(pt) {
    if (lang === 'pt-BR' || !pt) return pt;
    const key = pt.replace(/\s+/g, ' ').trim(); if (!key || !/[A-Za-zÀ-ú]/.test(key)) return pt;
    let out = cache.get(key);
    if (out === undefined) { out = lookup(key); cache.set(key, out); }
    if (out == null) return pt;
    const lead = pt.match(/^\s*/)[0], trail = pt.match(/\s*$/)[0];
    return lead + out + trail;
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
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { element(root); if (SKIP.has(root.nodeName)) return; }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) textNode(n); else element(n); }
  }
  function apply() { if (busy) return; busy = true; try { walk(document.body); } finally { busy = false; } document.documentElement.lang = lang; }
  const observer = new MutationObserver(list => {
    if (busy) return; busy = true;
    try { for (const m of list) { if (m.type === 'characterData') textNode(m.target); else if (m.type === 'attributes') element(m.target); else m.addedNodes.forEach(walk); } } finally { busy = false; }
  });
  function start() { apply(); observer.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS}); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.gzI18n = {
    langs: LANGS, get lang() { return lang; },
    set(next) { if (!LANGS[next] || next === lang) return; lang = next; cache = new Map(); try { localStorage.setItem('gz-lang', lang); } catch {} apply(); },
    t: translate
  };
})();
