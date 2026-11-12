'use strict';
// 1.3.2: nome da Arena/Organização (todos os planos): sai no cupom, no fechamento de caixa, nas faturas e nos arquivos exportados.
function gzOrgName() { const n = String(state?.settings?.organization || '').trim(); return n || 'GameZoney'; }
async function renderOrganization(box) {
  if (!box || !isAdmin()) return;
  const cur = String(state?.settings?.organization || '');
  box.innerHTML = `<section class="panel" id="org-section"><h2>Nome da arena/organização</h2><p class="hint">Aparece no cupom de venda, no fechamento de caixa, nas faturas, no relatório financeiro e no nome das planilhas exportadas. Em branco, sai "GameZoney".</p>
    <form id="org-form" class="dialog-actions" style="justify-content:flex-start;align-items:flex-end;flex-wrap:wrap"><label style="flex:1 1 280px;margin:0">Nome<input name="name" maxlength="60" autocomplete="off" placeholder="Ex.: Arena Gamer Centro" value="${esc(cur)}"></label><button class="primary" style="flex:0 0 auto">Salvar nome</button></form></section>`;
  box.querySelector('#org-form').onsubmit = async e => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
    try { const r = await api('/organization', {name: e.target.name.value}); state.settings.organization = r.name; toast(r.name ? 'Nome salvo: ' + r.shown : 'Nome em branco: sai "GameZoney".'); }
    catch (err) { toast(err.message); } finally { btn.disabled = false; }
  };
}
