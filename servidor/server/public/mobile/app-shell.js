'use strict';
// 3.0.54: roda antes do primeiro desenho da página (sem piscar). Dentro dos apps GameZoney (Android/iOS)
// o próprio app já reserva o espaço da barra de status e da barra de gestos: a página não reserva de novo.
(() => {
  if (/GameZoneyMobile/.test(navigator.userAgent)) document.documentElement.classList.add('in-app');
})();
