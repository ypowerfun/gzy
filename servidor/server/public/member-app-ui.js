'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.3.7 (plano Pro): Gerenciar App › App do cliente (app.gamezoney.com/<endereço>) e Conquistas.
let gzAppTab = (() => { try { const t = localStorage.getItem('gz-app-tab'); return t === 'achievements' || t === 'reception' ? t : 'client'; } catch { return 'client'; } })(); // 1.3.8: a aba Servidor em nuvem saiu
function gzAppTabs() {
  const t = (k, label) => `<button type="button" data-app-tab="${k}" class="${gzAppTab === k ? 'active' : ''}">${label}</button>`;
  return `<div class="shop-tabs">${t('client', '📱 App do cliente')}${t('reception', '🖥️ App da recepção')}${t('achievements', '🏆 Conquistas')}</div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-app-tab]'); if (!b) return;
  gzAppTab = b.dataset.appTab; try { localStorage.setItem('gz-app-tab', gzAppTab); } catch { }
  if (view === 'app') renderAppManager().catch(err => toast(err.message));
});
function memberAppSection(st) {
  const sec = document.createElement('section'); sec.className = 'panel'; sec.id = 'member-app-section';
  const state_ = !st.enabled ? '<span class="subtext">Desligado</span>' : st.connected ? '<strong style="color:var(--green);font-size:15px">● Conectado ao app.gamezoney.com</strong>' : `<strong style="color:#ffb84d;font-size:15px">● Conectando…</strong>${st.lastError ? `<small class="subtext">${esc(st.lastError)}</small>` : ''}`;
  sec.innerHTML = `<h2>App do cliente <span class="badge gold">PRO</span></h2>
    <p class="hint">Os seus clientes abrem o app pelo celular e entram com o mesmo nick e senha do PC. No app eles veem o saldo de tempo, as medalhas e a sessão em andamento, as estações livres ou ocupadas (PCs, consoles/VR e simuladores) com o tempo que falta, as conquistas e o histórico. O app só mostra informações: recargas e sessões continuam na recepção e nos PCs. Não precisa de domínio, VPS nem abrir portas: este servidor se liga sozinho ao gamezoney.com pela internet.</p>
    <div class="balance"><span>Situação</span><span style="text-align:right">${state_}</span></div>
    ${st.hasAccount ? '' : '<p class="hint" style="color:#ffb84d">Entre com a conta gamezoney.com do plano Pro em Configuração › Licença antes de ligar o app.</p>'}
    <form id="ma-form" style="margin-top:12px">
      <label class="check"><input type="checkbox" name="enabled" ${st.enabled ? 'checked' : ''}> Ligar o app do cliente</label>
      <label>Endereço do app<div style="display:flex;align-items:center;gap:6px"><span class="subtext" style="white-space:nowrap;margin:0">app.gamezoney.com/</span><input name="slug" maxlength="40" placeholder="arena-centro" value="${esc(st.slug)}" autocomplete="off" spellcheck="false" style="flex:1"></div></label>
      <p class="hint">Use letras minúsculas, números e hífen (ex.: arena-centro). Os clientes abrem app.gamezoney.com/ seguido do endereço (ex.: app.gamezoney.com/arena-centro): divulgue no balcão, nas redes sociais e no papel de parede dos PCs. O tipo de cada estação no filtro do app (PC, Console/VR ou Simulador) fica em Painel de controle › configurar a estação.</p>
      <label>WhatsApp do suporte (opcional)<input name="whatsapp" maxlength="20" inputmode="tel" placeholder="11 91234-5678" value="${esc(st.whatsapp ? (st.whatsapp.startsWith('55') ? st.whatsapp.slice(2) : '+' + st.whatsapp) : '')}" autocomplete="off"></label>
      <p class="hint">Com o número preenchido, o app mostra a opção Suporte (WhatsApp) na engrenagem, que abre uma conversa com este número. Em branco, a opção fica desligada.</p>
      <div class="dialog-actions" style="justify-content:flex-start"><button class="primary" style="flex:0 0 auto">Salvar</button>${gzAppTestButton()}</div>
      <p class="error" id="ma-error" role="alert"></p>
    </form>`;
  sec.querySelector('#ma-form').onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.disabled = true; sec.querySelector('#ma-error').textContent = '';
    try { const r = await api('/member-app', {enabled: e.target.enabled.checked, slug: e.target.slug.value, whatsapp: e.target.whatsapp.value}); sec.replaceWith(memberAppSection(r)); toast(r.enabled ? 'App do cliente ligado.' : 'App do cliente desligado.'); setTimeout(() => { if (view === 'app' && gzAppTab === 'client') renderAppManager().catch(() => {}); }, 4000); }
    catch (err) { sec.querySelector('#ma-error').textContent = err.message; b.disabled = false; }
  };
  return sec;
}
// 1.4.2: Testar conexão (o que falta para o app funcionar, sem precisar de suporte)
function gzAppTestButton() { return '<button type="button" data-app-test style="flex:0 0 auto">Testar conexão</button>'; }
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-app-test]'); if (!b) return;
  b.disabled = true; const old = b.textContent; b.textContent = 'Testando…';
  try {
    const r = await api('/member-app/test', {});
    modal('Testar conexão', `<p class="hint">Não é preciso abrir nenhuma porta no roteador: o servidor só usa a saída HTTPS (porta 443) até o gamezoney.com.</p>${r.checks.map(c => `<div class="balance"><span>${c.ok ? '✔' : '✖'} ${esc(c.label)}</span><span style="text-align:right;max-width:62%;color:${c.ok ? 'var(--green)' : '#ffb84d'}">${esc(c.detail)}</span></div>`).join('')}<p class="hint" style="margin-top:10px">${r.ok ? 'Tudo certo.' : 'Corrija o item marcado com ✖ e clique em Testar conexão de novo.'}</p>`);
  } catch (err) { toast(err.message); } finally { b.disabled = false; b.textContent = old; }
});
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
// 1.4.1 (plano Pro): App da recepção — o painel do servidor aberto de fora (app.gamezoney.com/servidor/<endereço>), sem Configuração e Gerenciar App
function receptionSection(st) {
  const sec = document.createElement('section'); sec.className = 'panel'; sec.id = 'reception-section';
  const link = st.slug ? 'app.gamezoney.com/servidor/' + st.slug : '';
  const state_ = !st.enabled ? '<span class="subtext">Desligado</span>' : st.connected ? '<strong style="color:var(--green);font-size:15px">● Conectado ao app.gamezoney.com</strong>' : '<strong style="color:#ffb84d;font-size:15px">● Conectando…</strong>';
  sec.innerHTML = `<h2>App da recepção <span class="badge gold">PRO</span></h2>
    <p class="hint">Abra o painel deste servidor de qualquer lugar (celular, notebook ou outro computador) pelo navegador, com o mesmo usuário e senha do painel. Ficam disponíveis todas as telas (Painel de controle, Clientes, Fidelidade, Corujão/Viradão, Sessão, Log, Faturas, Estatística, Caixa, Produtos/Serviços, Ranking…), menos a Configuração e o Gerenciar App, que só abrem aqui no servidor. Não é preciso abrir porta no roteador: o servidor liga para o gamezoney.com e precisa estar aberto e com internet.</p>
    <div class="balance"><span>Situação</span><span style="text-align:right">${state_}</span></div>
    ${link ? `<div class="balance"><span>Endereço</span><strong style="font-size:15px" data-no-i18n>${esc(link)}</strong></div>` : '<p class="hint" style="color:#ffb84d">Escolha antes o endereço na aba App do cliente (o app da recepção usa o mesmo endereço).</p>'}
    ${st.enabled && !st.connected && st.lastError ? `<p class="hint" style="color:#ffb84d">${esc(st.lastError)}</p>` : ''}
    <div class="balance"><span>Acessos conectados</span><strong style="font-size:15px">${st.sessions}</strong></div>
    <form id="rp-form" style="margin-top:12px">
      <label class="check"><input type="checkbox" name="enabled" ${st.enabled ? 'checked' : ''}> Ligar o app da recepção</label>
      <label>Quem pode entrar<select name="who"><option value="all" ${st.who !== 'admins' ? 'selected' : ''}>Todos os usuários do painel</option><option value="admins" ${st.who === 'admins' ? 'selected' : ''}>Só administradores</option></select></label>
      <p class="hint">Segurança: o acesso de fora cai depois de 12 horas sem uso; a senha precisa ter pelo menos 8 caracteres; a entrada pede um código enviado ao e-mail da conta gamezoney.com do plano; 5 senhas erradas seguidas travam o usuário por 15 minutos; cada entrada fica no Log com o IP. Use senhas fortes nos usuários do painel.</p>
      <div class="dialog-actions" style="justify-content:flex-start"><button class="primary" style="flex:0 0 auto">Salvar</button>${gzAppTestButton()}<button type="button" id="rp-disconnect" style="flex:0 0 auto" ${st.sessions ? '' : 'disabled'}>Desconectar todos</button></div>
      <p class="error" id="rp-error" role="alert"></p>
    </form>`;
  sec.querySelector('#rp-form').onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.disabled = true; sec.querySelector('#rp-error').textContent = '';
    try { const r = await api('/remote-panel', {enabled: e.target.enabled.checked, who: e.target.who.value}); toast(r.enabled ? 'App da recepção ligado.' : 'App da recepção desligado.'); setTimeout(() => { if (view === 'app' && gzAppTab === 'reception') renderAppManager().catch(() => {}); }, 2500); renderAppManager().catch(() => {}); }
    catch (err) { sec.querySelector('#rp-error').textContent = err.message; b.disabled = false; }
  };
  sec.querySelector('#rp-disconnect').onclick = async () => {
    if (!await ask('Desconectar todos os acessos do app da recepção? Quem estiver usando precisa entrar de novo.', {ok: 'Desconectar'})) return;
    try { const r = await api('/remote-panel/disconnect', {}); toast(r.disconnected + ' acesso(s) desconectado(s).'); renderAppManager().catch(() => {}); } catch (err) { toast(err.message); }
  };
  return sec;
}
