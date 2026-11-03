'use strict';
// 3.0.51: proteção de rede. Quem está na rede da arena (PCs dos clientes, Wi-Fi, TVs) só alcança o que precisa:
//  - próprio servidor (127.0.0.1, sem proxy): tudo (painel da recepção)
//  - Caddy (HTTPS público, 127.0.0.1 com cabeçalhos X-Forwarded-*): somente o app (/mobile). 3.0.70: sem os arquivos do painel (app SV retirado)
//  - computadores da arena: somente o canal HTTPS dos PCs (/pc e /pc-setup, porta 3443)
//  - TVs cadastradas: somente o resumo da sessão (/cliente.html, /logo.jpg, /tv/*) e apenas do IP da própria TV
//  - celulares na rede local: somente o app do cliente (pode ser desligado em Configurações → Apps)
// Todo o resto responde 404, sem revelar o que existe no servidor. O app SV e o painel nunca ficam na rede local.
const loopback = value => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value);
const forwarded = req => !!(req.headers['x-forwarded-for'] || req.headers['x-forwarded-proto'] || req.headers['x-forwarded-host']);
const CLIENT_FILES = new Set(['/mobile', '/mobile/client', '/mobile/client.css', '/mobile/client.js', '/logo-prime.png', '/favicon.ico',
  // 3.0.52: instalação na Tela de Início (iPhone/Android)
  '/mobile/manifest.webmanifest', '/mobile/install-hint.js', '/mobile/apple-touch-icon.png', '/mobile/icon-192.png', '/mobile/icon-512.png',
  '/mobile/icon-maskable-512.png',
  // 3.0.54: modo dentro do app (antes do primeiro desenho)
  '/mobile/app-shell.js', '/mobile/emblem.png',
  // 3.0.55: fonte Rajdhani (licença OFL) servida pelo próprio servidor
  '/mobile/fonts/rajdhani-600.woff2', '/mobile/fonts/rajdhani-700.woff2',
  // 3.0.57: ilustrações da área do cliente (WebP)
  ...['bg-entrada', 'bg-app', 'hero-arena', 'hourglass-red', 'hourglass-gold', 'shield-gold', 'medal-gold', 'medal-silver', 'station-pc', 'station-console', 'trophy-gold'].map(name => `/mobile/art/${name}.webp`)]);
const TV_FILES = new Set(['/cliente.html', '/logo.jpg']);

function origin(req) {
  const address = String(req.socket.remoteAddress || '');
  if (loopback(address)) return forwarded(req) ? 'proxy' : 'local';
  return req.socket.encrypted ? 'pc' : 'lan';
}

function allowed(req, store) {
  const where = origin(req), p = req.path;
  if (where === 'local') return true;
  if (where === 'proxy') return p === '/mobile' || p.startsWith('/mobile/');
  if (where === 'pc') return p === '/pc' || p.startsWith('/pc/') || p === '/pc-setup' || p.startsWith('/pc-setup/');
  if (TV_FILES.has(p) || p.startsWith('/tv/')) {
    const ip = String(req.socket.remoteAddress).replace(/^::ffff:/, '');
    return store.state.stations.some(s => s.kind === 'tv' && s.active !== false && !s.removedAt && s.ip === ip);
  }
  if (store.state.settings.mobile?.lanClient === false) return false;
  return CLIENT_FILES.has(p) || p.startsWith('/mobile/api/');
}

module.exports = function networkGuard(store) {
  return (req, res, next) => {
    if (allowed(req, store)) return next();
    res.set('Cache-Control', 'no-store').status(404).type('text').send('Não encontrado.');
  };
};
module.exports.origin = origin;
