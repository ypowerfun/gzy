'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.8: Comunicados e promoções por e-mail para as contas cadastradas.
//  - O administrador escreve (assunto, título, mensagem, botão e banner opcionais), vê a prévia, manda um teste para si
//    e envia. O envio vai para uma fila no banco e sai um e-mail por pessoa, com intervalo e limite por dia (o Titan
//    bloqueia quem manda muitos de uma vez). Se o site reiniciar, a fila continua de onde parou.
//  - Todo comunicado tem "Cancelar inscrição" (link assinado + cabeçalho List-Unsubscribe, exigido por Gmail/Outlook);
//    quem cancelou não recebe mais. O cliente também liga/desliga em Minha conta › Meus dados.
//  - E-mails da conta (confirmação, senha, licença, suporte) continuam indo para todos: não são propaganda.
const crypto = require('node:crypto');
const tpl = require('./email-template');

module.exports = function campaigns(app, ctx) {
  const {db, needAdmin, jsonOnly, api, fail, str, uid, mail, SITE, env, log, intervalMs} = ctx;
  const DAILY = Math.max(1, Number(env.MAIL_DAILY_LIMIT) || 300), DAY = 86400000;
  // segredo dos links de "cancelar inscrição" (criado uma vez e guardado no banco)
  let secret = db.get("SELECT value FROM settings WHERE key='unsub_secret'")?.value;
  if (!secret) { secret = crypto.randomBytes(32).toString('hex'); db.run("INSERT INTO settings(key,value) VALUES('unsub_secret',?)", secret); }
  const sign = id => crypto.createHmac('sha256', secret).update('unsub:' + id).digest('hex').slice(0, 32);
  const unsubUrl = id => `${SITE}/api/unsubscribe?u=${encodeURIComponent(id)}&t=${sign(id)}`;
  const validSig = (id, t) => { const a = Buffer.from(sign(String(id || ''))), b = Buffer.from(String(t || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };

  function message(input) {
    const subject = str(input.subject, 150), title = str(input.title, 150), body = String(input.body ?? '').replace(/\r/g, '').trim().slice(0, 8000);
    const buttonLabel = str(input.buttonLabel, 60), buttonUrl = str(input.buttonUrl, 500), image = str(input.image, 200);
    if (!subject) fail(400, 'Escreva o assunto do e-mail.'); if (!body) fail(400, 'Escreva a mensagem.');
    if (buttonUrl && !/^https:\/\/[^\s"'<>]+$/i.test(buttonUrl)) fail(400, 'O link do botão precisa começar com https://');
    if (buttonUrl && !buttonLabel) fail(400, 'Escreva o texto do botão.');
    if (image && !/^\/media\/design\/[a-f0-9]{24}\.(png|jpe?g|webp)$/.test(image)) fail(400, 'Imagem inválida.');
    return {subject, title, body, buttonLabel, buttonUrl, image};
  }
  // monta o e-mail de uma pessoa ({nome} vira o primeiro nome)
  function build(m, user) {
    const first = String(user.name || '').trim().split(/\s+/)[0] || 'cliente';
    const fill = s => String(s || '').replace(/\{nome\}/gi, first);
    const o = {site: SITE, subject: fill(m.subject), preheader: fill(m.title || m.subject), title: fill(m.title), lines: fill(m.body).split(/\n{2,}/).map(s => s.trim()).filter(Boolean),
      button: m.buttonUrl ? {label: fill(m.buttonLabel), url: m.buttonUrl} : null, image: m.image ? SITE + m.image : '', marketing: true, unsubscribe: user.id ? unsubUrl(user.id) : ''};
    // título e botão ficam no destaque; a mensagem vem antes
    return {subject: o.subject, text: tpl.renderText(o), html: tpl.renderEmail(o), headers: user.id ? {'List-Unsubscribe': `<${o.unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'} : undefined};
  }
  const audienceSql = a => `SELECT id, email, name FROM users WHERE marketing_opt_out=0${a === 'verified' ? ' AND email_verified=1' : ''} ORDER BY created_at`;
  const count = sql => db.get(sql.replace(/^SELECT id, email, name/, 'SELECT COUNT(*) n').replace(/ ORDER BY.*$/, '')).n;
  const sentToday = () => db.get("SELECT COUNT(*) n FROM campaign_recipients WHERE status IN ('sent','failed') AND at>?", Date.now() - DAY).n;
  const publicCampaign = c => ({id: c.id, subject: c.subject, audience: c.audience, status: c.status, total: c.total, sent: c.sent, failed: c.failed, createdAt: c.created_at, finishedAt: c.finished_at,
    pending: db.get("SELECT COUNT(*) n FROM campaign_recipients WHERE campaign_id=? AND status='pending'", c.id).n});

  app.get('/api/admin/campaigns', api(req => {
    needAdmin(req);
    return {audience: {all: count(audienceSql('all')), verified: count(audienceSql('verified')), optedOut: db.get('SELECT COUNT(*) n FROM users WHERE marketing_opt_out=1').n},
      dailyLimit: DAILY, sentToday: sentToday(), campaigns: db.all('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 50').map(publicCampaign)};
  }));
  app.post('/api/admin/campaigns/preview', jsonOnly, api(req => { needAdmin(req); return {html: build(message(req.body), {name: req.user.name, id: req.user.id}).html}; }));
  app.post('/api/admin/campaigns/test', jsonOnly, api(async req => {
    needAdmin(req); const e = build(message(req.body), req.user);
    const ok = await Promise.resolve(mail.send(req.user.email, '[TESTE] ' + e.subject, e.text, {html: e.html, headers: e.headers})).catch(() => false);
    if (ok === false) fail(502, 'O e-mail de teste não foi enviado. Confira o SMTP no servidor do site.');
    return {ok: true, to: req.user.email};
  }));
  app.post('/api/admin/campaigns', jsonOnly, api(req => {
    needAdmin(req); const m = message(req.body), audience = req.body.audience === 'verified' ? 'verified' : 'all';
    if (db.get("SELECT id FROM campaigns WHERE status='sending' AND subject=? AND created_at>?", m.subject, Date.now() - 600000)) fail(409, 'Este comunicado já está sendo enviado.');
    const people = db.all(audienceSql(audience)); if (!people.length) fail(400, 'Nenhuma conta para receber.');
    const id = uid(), now = Date.now();
    db.run('INSERT INTO campaigns(id,subject,title,body,button_label,button_url,image,audience,status,total,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, m.subject, m.title, m.body, m.buttonLabel, m.buttonUrl, m.image, audience, 'sending', people.length, now, req.user.email);
    for (const p of people) db.run('INSERT INTO campaign_recipients(campaign_id,user_id,email) VALUES(?,?,?)', id, p.id, p.email);
    db.audit(req.user.email, 'comunicado', `"${m.subject}" para ${people.length} conta(s)`);
    return {ok: true, campaign: publicCampaign(db.get('SELECT * FROM campaigns WHERE id=?', id))};
  }));
  app.post('/api/admin/campaigns/:id/cancel', jsonOnly, api(req => {
    needAdmin(req); const c = db.get('SELECT * FROM campaigns WHERE id=?', req.params.id) || fail(404, 'Comunicado não encontrado.');
    if (c.status === 'sending') { db.run("UPDATE campaign_recipients SET status='canceled' WHERE campaign_id=? AND status='pending'", c.id); db.run("UPDATE campaigns SET status='canceled', finished_at=? WHERE id=?", Date.now(), c.id); db.audit(req.user.email, 'comunicado', `"${c.subject}" cancelado`); }
    return {ok: true};
  }));

  // cancelar inscrição: link do e-mail (GET) e "um clique" do Gmail/Outlook (POST)
  function unsubscribe(req) { const id = String(req.query.u || ''); if (!validSig(id, req.query.t)) return false; db.run('UPDATE users SET marketing_opt_out=1 WHERE id=?', id); return true; }
  app.get('/api/unsubscribe', (req, res) => {
    const ok = unsubscribe(req);
    res.status(ok ? 200 : 400).type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>GameZoney</title></head><body style="margin:0;background:#0b0e13;color:#e7ebf2;font-family:Arial,sans-serif;text-align:center;padding:60px 20px"><img src="/logo-gamezoney.png" alt="GameZoney" style="width:200px;max-width:70%"><h1 style="font-size:22px;margin:30px 0 10px">${ok ? 'Inscrição cancelada' : 'Link inválido'}</h1><p style="color:#aab3c2;max-width:440px;margin:0 auto 24px;line-height:1.6">${ok ? 'Você não vai mais receber comunicados e promoções da GameZoney. E-mails da sua conta (licença, senha, suporte) continuam chegando. Para voltar a receber, marque a opção em Minha conta › Meus dados.' : 'Este link de cancelamento não é válido. Você pode desligar os comunicados em Minha conta › Meus dados.'}</p><a href="/" style="color:#FDD034">Voltar para gamezoney.com</a></body></html>`);
  });
  app.post('/api/unsubscribe', (req, res) => res.status(unsubscribe(req) ? 200 : 400).json({ok: true}));

  // fila: um e-mail por vez, respeitando o limite de 24 h
  let running = false;
  async function tick() {
    if (running) return false; running = true;
    try {
      if (sentToday() >= DAILY) return false;
      const r = db.get("SELECT r.*, c.status cstatus FROM campaign_recipients r JOIN campaigns c ON c.id=r.campaign_id WHERE r.status='pending' AND c.status='sending' ORDER BY c.created_at, r.rowid LIMIT 1");
      if (!r) return false;
      const c = db.get('SELECT * FROM campaigns WHERE id=?', r.campaign_id), u = db.get('SELECT id, name, email, marketing_opt_out FROM users WHERE id=?', r.user_id);
      let status = 'skipped';
      if (u && !u.marketing_opt_out) {
        const e = build({subject: c.subject, title: c.title, body: c.body, buttonLabel: c.button_label, buttonUrl: c.button_url, image: c.image}, u);
        const ok = await Promise.resolve(mail.send(u.email, e.subject, e.text, {html: e.html, headers: e.headers})).catch(() => false);
        status = ok === false ? 'failed' : 'sent';
      }
      db.run('UPDATE campaign_recipients SET status=?, at=? WHERE campaign_id=? AND user_id=?', status, Date.now(), r.campaign_id, r.user_id);
      if (status === 'sent') db.run('UPDATE campaigns SET sent=sent+1 WHERE id=?', c.id); else if (status === 'failed') db.run('UPDATE campaigns SET failed=failed+1 WHERE id=?', c.id);
      if (!db.get("SELECT 1 FROM campaign_recipients WHERE campaign_id=? AND status='pending' LIMIT 1", c.id)) db.run("UPDATE campaigns SET status='done', finished_at=? WHERE id=? AND status='sending'", Date.now(), c.id);
      return true;
    } catch (e) { log.error('Comunicados:', e.message); return false; } finally { running = false; }
  }
  const timer = intervalMs === 0 ? null : setInterval(tick, intervalMs || 4000); if (timer && timer.unref) timer.unref();
  return {tick, stop: () => timer && clearInterval(timer), unsubUrl};
};
