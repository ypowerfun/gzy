'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createApp} = require('../server');

async function boot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-d-')); const mails = [];
  const app = createApp({env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''},
    mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, subject, text}); return true; }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const client = () => { let cookie = ''; return async (url, body, status = 200) => {
    const r = await fetch(base + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); if (kv.startsWith('gzs=')) cookie = kv.endsWith('=') ? '' : kv; }
    const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); try { return JSON.parse(text); } catch { return {text, headers: r.headers}; } }; };
  const admin = async () => { const c = client(); await c('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'}); const m = mails.find(x => x.to === 'dono@gamezoney.com'); await fetch(base + '/api/auth/verify?t=' + m.text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'}); return c; };
  return {base, client, admin, dir};
}
// PNG 1x1 válido
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test('1.7: design do site — só o administrador salva; textos, links e imagens são conferidos; restaurar volta ao original', async t => {
  const s = await boot(t); const anon = s.client(), ana = s.client();
  assert.deepEqual(await anon('/api/design?page=/'), {key: '/', page: [], header: [], footer: [], partners: []});
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  await ana('/api/admin/design', {pages: {'/': [{p: '1.0', s: 'x', x: 1}]}}, 403);
  await ana('/api/admin/design/image', {data: PNG}, 403);
  const dono = await s.admin();
  // link perigoso e imagem de fora são recusados
  await dono('/api/admin/design', {pages: {'/': [{p: '1.2', s: 'Entrar', h: 'javascript:alert(1)'}]}}, 400);
  await dono('/api/admin/design', {pages: {'/': [{p: '1.2', s: 'Logo', i: 'https://evil.com/x.png'}]}}, 400);
  await dono('/api/admin/design/image', {data: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='}, 400);
  await dono('/api/admin/design/image', {data: 'data:image/png;base64,' + Buffer.from('não é imagem').toString('base64')}, 400);
  const {url} = await dono('/api/admin/design/image', {data: PNG}); assert.match(url, /^\/media\/design\/[a-f0-9]{24}\.png$/);
  assert.equal((await fetch(s.base + url)).status, 200);
  const r = await dono('/api/admin/design', {pages: {
    '/index.html': [{p: '2.0.1', s: 'Sua arena.', t: {pt: 'Nova chamada', en: 'New headline', fr: 'ignorado'}, d: {z: 150, dx: 10, dy: -5}, m: {z: 100, dx: 0, dy: 0}}, {p: '9', s: 'img:hero.jpg', i: url, a: 'Foto'}, {p: '3', s: 'nada'}],
    '*h': [{p: '0.0', s: 'img:logo-gamezoney.png', d: {z: 900}}], '*f': [{p: '1.1', s: 'Termos', x: 1, h: '/termos.html'}]}});
  assert.deepEqual(r.saved, {'/': 2, '*h': 1, '*f': 1}, 'item sem alteração é descartado; /index.html vira /');
  const pub = await anon('/api/design?page=/index.html');
  assert.deepEqual(pub.page[0], {p: '2.0.1', s: 'Sua arena.', t: {pt: 'Nova chamada', en: 'New headline'}, d: {z: 150, dx: 10, dy: -5}}, 'idioma desconhecido e posição padrão do celular não são guardados');
  assert.equal(pub.header[0].d.z, 400, 'tamanho limitado a 400%'); assert.equal(pub.footer[0].x, 1);
  assert.equal((await anon('/api/design?page=/atendimento.html')).page.length, 0); assert.equal((await anon('/api/design?page=/atendimento.html')).footer.length, 1, 'rodapé vale para todas as páginas');
  assert.deepEqual((await dono('/api/admin/design')).pages, {'/': 2, '*h': 1, '*f': 1});
  // texto é guardado como texto (o navegador põe com textContent); HTML não vira código
  await dono('/api/admin/design', {pages: {'/atendimento.html': [{p: '1', s: 'a', t: {pt: '<img src=x onerror=alert(1)>'}}]}});
  assert.equal((await anon('/api/design?page=/atendimento')).page[0].t.pt, '<img src=x onerror=alert(1)>');
  await dono('/api/admin/design/reset', {page: '/'}); assert.equal((await anon('/api/design?page=/')).page.length, 0);
  assert.equal((await anon('/api/design?page=/')).header.length, 1, 'restaurar a página não mexe no topo');
  await dono('/api/admin/design/reset', {page: 'all'}); assert.deepEqual((await dono('/api/admin/design')).pages, {});
});

test('1.7: parceiros do rodapé — logo do próprio site, nome obrigatório, link só https', async t => {
  const s = await boot(t); const anon = s.client(), dono = await s.admin();
  const {url} = await dono('/api/admin/design/image', {data: PNG});
  await dono('/api/admin/partners', {partners: [{name: '', img: url}]}, 400);
  await dono('/api/admin/partners', {partners: [{name: 'X', img: 'https://evil.com/a.png'}]}, 400);
  await dono('/api/admin/partners', {partners: [{name: 'X', img: url, url: 'javascript:alert(1)'}]}, 400);
  const r = await dono('/api/admin/partners', {partners: [{name: 'Loja Gamer', img: url, url: 'https://lojagamer.com.br'}, {name: 'Arena Parceira', img: url}]});
  assert.equal(r.partners.length, 2); assert.ok(r.partners[0].id);
  assert.deepEqual((await anon('/api/design?page=/')).partners, [{name: 'Loja Gamer', url: 'https://lojagamer.com.br', img: url}, {name: 'Arena Parceira', url: '', img: url}]);
  await dono('/api/admin/partners', {partners: []}); assert.equal((await anon('/api/design?page=/')).partners.length, 0);
  // a página inicial tem o selo de compra segura no preço e no rodapé
  const home = await (await fetch(s.base + '/')).text(); assert.equal((home.match(/Compra 100% segura/g) || []).length, 2); assert.match(home, /class="footer-trust"/);
});
