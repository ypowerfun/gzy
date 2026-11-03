'use strict';
// 3.0.26: painel do servidor em modo "aplicativo".
// - Sem menu do botão direito (Inspecionar, Traduzir, Salvar como...), sem seleção de texto fora dos campos,
//   sem arrastar e sem atalhos do navegador (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S, Ctrl+P, zoom...).
// - Ajuste automático à resolução: a interface é reduzida proporcionalmente em telas/janelas menores para que
//   nenhum botão, coluna ou texto fique escondido. F5 / Ctrl+R (atualizar) continuam permitidos.
(function () {
  const editable = el => !!(el && el.closest && el.closest('input,textarea,select,[contenteditable="true"]'));
  document.addEventListener('contextmenu', e => e.preventDefault(), true);
  document.addEventListener('selectstart', e => { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener('dragstart', e => { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    const fn = /^f([1-9]|1[0-2])$/.test(k) && k !== 'f5';                    // F1..F12, exceto F5
    const devtools = ctrl && e.shiftKey && ['i', 'j', 'c', 'k', 'm', 'delete', 'o', 'b', 'e'].includes(k);
    const browser = ctrl && !e.shiftKey && ['u', 's', 'p', 'o', 'h', 'j', 'd', 'f', 'g', 'e', 'k', 'l', 'n', 't', '+', '=', '-', '_', '0'].includes(k);
    const alt = e.altKey && ['f', 'e', 'home', 'arrowleft', 'arrowright'].includes(k);
    const caret = k === 'f7';
    // Copiar/colar/desfazer continuam funcionando dentro dos campos de texto.
    if (ctrl && !e.shiftKey && ['a', 'c', 'x', 'v', 'z', 'y'].includes(k)) { if (!editable(e.target) && k === 'a') e.preventDefault(); return; }
    if (fn || devtools || browser || alt || caret) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  window.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, {passive: false, capture: true});   // zoom com Ctrl+roda
  window.addEventListener('gesturestart', e => e.preventDefault());

  // Ajuste automático à resolução (base do layout: 1366 x 740).
  const BASE_W = 1366, BASE_H = 740, MIN = 0.62;
  function fit() {
    const w = window.innerWidth, h = window.innerHeight;
    const z = Math.max(MIN, Math.min(1, w / BASE_W, h / BASE_H));
    document.documentElement.style.zoom = z === 1 ? '' : String(Math.round(z * 1000) / 1000);
    document.documentElement.style.setProperty('--fit-zoom', String(Math.round(z * 1000) / 1000));
    document.documentElement.classList.toggle('compact', z < 0.9);
    document.documentElement.classList.toggle('narrow', w / z < 1180);   // largura efetiva apos o ajuste
  }
  fit(); window.addEventListener('resize', fit);
})();
