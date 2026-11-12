'use strict';
// 1.3.3 (Pro): Personalizar visual — logo da arena no painel e nos PCs + cor de destaque (só aparência)
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib');
const {createServer} = require('../server'), planHelper = require('./plan-helper'), branding = require('../branding');

// PNG de verdade (RGBA) para os testes
function png(w, h, rgb = [40, 140, 255]) {
  const crcT = Array.from({length: 256}, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = 255; }
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

test('1.3.3: recolorir troca só os tons dourados (aviso, alerta, fundo e textos ficam iguais)', () => {
  const css = ':root{--red:#d4a017;--red2:#ffce3a;--red-dark:#7a580a;--alert:#e81e28;--amber:#f2a93b;--text:#e9eaee;--bg:#08080a}.x{box-shadow:0 0 16px rgba(212,160,23,.45);color:#FDD034}';
  const out = branding.recolor(css, '#2f8cff');
  for (const keep of ['#e81e28', '#f2a93b', '#e9eaee', '#08080a']) assert.ok(out.includes(keep), keep);
  for (const gone of ['#d4a017', '#ffce3a', '#7a580a', 'rgba(212,160,23', '#FDD034']) assert.ok(!out.includes(gone), gone);
  const red = /--red:(#[0-9a-f]{6})/.exec(out)[1], [r, g, b] = [1, 3, 5].map(i => parseInt(red.slice(i, i + 2), 16)); assert.ok(b > r && b > g, 'virou azul: ' + red);
  assert.match(out, /rgba\(\d+,\d+,\d+,\.45\)/, 'mantém a transparência');
  const same = branding.recolor(css, '#d4a017').toLowerCase(), hexes = s => s.match(/#[0-9a-f]{6}/g);
  const near = (a, b) => [1, 3, 5].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 2);
  hexes(css.toLowerCase()).forEach((h, i) => assert.ok(near(h, hexes(same)[i]), 'cor padrão = mesmo visual: ' + h + ' → ' + hexes(same)[i]));
});

test('1.3.3: personalizar visual só no Pro; logo e cor no painel e nos PCs; voltar ao padrão', async t => {
  const {license, plan} = planHelper();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-brand-'));
  const app = createServer({directory, noTimer: true, license});
  await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + app.server.address().port; let cookie = '';
  t.after(async () => { await app.close(); fs.rmSync(directory, {recursive: true, force: true, maxRetries: 5}); });
  const call = async (url, body, status = 200) => { const r = await fetch(base + '/api' + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
    const c = r.headers.get('set-cookie'); if (c) cookie = c.split(';')[0]; const j = await r.json(); assert.equal(r.status, status, url + ' ' + JSON.stringify(j)); return j; };
  await call('/setup', {name: 'Dono', username: 'admin', password: 'senha123'}); await call('/login', {username: 'admin', password: 'senha123'});
  const original = fs.readFileSync(path.join(__dirname, '../public/logo-gamezoney.png'));
  const logo = png(64, 32), pcLogo = png(40, 40, [230, 40, 60]);
  // teste grátis e Standard: bloqueado
  assert.equal((await call('/branding')).allowed, false);
  assert.match((await call('/branding', {color: '#2f8cff', serverLogo: logo}, 400)).error, /plano Pro/);
  plan(app, 'standard'); assert.match((await call('/branding', {color: '#2f8cff', serverLogo: logo}, 400)).error, /plano Pro/);
  plan(app, 'pro'); assert.equal((await call('/branding')).allowed, true);
  // validações
  assert.match((await call('/branding', {color: 'azul', serverLogo: logo}, 400)).error, /cor/);
  assert.match((await call('/branding', {color: '#101010', serverLogo: logo}, 400)).error, /muito escura/);
  assert.match((await call('/branding', {color: '#2f8cff', serverLogo: 'data:image/jpeg;base64,/9j/4AAQ'}, 400)).error, /PNG/);
  assert.match((await call('/branding', {color: '#2f8cff', serverLogo: png(8, 8)}, 400)).error, /16 a 2048/);
  assert.match((await call('/branding', {color: '#2f8cff'}, 400)).error, /pelo menos uma logo/);
  assert.equal(app.brand.pcRev(), '', 'sem personalização os PCs ficam no padrão');
  // aplica: mesma logo nos PCs
  let st = await call('/branding', {color: '#2f8cff', serverLogo: logo, sameLogo: true}); assert.equal(st.active, true); assert.equal(st.serverLogo, true); assert.equal(st.clientLogo, true);
  let r = await fetch(base + '/logo-gamezoney.png'); assert.deepEqual(Buffer.from(await r.arrayBuffer()), Buffer.from(logo.split(',')[1], 'base64'), 'painel mostra a logo da arena');
  const css = await (await fetch(base + '/theme-gamezoney.css')).text(); assert.ok(!css.includes('#d4a017') && css.includes('--alert:#e81e28'), 'dourado recolorido, alerta igual');
  const rev = app.brand.pcRev(); assert.ok(rev); let d = app.brand.pcData(); assert.equal(d.color, '#2f8cff'); assert.equal(d.logo, logo.split(',')[1]);
  // logo própria para os PCs; manter a do servidor
  st = await call('/branding', {color: '#3cd27a', clientLogo: pcLogo}); d = app.brand.pcData(); assert.equal(d.logo, pcLogo.split(',')[1]); assert.notEqual(app.brand.pcRev(), rev);
  assert.ok(fs.existsSync(path.join(directory, 'branding', 'server.png')), 'logos na pasta de dados (entram no backup completo)');
  // 1.3.4: tela da TV no fim da sessão (cliente.html): logo dos PCs no lugar do GZ, cores trocadas, logo larga sem corte
  r = await fetch(base + '/logo.jpg'); assert.deepEqual(Buffer.from(await r.arrayBuffer()), Buffer.from(pcLogo.split(',')[1], 'base64'), 'TV mostra a logo da arena');
  const tv = await (await fetch(base + '/cliente.html')).text(); assert.ok(!tv.includes('#ffce3a'), 'título da TV na cor da arena'); assert.match(tv, /object-fit:contain/);
  // plano vencido/trocado: volta ao padrão sozinho (guardado)
  plan(app, 'standard'); assert.equal(app.brand.pcRev(), ''); r = await fetch(base + '/logo-gamezoney.png'); assert.deepEqual(Buffer.from(await r.arrayBuffer()), original);
  r = await fetch(base + '/logo.jpg'); assert.deepEqual(Buffer.from(await r.arrayBuffer()), fs.readFileSync(path.join(__dirname, '../public/logo.jpg')), 'sem Pro a TV volta ao GZ');
  assert.ok((await (await fetch(base + '/cliente.html')).text()).includes('#ffce3a'));
  assert.ok((await (await fetch(base + '/theme-gamezoney.css')).text()).includes('#d4a017'));
  assert.equal((await call('/branding')).enabled, true);
  // voltar ao padrão (vale sem o Pro)
  await call('/branding/reset', {}); assert.equal((await call('/branding')).enabled, false); assert.ok(!fs.existsSync(path.join(directory, 'branding', 'server.png')));
  plan(app, 'pro'); assert.equal(app.brand.pcRev(), ''); assert.deepEqual(app.brand.pcData(), {rev: '', color: '', logo: ''});
  // o PC recebe a revisão no /pc/state e baixa por /pc/branding
  const pcSrc = fs.readFileSync(path.join(__dirname, '../pc.js'), 'utf8'); assert.match(pcSrc, /branding:\{rev:brand\?brand\.pcRev\(\):''\}/); assert.match(pcSrc, /operation\('\/branding'/);
});
