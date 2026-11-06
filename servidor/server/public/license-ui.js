'use strict';
// Licença — aviso no topo (teste grátis / plano vencendo / sem plano) e seção "Licença" no início da Configuração.
// 1.0.6: o plano (Standard/Pro) vem da conta gamezoney.com: o administrador entra com o e-mail e a senha do site.
let gzLicense = null, gzLicenseAt = 0;
async function loadLicense(force) {
  if (!force && gzLicense && Date.now() - gzLicenseAt < 60000) return gzLicense;
  try { gzLicense = await api('/license'); gzLicenseAt = Date.now(); } catch { }
  return gzLicense;
}
const licDate = t => new Date(t).toLocaleDateString(({en: 'en-US', es: 'es', fr: 'fr', ru: 'ru'})[window.gzI18n && gzI18n.lang] || 'pt-BR');
function licenseBar() {
  const main = document.querySelector('#shell main'); if (!main) return;
  let bar = $('#gz-license-bar'); const L = gzLicense;
  const legacySoon = L && L.mode === 'licensed' && L.legacy && L.legacyUntil - Date.now() < 30 * 86400000;
  const hide = !L || (L.mode === 'plan') || (L.mode === 'licensed' && !legacySoon) || (L.mode === 'trial' && L.daysLeft > 7 && view !== 'settings');
  if (hide) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'gz-license-bar'; main.prepend(bar); }
  const expired = L.mode === 'expired';
  bar.className = 'gz-license-bar' + (expired || L.mode === 'plan-grace' ? ' expired' : '');
  let text;
  if (expired) text = L.planEnded ? `<strong>O plano ${esc(L.planEnded)} venceu.</strong> <span>Recargas, sessões novas e vendas estão bloqueadas. Seus dados continuam guardados.</span>` : `<strong>Teste grátis encerrado.</strong> <span>Recargas, sessões novas e vendas estão bloqueadas. Seus dados continuam guardados.</span>`;
  else if (L.mode === 'plan-grace') text = `<strong>Renovação do plano pendente: ${L.daysLeft} dia(s) para regularizar.</strong> <span>Depois disso, recargas, sessões novas e vendas ficam bloqueadas.</span>`;
  else if (legacySoon) text = `<strong>A licença antiga vale até ${licDate(L.legacyUntil)}.</strong> <span>Entre com a sua conta gamezoney.com com plano ativo para continuar.</span>`;
  else text = `<strong>Teste grátis: ${L.daysLeft} dia(s) restante(s).</strong> <span>Assine um plano e entre com a sua conta gamezoney.com para continuar usando depois do teste.</span>`;
  const action = L.mode === 'plan-grace' ? '<button class="ghost" data-license-refresh>Atualizar plano</button>' : '<button class="ghost" data-license-login>Entrar com a conta</button>';
  bar.innerHTML = `${text}<span class="gz-license-actions">${action}<a class="primary-link" href="${esc(L.buyUrl)}" target="_blank" rel="noopener">Ver planos</a></span>`;
  licenseButtons(bar);
}
function licenseButtons(root) {
  root.querySelectorAll('[data-license-login]').forEach(b => b.onclick = () => licenseLoginModal());
  root.querySelectorAll('[data-license-refresh]').forEach(b => b.onclick = async () => { b.disabled = true; try { gzLicense = await api('/license/refresh', {}); gzLicenseAt = Date.now(); toast(gzLicense.lastError ? gzLicense.lastError : 'Plano atualizado.'); licenseRefreshView(); } catch (e) { toast(e.message); } finally { b.disabled = false; } });
  root.querySelectorAll('[data-license-logout]').forEach(b => b.onclick = async () => {
    if (!await ask('Sair da conta gamezoney.com neste computador? O plano deixa de valer aqui (dá para entrar de novo depois, aqui ou em outro computador).', {ok: 'Sair da conta'})) return;
    try { gzLicense = await api('/license/logout', {}); gzLicenseAt = Date.now(); toast('Conta desconectada deste computador.'); licenseRefreshView(); } catch (e) { toast(e.message); } });
}
function licenseRefreshView() { licenseBar(); if (view === 'settings') renderSettings(); }
// entrar com o e-mail e a senha da conta gamezoney.com (a mesma do site); a senha não é guardada neste computador
function licenseLoginModal(prefill = '') {
  if (!isAdmin()) return toast('Somente o administrador pode entrar com a conta da licença.');
  const site = String((gzLicense && gzLicense.accountUrl) || 'https://gamezoney.com/conta').replace(/\/conta$/, '');
  modal('Entrar com a conta gamezoney.com', `<form><p class="hint">Use o mesmo e-mail e senha que você usa para entrar no site gamezoney.com. O plano (Standard ou Pro) fica ligado à sua conta e vale neste computador. Este computador precisa de internet para entrar.</p><label>E-mail da conta gamezoney.com<input name="email" type="email" required maxlength="200" autocomplete="off" value="${esc(prefill)}"></label><label>Senha da conta gamezoney.com<input name="password" type="text" data-secret autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" maxlength="200" required></label><p class="hint">Ainda não tem plano? <a href="${esc(site)}/#precos" target="_blank" rel="noopener">Ver planos em gamezoney.com</a>. Entra com Google ou esqueceu a senha? Crie uma senha em <a href="${esc(site)}/entrar.html" target="_blank" rel="noopener">gamezoney.com › Entrar › Esqueci a senha</a>.</p><div class="dialog-actions"><button class="primary">Entrar</button></div></form>`);
  $('#modal-body input').focus();
  formAction(async d => {
    try { licenseDone(await api('/license/login', {email: d.email, password: d.password})); }
    catch (e) {
      if (e.data && e.data.needTransfer) {
        if (!await ask(`Esta conta já está sendo usada no computador "${e.data.machine || 'sem nome'}". Usar o plano neste computador? O outro computador deixa de usar o plano.`, {ok: 'Usar neste computador'})) throw Object.assign(Error(''), {keepOpen: true});
        return licenseDone(await api('/license/login', {email: d.email, password: d.password, transfer: true}));
      }
      throw e;
    }
  });
}
function licenseDone(L) { gzLicense = L; gzLicenseAt = Date.now(); toast(L.mode === 'plan' || L.mode === 'plan-grace' ? `Plano ${L.planName} ativo neste computador. Obrigado por escolher o GameZoney!` : 'Conta conectada.'); licenseRefreshView(); }
// licença antiga por chave (GZ-...): continua aceita para quem ainda tem a chave
function activateLicenseModal() {
  if (!isAdmin()) return toast('Somente o administrador pode ativar a licença.');
  modal('Ativar licença', `<form><p class="hint">Digite a chave recebida em gamezoney.com (Minha conta › Licenças). Este computador precisa de internet só no momento da ativação.</p><label>Chave da licença<input name="key" required maxlength="24" placeholder="GZ-XXXX-XXXX-XXXX-XXXX" autocomplete="off" style="text-transform:uppercase"></label><div class="dialog-actions"><button class="primary">Ativar</button></div></form>`);
  return formAction(async d => {
    try { await licenseActivated(await api('/license/activate', {key: d.key})); }
    catch (e) { if (e.data && e.data.needLogin) { licenseLoginStep(d.key, e.data.machine); throw Object.assign(Error(''), {keepOpen: true}); } throw e; }
  });
}
function licenseActivated(L) { gzLicense = L; gzLicenseAt = Date.now(); toast('Licença ativada. Obrigado por escolher o GameZoney!'); licenseRefreshView(); }
// 1.0.5 (troca de computador): a chave já está ativada em outro computador — só ativa aqui com o e-mail e a senha da conta gamezoney.com que comprou a licença
function licenseLoginStep(key, machine) {
  const site = String((gzLicense && gzLicense.accountUrl) || 'https://gamezoney.com/conta').replace(/\/conta$/, '');
  modal('Ativar em outro computador', `<form><p class="hint">Esta chave já está ativada em outro computador: <strong>${esc(machine || 'sem nome')}</strong>.</p><p class="hint">Para ativar neste computador, entre com o e-mail e a senha da sua conta gamezoney.com (a mesma que você usa para entrar no site). O outro computador deixa de usar esta licença.</p><label>E-mail da conta gamezoney.com<input name="email" type="email" required maxlength="200" autocomplete="off"></label><label>Senha da conta gamezoney.com<input name="password" type="text" data-secret autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" maxlength="200" required></label><p class="hint">Esqueceu a senha ou entra com Google? Crie uma senha em <a href="${esc(site)}/entrar.html" target="_blank" rel="noopener">gamezoney.com › Entrar › Esqueci a senha</a>.</p><div class="dialog-actions"><button class="primary">Ativar neste computador</button></div></form>`);
  $('#modal-body input').focus();
  formAction(async d => licenseActivated(await api('/license/activate', {key, email: d.email, password: d.password})));
}
function licenseSection() {
  const L = gzLicense; if (!L) return null;
  const sec = document.createElement('section'); sec.id = 'license-section'; sec.className = 'panel';
  const row = (k, v, color) => `<div class="balance"><span>${k}</span><strong${color ? ` style="color:${color}"` : ''}>${v}</strong></div>`;
  const checked = L.checkedAt ? `<small class="subtext">Última conferência com gamezoney.com: ${new Date(L.checkedAt).toLocaleString()}</small>` : '';
  let body;
  if (L.mode === 'plan' || L.mode === 'plan-grace') {
    body = row('Situação', L.mode === 'plan' ? `Plano ${esc(L.planName)} ativo` : `Plano ${esc(L.planName)}: renovação pendente`, L.mode === 'plan' ? 'var(--green)' : '#ff8793')
      + row('Conta', esc(L.email)) + (L.period ? row('Período', esc(L.period)) : '') + row(L.mode === 'plan' ? 'Válido até' : 'Regularize até', licDate(L.mode === 'plan' ? L.paidUntil : L.graceUntil))
      + `<p class="hint">O plano é renovado na sua conta gamezoney.com e este computador confere sozinho quando tem internet. Sem internet, continua valendo até a data acima.</p>`
      + `<div class="dialog-actions" style="justify-content:flex-start;gap:10px"><button class="ghost" data-license-refresh style="flex:0 0 auto">Atualizar plano</button><button class="ghost" data-license-logout style="flex:0 0 auto">Sair da conta</button><a class="button-link" href="${esc(L.accountUrl)}" target="_blank" rel="noopener">Minha conta no site</a></div>${checked}`;
  } else if (L.mode === 'licensed') {
    body = row('Situação', 'Licença antiga (convertida no plano Standard)', 'var(--green)') + row('Chave', esc(L.key)) + (L.email ? row('Conta', esc(L.email)) : '') + row('Vale até', licDate(L.legacyUntil))
      + `<p class="hint">A licença vitalícia virou plano Standard por 12 meses. Este computador passa sozinho para o plano da sua conta quando tiver internet; você também pode entrar com a conta agora.</p>`
      + `<div class="dialog-actions" style="justify-content:flex-start;gap:10px"><button class="primary" data-license-login style="flex:0 0 auto">Entrar com a conta gamezoney.com</button><button class="ghost" data-license-refresh style="flex:0 0 auto">Atualizar plano</button></div>${L.lastError ? `<p class="hint" style="color:#ff8793">${esc(L.lastError)}</p>` : ''}${checked}`;
  } else {
    body = row('Situação', L.mode === 'expired' ? (L.planEnded ? `Plano ${esc(L.planEnded)} vencido` : 'Teste grátis encerrado') : 'Teste grátis', L.mode === 'expired' ? '#ff8793' : 'var(--red2)')
      + (L.mode === 'trial' ? row('Teste até', licDate(L.trialEndsAt)) + row('Dias restantes', L.daysLeft) : '')
      + `<p class="hint">O GameZoney funciona com um plano (Standard ou Pro) da sua conta gamezoney.com. Assine no site e entre aqui com o mesmo e-mail e senha.</p>${L.lastError ? `<p class="hint" style="color:#ff8793">${esc(L.lastError)}</p>` : ''}`
      + `<div class="dialog-actions" style="justify-content:flex-start;gap:10px"><button class="primary" data-license-login style="flex:0 0 auto">Entrar com a conta gamezoney.com</button><a class="button-link" href="${esc(L.buyUrl)}" target="_blank" rel="noopener">Ver planos</a>${L.planEnded ? '<button class="ghost" data-license-refresh style="flex:0 0 auto">Atualizar plano</button>' : ''}</div>`;
  }
  sec.innerHTML = `<h2>Licença</h2>${body}<small class="subtext">Código desta instalação: ${esc(L.installId)}</small>`;
  licenseButtons(sec);
  return sec;
}
(function () {
  const original = renderSettings;
  renderSettings = function () {
    original.apply(this, arguments);
    if (!isAdmin()) return;
    loadLicense().then(() => { if (view !== 'settings') return; $('#license-section')?.remove(); const sec = licenseSection(); if (sec) $('#view').prepend(sec); licenseBar(); });
  };
  const tick = () => { if (!state) return; loadLicense().then(licenseBar); };
  setInterval(tick, 60000);
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-view]')) setTimeout(tick, 50); });
  setTimeout(tick, 1500);
})();
