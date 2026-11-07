'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.8: Pixel da Meta e tag do Google (Analytics 4 / Google Ads) para medir e otimizar os anúncios.
//  - Os IDs são colados em /admin › Anúncios (settings.tracking). Sem ID, nada muda no site (nem a CSP).
//    Google: G- (Analytics 4), AW- (Google Ads), GT- (tag do Google) ou GTM- (contêiner do Google Tag Manager).
//  - LGPD: o site mostra o aviso de cookies; Meta e Google só carregam DEPOIS que o visitante aceita (public/tracking.js).
//  - Eventos: visita de página, cadastro (CompleteRegistration / sign_up), início da compra (InitiateCheckout / begin_checkout)
//    e assinatura (Subscribe / purchase), com o valor em reais.
const RE = {meta: /^\d{8,20}$/, google: /^(G|AW|GT|GTM)-[A-Z0-9]{4,20}$/, conversion: /^AW-\d{6,15}\/[A-Za-z0-9_-]{4,40}$/};
const DOMAINS = {
  'script-src': ['https://connect.facebook.net', 'https://www.googletagmanager.com', 'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net'],
  'img-src': ['https://www.facebook.com', 'https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://www.googletagmanager.com', 'https://*.g.doubleclick.net', 'https://www.google.com', 'https://www.google.com.br', 'https://www.googleadservices.com'],
  'connect-src': ['https://www.facebook.com', 'https://connect.facebook.net', 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com', 'https://*.g.doubleclick.net', 'https://www.google.com', 'https://www.googleadservices.com'],
  'frame-src': ['https://td.doubleclick.net', 'https://www.googletagmanager.com']
};

module.exports = function tracking(db) {
  let cache = null;
  const get = () => {
    if (cache) return cache;
    let t = {}; try { t = JSON.parse(db.get("SELECT value FROM settings WHERE key='tracking'")?.value || '{}'); } catch { }
    cache = {meta: RE.meta.test(t.meta || '') ? t.meta : '', google: (Array.isArray(t.google) ? t.google : []).filter(g => RE.google.test(g)).slice(0, 3),
      googleSignup: RE.conversion.test(t.googleSignup || '') ? t.googleSignup : '', googlePurchase: RE.conversion.test(t.googlePurchase || '') ? t.googlePurchase : ''};
    return cache;
  };
  const enabled = () => { const t = get(); return !!(t.meta || t.google.length); };
  // acrescenta os domínios da Meta/Google à CSP só quando há algum ID configurado
  function csp(policy) {
    if (!enabled()) return policy;
    let out = policy;
    for (const [dir, list] of Object.entries(DOMAINS)) {
      const re = new RegExp(`(^|; )${dir} ([^;]*)`);
      out = re.test(out) ? out.replace(re, (m, a, v) => `${a}${dir} ${v} ${list.join(' ')}`) : out + `; ${dir} 'self' ${list.join(' ')}`;
    }
    return out;
  }
  function routes(app, {needAdmin, jsonOnly, api, fail}) {
    app.get('/api/admin/tracking', api(req => { needAdmin(req); return {tracking: get()}; }));
    app.post('/api/admin/tracking', jsonOnly, api(req => {
      needAdmin(req); const b = req.body || {}, s = v => String(v ?? '').trim();
      const meta = s(b.meta), google = s(b.google).split(/[\s,;]+/).filter(Boolean), googleSignup = s(b.googleSignup), googlePurchase = s(b.googlePurchase);
      if (meta && !RE.meta.test(meta)) fail(400, 'ID do Pixel da Meta inválido (só números, ex.: 123456789012345).');
      for (const g of google) if (!RE.google.test(g)) fail(400, `ID do Google inválido: ${g} (use G-XXXXXXXXXX, AW-123456789 ou GTM-XXXXXXX).`);
      if (google.length > 3) fail(400, 'No máximo 3 IDs do Google.');
      for (const c of [googleSignup, googlePurchase]) if (c && !RE.conversion.test(c)) fail(400, `Conversão do Google Ads inválida: ${c} (formato AW-123456789/AbCdEf).`);
      const value = {meta, google, googleSignup, googlePurchase};
      db.run("INSERT INTO settings(key,value) VALUES('tracking',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", JSON.stringify(value));
      cache = null; db.audit(req.user.email, 'anuncios', `Pixel ${meta || '—'} • Google ${google.join(', ') || '—'}`);
      return {tracking: get()};
    }));
  }
  return {get, enabled, csp, routes, publicConfig: () => enabled() ? get() : null};
};
module.exports.RE = RE;
