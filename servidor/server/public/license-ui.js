'use strict';
// 1.0.5: Licença — aviso no topo (teste grátis / teste encerrado) e seção "Licença" no início da Configuração.
let gzLicense = null, gzLicenseAt = 0;
async function loadLicense(force) {
  if (!force && gzLicense && Date.now() - gzLicenseAt < 60000) return gzLicense;
  try { gzLicense = await api('/license'); gzLicenseAt = Date.now(); } catch { }
  return gzLicense;
}
function licenseBar() {
  const main = document.querySelector('#shell main'); if (!main) return;
  let bar = $('#gz-license-bar'); const L = gzLicense;
  if (!L || L.mode === 'licensed' || (L.mode === 'trial' && L.daysLeft > 7 && view !== 'settings')) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'gz-license-bar'; main.prepend(bar); }
  const expired = L.mode === 'expired';
  bar.className = 'gz-license-bar' + (expired ? ' expired' : '');
  const text = expired
    ? `<strong>Teste grátis encerrado.</strong> <span>Recargas, sessões novas e vendas estão bloqueadas. Seus dados continuam guardados.</span>`
    : `<strong>Teste grátis: ${L.daysLeft} dia(s) restante(s).</strong> <span>Ative a licença vitalícia para continuar usando depois do teste.</span>`;
  bar.innerHTML = `${text}<span class="gz-license-actions"><button class="ghost" data-license-activate>Ativar licença</button><a class="primary-link" href="${esc(L.buyUrl)}" target="_blank" rel="noopener">Comprar licença</a></span>`;
  bar.querySelector('[data-license-activate]').onclick = activateLicenseModal;
}
function activateLicenseModal() {
  if (!isAdmin()) return toast('Somente o administrador pode ativar a licença.');
  modal('Ativar licença', `<form><p class="hint">Digite a chave recebida em gamezoney.com (Minha conta › Licenças). Este computador precisa de internet só no momento da ativação.</p><label>Chave da licença<input name="key" required maxlength="24" placeholder="GZ-XXXX-XXXX-XXXX-XXXX" autocomplete="off" style="text-transform:uppercase"></label><div class="dialog-actions"><button class="primary">Ativar</button></div></form>`);
  return formAction(async d => {
    try { await licenseActivated(await api('/license/activate', {key: d.key})); }
    catch (e) { if (e.data && e.data.needLogin) { licenseLoginStep(d.key, e.data.machine); throw Object.assign(Error(''), {keepOpen: true}); } throw e; }
  });
}
function licenseActivated(L) { gzLicense = L; gzLicenseAt = Date.now(); toast('Licença ativada. Obrigado por escolher o GameZoney!'); licenseBar(); if (view === 'settings') renderSettings(); }
// 1.0.6: a chave já está ativada em outro computador — só ativa aqui com o e-mail e a senha da conta gamezoney.com que comprou a licença
function licenseLoginStep(key, machine) {
  const site = String((gzLicense && gzLicense.accountUrl) || 'https://gamezoney.com/conta').replace(/\/conta$/, '');
  modal('Ativar em outro computador', `<form><p class="hint">Esta chave já está ativada em outro computador: <strong>${esc(machine || 'sem nome')}</strong>.</p><p class="hint">Para ativar neste computador, entre com o e-mail e a senha da sua conta gamezoney.com (a mesma que você usa para entrar no site). O outro computador deixa de usar esta licença.</p><label>E-mail da conta gamezoney.com<input name="email" type="email" required maxlength="200" autocomplete="off"></label><label>Senha da conta gamezoney.com<input name="password" type="text" data-secret autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" maxlength="200" required></label><p class="hint">Esqueceu a senha ou entra com Google? Crie uma senha em <a href="${esc(site)}/entrar.html" target="_blank" rel="noopener">gamezoney.com › Entrar › Esqueci a senha</a>.</p><div class="dialog-actions"><button class="primary">Ativar neste computador</button></div></form>`);
  $('#modal-body input').focus();
  formAction(async d => licenseActivated(await api('/license/activate', {key, email: d.email, password: d.password})));
}
function licenseSection() {
  const L = gzLicense; if (!L) return null;
  const sec = document.createElement('section'); sec.id = 'license-section'; sec.className = 'panel';
  const date = t => new Date(t).toLocaleDateString(({en: 'en-US', es: 'es', fr: 'fr', ru: 'ru'})[window.gzI18n && gzI18n.lang] || 'pt-BR');
  let body;
  if (L.mode === 'licensed') body = `<div class="balance"><span>Situação</span><strong style="color:var(--green)">Licença vitalícia ativa</strong></div><div class="balance"><span>Chave</span><strong>${esc(L.key)}</strong></div>${L.email ? `<div class="balance"><span>Conta</span><strong>${esc(L.email)}</strong></div>` : ''}<p class="hint">A licença nunca expira e não precisa de internet para continuar valendo.</p><p class="hint">Para usar a mesma chave em outro computador, ative a chave nele: será pedido o e-mail e a senha da sua conta gamezoney.com.</p>`;
  else body = `<div class="balance"><span>Situação</span><strong style="color:${L.mode === 'expired' ? '#ff8793' : 'var(--red2)'}">${L.mode === 'expired' ? 'Teste grátis encerrado' : 'Teste grátis'}</strong></div><div class="balance"><span>Teste até</span><strong>${date(L.trialEndsAt)}</strong></div>${L.mode === 'trial' ? `<div class="balance"><span>Dias restantes</span><strong>${L.daysLeft}</strong></div>` : ''}<p class="hint">Licença vitalícia com suporte completo: compre em gamezoney.com e ative aqui com a chave recebida.</p><div class="dialog-actions" style="justify-content:flex-start;gap:10px"><button class="primary" data-license-activate style="flex:0 0 auto">Ativar licença</button><a class="button-link" href="${esc(L.buyUrl)}" target="_blank" rel="noopener">Comprar licença</a></div>`;
  sec.innerHTML = `<h2>Licença</h2>${body}<small class="subtext">Código desta instalação: ${esc(L.installId)}</small>`;
  const b = sec.querySelector('[data-license-activate]'); if (b) b.onclick = activateLicenseModal;
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
