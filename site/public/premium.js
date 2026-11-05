'use strict';
(() => {
  const translate = value => value;
  const menu = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#site-navigation');
  if (menu && navigation) {
    document.documentElement.classList.add('js-nav');
    const close = (restore = false) => {
      navigation.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false');
      if (restore) menu.focus();
    };
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      navigation.classList.toggle('is-open', open); menu.setAttribute('aria-expanded', String(open));
    });
    navigation.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') close(true); });
    document.addEventListener('click', e => { if (!e.target.closest('.topbar')) close(); });
    navigation.addEventListener('focusout', e => { if (e.relatedTarget && !navigation.contains(e.relatedTarget) && e.relatedTarget !== menu) close(); });
    matchMedia('(min-width:1001px)').addEventListener('change', () => close());
  }
  const demoTabs = [...document.querySelectorAll('.demo-tabs [role="tab"]')];
  function selectDemo(button, focus) {
    demoTabs.forEach(tab => {
      const selected = tab === button; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) button.focus();
  }
  demoTabs.forEach((button, i) => {
    button.addEventListener('click', () => selectDemo(button));
    button.addEventListener('keydown', e => {
      let next = i;
      if (e.key === 'ArrowRight') next = (i + 1) % demoTabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + demoTabs.length) % demoTabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = demoTabs.length - 1;
      else return;
      e.preventDefault(); selectDemo(demoTabs[next], true);
    });
  });
  document.querySelectorAll('[data-expand]').forEach(button => {
    button.addEventListener('click', () => {
      const trigger = document.querySelector('#demo-' + button.dataset.expand + ' [data-zoom]');
      if (trigger) trigger.click();
    });
  });
  const makeZoomAccessible = root => {
    root.querySelectorAll('[data-zoom]:not(button):not(a)').forEach(element => {
      element.setAttribute('role', 'button'); element.tabIndex = 0; element.setAttribute('aria-label', translate('Ampliar tela'));
    });
  };
  makeZoomAccessible(document);
  const reviews = document.getElementById('featured-reviews');
  if (reviews) new MutationObserver(() => makeZoomAccessible(reviews)).observe(reviews, {childList:true});
  document.addEventListener('keydown', e => {
    const target = e.target.closest('[data-zoom]:not(button):not(a)');
    if (target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); target.click(); }
  });
  document.querySelectorAll('[data-password]').forEach(button => {
    button.addEventListener('click', () => {
      const field = document.getElementById(button.dataset.password), shown = field.type === 'password';
      field.type = shown ? 'text' : 'password'; button.setAttribute('aria-pressed', String(shown));
      button.textContent = translate(shown ? 'Ocultar' : 'Mostrar');
    });
  });
  const accountContent = document.querySelector('.account-content');
  if (accountContent) {
    const panels = [...accountContent.querySelectorAll(':scope > section[id]')];
    const links = [...document.querySelectorAll('[data-account-link]')];
    const selectAccount = () => {
      const fragment = location.hash.slice(1), id = panels.some(p => p.id === fragment) ? fragment : 'visao-geral';
      panels.forEach(p => p.hidden = p.id !== id);
      links.forEach(a => { if (a.hash === '#' + id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    };
    window.addEventListener('hashchange', selectAccount);
    document.addEventListener('gz:account-ready', () => { document.body.classList.remove('account-pending'); selectAccount(); });
    selectAccount();
  }
  const applyConfig = config => {
    const google = document.getElementById('google-wrap');
    if (google) google.classList.toggle('hidden', !config.google);
    document.querySelectorAll('[data-support-email]').forEach(a => {
      if (typeof config.supportEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail)) { a.textContent = config.supportEmail; a.href = 'mailto:' + config.supportEmail; }
    });
  };
  if (siteConfig) applyConfig(siteConfig);
  document.addEventListener('gz:config', e => applyConfig(e.detail));
})();
