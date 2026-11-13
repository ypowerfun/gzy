'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.4.1: app da recepção — o mesmo painel aberto de fora (app.gamezoney.com/servidor/<endereço>), sem Configuração e Gerenciar App.
(function () {
  if (!document.querySelector('meta[name="gz-remote"]')) return;
  document.title = 'GameZoney • App da recepção';
  for (const v of ['settings', 'app']) {
    const b = document.querySelector(`nav button[data-view="${v}"]`); if (!b) continue;
    const prev = b.previousElementSibling; if (prev && prev.classList.contains('nav-sep')) prev.remove();
    b.remove();
  }
  const bottom = document.querySelector('.sidebar-bottom');
  if (bottom) for (const n of bottom.childNodes) if (n.nodeType === 3 && n.textContent.includes('Servidor local online')) n.textContent = ' Conectado pelo app da recepção';
  const small = document.querySelector('.auth-brand small'); if (small) small.textContent = 'APP DA RECEPÇÃO';
  const note = document.querySelector('#auth-form > small'); if (note) note.textContent = 'Mesmo usuário e senha do painel do servidor.';
})();
