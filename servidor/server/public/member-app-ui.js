'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.3.7 (plano Pro): Gerenciar App › App do cliente (app.gamezoney.com/<endereço>) e Conquistas.
let gzAppTab = (() => { try { return localStorage.getItem('gz-app-tab') || 'client'; } catch { return 'client'; } })();
function gzAppTabs() {
  const t = (k, label) => `<button type="button" data-app-tab="${k}" class="${gzAppTab === k ? 'active' : ''}">${label}</button>`;
  return `<div class="shop-tabs">${t('client', '📱 App do cliente')}${t('achievements', '🏆 Conquistas')}${t('cloud', '☁ Servidor em nuvem')}</div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-app-tab]'); if (!b) return;
  gzAppTab = b.dataset.appTab; try { localStorage.setItem('gz-app-tab', gzAppTab); } catch { }
  if (view === 'app') renderAppManager().catch(err => toast(err.message));
});
function memberAppSection(st) {
  const sec = document.createElement('section'); sec.className = 'panel'; sec.id = 'member-app-section';
  const link = st.url || '';
  const state_ = !st.enabled ? '<span class="subtext">Desligado</span>' : st.connected ? '<strong style="color:var(--green);font-size:15px">● Conectado ao app.gamezoney.com</strong>' : `<strong style="color:#ffb84d;font-size:15px">● Conectando…</strong>${st.lastError ? `<small class="subtext">${esc(st.lastError)}</small>` : ''}`;
  sec.innerHTML = `<h2>App do cliente <span class="badge gold">PRO</span></h2>
    <p class="hint">Os seus clientes abrem o app pelo celular e entram com o mesmo nick e senha do PC. No app eles veem o saldo de tempo, as medalhas e a sessão em andamento, as estações livres ou ocupadas (PCs, consoles, VR e simuladores) com o tempo que falta, as conquistas e o histórico. O app só mostra informações: recargas e sessões continuam na recepção e nos PCs. Não precisa de domínio, VPS nem abrir portas: este servidor se liga sozinho ao gamezoney.com pela internet.</p>
    <div class="balance"><span>Situação</span><span style="text-align:right">${state_}</span></div>
    ${link && st.enabled ? `<div class="balance"><span>Link do app</span><span style="text-align:right"><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a> <button type="button" class="ghost" id="ma-copy" style="margin-left:8px">Copiar link</button></span></div>` : ''}
    ${st.hasAccount ? '' : '<p class="hint" style="color:#ffb84d">Entre com a conta gamezoney.com do plano Pro em Configuração › Licença antes de ligar o app.</p>'}
    <form id="ma-form" style="margin-top:12px">
      <label class="check"><input type="checkbox" name="enabled" ${st.enabled ? 'checked' : ''}> Ligar o app do cliente</label>
      <label>Endereço do app<div style="display:flex;align-items:center;gap:6px"><span class="subtext" style="white-space:nowrap;margin:0">app.gamezoney.com/</span><input name="slug" maxlength="40" placeholder="arena-centro" value="${esc(st.slug)}" autocomplete="off" spellcheck="false" style="flex:1"></div></label>
      <p class="hint">Use letras minúsculas, números e hífen (ex.: arena-centro). Divulgue o link no balcão, nas redes sociais e no papel de parede dos PCs. O tipo de cada estação no filtro do app (PC, Console, VR ou Simulador) fica em Painel de controle › configurar a estação.</p>
      <div class="dialog-actions" style="justify-content:flex-start"><button class="primary" style="flex:0 0 auto">Salvar</button></div>
      <p class="error" id="ma-error" role="alert"></p>
    </form>`;
  sec.querySelector('#ma-form').onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.disabled = true; sec.querySelector('#ma-error').textContent = '';
    try { const r = await api('/member-app', {enabled: e.target.enabled.checked, slug: e.target.slug.value}); sec.replaceWith(memberAppSection(r)); toast(r.enabled ? 'App do cliente ligado.' : 'App do cliente desligado.'); setTimeout(() => { if (view === 'app' && gzAppTab === 'client') renderAppManager().catch(() => {}); }, 4000); }
    catch (err) { sec.querySelector('#ma-error').textContent = err.message; b.disabled = false; }
  };
  const copy = sec.querySelector('#ma-copy');
  if (copy) copy.onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copiado.'); } catch { toast(link); } };
  return sec;
}
const gzMedals = n => String(Math.round(n * 1000) / 1000).replace('.', ',');
function achievementsSection(d) {
  const sec = document.createElement('section'); sec.className = 'panel'; sec.id = 'achievements-section';
  const target = a => a.metric === 'spent' ? money(Math.round(a.target * 100)) : a.metric === 'hours' ? `${String(a.target).replace('.', ',')} h` : String(a.target);
  sec.innerHTML = `<h2>Conquistas <span class="badge gold">PRO</span></h2>
    <p class="hint">Crie metas para os clientes (ex.: 10 horas jogadas, 5 Corujões, R$ 100 em recargas). Quando o cliente completa, ele ganha as medalhas na Fidelidade e, se estiver jogando, aparece o aviso no PC. Quem já cumpre a meta recebe assim que a conquista é criada. O cliente acompanha o progresso no app.</p>
    <div class="dialog-actions" style="justify-content:flex-start;margin-bottom:12px"><button type="button" class="primary" id="ach-new" style="flex:0 0 auto">+ Nova conquista</button></div>
    ${d.list.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>Conquista</th><th>Meta</th><th>Medalhas</th><th>Completaram</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${d.list.map(a => `<tr><td style="font-size:20px">${esc(a.icon)}</td><td><strong>${esc(a.name)}</strong>${a.description ? `<small class="subtext">${esc(a.description)}</small>` : ''}</td><td>${esc(d.metrics[a.metric] || a.metric)}: ${esc(target(a))}</td><td>${gzMedals(a.medals)}</td><td>${a.completed}</td><td>${a.active === false ? '<span class="subtext">Pausada</span>' : 'Ativa'}</td><td><button type="button" class="ghost" data-ach-edit="${esc(a.id)}">Editar</button> <button type="button" class="ghost" data-ach-remove="${esc(a.id)}">Remover</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhuma conquista criada.</div>'}`;
  const form = a => {
    a = a || {metric: 'hours', target: 10, medals: 5, icon: d.icons[0], active: true};
    modal(a.id ? 'Editar conquista' : 'Nova conquista', `<form><div class="row"><label>Ícone<select name="icon">${d.icons.map(i => `<option ${i === a.icon ? 'selected' : ''} data-no-i18n>${i}</option>`).join('')}</select></label><label style="flex:3">Nome<input name="name" required maxlength="60" value="${esc(a.name)}" placeholder="Ex.: Maratonista"></label></div>
      <label>Descrição (opcional)<input name="description" maxlength="160" value="${esc(a.description)}" placeholder="Ex.: Jogue 10 horas na arena"></label>
      <div class="row"><label>O cliente precisa<select name="metric">${Object.entries(d.metrics).map(([k, t]) => `<option value="${k}" ${k === a.metric ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label><label>Meta<input name="target" required inputmode="decimal" value="${esc(String(a.target).replace('.', ','))}"></label><label>Medalhas<input name="medals" required inputmode="decimal" value="${esc(String(a.medals).replace('.', ','))}"></label></div>
      <label class="check"><input type="checkbox" name="active" ${a.active !== false ? 'checked' : ''}> Conquista ativa</label>
      <p class="hint">Meta em horas (Horas jogadas), em quantidade (Sessões e Corujão/Viradão) ou em reais (Recargas).</p>
      <div class="dialog-actions"><button class="primary">${a.id ? 'Salvar' : 'Criar conquista'}</button></div></form>`);
    formAction(async v => { const r = await api('/achievements', {...v, id: a.id, active: v.active === 'on'}); sec.replaceWith(achievementsSection(r)); });
  };
  sec.querySelector('#ach-new').onclick = () => form();
  sec.querySelectorAll('[data-ach-edit]').forEach(b => b.onclick = () => form(d.list.find(a => a.id === b.dataset.achEdit)));
  sec.querySelectorAll('[data-ach-remove]').forEach(b => b.onclick = async () => {
    const a = d.list.find(x => x.id === b.dataset.achRemove);
    if (!await ask(`Remover a conquista "${a.name}"? Quem já completou continua com as medalhas.`, {ok: 'Remover'})) return;
    try { sec.replaceWith(achievementsSection(await api('/achievements/remove', {id: a.id}))); toast('Conquista removida.'); } catch (err) { toast(err.message); }
  });
  return sec;
}
