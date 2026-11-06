'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.7: Design do site (editor visual do administrador) e Parceiros do rodapé.
//  - O administrador abre qualquer página com ?design=1 e edita textos (pt/en/es), links, imagens, tamanho, posição
//    (separado para computador e celular) e esconde elementos. As páginas HTML não mudam: as alterações ficam no
//    banco (settings 'design') e o site.js aplica ao abrir a página. "Restaurar" volta ao original.
//  - Topo (header) e rodapé (footer) valem para todas as páginas ('*h' e '*f').
//  - Imagens enviadas ficam em DATA_DIR/media/design (png/jpg/webp, até 3 MB; SVG não, por segurança).
const express = require('express'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');

const MAX_IMAGE = 3 * 1024 * 1024;
const PAGE_RE = /^(\*h|\*f|\/[a-z0-9/._-]{0,60})$/i;
const PATH_RE = /^\d{1,3}(\.\d{1,3}){0,40}$/;
const HREF_RE = /^(https?:\/\/[^\s"'<>]{1,490}|\/[^\s"'<>]{0,490}|#[^\s"'<>]{0,100}|mailto:[^\s"'<>]{1,200})$/i;
const SRC_RE = /^\/(media\/design\/[a-f0-9]{24}\.(png|jpe?g|webp)|[a-z0-9/._-]{1,120}\.(png|jpe?g|webp|svg|ico))$/i;
const LANGS = ['pt', 'en', 'es'];

module.exports = function design(app, ctx) {
  const {db, needAdmin, jsonOnly, api, fail, str, dataDir} = ctx;
  const mediaDir = path.join(dataDir, 'media', 'design');
  fs.mkdirSync(mediaDir, {recursive: true});
  app.use('/media/design', express.static(mediaDir, {maxAge: '7d', fallthrough: false}));

  const read = key => { try { return JSON.parse(db.get('SELECT value FROM settings WHERE key=?', key)?.value || 'null'); } catch { return null; } };
  const write = (key, value) => db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, JSON.stringify(value));
  const designData = () => { const d = read('design'); return d && typeof d.pages === 'object' ? d : {pages: {}}; };
  const partners = () => Array.isArray(read('partners')) ? read('partners') : [];
  const pageKey = p => { let k = String(p || '/').split(/[?#]/)[0].replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '') || '/'; if (k.length > 1) k = k.replace(/\/+$/, ''); return k; };

  const int = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
  function box(v) {
    if (!v || typeof v !== 'object') return undefined;
    const o = {z: int(v.z || 100, 30, 400), dx: int(v.dx, -3000, 3000), dy: int(v.dy, -3000, 3000)};
    return o.z === 100 && !o.dx && !o.dy ? undefined : o;
  }
  // confere cada alteração: texto puro (nunca HTML), links seguros (sem javascript:), imagens só do próprio site
  function clean(item) {
    if (!item || typeof item !== 'object' || !PATH_RE.test(String(item.p || ''))) return null;
    const o = {p: String(item.p), s: str(item.s, 120)};
    if (item.t && typeof item.t === 'object') { const t = {}; for (const l of LANGS) if (typeof item.t[l] === 'string') t[l] = String(item.t[l]).slice(0, 3000); if (Object.keys(t).length) o.t = t; }
    if (item.h !== undefined && item.h !== '') { const h = str(item.h, 500); if (!HREF_RE.test(h)) fail(400, 'Link inválido: use https://…, /pagina ou #secao.'); o.h = h; }
    if (item.i !== undefined && item.i !== '') { const i = str(item.i, 200); if (!SRC_RE.test(i)) fail(400, 'Imagem inválida.'); o.i = i; }
    if (typeof item.a === 'string') o.a = str(item.a, 200);
    if (item.x) o.x = 1;
    const d = box(item.d), m = box(item.m); if (d) o.d = d; if (m) o.m = m;
    return Object.keys(o).length > 2 ? o : null;
  }
  // apaga imagens que nenhuma alteração/parceiro usa mais (as enviadas há menos de 1 h ficam, podem estar no editor)
  function sweep() {
    const used = JSON.stringify([designData(), partners()]), old = Date.now() - 3600000;
    for (const f of fs.readdirSync(mediaDir)) { try { if (!used.includes('/media/design/' + f) && fs.statSync(path.join(mediaDir, f)).mtimeMs < old) fs.rmSync(path.join(mediaDir, f), {force: true}); } catch { } }
  }

  // público: alterações da página + topo + rodapé, e os parceiros
  app.get('/api/design', api(req => {
    const pages = designData().pages, k = pageKey(req.query.page);
    return {key: k, page: pages[k] || [], header: pages['*h'] || [], footer: pages['*f'] || [], partners: partners().map(p => ({name: p.name, url: p.url, img: p.img}))};
  }));
  // administrador: tudo (para o editor e o /admin)
  app.get('/api/admin/design', api(req => { needAdmin(req); const pages = designData().pages; return {pages: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, v.length])), partners: partners()}; }));
  app.post('/api/admin/design', jsonOnly, api(req => {
    needAdmin(req); const d = designData(), saved = {};
    const input = req.body.pages && typeof req.body.pages === 'object' ? req.body.pages : {};
    for (const [rawKey, list] of Object.entries(input)) {
      const k = rawKey.startsWith('*') ? rawKey : pageKey(rawKey); if (!PAGE_RE.test(k) || !Array.isArray(list)) fail(400, 'Página inválida.');
      const items = list.slice(0, 400).map(clean).filter(Boolean);
      if (items.length) d.pages[k] = items; else delete d.pages[k];
      saved[k] = items.length;
    }
    if (Object.keys(d.pages).length > 60) fail(400, 'Muitas páginas alteradas.');
    write('design', d); db.audit(req.user.email, 'design', 'alterações salvas: ' + Object.entries(saved).map(([k, n]) => `${k} (${n})`).join(', ')); sweep();
    return {ok: true, saved};
  }));
  app.post('/api/admin/design/reset', jsonOnly, api(req => {
    needAdmin(req); const d = designData(), what = String(req.body.page || '');
    if (what === 'all') d.pages = {}; else { const k = what.startsWith('*') ? what : pageKey(what); delete d.pages[k]; }
    write('design', d); db.audit(req.user.email, 'design', 'restaurado o original: ' + (what === 'all' ? 'site inteiro' : what)); sweep();
    return {ok: true};
  }));
  app.post('/api/admin/design/image', (req, res, next) => req.admin ? next() : res.status(403).json({error: 'Acesso restrito ao administrador.'}), express.json({limit: '5mb'}), jsonOnly, api(req => {
    needAdmin(req);
    const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.data || '')); if (!m) fail(400, 'Envie uma imagem .png, .jpg ou .webp.');
    const buf = Buffer.from(m[2], 'base64'); if (buf.length > MAX_IMAGE) fail(400, 'Imagem muito grande (máximo 3 MB).');
    // confere a assinatura do arquivo (não basta o nome)
    const ok = (m[1] === 'png' && buf.subarray(0, 4).toString('hex') === '89504e47') || (/jpe?g/.test(m[1]) && buf.subarray(0, 2).toString('hex') === 'ffd8') || (m[1] === 'webp' && buf.subarray(8, 12).toString() === 'WEBP');
    if (!ok) fail(400, 'Arquivo de imagem inválido.');
    const f = crypto.randomBytes(12).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
    fs.writeFileSync(path.join(mediaDir, f), buf); return {url: '/media/design/' + f};
  }));
  // parceiros do rodapé (logo + nome + link opcional), na ordem da lista
  app.post('/api/admin/partners', jsonOnly, api(req => {
    needAdmin(req); if (!Array.isArray(req.body.partners)) fail(400, 'Lista inválida.');
    const list = req.body.partners.slice(0, 16).map(p => {
      const name = str(p && p.name, 80), url = str(p && p.url, 500), img = str(p && p.img, 200);
      if (!name || !SRC_RE.test(img)) fail(400, 'Cada parceiro precisa de nome e logo.');
      if (url && !/^https?:\/\/[^\s"'<>]+$/i.test(url)) fail(400, 'O link do parceiro precisa começar com https://');
      return {id: p.id && /^[a-f0-9]{8,32}$/.test(p.id) ? p.id : crypto.randomBytes(6).toString('hex'), name, url, img};
    });
    write('partners', list); db.audit(req.user.email, 'parceiros', list.length + ' parceiro(s)'); sweep();
    return {ok: true, partners: list};
  }));
  return {pageKey};
};
