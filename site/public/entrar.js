'use strict';
(() => {
  const params = new URLSearchParams(location.search), msg = $('#msg');
  const next = /^\/(?!\/)[a-z0-9/._#-]*$/i.test(params.get('next') || '') ? params.get('next') : '/conta';
  const purchasing = next === '/conta#comprar';
  const t = text => text;
  const login = $('#login-form'), register = $('#register-form'), recovery = $('#forgot-form');
  const tabs = $$('[data-tab]');
  $('#google').href = '/auth/google?next=' + encodeURIComponent(next);
  $('#auth-purchase').classList.toggle('hidden', !purchasing);
  const tab = (name, focus = false) => {
    tabs.forEach(button => {
      const selected = button.dataset.tab === name;
      button.classList.toggle('on', selected); button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    login.classList.toggle('hidden', name !== 'login'); register.classList.toggle('hidden', name !== 'register'); recovery.classList.toggle('hidden', name !== 'forgot');
    $('.tabs').classList.toggle('hidden', name === 'forgot'); $('#google-wrap').classList.toggle('hidden', name === 'forgot' || !siteConfig?.google);
    const title = name === 'forgot' ? 'Vamos recuperar seu acesso.' : name === 'register' ? (purchasing ? 'Crie sua conta para continuar.' : 'Comece seu teste de 30 dias.') : 'Bem-vindo de volta.';
    const description = name === 'forgot' ? 'Informe seu e-mail para receber o link de recuperação.' : purchasing ? 'Entre ou crie uma conta para continuar com a compra da sua licença.' : name === 'register' ? 'Depois do cadastro, você acessa os downloads e o guia.' : 'Entre para acessar sua conta.';
    $('#auth-title').textContent = t(title); $('#auth-description').textContent = t(description);
    $('#register-submit').textContent = t(purchasing ? 'Criar conta e continuar a compra' : 'Criar conta e começar o teste');
    msg.className = 'msg'; msg.textContent = '';
    if (focus) (name === 'forgot' ? $('#forgot-email') : name === 'register' ? $('#register-name') : $('#login-email')).focus();
  };
  tabs.forEach((button, i) => {
    button.onclick = () => tab(button.dataset.tab);
    button.onkeydown = e => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault(); const chosen = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[1] : tabs[1-i]; tab(chosen.dataset.tab); chosen.focus();
    };
  });
  tab(params.get('criar') ? 'register' : 'login');
  if (params.get('erro')) showMsg(msg, params.get('erro'));
  api('/api/me').then(me => { if (me.user) location.href = next; }).catch(() => {});
  login.onsubmit = e => {
    e.preventDefault(); busy(login.querySelector('[type="submit"]'), async () => {
      try { await api('/api/auth/login', {email: login.email.value, password: login.password.value}); location.href = next; }
      catch (err) { showMsg(msg, err.message); }
    });
  };
  register.onsubmit = e => {
    e.preventDefault(); busy(register.querySelector('[type="submit"]'), async () => {
      try { await api('/api/auth/register', {name: register.elements.namedItem('name').value, email: register.email.value, password: register.password.value}); location.href = next; }
      catch (err) { showMsg(msg, err.message); }
    });
  };
  $('#forgot').onclick = e => { e.preventDefault(); recovery.email.value = login.email.value; tab('forgot', true); };
  $('#back-login').onclick = () => tab('login', true);
  recovery.onsubmit = e => {
    e.preventDefault(); busy(recovery.querySelector('[type="submit"]'), async () => {
      try { const r = await api('/api/auth/forgot', {email: recovery.email.value.trim()}); showMsg(msg, r.mail ? 'Se o e-mail tiver conta, enviamos um link para criar uma nova senha.' : 'Envio de e-mail indisponível no momento. Fale com o suporte para redefinir a senha.', r.mail); }
      catch (err) { showMsg(msg, err.message); }
    });
  };
  document.addEventListener('gz:config', () => { if (!recovery.classList.contains('hidden')) $('#google-wrap').classList.add('hidden'); });
})();
