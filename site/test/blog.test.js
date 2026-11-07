'use strict';
// 2.7: Blog — artigos iniciais, páginas montadas no servidor, administração, texto sempre escapado e sitemap
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createApp} = require('../server');
const {render, slugify} = require('../blog');

test('2.7: formato do texto escapa HTML e só aceita links https ou do próprio site', () => {
  const h = render('## Título <b>x</b>\n\nTexto com **negrito** e [link](/#precos) e [externo](https://exemplo.com) e [ruim](javascript:alert(1)).\n\n- um\n- dois\n\n1. a\n2. b\n\n<script>alert(1)</script>', 'https://gamezoney.com');
  assert.match(h, /<h2>Título &lt;b&gt;x&lt;\/b&gt;<\/h2>/); assert.match(h, /<strong>negrito<\/strong>/); assert.match(h, /<a href="\/#precos">link<\/a>/);
  assert.match(h, /<a href="https:\/\/exemplo.com" target="_blank" rel="noopener">externo<\/a>/); assert.ok(!/href="javascript/.test(h)); assert.ok(!h.includes('<script>'));
  assert.match(h, /<ul><li>um<\/li><li>dois<\/li><\/ul>/); assert.match(h, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
  assert.equal(slugify('Como abrir uma Lan House em 2026?'), 'como-abrir-uma-lan-house-em-2026');
});

test('2.7: blog público, artigos iniciais, administração e sitemap', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-blog-')), mails = [];
  const env = {SITE_URL: 'https://gamezoney.com', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', ADMIN_MFA: '0', MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''};
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env, mail: {enabled: true, send: async (to, s, text) => { mails.push({to, text}); return true; }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }), base = 'http://127.0.0.1:' + server.address().port;
  let closed = false; t.after(() => { server.close(); if (!closed) app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const client = () => { let c = ''; return async (url, body, status = 200) => { const r = await fetch(base + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: c}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const x of r.headers.getSetCookie?.() || []) { const [kv] = x.split(';'); if (kv.startsWith('gzs=')) c = kv.endsWith('=') ? '' : kv; } const text = await r.text(); assert.equal(r.status, status, url + ' ' + text.slice(0, 200)); try { return JSON.parse(text); } catch { return {html: text}; } }; };
  const anon = client(), dono = client(), ana = client();
  // artigos iniciais publicados
  const list = (await anon('/blog')).html; assert.equal((list.match(/class="card blog-card"/g) || []).length, 4); assert.match(list, /<link rel="canonical" href="https:\/\/gamezoney.com\/blog">/);
  const art = (await anon('/blog/quanto-cobrar-por-hora-lan-house')).html;
  assert.match(art, /<title>Quanto cobrar por hora na lan house/); assert.match(art, /"@type":"BlogPosting"/); assert.match(art, /Leia também/); assert.match(art, /<h2>1\. Some os custos fixos do mês<\/h2>/); assert.match(art, /<html lang="pt-BR"/);
  await anon('/blog/nao-existe', undefined, 404);
  // administração: só admin
  await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  await fetch(base + '/api/auth/verify?t=' + mails.find(m => m.to === 'dono@gamezoney.com').text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'});
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  await ana('/api/admin/posts', undefined, 403); await ana('/api/admin/posts', {title: 'Teste de artigo', body: 'x'.repeat(60)}, 403);
  assert.equal((await dono('/api/admin/posts')).posts.length, 4);
  await dono('/api/admin/posts', {title: 'Curto', body: 'pouco'}, 400);
  const r = await dono('/api/admin/posts', {title: 'Promoção de férias na arena gamer', summary: 'Ideias <b>de</b> promoção', body: 'Texto do artigo com ideias de promoção para as férias escolares. <script>x</script>', status: 'draft'});
  assert.equal(r.slug, 'promocao-de-ferias-na-arena-gamer');
  await anon('/blog/' + r.slug, undefined, 404); // rascunho não aparece
  await dono('/api/admin/posts', {title: 'Outro título', slug: r.slug, body: 'y'.repeat(60)}, 409); // endereço repetido
  const id = (await dono('/api/admin/posts')).posts.find(p => p.slug === r.slug).id;
  await dono('/api/admin/posts', {id, title: 'Promoção de férias na arena gamer', slug: r.slug, summary: 'Ideias <b>de</b> promoção', body: 'Texto do artigo com ideias de promoção para as férias escolares. <script>x</script>', status: 'published'});
  const pub = (await anon('/blog/' + r.slug)).html; assert.ok(!pub.includes('<script>x</script>')); assert.match(pub, /Ideias &lt;b&gt;de&lt;\/b&gt; promoção/);
  const map = (await anon('/sitemap.xml')).html; assert.ok(map.includes('<loc>https://gamezoney.com/blog</loc>')); assert.ok(map.includes(`<loc>https://gamezoney.com/blog/${r.slug}</loc>`));
  // excluir: e os artigos iniciais não voltam
  await dono(`/api/admin/posts/${id}/remove`, {});
  for (const p of (await dono('/api/admin/posts')).posts) await dono(`/api/admin/posts/${p.id}/remove`, {});
  app.locals.close(); closed = true;
  const app2 = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env, log: {log() {}, error() {}}});
  const s2 = await new Promise(r2 => { const s = app2.listen(0, '127.0.0.1', () => r2(s)); });
  const again = await (await fetch('http://127.0.0.1:' + s2.address().port + '/blog')).text(); s2.close(); app2.locals.close();
  assert.equal((again.match(/class="card blog-card"/g) || []).length, 0, 'artigos iniciais entram uma vez só');
});
