'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.6 (SEO / visitantes de outros países):
//  - Endereços próprios por idioma: / (português, padrão), /en/ (inglês) e /es/ (espanhol), para o Google indexar as três
//    versões. A página é a mesma; o servidor troca idioma, título, descrição e etiquetas e o i18n-site.js traduz o resto.
//  - Em cada página pública: descrição, endereço oficial (canonical), versões nos outros idiomas (hreflang), cartão de
//    compartilhamento (WhatsApp/Facebook/Instagram/X) com imagem própria 1200x630 e, na inicial, dados estruturados
//    (SoftwareApplication com os preços dos planos e a organização).
//  - /robots.txt e /sitemap.xml para os buscadores.
const fs = require('node:fs'), path = require('node:path');

const LANGS = ['pt', 'en', 'es'];
const HTML_LANG = {pt: 'pt-BR', en: 'en', es: 'es'}, OG_LOCALE = {pt: 'pt_BR', en: 'en_US', es: 'es_ES'};
const PAGES = ['index', 'atualizacoes', 'atendimento', 'termos', 'privacidade'];
// textos para buscadores e compartilhamento (com os termos que as pessoas pesquisam em cada país)
const SEO = {
  index: {
    pt: ['GameZoney | Sistema para Lan House e Arena Gamer: PCs, Consoles, Caixa e PDV', 'Sistema completo para lan house, arena gamer e cyber café: tempo de PCs e consoles, controle de impressão, PDV, caixa, notas fiscais, fidelidade e várias lojas. Teste grátis por 30 dias.'],
    en: ['GameZoney | LAN Center & Gaming Center Management Software: PCs, Consoles, POS', 'All-in-one software for LAN centers, gaming lounges and cyber cafés: PC and console time, print control, point of sale, cash register, invoices, loyalty and multi-store. 30-day free trial.'],
    es: ['GameZoney | Software para Cibercafé y Centro Gamer: PCs, Consolas, Caja y TPV', 'Sistema completo para cibercafés y salas gamer: tiempo de PCs y consolas, control de impresión, punto de venta, caja, facturas, fidelidad y varias tiendas. Prueba gratis por 30 días.']
  },
  atualizacoes: {
    pt: ['Atualizações | GameZoney – sistema para lan house', 'Novidades do GameZoney: o sistema para lan house e arena gamer que recebe melhorias constantes.'],
    en: ['Updates | GameZoney – LAN center software', 'What is new in GameZoney, the LAN center and gaming center software that keeps improving.'],
    es: ['Actualizaciones | GameZoney – software para cibercafé', 'Novedades de GameZoney, el sistema para cibercafés y centros gamer que mejora constantemente.']
  },
  atendimento: {
    pt: ['Atendimento | GameZoney', 'Fale com a equipe GameZoney: dúvidas sobre compra, suporte técnico e guia de instalação do sistema para lan house.'],
    en: ['Support | GameZoney', 'Talk to the GameZoney team: purchase questions, technical support and the installation guide.'],
    es: ['Atención | GameZoney', 'Hable con el equipo GameZoney: dudas de compra, soporte técnico y guía de instalación.']
  },
  termos: {pt: ['Termos de uso | GameZoney', 'Termos de uso do GameZoney, planos e assinatura.'], en: ['Terms of use | GameZoney', 'GameZoney terms of use, plans and subscription.'], es: ['Términos de uso | GameZoney', 'Términos de uso de GameZoney, planes y suscripción.']},
  privacidade: {pt: ['Política de privacidade | GameZoney', 'Como o GameZoney trata os seus dados.'], en: ['Privacy policy | GameZoney', 'How GameZoney handles your data.'], es: ['Política de privacidad | GameZoney', 'Cómo GameZoney trata sus datos.']}
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const urlOf = (lang, page) => (lang === 'pt' ? '' : '/' + lang) + '/' + (page === 'index' ? '' : page + '.html');

module.exports = function seo(app, {publicDir, SITE, plans}) {
  const cache = new Map();
  const read = file => { const st = fs.statSync(file), c = cache.get(file); if (c && c.mtime === st.mtimeMs) return c.html; const html = fs.readFileSync(file, 'utf8'); cache.set(file, {mtime: st.mtimeMs, html}); return html; };
  function structured(lang) {
    const list = (plans && plans.publicPlans ? plans.publicPlans() : []).filter(p => !p.free);
    const prices = list.flatMap(p => [p.monthly, p.annual]).filter(n => n > 0);
    const app = {'@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'GameZoney', url: SITE + urlOf(lang, 'index'), applicationCategory: 'BusinessApplication', operatingSystem: 'Windows 10, Windows 11',
      inLanguage: ['pt-BR', 'en', 'es'], description: SEO.index[lang][1], image: SITE + '/share/og-' + lang + '.jpg',
      offers: prices.length ? {'@type': 'AggregateOffer', priceCurrency: 'BRL', lowPrice: (Math.min(...prices) / 100).toFixed(2), highPrice: (Math.max(...prices) / 100).toFixed(2), offerCount: prices.length} : {'@type': 'Offer', price: '0', priceCurrency: 'BRL'}};
    const org = {'@context': 'https://schema.org', '@type': 'Organization', name: 'GameZoney', url: SITE + '/', logo: SITE + '/logo-gamezoney.png', sameAs: ['https://www.instagram.com/gamezoney_']};
    // dados para o Google (não é código: o navegador não executa application/ld+json)
    return `<script type="application/ld+json">${JSON.stringify(app).replace(/</g, '\\u003c')}</script><script type="application/ld+json">${JSON.stringify(org).replace(/</g, '\\u003c')}</script>`;
  }
  function render(lang, page) {
    let html = read(path.join(publicDir, page + '.html'));
    const [title, description] = SEO[page][lang], url = SITE + urlOf(lang, page), image = SITE + '/share/og-' + lang + '.jpg';
    html = html.replace(/<html lang="[^"]*"/, `<html lang="${HTML_LANG[lang]}"${lang === 'pt' ? '' : ` data-gz-lang="${lang}"`}`)
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
      .replace(/\s*<meta (?:name="description"|name="twitter:[^"]*"|property="og:[^"]*")[^>]*>/g, '')
      .replace(/\s*<link rel="(?:canonical|alternate)"[^>]*>/g, '');
    const head = [`<meta name="description" content="${esc(description)}">`, `<link rel="canonical" href="${url}">`,
      ...LANGS.map(l => `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${SITE + urlOf(l, page)}">`), `<link rel="alternate" hreflang="x-default" href="${SITE + urlOf('pt', page)}">`,
      '<meta property="og:type" content="website">', '<meta property="og:site_name" content="GameZoney">', `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(description)}">`,
      `<meta property="og:url" content="${url}">`, `<meta property="og:image" content="${image}">`, '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
      `<meta property="og:locale" content="${OG_LOCALE[lang]}">`, ...LANGS.filter(l => l !== lang).map(l => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`),
      '<meta name="twitter:card" content="summary_large_image">', `<meta name="twitter:title" content="${esc(title)}">`, `<meta name="twitter:description" content="${esc(description)}">`, `<meta name="twitter:image" content="${image}">`,
      page === 'index' ? structured(lang) : ''].join('');
    return html.replace('</head>', head + '</head>');
  }
  // páginas públicas: /, /atualizacoes.html … e as mesmas em /en/ e /es/
  const RE = new RegExp(`^/(?:(en|es)/)?(?:(${PAGES.join('|')})(?:\\.html)?)?$`);
  app.get(/^\/(?:(?:en|es)(?:\/|$))?(?:[a-z-]+(?:\.html)?)?$/, (req, res, next) => {
    if (req.path === '/en' || req.path === '/es') return res.redirect(301, req.path + '/');
    const m = RE.exec(req.path); if (!m) return req.path.startsWith('/en/') || req.path.startsWith('/es/') ? res.status(404).sendFile(path.join(publicDir, '404.html')) : next();
    const lang = m[1] || 'pt', page = m[2] || 'index';
    let html; try { html = render(lang, page); } catch { return next(); }
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  });
  app.get('/robots.txt', (req, res) => res.type('text').set('Cache-Control', 'public, max-age=3600').send(
    ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /conta', 'Disallow: /carrinho', 'Disallow: /entrar', 'Disallow: /redefinir', 'Disallow: /api/', 'Disallow: /download/', 'Disallow: /guia', '', `Sitemap: ${SITE}/sitemap.xml`, ''].join('\n')));
  app.get('/sitemap.xml', (req, res) => {
    const mod = p => { try { return new Date(fs.statSync(path.join(publicDir, p + '.html')).mtimeMs).toISOString().slice(0, 10); } catch { return new Date().toISOString().slice(0, 10); } };
    const urls = PAGES.flatMap(p => LANGS.map(l => `<url><loc>${SITE + urlOf(l, p)}</loc><lastmod>${mod(p)}</lastmod><changefreq>${p === 'index' || p === 'atualizacoes' ? 'weekly' : 'yearly'}</changefreq><priority>${p === 'index' ? '1.0' : p === 'atualizacoes' ? '0.7' : '0.3'}</priority>${LANGS.map(a => `<xhtml:link rel="alternate" hreflang="${HTML_LANG[a]}" href="${SITE + urlOf(a, p)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${SITE + urlOf('pt', p)}"/></url>`));
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>\n`);
  });
  return {SEO, urlOf};
};
module.exports.SEO = SEO;
