'use strict';
// 2.4: faixa do topo sozinha no /admin, avaliação (enviar + 1 edição), chamados com imagens e um por vez, conversa encerrada
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createApp} = require('../server');

async function boot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-24-')), {privateKey} = crypto.generateKeyPairSync('ed25519'), mails = [];
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com',
    LICENSE_PRIVATE_KEY: privateKey.export({type: 'pkcs8', format: 'pem'}), MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''},
    mail: {enabled: true, send: async (to, subject, text) => { mails.push({to, subject, text}); return true; }}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }), base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const client = () => { const jar = {}; return async (url, body, status = 200) => {
    const r = await fetch(base + url, {redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ')}, body: body === undefined ? undefined : JSON.stringify(body)});
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'), i = kv.indexOf('='), k = kv.slice(0, i), v = kv.slice(i + 1); if (v) jar[k] = v; else delete jar[k]; }
    const buf = Buffer.from(await r.arrayBuffer()); assert.equal(r.status, status, url + ' ' + buf.toString().slice(0, 200));
    try { return JSON.parse(buf.toString()); } catch { return {buf, type: r.headers.get('content-type')}; } }; };
  const dono = client(); await dono('/api/auth/register', {name: 'Dono', email: 'dono@gamezoney.com', password: 'senha-do-dono'});
  await fetch(base + '/api/auth/verify?t=' + mails.find(m => m.to === 'dono@gamezoney.com').text.match(/verify\?t=([a-f0-9]+)/)[1], {redirect: 'manual'});
  return {base, client, dono, mails, dir};
}
const png = n => 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(n, 1)]).toString('base64');
const PNG = png(40);

test('2.4: /admin salva só a faixa do topo e mantém os preços da venda antiga', async t => {
  const s = await boot(t), anon = s.client();
  const before = (await s.dono('/api/admin/overview')).offer;
  const r = await s.dono('/api/admin/offer', {banner: 'Natal GameZoney'});
  assert.equal(r.offer.banner, 'Natal GameZoney'); assert.deepEqual([r.offer.priceCents, r.offer.listPriceCents, r.offer.priceLabel], [before.priceCents, before.listPriceCents, before.priceLabel]);
  assert.equal((await anon('/api/config')).banner, 'Natal GameZoney');
  assert.equal((await s.dono('/api/admin/offer', {banner: ''})).offer.banner, '');
});

test('2.4: avaliação — enviar, editar 1 vez e depois fechada (excluir não libera de novo)', async t => {
  const s = await boot(t), ana = s.client(), bia = s.client();
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  assert.equal((await ana('/api/reviews/mine')).canWrite, true);
  assert.equal((await ana('/api/reviews', {stars: 5, text: 'Sistema excelente para a arena!'})).canWrite, true, 'ainda pode editar 1 vez');
  const ed = await ana('/api/reviews', {stars: 4, text: 'Sistema excelente, recomendo muito!'}); assert.equal(ed.canWrite, false); assert.equal(ed.review.stars, 4);
  assert.match((await ana('/api/reviews', {stars: 5, text: 'Tentando editar de novo'}, 403)).error, /não pode mais ser alterada/);
  await ana('/api/reviews/remove', {}); assert.equal((await ana('/api/reviews/mine')).review, null);
  assert.match((await ana('/api/reviews', {stars: 5, text: 'Avaliar outra vez depois de excluir'}, 403)).error, /já avaliou/);
  // excluir antes de editar: pode avaliar de novo, mas isso conta como a edição
  await bia('/api/auth/register', {name: 'Bia', email: 'bia@x.com', password: 'senha-forte-1'});
  await bia('/api/reviews', {stars: 3, text: 'Bom, mas pode melhorar.'}); await bia('/api/reviews/remove', {});
  assert.equal((await bia('/api/reviews', {stars: 5, text: 'Melhorou bastante, ótimo!'})).canWrite, false);
});

test('2.4: chamado com até 2 imagens de 1 MB, só o dono e o admin veem, e um chamado aberto por vez', async t => {
  const s = await boot(t), ana = s.client(), bia = s.client(), anon = s.client();
  await ana('/api/auth/register', {name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1'});
  await bia('/api/auth/register', {name: 'Bia', email: 'bia@x.com', password: 'senha-forte-1'});
  await anon('/api/support', {subject: 'Ajuda', message: 'Sem conta', images: [PNG]}, 401);
  await ana('/api/support', {subject: 'Ajuda', message: 'Três imagens', images: [PNG, PNG, PNG]}, 400);
  assert.match((await ana('/api/support', {subject: 'Ajuda', message: 'Imagem grande', images: [png(1024 * 1024)]}, 400)).error, /1 MB/);
  await ana('/api/support', {subject: 'Ajuda', message: 'Não é imagem', images: ['data:image/png;base64,' + Buffer.from('texto').toString('base64')]}, 400);
  await ana('/api/support', {subject: 'Erro no caixa', message: 'Veja os prints', images: [PNG, png(900 * 1024)]});
  const tk = (await ana('/api/me')).tickets[0]; assert.equal(tk.images.length, 2); assert.match(tk.images[0], /^\/api\/tickets\/[\w-]+\/image\/0$/);
  const img = await ana(tk.images[0]); assert.match(img.type, /image\/png/);
  await bia(tk.images[0], undefined, 404); await anon(tk.images[0], undefined, 404); await ana(tk.images[0].replace(/0$/, '5'), undefined, 404);
  assert.match((await s.dono(tk.images[1])).type, /image\/png/);
  assert.equal((await s.dono('/api/admin/overview')).tickets[0].images.length, 2);
  assert.equal(fs.readdirSync(path.join(s.dir, 'media', 'tickets')).length, 2); assert.ok(!fs.existsSync(path.join(s.dir, 'public')), 'fora da pasta pública');
  // um por vez: só abre outro depois da resposta
  assert.match((await ana('/api/support', {subject: 'Outra coisa', message: 'Segundo chamado'}, 409)).error, /aguardando resposta/);
  await s.dono('/api/admin/tickets/' + tk.id, {reply: 'Resolvido.', status: 'closed'});
  await ana('/api/support', {subject: 'Outra coisa', message: 'Segundo chamado'});
  await bia('/api/support', {subject: 'Dúvida', message: 'Outra conta não é afetada'});
});

test('2.4: conversa encerrada pelo administrador não recebe mais mensagens; o cliente abre outra', async t => {
  const s = await boot(t), vis = s.client();
  await vis('/api/chat/start', {name: 'Visitante', email: 'v@x.com', message: 'Olá'});
  const id = (await s.dono('/api/admin/chats')).chats[0].id;
  await s.dono('/api/admin/chats/' + id, {status: 'closed'});
  assert.equal((await vis('/api/chat')).chat.status, 'closed');
  assert.match((await vis('/api/chat/send', {text: 'ainda aí?'}, 409)).error, /encerrada/);
  await vis('/api/chat/end', {}); assert.equal((await vis('/api/chat')).chat, null);
  const n = await vis('/api/chat/start', {name: 'Visitante', email: 'v@x.com', message: 'Nova dúvida'}); assert.equal(n.chat.status, 'open');
  await vis('/api/chat/send', {text: 'mais uma'});
});
