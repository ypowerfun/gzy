'use strict';
// Proteção de rede do GameZoney. Quem está na rede da arena (PCs dos clientes, Wi-Fi, TVs) só alcança o que precisa:
//  - próprio servidor (127.0.0.1, sem proxy): tudo (painel da recepção)
//  - computadores da arena: somente o canal HTTPS dos PCs (/pc e /pc-setup, porta 3443)
//  - TVs cadastradas: somente o resumo da sessão (/cliente.html, /logo.jpg, /tv/*) e apenas do IP da própria TV
//  - qualquer outro aparelho, e pedidos repassados por proxy (X-Forwarded-*): nada
// Todo o resto responde 404, sem revelar o que existe no servidor. O painel nunca fica na rede local.
const loopback = value => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value);
const forwarded = req => !!(req.headers['x-forwarded-for'] || req.headers['x-forwarded-proto'] || req.headers['x-forwarded-host']);
const TV_FILES = new Set(['/cliente.html', '/logo.jpg']);

function origin(req) {
  const address = String(req.socket.remoteAddress || '');
  if (loopback(address)) return forwarded(req) ? 'proxy' : 'local';
  return req.socket.encrypted ? 'pc' : 'lan';
}

function allowed(req, store) {
  const where = origin(req), p = req.path;
  if (where === 'local') return true;
  if (where === 'proxy') return false;
  if (where === 'pc') return p === '/pc' || p.startsWith('/pc/') || p === '/pc-setup' || p.startsWith('/pc-setup/');
  if (TV_FILES.has(p) || p.startsWith('/tv/')) {
    const ip = String(req.socket.remoteAddress).replace(/^::ffff:/, '');
    return store.state.stations.some(s => s.kind === 'tv' && s.active !== false && !s.removedAt && s.ip === ip);
  }
  return false;
}

module.exports = function networkGuard(store) {
  return (req, res, next) => {
    if (allowed(req, store)) return next();
    res.set('Cache-Control', 'no-store').status(404).type('text').send('Não encontrado.');
  };
};
module.exports.origin = origin;
