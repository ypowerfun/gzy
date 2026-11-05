'use strict';
(() => {
  const params = new URLSearchParams(location.search), msg = $('#msg');
  const next = /^\/[a-z0-9/._#-]*$/i.test(params.get('next') || '') ? params.get('next') : '/conta';
  $('#google').href = '/auth/google?next=' + encodeURIComponent(next.split('#')[0]);
  if (params.get('erro')) showMsg(msg, params.get('erro'));
  const tab = name => { $$('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); $('#login-form').classList.toggle('hidden', name !== 'login'); $('#register-form').classList.toggle('hidden', name !== 'register'); msg.className = 'msg'; };
  $$('[data-tab]').forEach(b => b.onclick = () => tab(b.dataset.tab));
  if (params.get('criar')) tab('register');
  api('/api/me').then(me => { if (me.user) location.href = next; }).catch(() => {});
  $('#login-form').onsubmit = e => { e.preventDefault(); const f = e.target; busy(f.querySelector('button'), async () => {
    try { await api('/api/auth/login', {email: f.email.value, password: f.password.value}); location.href = next; } catch (err) { showMsg(msg, err.message); } }); };
  $('#register-form').onsubmit = e => { e.preventDefault(); const f = e.target; busy(f.querySelector('button'), async () => {
    try { await api('/api/auth/register', {name: f.name.value, email: f.email.value, password: f.password.value}); location.href = next; } catch (err) { showMsg(msg, err.message); } }); };
  $('#forgot').onclick = async e => {
    e.preventDefault(); const email = $('#login-form').email.value.trim();
    if (!email) return showMsg(msg, 'Digite seu e-mail no campo acima e clique de novo em Esqueci a senha.');
    try { const r = await api('/api/auth/forgot', {email}); showMsg(msg, r.mail ? 'Se o e-mail tiver conta, enviamos um link para criar uma nova senha.' : 'Envio de e-mail indisponível no momento. Fale com o suporte para redefinir a senha.', r.mail); }
    catch (err) { showMsg(msg, err.message); }
  };
})();
