'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.2: Avaliações (1 a 5 estrelas, texto e até 2 imagens .jpg/.png; o administrador escolhe as 3 da página inicial e a ordem)
// e Chat ao vivo (visitante ou cliente conversa com o administrador; mensagens por consulta a cada poucos segundos).
const express = require('express'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');

const MAX_IMAGE = 2 * 1024 * 1024; // 2 MB por imagem
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');

module.exports = function community(app, ctx) {
  const {db, needUser, needAdmin, jsonOnly, api, limit, fail, str, uid, mail, ADMINS, SITE, dataDir, log} = ctx;
  const mediaDir = path.join(dataDir, 'media', 'reviews');
  fs.mkdirSync(mediaDir, {recursive: true});

  // ---------- Avaliações ----------
  function imageFile(dataUrl) {
    const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) fail(400, 'Envie imagens .jpg ou .png.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_IMAGE) fail(400, 'Cada imagem pode ter no máximo 2 MB.');
    const png = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const jpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (!png && !jpg) fail(400, 'Envie imagens .jpg ou .png.');
    return {buf, ext: png ? 'png' : 'jpg'};
  }
  const publicReview = (r, withAdmin) => r && ({
    id: r.id, stars: r.stars, text: r.text, name: r.name || '', organization: r.organization || '',
    images: JSON.parse(r.images || '[]').map(f => '/media/reviews/' + f),
    ...(withAdmin ? {featured: r.featured, hidden: !!r.hidden, email: r.email, createdAt: r.created_at, updatedAt: r.updated_at} : {})
  });
  app.use('/media/reviews', express.static(mediaDir, {maxAge: '7d', fallthrough: false}));
  // página inicial: as 3 avaliações escolhidas pelo administrador, na ordem dele (sem data)
  app.get('/api/reviews/featured', api(() => ({
    reviews: db.all('SELECT r.*, u.name, u.organization FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.featured>0 AND r.hidden=0 ORDER BY r.featured LIMIT 3').map(r => publicReview(r))
  })));
  app.get('/api/reviews/mine', api(req => {
    const u = needUser(req);
    return {review: publicReview(db.get('SELECT r.*, u.name, u.organization FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.user_id=?', u.id)) || null};
  }));
  // cada usuário tem 1 avaliação (enviar de novo atualiza a mesma)
  app.post('/api/reviews', express.json({limit: '6mb'}), jsonOnly, limit('review', 20, 3600000), api(req => {
    const u = needUser(req), stars = Number(req.body.stars), text = str(req.body.text, 1500);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail(400, 'Escolha de 1 a 5 estrelas.');
    if (text.length < 10) fail(400, 'Escreva sua avaliação (mínimo 10 caracteres).');
    const old = db.get('SELECT * FROM reviews WHERE user_id=?', u.id);
    const keep = Array.isArray(req.body.keepImages) ? req.body.keepImages.map(String) : [];
    const oldFiles = old ? JSON.parse(old.images || '[]') : [];
    const kept = oldFiles.filter(f => keep.includes('/media/reviews/' + f));
    const added = Array.isArray(req.body.images) ? req.body.images : [];
    if (kept.length + added.length > 2) fail(400, 'No máximo 2 imagens.');
    const decoded = added.map(imageFile);
    const id = old ? old.id : uid(), files = [...kept];
    for (const d of decoded) { const f = `${id}-${crypto.randomBytes(6).toString('hex')}.${d.ext}`; fs.writeFileSync(path.join(mediaDir, f), d.buf); files.push(f); }
    for (const f of oldFiles) if (!files.includes(f)) fs.rmSync(path.join(mediaDir, f), {force: true});
    const now = Date.now();
    if (old) db.run('UPDATE reviews SET stars=?, text=?, images=?, updated_at=? WHERE id=?', stars, text, JSON.stringify(files), now, id);
    else db.run('INSERT INTO reviews(id,user_id,stars,text,images,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', id, u.id, stars, text, JSON.stringify(files), now, now);
    db.audit(u.email, 'avaliacao', `${stars} estrela(s)`);
    if (!old) for (const a of ADMINS) mail.send(a, `GameZoney: nova avaliação (${stars} estrelas)`, `${u.name} <${u.email}>\n\n${text}\n\nEscolha as avaliações da página inicial em ${SITE}/admin`);
    return {review: publicReview(db.get('SELECT r.*, u.name, u.organization FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.id=?', id))};
  }));
  app.post('/api/reviews/remove', jsonOnly, api(req => {
    const u = needUser(req), r = db.get('SELECT * FROM reviews WHERE user_id=?', u.id); if (!r) return {ok: true};
    for (const f of JSON.parse(r.images || '[]')) fs.rmSync(path.join(mediaDir, f), {force: true});
    db.run('DELETE FROM reviews WHERE id=?', r.id); return {ok: true};
  }));
  // administrador: posição na página inicial (1, 2, 3 ou 0 = fora), ocultar/mostrar e excluir
  app.post('/api/admin/reviews/:id', jsonOnly, api(req => {
    needAdmin(req); const r = db.get('SELECT * FROM reviews WHERE id=?', req.params.id) || fail(404, 'Avaliação não encontrada.');
    if (req.body.remove) { for (const f of JSON.parse(r.images || '[]')) fs.rmSync(path.join(mediaDir, f), {force: true}); db.run('DELETE FROM reviews WHERE id=?', r.id); db.audit(req.user.email, 'avaliacao', 'excluída ' + r.id); return {ok: true}; }
    if (req.body.featured !== undefined) {
      const pos = Number(req.body.featured); if (![0, 1, 2, 3].includes(pos)) fail(400, 'Posição inválida.');
      db.tx(() => { if (pos) db.run('UPDATE reviews SET featured=0 WHERE featured=? AND id<>?', pos, r.id); db.run('UPDATE reviews SET featured=? WHERE id=?', pos, r.id); });
    }
    if (req.body.hidden !== undefined) db.run('UPDATE reviews SET hidden=? WHERE id=?', req.body.hidden ? 1 : 0, r.id);
    return {ok: true};
  }));
  const adminReviews = () => db.all('SELECT r.*, u.name, u.organization, u.email FROM reviews r JOIN users u ON u.id=r.user_id ORDER BY (r.featured=0), r.featured, r.created_at DESC LIMIT 500').map(r => publicReview(r, true));

  // ---------- Chat ao vivo ----------
  let adminSeenAt = 0;
  const adminOnline = () => Date.now() - adminSeenAt < 120000;
  const CHAT = 'gzc';
  const chatOf = req => { const t = String(req.headers.cookie || '').split(/;\s*/).map(c => c.split('=')).find(([k]) => k === CHAT)?.[1]; return t ? db.get('SELECT * FROM chats WHERE token_hash=?', sha(t)) : null; };
  const messages = (chatId, after = 0) => db.all('SELECT id, sender, text, at FROM chat_messages WHERE chat_id=? AND id>? ORDER BY id LIMIT 200', chatId, Number(after) || 0);
  const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
  app.get('/api/chat', api(req => {
    const c = chatOf(req), base = {online: adminOnline(), user: req.user ? {name: req.user.name, email: req.user.email, phone: req.user.phone} : null};
    if (!c) return {...base, chat: null};
    if (c.unread_user) db.run('UPDATE chats SET unread_user=0 WHERE id=?', c.id);
    return {...base, chat: {id: c.id, name: c.name, status: c.status}, messages: messages(c.id, req.query.after)};
  }));
  app.post('/api/chat/start', jsonOnly, limit('chat-start', 10, 3600000), api((req, res) => {
    const name = str(req.body.name, 80), email = str(req.body.email, 200).toLowerCase(), phone = str(req.body.phone, 30), text = str(req.body.message, 2000);
    if (!name) fail(400, 'Informe seu nome.'); if (!EMAIL_RE.test(email)) fail(400, 'Informe um e-mail válido.');
    if (text.length < 2) fail(400, 'Escreva sua mensagem.');
    const token = crypto.randomBytes(24).toString('hex'), id = uid(), now = Date.now();
    db.run('INSERT INTO chats(id,token_hash,user_id,name,email,phone,created_at,last_at,unread_admin) VALUES(?,?,?,?,?,?,?,?,1)', id, sha(token), req.user?.id || null, name, email, phone, now, now);
    db.run('INSERT INTO chat_messages(chat_id,sender,text,at) VALUES(?,?,?,?)', id, 'user', text, now);
    res.append('Set-Cookie', `${CHAT}=${token}; Path=/; HttpOnly; SameSite=Lax${ctx.secureCookie ? '; Secure' : ''}; Max-Age=${90 * 86400}`);
    if (!adminOnline()) for (const a of ADMINS) mail.send(a, 'GameZoney: nova conversa no chat', `${name} <${email}> ${phone}\n\n${text}\n\nResponder: ${SITE}/admin#chat`);
    return {chat: {id, name, status: 'open'}, messages: messages(id), online: adminOnline()};
  }));
  app.post('/api/chat/send', jsonOnly, limit('chat-send', 60, 600000), api(req => {
    const c = chatOf(req) || fail(404, 'Conversa não encontrada. Inicie uma nova conversa.'), text = str(req.body.text, 2000);
    if (!text) fail(400, 'Escreva sua mensagem.');
    const now = Date.now();
    db.run('INSERT INTO chat_messages(chat_id,sender,text,at) VALUES(?,?,?,?)', c.id, 'user', text, now);
    db.run("UPDATE chats SET last_at=?, unread_admin=unread_admin+1, status='open' WHERE id=?", now, c.id);
    return {messages: messages(c.id, req.body.after)};
  }));
  app.post('/api/chat/end', jsonOnly, api((req, res) => { res.append('Set-Cookie', `${CHAT}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); return {ok: true}; }));
  // administrador
  app.get('/api/admin/chats', api(req => {
    needAdmin(req); adminSeenAt = Date.now();
    const list = db.all("SELECT c.*, (SELECT text FROM chat_messages m WHERE m.chat_id=c.id ORDER BY id DESC LIMIT 1) last_text FROM chats c ORDER BY (c.status='open') DESC, c.last_at DESC LIMIT 200")
      .map(c => ({id: c.id, name: c.name, email: c.email, phone: c.phone, status: c.status, lastAt: c.last_at, unread: c.unread_admin, lastText: c.last_text || '', customer: !!c.user_id}));
    const open = req.query.id ? db.get('SELECT * FROM chats WHERE id=?', String(req.query.id)) : null;
    if (open && open.unread_admin) db.run('UPDATE chats SET unread_admin=0 WHERE id=?', open.id);
    return {chats: list, messages: open ? messages(open.id, req.query.after) : []};
  }));
  app.post('/api/admin/chats/:id', jsonOnly, api(req => {
    needAdmin(req); adminSeenAt = Date.now();
    const c = db.get('SELECT * FROM chats WHERE id=?', req.params.id) || fail(404, 'Conversa não encontrada.'), now = Date.now();
    const text = str(req.body.text, 2000);
    if (text) {
      db.run('INSERT INTO chat_messages(chat_id,sender,text,at) VALUES(?,?,?,?)', c.id, 'admin', text, now);
      db.run("UPDATE chats SET last_at=?, unread_user=unread_user+1, status='open' WHERE id=?", now, c.id);
      // se a pessoa saiu do site, a resposta também vai por e-mail
      if (req.body.email) mail.send(c.email, 'GameZoney: resposta da sua conversa', `Olá, ${c.name}!\n\n${text}\n\nContinue a conversa em ${SITE} (botão Fale conosco).`);
    }
    if (['open', 'closed'].includes(req.body.status)) db.run('UPDATE chats SET status=? WHERE id=?', req.body.status, c.id);
    return {messages: messages(c.id, req.body.after)};
  }));

  return {adminReviews, adminOnline, unreadChats: () => db.get('SELECT COUNT(*) n FROM chats WHERE unread_admin>0').n};
};
