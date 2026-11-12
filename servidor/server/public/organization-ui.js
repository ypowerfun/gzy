'use strict';
// 1.3.2: nome da Arena/Organização (todos os planos): sai no cupom, no fechamento de caixa, nas faturas e nos arquivos exportados.
// 1.3.6: o campo saiu da Configuração e fica no topo do Perfil (administrador edita; operador só vê).
function gzOrgName() { const n = String(state?.settings?.organization || '').trim(); return n || 'GameZoney'; }
function gzOrgFieldHtml() {
  const cur = String(state?.settings?.organization || '');
  if (!isAdmin()) return `<div class="org-field"><span class="org-label">Arena/Organização</span><strong class="org-name">${esc(gzOrgName())}</strong></div>`;
  return `<form id="org-form" class="org-field"><label>Arena/Organização<input name="name" maxlength="60" autocomplete="off" placeholder="Ex.: Arena Gamer Centro" value="${esc(cur)}"></label><button class="primary">Salvar</button><small class="hint">Sai no cupom, no fechamento de caixa, nas faturas e nas planilhas exportadas. Em branco, sai "GameZoney".</small></form>`;
}
function gzOrgBind(root) {
  const form = root && root.querySelector('#org-form'); if (!form) return;
  form.onsubmit = async e => {
    e.preventDefault(); const btn = form.querySelector('button'); btn.disabled = true;
    try { const r = await api('/organization', {name: form.name.value}); state.settings.organization = r.name; form.name.value = r.name; toast(r.name ? 'Nome salvo: ' + r.shown : 'Nome em branco: sai "GameZoney".'); }
    catch (err) { toast(err.message); } finally { btn.disabled = false; }
  };
}
