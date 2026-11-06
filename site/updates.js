'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.3 (etapa 3): atualização do GameZoney Servidor pelo botão "Verificar atualização" (Configuração).
//  - O administrador coloca o instalador na pasta de downloads (como hoje) e, em /admin › Atualizações, escolhe o arquivo
//    e clica em Publicar. O site calcula o SHA-256 do arquivo e ASSINA um manifesto (Ed25519, a mesma chave das licenças)
//    com versão, nome, tamanho e SHA-256. O Servidor só instala se a assinatura e o SHA-256 baterem: um arquivo trocado
//    na pasta, no caminho ou no computador da arena é recusado.
//  - /api/update/check: qualquer Servidor vê se há versão nova. O download automático é do PLANO ("Novas atualizações"):
//    só sai com certificado de plano válido, deste computador e com plano ativo; o link vale 30 min e é deste computador.
//    No teste grátis, o Servidor mostra a versão nova e indica baixar em gamezoney.com › Minha conta › Downloads.
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');

const NAME_RE = /^GameZoney-(?:Servidor-(\d+\.\d+\.\d+)-Setup|Instalador-Servidor-(\d+\.\d+\.\d+)-Cliente-\d+\.\d+\.\d+)\.exe$/;
const versionOf = f => { const m = NAME_RE.exec(f); return m ? (m[1] || m[2]) : null; };
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

module.exports = function updates(app, ctx) {
  const {db, needAdmin, jsonOnly, api, fail, str, limit, privateKey, downloadsDir, plans, planActivation, SITE, log} = ctx;
  const setting = k => { try { return JSON.parse(db.get('SELECT value FROM settings WHERE key=?', k)?.value || 'null'); } catch { return null; } };
  const save = (k, v) => db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, JSON.stringify(v));
  let secret = db.get("SELECT value FROM settings WHERE key='update_secret'")?.value;
  if (!secret) { secret = crypto.randomBytes(32).toString('hex'); db.run("INSERT INTO settings(key,value) VALUES('update_secret',?)", secret); }
  const mac = s => crypto.createHmac('sha256', secret).update(s).digest('hex').slice(0, 40);
  const sign = data => { if (!privateKey) fail(503, 'Assinatura indisponível no site (chave ausente).'); const body = Buffer.from(JSON.stringify(data)).toString('base64url'); return body + '.' + crypto.sign(null, Buffer.from(body, 'base64url'), privateKey).toString('base64url'); };
  const installers = () => { try { return fs.readdirSync(downloadsDir).filter(f => versionOf(f)).map(f => ({file: f, version: versionOf(f), size: fs.statSync(path.join(downloadsDir, f)).size})); } catch { return []; } };
  const sha256 = file => new Promise((ok, err) => { const h = crypto.createHash('sha256'); fs.createReadStream(file).on('data', c => h.update(c)).on('error', err).on('end', () => ok(h.digest('hex'))); });
  const published = () => setting('update_servidor');

  // ---------- administrador ----------
  app.get('/api/admin/updates', api(req => { needAdmin(req); const p = published(); return {files: installers(), published: p && {version: p.version, file: p.file, size: p.size, sha256: p.sha256, notes: p.notes, publishedAt: p.publishedAt}}; }));
  app.post('/api/admin/updates/publish', jsonOnly, api(async req => {
    needAdmin(req); const file = str(req.body.file, 120), notes = String(req.body.notes ?? '').replace(/\r/g, '').trim().slice(0, 1500);
    const f = installers().find(x => x.file === file) || fail(404, 'Arquivo não encontrado na pasta de downloads (nome GameZoney-Servidor-X.Y.Z-Setup.exe).');
    const full = path.join(downloadsDir, f.file), hash = await sha256(full), size = fs.statSync(full).size;
    const data = {v: 1, kind: 'update', product: 'servidor', version: f.version, file: f.file, size, sha256: hash, notes, publishedAt: Date.now()};
    save('update_servidor', {...data, manifest: sign(data)});
    db.audit(req.user.email, 'atualizacao', `publicada ${f.version} (${f.file}, ${hash.slice(0, 12)}…)`);
    return {ok: true, published: {version: data.version, file: data.file, size, sha256: hash, notes, publishedAt: data.publishedAt}};
  }));
  app.post('/api/admin/updates/unpublish', jsonOnly, api(req => { needAdmin(req); db.run("DELETE FROM settings WHERE key='update_servidor'"); db.audit(req.user.email, 'atualizacao', 'publicação retirada'); return {ok: true}; }));

  // ---------- GameZoney Servidor ----------
  const ID_RE = /^[0-9a-f-]{20,80}$/i;
  app.post('/api/update/check', limit('updatecheck', 120, 3600000), api(req => {
    const installId = str(req.body?.installId, 80), version = str(req.body?.version, 20);
    if (!ID_RE.test(installId) || !/^\d+\.\d+\.\d+$/.test(version)) fail(400, 'Pedido inválido.');
    const p = published();
    if (!p) return {available: false, latest: version};
    // o arquivo publicado tem que continuar o mesmo (se trocaram o arquivo na pasta, a publicação perde a validade)
    let st; try { st = fs.statSync(path.join(downloadsDir, p.file)); } catch { return {available: false, latest: version}; }
    if (st.size !== p.size) { log.error('Atualização: o arquivo publicado mudou de tamanho; publique de novo.'); return {available: false, latest: version}; }
    if (cmp(p.version, version) <= 0) return {available: false, latest: p.version};
    const out = {available: true, version: p.version, notes: p.notes, size: p.size, manifest: p.manifest};
    // download automático: só com plano ativo neste computador
    const cert = planActivation.verify(req.body?.token);
    const bound = cert && cert.v === 2 && cert.kind === 'plan' && cert.installId === installId && db.get('SELECT 1 FROM plan_installs WHERE user_id=? AND install_id=?', cert.uid, installId) && plans.planOf(cert.uid);
    if (!bound) return {...out, download: null, reason: 'plan', downloadsUrl: SITE + '/conta#downloads'};
    const exp = Date.now() + 30 * 60000, base = `${installId}.${exp}.${p.sha256}`;
    return {...out, download: `/api/update/file?i=${encodeURIComponent(installId)}&e=${exp}&s=${mac(base)}`};
  }));
  app.get('/api/update/file', limit('updatefile', 20, 3600000), (req, res) => {
    const p = published(), i = String(req.query.i || ''), e = Number(req.query.e), s = String(req.query.s || '');
    if (!p || !ID_RE.test(i) || !(e > Date.now()) || !/^[a-f0-9]{40}$/.test(s)) return res.status(403).json({error: 'Link de atualização inválido ou vencido.'});
    const want = mac(`${i}.${e}.${p.sha256}`);
    if (!crypto.timingSafeEqual(Buffer.from(want), Buffer.from(s))) return res.status(403).json({error: 'Link de atualização inválido ou vencido.'});
    db.run('INSERT INTO downloads(user_id,file,at) VALUES(?,?,?)', null, 'atualizacao:' + p.file, Date.now());
    res.set('Cache-Control', 'no-store'); res.download(path.join(downloadsDir, p.file), p.file);
  });
  return {versionOf, cmp};
};
