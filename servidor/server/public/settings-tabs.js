'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.3.6: Configuração em ABAS no topo (como Caixa, Produtos/Serviços e Gerenciamento NF-e): uma área por vez, sem
// rolar a página para achar as outras. Cada quadro continua sendo criado pelo seu módulo (license-ui, backup-ui,
// self-service-ui, pc-notices-ui, pc-devices-ui, app-manager-ui…), na hora em que os dados chegam; aqui só se escolhe
// qual aparece. Quadro novo sem aba conhecida ganha uma aba com o título do quadro (nunca some).
const GZ_CFG_TABS = [
  ['license', 'Licença', ['license-section', 'update-section']],
  ['brand', 'Personalizar visual', ['cfg-brand']],
  ['accounts', 'Contas de acesso', ['cfg-accounts']],
  ['machines', 'Máquinas', ['cfg-machines']],
  ['backup', 'Backup', ['backup-section']],
  ['net', 'Servidor IP', ['net-section']],
  ['self', 'Autoatendimento', ['self-section']],
  ['notices', 'Avisos no PC', ['pcn-section']],
  ['print', 'Impressão', ['print-section']],
  ['diskless', 'Boot pela rede', ['diskless-section']],
  ['units', 'Multi-Unidade', ['units-section']],
];
const GZ_CFG_BY_ID = new Map(GZ_CFG_TABS.flatMap(([key, , ids]) => ids.map(id => [id, key])));
let gzCfgTab = (() => { try { return localStorage.getItem('gz-cfg-tab') || 'license'; } catch { return 'license'; } })();
function gzCfgInfo(el) {
  const known = GZ_CFG_BY_ID.get(el.id);
  if (known) return [known, GZ_CFG_TABS.find(t => t[0] === known)[1]];
  const title = (el.querySelector('h2')?.textContent || '').trim() || 'Outros';
  return ['x:' + (el.id || title), title];
}
function gzCfgApply() {
  const box = document.getElementById('view');
  if (!box || view !== 'settings' || !isAdmin()) return;
  const kids = [...box.children].filter(el => el.id !== 'cfg-tabs');
  if (!kids.length) return;
  const present = new Map();
  for (const el of kids) { const [key, label] = gzCfgInfo(el); if (!present.has(key)) present.set(key, label); }
  const order = [...GZ_CFG_TABS.map(t => t[0]).filter(k => present.has(k)), ...[...present.keys()].filter(k => k.startsWith('x:'))];
  // a aba escolhida pode ainda não ter chegado (os quadros carregam em tempos diferentes): mostra a primeira e volta
  // para a escolhida assim que ela aparecer
  const active = present.has(gzCfgTab) ? gzCfgTab : order[0];
  let bar = document.getElementById('cfg-tabs');
  if (!bar) { bar = document.createElement('div'); bar.id = 'cfg-tabs'; bar.className = 'shop-tabs cfg-tabs'; }
  if (box.firstElementChild !== bar) box.prepend(bar);
  const sig = order.join('|') + '#' + active;
  if (bar.dataset.sig !== sig) {
    bar.dataset.sig = sig;
    bar.innerHTML = order.map(k => `<button type="button" data-cfg-tab="${esc(k)}" class="${k === active ? 'active' : ''}">${esc(present.get(k))}</button>`).join('');
  }
  for (const el of kids) el.classList.toggle('cfg-off', gzCfgInfo(el)[0] !== active);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cfg-tab]'); if (!b) return;
  gzCfgTab = b.dataset.cfgTab; try { localStorage.setItem('gz-cfg-tab', gzCfgTab); } catch { }
  gzCfgApply();
});
// abrir uma aba por código (ex.: avisos que levam a Configuração › Licença)
function gzCfgOpen(key) { gzCfgTab = key; try { localStorage.setItem('gz-cfg-tab', key); } catch { } gzCfgApply(); }
(function watch() {
  const box = document.getElementById('view');
  if (!box) return void document.addEventListener('DOMContentLoaded', watch, {once: true});
  new MutationObserver(gzCfgApply).observe(box, {childList: true});
  gzCfgApply();
})();
