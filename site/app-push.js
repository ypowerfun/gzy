'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.25 (pedido do dono): os avisos da recepção (Ações › Enviar mensagem › "Enviar também no app") chegam no celular como
// notificação, mesmo com o app fechado (Web Push). Fluxo:
//  1. O cliente toca em "Ativar notificações" no app; o navegador cria a inscrição e o app manda para POST /api/app/push/:slug
//     com o token do cliente. O site confere o token com a arena (ação "me") e guarda: endereço do serviço de push + chaves
//     do navegador + id do cliente. Nada de nome, saldo ou texto de aviso fica gravado.
//  2. Quando a recepção envia um aviso para o app, o GameZoney Servidor chama POST /api/app/notify (certificado do plano Pro)
//     e o site manda a notificação cifrada para as inscrições daquela arena (todos ou só os clientes indicados).
const webpush = require('./web-push');

module.exports = function appPush(app, ctx) {
  const {db, api, fail, str, limit, plans, planActivation, log, ask, row, SLUG_RE, APP_URL} = ctx;
  const pushFetch = ctx.pushFetch || ((...a) => fetch(...a));
  const extraHosts = ctx.pushHosts || [];
  db.raw.exec(`CREATE TABLE IF NOT EXISTS app_push(endpoint TEXT PRIMARY KEY, slug TEXT NOT NULL, member_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS app_push_slug ON app_push(slug, member_id);`);
  // chaves VAPID do site: criadas uma vez e guardadas (a pública vai para os navegadores; a privada nunca sai do servidor)
  let keys = null;
  function vapid() {
    if (keys) return keys;
    try { keys = JSON.parse(db.get("SELECT value FROM settings WHERE key='vapid'")?.value || 'null'); } catch { keys = null; }
    if (!keys?.publicKey || !keys?.privateKey) {
      keys = webpush.generateKeys();
      db.run("INSERT INTO settings(key,value) VALUES('vapid',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", JSON.stringify(keys));
    }
    return keys;
  }
  vapid();
  const memberOfToken = auth => { const m = /^Bearer\s+v1\.([A-Za-z0-9_-]{1,80})\.\d+\.[A-Za-z0-9_-]+$/.exec(String(auth || '')); return m ? m[1] : ''; };

  app.get('/api/app/push-key', limit('pushkey', 240, 60000), api(() => ({key: vapid().publicKey})));

  // inscrição do celular (depois do "Ativar notificações")
  app.post('/api/app/push/:slug', limit('pushsub', 30, 15 * 60000), api(async req => {
    const r = row(req.params.slug); if (!r) fail(404, 'Arena não encontrada.');
    const s = req.body?.subscription || {}, endpoint = str(s.endpoint, 1000), p256dh = str(s.keys?.p256dh, 200), auth = str(s.keys?.auth, 100);
    if (!webpush.allowedEndpoint(endpoint, extraHosts) || !webpush.validKeys(p256dh, auth)) fail(400, 'Este navegador não aceita notificações do app.');
    const memberId = memberOfToken(req.headers.authorization); if (!memberId) fail(401, 'Entre de novo.');
    // o token é conferido pela arena (ela assinou); só assim o site sabe que o celular é mesmo desse cliente
    const [status, data] = await ask(r.slug, 'me', {}, req.headers.authorization || '', req.ip);
    if (status !== 200) fail(status, data?.error || 'Não foi possível falar com a arena agora.');
    const now = Date.now();
    db.run(`INSERT INTO app_push(endpoint,slug,member_id,p256dh,auth,created_at,updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET slug=excluded.slug, member_id=excluded.member_id, p256dh=excluded.p256dh, auth=excluded.auth, updated_at=excluded.updated_at`,
      endpoint, r.slug, memberId, p256dh, auth, now, now);
    // até 5 aparelhos por cliente e 5000 por arena (os mais antigos saem)
    db.run(`DELETE FROM app_push WHERE slug=? AND member_id=? AND endpoint NOT IN (SELECT endpoint FROM app_push WHERE slug=? AND member_id=? ORDER BY updated_at DESC LIMIT 5)`, r.slug, memberId, r.slug, memberId);
    db.run(`DELETE FROM app_push WHERE slug=? AND endpoint NOT IN (SELECT endpoint FROM app_push WHERE slug=? ORDER BY updated_at DESC LIMIT 5000)`, r.slug, r.slug);
    return {ok: true};
  }));
  // sair da conta / desativar: tira a inscrição (o endereço é secreto do navegador)
  app.post('/api/app/push/:slug/remove', limit('pushdel', 60, 15 * 60000), api(req => {
    const endpoint = str(req.body?.endpoint, 1000); if (endpoint) db.run('DELETE FROM app_push WHERE endpoint=? AND slug=?', endpoint, String(req.params.slug));
    return {ok: true};
  }));

  // aviso novo vindo do GameZoney Servidor da arena
  const perAccount = new Map();
  app.post('/api/app/notify', limit('appnotify', 120, 15 * 60000), api(req => {
    const b = req.body || {}, installId = str(b.installId, 80), slug = str(b.slug, 40);
    if (!/^[0-9a-f-]{20,80}$/i.test(installId) || !SLUG_RE.test(slug)) fail(400, 'Pedido inválido.');
    const cert = planActivation.verify(b.token);
    if (!cert || cert.v !== 2 || cert.kind !== 'plan' || cert.installId !== installId || !cert.uid) fail(401, 'Certificado do plano inválido.');
    if (plans.planOf(cert.uid)?.plan !== 'pro') fail(402, 'O app do cliente faz parte do plano Pro.');
    const bound = db.get('SELECT install_id FROM plan_installs WHERE user_id=?', cert.uid);
    if (!bound || bound.install_id !== installId) fail(409, 'Esta conta passou a ser usada em outro computador.');
    const a = db.get('SELECT plan_uid, name FROM app_arenas WHERE slug=?', slug);
    if (!a || a.plan_uid !== cert.uid) fail(409, 'Endereço do app não registrado.');
    const now = Date.now(); let n = perAccount.get(cert.uid); if (!n || n.until < now) { n = {count: 0, until: now + 15 * 60000}; perAccount.set(cert.uid, n); }
    if (++n.count > 60) fail(429, 'Muitos avisos seguidos. Aguarde alguns minutos.');
    if (perAccount.size > 5000) for (const [k, v] of perAccount) if (v.until < now) perAccount.delete(k);
    const text = str(b.notice?.text, 200).replace(/\*([^*\n]+)\*/g, '$1'), id = str(b.notice?.id, 80).replace(/[^A-Za-z0-9-]/g, '');
    if (!text) fail(400, 'Aviso vazio.');
    const to = b.to === 'all' ? 'all' : Array.isArray(b.to) ? b.to.slice(0, 500).map(x => String(x).slice(0, 80)) : [];
    const subs = to === 'all' ? db.all('SELECT * FROM app_push WHERE slug=?', slug)
      : to.length ? db.all(`SELECT * FROM app_push WHERE slug=? AND member_id IN (${to.map(() => '?').join(',')})`, slug, ...to) : [];
    const payload = JSON.stringify({title: str(a.name, 80) || 'Aviso da arena', body: text, tag: id || 'gz', url: APP_URL + '/' + slug});
    deliver(subs, payload, slug);
    return {queued: subs.length};
  }));
  // entrega em segundo plano, 10 por vez; inscrição vencida (404/410) sai da lista
  function deliver(subs, payload, slug) {
    if (!subs.length) return;
    const list = [...subs]; let ok = 0, gone = 0, failed = 0;
    const worker = async () => { for (let s = list.shift(); s; s = list.shift()) {
      try { const st = await webpush.send(s, payload, vapid(), {fetch: pushFetch});
        if (st === 404 || st === 410) { db.run('DELETE FROM app_push WHERE endpoint=?', s.endpoint); gone++; } else if (st >= 200 && st < 300) ok++; else failed++; }
      catch { failed++; } } };
    Promise.all(Array.from({length: Math.min(10, subs.length)}, worker)).then(() => log.log?.(`App ${slug}: notificação enviada a ${ok} aparelho(s)${gone ? `, ${gone} inscrição(ões) vencida(s) removida(s)` : ''}${failed ? `, ${failed} falha(s)` : ''}`));
  }
  return {vapid, count: slug => db.get('SELECT COUNT(*) n FROM app_push WHERE slug=?', slug).n};
};
