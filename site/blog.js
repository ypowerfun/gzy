'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.7: Blog (português). Artigos que respondem ao que os donos de lan house e arena gamer pesquisam no Google
// ("como abrir uma lan house", "quanto cobrar por hora"...). O administrador escreve em /admin › Blog; as páginas
// /blog e /blog/<endereço> são montadas no servidor (o Google lê sem precisar de JavaScript) com o visual do site.
// Texto do artigo em formato simples: "## Título", "### Subtítulo", "- item", "1. item", **negrito**, [link](https://… ou /…).
const fs = require('node:fs'), path = require('node:path');

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

function render(text, site) {
  const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:https:\/\/|\/)[^)\s]*)\)/g, (m, t, u) => `<a href="${u}"${/^https:\/\//.test(u) && !u.startsWith(site) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
  return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean).map(b => {
    const lines = b.split('\n').map(l => l.trim());
    if (/^### /.test(b)) return `<h3>${inline(b.slice(4))}</h3>`;
    if (/^## /.test(b)) return `<h2>${inline(b.slice(3))}</h2>`;
    if (lines.every(l => /^- /.test(l))) return `<ul>${lines.map(l => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    if (lines.every(l => /^\d+\. /.test(l))) return `<ol>${lines.map(l => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('\n');
}
const words = t => (String(t || '').match(/\S+/g) || []).length;

module.exports = function blog(app, ctx) {
  const {db, needAdmin, jsonOnly, api, fail, str, uid, SITE, publicDir} = ctx;
  db.raw.exec("CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', published_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, author TEXT NOT NULL DEFAULT '')");
  // primeiros artigos (uma vez só: se o administrador apagar, não voltam)
  if (!db.get("SELECT 1 FROM settings WHERE key='blog_seeded'")) {
    const now = Date.now();
    require('./blog-artigos').forEach((a, i) => { if (!db.get('SELECT 1 FROM posts WHERE slug=?', a.slug)) db.run("INSERT INTO posts(id,slug,title,summary,body,status,published_at,created_at,updated_at,author) VALUES(?,?,?,?,?,'published',?,?,?,'GameZoney')", uid(), a.slug, a.title, a.summary, a.body, now - i * 86400000, now, now); });
    db.run("INSERT INTO settings(key,value) VALUES('blog_seeded','1')");
  }
  const published = () => db.all("SELECT * FROM posts WHERE status='published' ORDER BY published_at DESC LIMIT 200");
  const date = t => new Date(t).toLocaleDateString('pt-BR', {day: '2-digit', month: 'long', year: 'numeric'});

  // ---------- páginas ----------
  let shell = null, shellMtime = 0;
  function page({title, description, url, main, ld, type = 'website'}) {
    const file = path.join(publicDir, 'atualizacoes.html'), st = fs.statSync(file);
    if (!shell || st.mtimeMs !== shellMtime) { shell = fs.readFileSync(file, 'utf8'); shellMtime = st.mtimeMs; }
    const a = shell.indexOf('<main'), b = shell.indexOf('</main>') + 7;
    const head = [`<meta name="description" content="${esc(description)}">`, `<link rel="canonical" href="${url}">`, `<meta property="og:type" content="${type}">`, '<meta property="og:site_name" content="GameZoney">',
      `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(description)}">`, `<meta property="og:url" content="${url}">`, `<meta property="og:image" content="${SITE}/share/og-pt.jpg">`,
      '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">', '<meta property="og:locale" content="pt_BR">', '<meta name="twitter:card" content="summary_large_image">',
      ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''].join('');
    return (shell.slice(0, a) + main + shell.slice(b)).replace(/<html lang="[^"]*"/, '<html lang="pt-BR"').replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
      .replace(/\s*<meta (?:name="description"|name="twitter:[^"]*"|property="og:[^"]*")[^>]*>/g, '').replace(/\s*<link rel="(?:canonical|alternate)"[^>]*>/g, '').replace('</head>', head + '</head>')
      .replace('<body class="release-page"', '<body class="release-page blog-page"');
  }
  const cta = '<aside class="blog-cta card"><h2>Experimente o GameZoney na sua arena</h2><p>Controle de tempo dos PCs e consoles, recargas, PDV, caixa e fidelidade em um só sistema. Teste grátis por 30 dias, sem cartão.</p><div class="row"><a class="btn gold" href="/entrar.html?criar=1&amp;next=/conta">Testar grátis</a><a class="btn outline" href="/#precos">Ver planos</a></div></aside>';
  const card = p => `<article class="card blog-card"><p class="blog-date">${date(p.published_at)}</p><h2><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></h2><p>${esc(p.summary)}</p><a class="text-action" href="/blog/${esc(p.slug)}">Ler artigo →</a></article>`;
  app.get(['/blog', '/blog/'], (req, res) => {
    const list = published();
    const main = `<main id="conteudo"><section class="block2"><div class="wrap"><p class="eyebrow line">Blog GameZoney</p><h1 class="mega2">Dicas para lan house e arena gamer.</h1><p class="sub2">Como abrir, quanto cobrar, como organizar eventos e como controlar a sua arena.</p><div class="blog-list">${list.map(card).join('') || '<p class="note">Os primeiros artigos chegam em breve.</p>'}</div>${cta}</div></section></main>`;
    res.set('Cache-Control', 'public, max-age=300').type('html').send(page({title: 'Blog | GameZoney – dicas para lan house e arena gamer', description: 'Artigos para donos de lan house e arena gamer: como abrir, quanto cobrar por hora, eventos e controle da arena.', url: SITE + '/blog', main,
      ld: {'@context': 'https://schema.org', '@type': 'Blog', name: 'Blog GameZoney', url: SITE + '/blog', inLanguage: 'pt-BR', publisher: {'@type': 'Organization', name: 'GameZoney', logo: {'@type': 'ImageObject', url: SITE + '/logo-gamezoney.png'}}}}));
  });
  app.get('/blog/:slug', (req, res, next) => {
    const p = db.get("SELECT * FROM posts WHERE slug=? AND status='published'", String(req.params.slug));
    if (!p) return res.status(404).sendFile(path.join(publicDir, '404.html'));
    const others = published().filter(o => o.id !== p.id).slice(0, 3), mins = Math.max(1, Math.round(words(p.body) / 200)), url = SITE + '/blog/' + p.slug;
    const main = `<main id="conteudo"><article class="block2 blog-post"><div class="wrap"><nav class="blog-crumbs" aria-label="Você está em"><a href="/">Início</a> › <a href="/blog">Blog</a></nav><h1 class="mega2">${esc(p.title)}</h1><p class="blog-date">${date(p.published_at)} • ${mins} min de leitura</p><p class="sub2">${esc(p.summary)}</p><div class="blog-body">${render(p.body, SITE)}</div>${cta}${others.length ? `<h2 class="blog-more">Leia também</h2><div class="blog-list">${others.map(card).join('')}</div>` : ''}</div></article></main>`;
    res.set('Cache-Control', 'public, max-age=300').type('html').send(page({title: p.title + ' | Blog GameZoney', description: p.summary || p.title, url, main, type: 'article',
      ld: {'@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.summary, datePublished: new Date(p.published_at).toISOString(), dateModified: new Date(p.updated_at).toISOString(), inLanguage: 'pt-BR', mainEntityOfPage: url, image: SITE + '/share/og-pt.jpg',
        author: {'@type': 'Organization', name: 'GameZoney', url: SITE + '/'}, publisher: {'@type': 'Organization', name: 'GameZoney', logo: {'@type': 'ImageObject', url: SITE + '/logo-gamezoney.png'}}}}));
  });

  // ---------- administrador ----------
  app.get('/api/admin/posts', api(req => { needAdmin(req); return {posts: db.all('SELECT id,slug,title,summary,body,status,published_at,updated_at FROM posts ORDER BY COALESCE(published_at,created_at) DESC')}; }));
  app.post('/api/admin/posts', jsonOnly, api(req => {
    needAdmin(req); const b = req.body || {}, id = str(b.id, 60), now = Date.now();
    const title = str(b.title, 160), summary = str(b.summary, 300), body = String(b.body ?? '').replace(/\r/g, '').slice(0, 60000).trim(), status = b.status === 'published' ? 'published' : 'draft';
    if (title.length < 5) fail(400, 'Escreva o título (mínimo 5 caracteres).'); if (body.length < 50) fail(400, 'Escreva o texto do artigo.');
    const slug = slugify(b.slug || title); if (slug.length < 3) fail(400, 'Endereço inválido.');
    const clash = db.get('SELECT id FROM posts WHERE slug=?', slug); if (clash && clash.id !== id) fail(409, 'Já existe um artigo com este endereço. Mude o endereço.');
    const old = id ? db.get('SELECT * FROM posts WHERE id=?', id) || fail(404, 'Artigo não encontrado.') : null;
    const publishedAt = status === 'published' ? (old && old.published_at) || now : (old ? old.published_at : null);
    if (old) db.run('UPDATE posts SET slug=?, title=?, summary=?, body=?, status=?, published_at=?, updated_at=? WHERE id=?', slug, title, summary, body, status, publishedAt, now, old.id);
    else db.run('INSERT INTO posts(id,slug,title,summary,body,status,published_at,created_at,updated_at,author) VALUES(?,?,?,?,?,?,?,?,?,?)', uid(), slug, title, summary, body, status, publishedAt, now, now, req.user.email);
    db.audit(req.user.email, 'blog', `${old ? 'editado' : 'criado'}: ${title} (${status === 'published' ? 'publicado' : 'rascunho'})`);
    return {ok: true, slug, url: '/blog/' + slug};
  }));
  app.post('/api/admin/posts/:id/remove', jsonOnly, api(req => { needAdmin(req); const p = db.get('SELECT * FROM posts WHERE id=?', req.params.id) || fail(404, 'Artigo não encontrado.'); db.run('DELETE FROM posts WHERE id=?', p.id); db.audit(req.user.email, 'blog', 'excluído: ' + p.title); return {ok: true}; }));
  app.post('/api/admin/posts/preview', jsonOnly, api(req => { needAdmin(req); return {html: render(String(req.body?.body || '').slice(0, 60000), SITE)}; }));

  // endereços para o sitemap.xml
  return {sitemap: () => [{loc: SITE + '/blog', lastmod: Math.max(0, ...published().map(p => p.updated_at))}, ...published().map(p => ({loc: SITE + '/blog/' + p.slug, lastmod: p.updated_at}))]};
};
module.exports.render = render;
module.exports.slugify = slugify;
