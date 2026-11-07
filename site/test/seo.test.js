'use strict';
// 2.6: SEO — páginas por idioma (/, /en/, /es/), etiquetas para buscadores e compartilhamento, robots.txt e sitemap.xml
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createApp} = require('../server');

test('2.6: páginas públicas em 3 idiomas com título, descrição, canonical, hreflang, cartão de compartilhamento e dados estruturados', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-seo-'));
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'https://gamezoney.com', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }), base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const get = async (url, status = 200) => { const r = await fetch(base + url, {redirect: 'manual'}); assert.equal(r.status, status, url); return {r, html: await r.text()}; };
  const one = (html, re) => { const m = html.match(re); return m ? m[1] : null; };

  const pt = (await get('/')).html, en = (await get('/en/')).html, es = (await get('/es/')).html;
  assert.match(pt, /<html lang="pt-BR"/); assert.ok(!/data-gz-lang/.test(pt), 'português continua o padrão, sem forçar idioma');
  assert.match(en, /<html lang="en" data-gz-lang="en"/); assert.match(es, /<html lang="es" data-gz-lang="es"/);
  assert.match(one(pt, /<title>([^<]*)<\/title>/), /Lan House/); assert.match(one(en, /<title>([^<]*)<\/title>/), /LAN Center/); assert.match(one(es, /<title>([^<]*)<\/title>/), /Cibercafé/);
  for (const [html, url] of [[pt, 'https://gamezoney.com/'], [en, 'https://gamezoney.com/en/'], [es, 'https://gamezoney.com/es/']]) {
    assert.equal(one(html, /<link rel="canonical" href="([^"]*)"/), url);
    assert.equal((html.match(/<meta name="description"/g) || []).length, 1, 'uma descrição só');
    assert.equal((html.match(/property="og:title"/g) || []).length, 1, 'sem etiquetas repetidas');
    for (const l of ['pt-BR', 'en', 'es', 'x-default']) assert.ok(html.includes(`hreflang="${l}"`), l);
    const ld = JSON.parse(one(html, /<script type="application\/ld\+json">(.*?)<\/script>/));
    assert.equal(ld['@type'], 'SoftwareApplication'); assert.equal(ld.offers.priceCurrency, 'BRL'); assert.equal(ld.offers.lowPrice, '29.90');
  }
  assert.match(en, /og:image" content="https:\/\/gamezoney.com\/share\/og-en.jpg"/);
  // outras páginas e endereços
  const upd = (await get('/es/atualizacoes.html')).html; assert.match(upd, /<link rel="canonical" href="https:\/\/gamezoney.com\/es\/atualizacoes.html"/); assert.ok(!upd.includes('application/ld+json'), 'dados estruturados só na inicial');
  assert.match((await get('/atualizacoes')).html, /href="https:\/\/gamezoney.com\/atualizacoes.html"/);
  assert.equal((await get('/en', 301)).r.headers.get('location'), '/en/');
  await get('/en/nao-existe', 404); await get('/en/conta', 404);
  assert.match((await get('/entrar.html')).html, /<html/, 'páginas fora do SEO continuam iguais');
  const robots = (await get('/robots.txt')).html; assert.match(robots, /Disallow: \/admin/); assert.match(robots, /Sitemap: https:\/\/gamezoney.com\/sitemap.xml/);
  const map = (await get('/sitemap.xml')).html; assert.equal((map.match(/<url>/g) || []).length, 15); assert.ok(map.includes('<loc>https://gamezoney.com/es/termos.html</loc>'));
  const img = await fetch(base + '/share/og-pt.jpg'); assert.equal(img.status, 200); assert.equal(img.headers.get('cross-origin-resource-policy'), 'cross-origin', 'WhatsApp/Facebook carregam a imagem');
});
