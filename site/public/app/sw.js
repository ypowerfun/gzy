'use strict';
// GameZoney — app do cliente: notificações no celular mesmo com o app fechado (2.25). Software proprietário e confidencial.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = {body: e.data ? e.data.text() : ''}; }
  const title = String(d.title || 'Aviso da arena').slice(0, 80), body = String(d.body || '').slice(0, 240);
  e.waitUntil((async () => {
    // app aberto: o sino atualiza na hora
    for (const c of await self.clients.matchAll({type: 'window', includeUncontrolled: true})) c.postMessage({type: 'gz-notice'});
    await self.registration.showNotification(title, {body, tag: String(d.tag || 'gz').slice(0, 80), icon: '/app/img/icon-192.png', badge: '/app/img/icon-64.png', data: {url: String(d.url || '')}});
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data && e.notification.data.url;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const c of list) { c.postMessage({type: 'gz-open-notices'}); if ('focus' in c) return c.focus(); }
    if (/^https:\/\/[^\s]+$/.test(url || '')) return self.clients.openWindow(url);
  })());
});
