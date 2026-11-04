'use strict';
// 3.0.52: no iPhone, ensina a instalar o app GameZoney na Tela de Início (grátis, sem App Store).
// Não aparece no app já instalado nem dentro do app Android.
(() => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (!ios || installed || /GameZoneyMobile/.test(ua)) return;
  try { if (localStorage.getItem('prime-install-hint') === 'off') return; } catch {}
  const show = () => {
    const box = document.createElement('div');
    box.setAttribute('role', 'note');
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:1000;'
      + 'background:#1a1a27;color:#fff;border:1px solid #f22b46;border-radius:14px;padding:14px 46px 14px 14px;'
      + 'font:14px/1.45 -apple-system,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.55)';
    const title = document.createElement('strong');
    title.textContent = 'Instale o app GameZoney';
    const text = document.createElement('div');
    text.textContent = 'Toque em Compartilhar (quadrado com a seta para cima) e depois em "Adicionar à Tela de Início".';
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar');
    close.textContent = '×';
    close.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:0;color:#fff;font-size:24px;line-height:1;padding:6px';
    close.onclick = () => {
      try { localStorage.setItem('prime-install-hint', 'off'); } catch {}
      box.remove();
    };
    box.append(title, text, close);
    document.body.append(box);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
