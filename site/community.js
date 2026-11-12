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
  const imageFile = d => require('./image-util').decodeImage(d, MAX_IMAGE, fail);
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
  // 2.4: cada conta envia a avaliação 1 vez e pode editar 1 vez; depois fica fechada (excluir não libera de novo)
  const MAX_WRITES = 2, writesOf = id => db.get('SELECT review_writes n FROM users WHERE id=?', id)?.n || 0;
  app.get('/api/reviews/mine', api(req => {
    const u = needUser(req);
    return {review: publicReview(db.get('SELECT r.*, u.name, u.organization FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.user_id=?', u.id)) || null, canWrite: writesOf(u.id) < MAX_WRITES};
  }));
  // cada usuário tem 1 avaliação (enviar de novo atualiza a mesma)
  app.post('/api/reviews', (req, res, next) => req.user ? next() : res.status(401).json({error: 'Entre na sua conta.'}), express.json({limit: '6mb'}), jsonOnly, limit('review', 20, 3600000), api(req => {
    const u = needUser(req), stars = Number(req.body.stars), text = str(req.body.text, 1500);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail(400, 'Escolha de 1 a 5 estrelas.');
    if (text.length < 10) fail(400, 'Escreva sua avaliação (mínimo 10 caracteres).');
    const old = db.get('SELECT * FROM reviews WHERE user_id=?', u.id);
    if (writesOf(u.id) >= MAX_WRITES) fail(403, old ? 'Sua avaliação já foi editada e não pode mais ser alterada.' : 'Você já avaliou o GameZoney. Não é possível avaliar de novo.');
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
    db.run('UPDATE users SET review_writes=review_writes+1 WHERE id=?', u.id);
    db.audit(u.email, 'avaliacao', `${stars} estrela(s)${old ? ' (editada)' : ''}`);
    if (!old) for (const a of ADMINS) mail.send(a, `GameZoney: nova avaliação (${stars} estrelas)`, `${u.name} <${u.email}>\n\n${text}\n\nEscolha as avaliações da página inicial em ${SITE}/admin`);
    return {review: publicReview(db.get('SELECT r.*, u.name, u.organization FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.id=?', id)), canWrite: writesOf(u.id) < MAX_WRITES};
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

  // ---------- Chat ao vivo + assistente (2.14) ----------
  let adminSeenAt = 0;
  const adminOnline = () => Date.now() - adminSeenAt < 120000;
  const CHAT = 'gzc';
  const chatOf = req => { const t = String(req.headers.cookie || '').split(/;\s*/).map(c => c.split('=')).find(([k]) => k === CHAT)?.[1]; return t ? db.get('SELECT * FROM chats WHERE token_hash=?', sha(t)) : null; };
  const messages = (chatId, after = 0) => db.all('SELECT id, sender, text, at FROM chat_messages WHERE chat_id=? AND id>? ORDER BY id LIMIT 200', chatId, Number(after) || 0);
  const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
  const LANGS = ['pt', 'en', 'es'], langIn = l => (LANGS.includes(l) ? l : 'pt');

  // banco de respostas do assistente: bot/perguntas.js é a base; o que o administrador editar/apagar no /admin não é trocado
  const BASE = require('./bot/perguntas');
  {
    const now = Date.now(), J = v => JSON.stringify(v || []);
    for (const b of BASE) {
      const row = db.get('SELECT source FROM bot_answers WHERE id=?', b.id);
      if (!row) db.run('INSERT INTO bot_answers(id,question,alt,keywords,answer,human,source,updated_at) VALUES(?,?,?,?,?,?,?,?)', b.id, b.q, J(b.alt), J(b.kw), b.a, b.human ? 1 : 0, 'base', now);
      else if (row.source === 'base') db.run('UPDATE bot_answers SET question=?, alt=?, keywords=?, answer=?, human=? WHERE id=?', b.q, J(b.alt), J(b.kw), b.a, b.human ? 1 : 0, b.id);
    }
  }
  let answersCache = null;
  const answers = () => answersCache ||= db.all('SELECT * FROM bot_answers WHERE hidden=0 ORDER BY id')
    .map(r => ({id: r.id, q: r.question, alt: JSON.parse(r.alt || '[]'), kw: JSON.parse(r.keywords || '[]'), a: r.answer, human: !!r.human, v: r.updated_at + ':' + r.answer.length}));
  const bot = require('./bot')({plansInfo: () => (ctx.plansInfo ? ctx.plansInfo() : []), answers});

  const say = (c, text) => { db.run('INSERT INTO chat_messages(chat_id,sender,text,at) VALUES(?,?,?,?)', c.id, 'bot', String(text).slice(0, 4000), Date.now()); db.run('UPDATE chats SET unread_user=unread_user+1 WHERE id=?', c.id); };
  // pedido de especialista: online = o assistente para e o atendente assume; offline = devolutiva por e-mail (o assistente continua ajudando)
  function handoff(c) {
    const T = bot.texts(c.lang), online = adminOnline();
    db.run('UPDATE chats SET handoff=1, unread_admin=unread_admin+1' + (online ? ', bot=0' : '') + ' WHERE id=?', c.id);
    const now = Date.now();
    if (!online && now - (c.notified_at || 0) > 30 * 60000) {
      db.run('UPDATE chats SET notified_at=? WHERE id=?', now, c.id);
      const hist = db.all('SELECT sender, text FROM chat_messages WHERE chat_id=? ORDER BY id DESC LIMIT 12', c.id).reverse()
        .map(m => `${m.sender === 'user' ? c.name : m.sender === 'bot' ? 'Assistente' : 'GameZoney'}: ${m.text}`).join('\n\n');
      for (const a of ADMINS) mail.send(a, 'GameZoney: cliente pediu um especialista no chat', `${c.name} <${c.email}> ${c.phone}\n\n${hist}\n\nResponder: ${SITE}/admin#chat`);
    }
    return {online, T};
  }
  function botTurn(c, text, first) {
    if (!c.bot) return;
    const name = String(c.name || '').split(/\s+/)[0], r = bot.reply(text, {lang: c.lang, name, first});
    if (r.id && r.id !== 'saudacao' && r.id !== 'obrigado') db.run('UPDATE bot_answers SET uses=uses+1 WHERE id=?', r.id);
    if (r.unknown) {
      db.run('INSERT INTO bot_misses(chat_id,text,at) VALUES(?,?,?)', c.id, String(text).slice(0, 500), Date.now());
      const {online, T} = handoff(c);
      return say(c, (r.text ? r.text + '\n' : '') + (online ? T.unknownOnline : T.unknownOffline(c.email)));
    }
    if (r.handoff) { const {online, T} = handoff(c); return say(c, (r.text ? r.text + '\n\n' : (first ? bot.texts(c.lang).hello(name) + '\n' : '')) + (online ? T.online : T.offline(c.email))); }
    say(c, r.text);
  }
  // 2.14: cliente que não responde o assistente em 5 min (sem ter chamado especialista): a conversa é encerrada; só abrindo outra
  const IDLE = Number(ctx.chatIdleMs) || 5 * 60000;
  const IDLE_TEXT = {pt: 'Encerramos esta conversa porque não recebemos resposta em 5 minutos. Se precisar, é só abrir uma nova conversa.',
    en: 'We closed this conversation because we got no reply within 5 minutes. If you need anything, just start a new conversation.',
    es: 'Cerramos esta conversación porque no recibimos respuesta en 5 minutos. Si lo necesitas, abre una nueva conversación.'};
  function expire(c, now = Date.now()) {
    if (!c || c.status !== 'open' || !c.bot || c.handoff) return c;
    const last = db.get('SELECT sender, at FROM chat_messages WHERE chat_id=? ORDER BY id DESC LIMIT 1', c.id);
    if (!last || last.sender !== 'bot' || now - last.at < IDLE) return c;
    say(c, IDLE_TEXT[bot.langOf(c.lang)]);
    db.run("UPDATE chats SET status='closed', closed_by='timeout', last_at=? WHERE id=?", now, c.id);
    return db.get('SELECT * FROM chats WHERE id=?', c.id);
  }
  const idleSweep = setInterval(() => { try { for (const c of db.all("SELECT * FROM chats WHERE status='open' AND bot=1 AND handoff=0 AND last_at<?", Date.now() - IDLE)) expire(c); } catch { } }, Math.min(60000, IDLE));
  idleSweep.unref?.();
  const chatInfo = c => ({id: c.id, name: c.name, status: c.status, closedBy: c.closed_by || '', rated: c.rating > 0 || !!c.rated_at, rating: c.rating || 0, handoff: !!c.handoff, bot: !!c.bot});

  app.get('/api/chat', api(req => {
    const c = expire(chatOf(req)), base = {online: adminOnline(), user: req.user ? {name: req.user.name, email: req.user.email, phone: req.user.phone} : null};
    if (!c) return {...base, chat: null};
    if (c.unread_user) db.run('UPDATE chats SET unread_user=0 WHERE id=?', c.id);
    return {...base, chat: chatInfo(c), messages: messages(c.id, req.query.after)};
  }));
  app.post('/api/chat/start', jsonOnly, limit('chat-start', 10, 3600000), api((req, res) => {
    const name = str(req.body.name, 80), email = str(req.body.email, 200).toLowerCase(), phone = str(req.body.phone, 30), text = str(req.body.message, 2000);
    if (!name) fail(400, 'Informe seu nome.'); if (!EMAIL_RE.test(email)) fail(400, 'Informe um e-mail válido.');
    if (text.length < 2) fail(400, 'Escreva sua mensagem.');
    const token = crypto.randomBytes(24).toString('hex'), id = uid(), now = Date.now(), lang = langIn(req.body.lang);
    // o assistente responde na hora; o atendente só é chamado (e avisado por e-mail, se estiver fora) quando o cliente pede ou o assistente não resolve
    db.run('INSERT INTO chats(id,token_hash,user_id,name,email,phone,created_at,last_at,unread_admin,lang,bot) VALUES(?,?,?,?,?,?,?,?,0,?,1)', id, sha(token), req.user?.id || null, name, email, phone, now, now, lang);
    db.run('INSERT INTO chat_messages(chat_id,sender,text,at) VALUES(?,?,?,?)', id, 'user', text, now);
    res.append('Set-Cookie', `${CHAT}=${token}; Path=/; HttpOnly; SameSite=Lax${ctx.secureCookie ? '; Secure' : ''}; Max-Age=${90 * 86400}`);
    // a mensagem do formulário começa com o assunto escolhido ([Compra]/[Suporte]); o assistente lê só o texto
    botTurn(db.get('SELECT * FROM chats WHERE id=?', id), text.replace(/^\[(Compra|Suporte)\]\s*/i, ''), true);
    const c = db.get('SELECT * FROM chats WHERE id=?', id);
    return {chat: chatInfo(c), messages: messages(id), online: adminOnline()};
  }));
  app.post('/api/chat/send', jsonOnly, limit('chat-send', 60, 600000), api(req => {
    const c = expire(chatOf(req)) || fail(404, 'Conversa não encontrada. Inicie uma nova conversa.'), text = str(req.body.text, 2000);
    if (c.status === 'closed') fail(409, c.closed_by === 'timeout' ? 'Esta conversa foi encerrada por falta de resposta. Abra uma nova conversa.' : c.closed_by === 'user' ? 'Esta conversa foi encerrada. Abra uma nova conversa.' : 'Esta conversa foi encerrada pela equipe GameZoney. Inicie uma nova conversa.');
    if (!text) fail(400, 'Escreva sua mensagem.');
    const now = Date.now();
    if (req.body.lang && LANGS.includes(req.body.lang) && req.body.lang !== c.lang) { db.run('UPDATE chats SET lang=? WHERE id=?', req.body.lang, c.id); c.lang = req.body.lang; }
    db.run('INSERT INTO chat_messages(chat_id,sender,text,at) VALUES(?,?,?,?)', c.id, 'user', text, now);
    db.run('UPDATE chats SET last_at=?' + (!c.bot || c.handoff ? ', unread_admin=unread_admin+1' : '') + ' WHERE id=?', now, c.id);
    botTurn(c, text, false);
    return {chat: chatInfo(db.get('SELECT * FROM chats WHERE id=?', c.id)), messages: messages(c.id, req.body.after)};
  }));
  // encerrar e avaliar (1 a 5 estrelas + comentário opcional; stars 0 = encerrar sem avaliar). Uma avaliação por conversa.
  app.post('/api/chat/rate', jsonOnly, limit('chat-rate', 20, 3600000), api(req => {
    const c = chatOf(req) || fail(404, 'Conversa não encontrada.');
    if (c.rated_at) fail(409, 'Esta conversa já foi avaliada. Obrigado!');
    const stars = Math.round(Number(req.body.stars) || 0), comment = str(req.body.comment, 500);
    if (stars < 0 || stars > 5) fail(400, 'Escolha de 1 a 5 estrelas.');
    const now = Date.now();
    db.run("UPDATE chats SET status='closed', closed_by=CASE WHEN status='closed' THEN closed_by ELSE 'user' END, rating=?, rating_comment=?, rated_at=?, last_at=? WHERE id=?", stars, stars ? comment : '', now, now, c.id);
    return {chat: chatInfo(db.get('SELECT * FROM chats WHERE id=?', c.id))};
  }));
  app.post('/api/chat/end', jsonOnly, api((req, res) => { res.append('Set-Cookie', `${CHAT}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); return {ok: true}; }));
  // administrador
  app.get('/api/admin/chats', api(req => {
    needAdmin(req); adminSeenAt = Date.now();
    const list = db.all("SELECT c.*, (SELECT text FROM chat_messages m WHERE m.chat_id=c.id ORDER BY id DESC LIMIT 1) last_text FROM chats c ORDER BY (c.status='open') DESC, c.handoff DESC, c.last_at DESC LIMIT 200")
      .map(c => ({id: c.id, name: c.name, email: c.email, phone: c.phone, status: c.status, lastAt: c.last_at, unread: c.unread_admin, lastText: c.last_text || '', customer: !!c.user_id,
        bot: !!c.bot, handoff: !!c.handoff, closedBy: c.closed_by || '', rating: c.rating || 0, ratingComment: c.rating_comment || ''}));
    const open = req.query.id ? db.get('SELECT * FROM chats WHERE id=?', String(req.query.id)) : null;
    if (open && open.unread_admin) db.run('UPDATE chats SET unread_admin=0 WHERE id=?', open.id);
    const rated = db.get('SELECT COUNT(*) n, AVG(rating) avg FROM chats WHERE rating>0');
    return {chats: list, messages: open ? messages(open.id, req.query.after) : [], ratings: {count: rated.n, average: rated.avg ? Math.round(rated.avg * 10) / 10 : 0}};
  }));
  app.post('/api/admin/chats/:id', jsonOnly, api(req => {
    needAdmin(req); adminSeenAt = Date.now();
    const c = db.get('SELECT * FROM chats WHERE id=?', req.params.id) || fail(404, 'Conversa não encontrada.'), now = Date.now();
    const text = str(req.body.text, 2000);
    if (text) {
      db.run('INSERT INTO chat_messages(chat_id,sender,text,at) VALUES(?,?,?,?)', c.id, 'admin', text, now);
      // o atendente assumiu: o assistente para de responder nesta conversa
      db.run("UPDATE chats SET last_at=?, unread_user=unread_user+1, status='open', closed_by='', bot=0 WHERE id=?", now, c.id);
      // se a pessoa saiu do site, a resposta também vai por e-mail
      if (req.body.email) { const tpl = require('./email-template'), m = {site: SITE, preheader: 'Resposta da equipe GameZoney.', lines: [`Olá, ${c.name}!`, text], button: {label: 'Continuar a conversa', url: `${SITE}/atendimento.html`}};
        mail.send(c.email, 'GameZoney: resposta da sua conversa', tpl.renderText(m), {html: tpl.renderEmail(m)}); }
    }
    if (['open', 'closed'].includes(req.body.status)) db.run("UPDATE chats SET status=?, closed_by=CASE WHEN ?='closed' THEN 'admin' ELSE '' END WHERE id=?", req.body.status, req.body.status, c.id);
    if (typeof req.body.bot === 'boolean') db.run('UPDATE chats SET bot=?, handoff=CASE WHEN ? THEN 0 ELSE handoff END WHERE id=?', req.body.bot ? 1 : 0, req.body.bot ? 1 : 0, c.id);
    return {messages: messages(c.id, req.body.after)};
  }));

  // /admin › Assistente: banco de respostas, perguntas sem resposta e teste
  const adminAnswer = r => ({id: r.id, question: r.question, alt: JSON.parse(r.alt || '[]'), keywords: JSON.parse(r.keywords || '[]'), answer: r.answer, human: !!r.human, source: r.source, isBase: BASE.some(b => b.id === r.id), hidden: !!r.hidden, uses: r.uses, updatedAt: r.updated_at});
  app.get('/api/admin/bot', api(req => {
    needAdmin(req);
    return {answers: db.all('SELECT * FROM bot_answers WHERE hidden=0 ORDER BY uses DESC, question').map(adminAnswer),
      misses: db.all('SELECT * FROM bot_misses WHERE done=0 ORDER BY id DESC LIMIT 200').map(m => ({id: m.id, text: m.text, at: m.at, chatId: m.chat_id}))};
  }));
  const list = (v, max, each) => (Array.isArray(v) ? v : String(v || '').split(/\n|,/)).map(s => String(s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, each)).filter(Boolean).slice(0, max);
  app.post('/api/admin/bot/answer', jsonOnly, api(req => {
    needAdmin(req);
    const question = str(req.body.question, 200), answer = String(req.body.answer || '').replace(/\r/g, '').trim().slice(0, 3000);
    if (question.length < 3) fail(400, 'Escreva a pergunta.'); if (answer.length < 3) fail(400, 'Escreva a resposta.');
    const id = /^[a-z0-9-]{2,60}$/.test(req.body.id || '') && db.get('SELECT id FROM bot_answers WHERE id=?', req.body.id) ? req.body.id : 'adm-' + uid().slice(0, 12);
    const alt = JSON.stringify(list(req.body.alt, 30, 200)), kw = JSON.stringify(list(req.body.keywords, 30, 60)), now = Date.now();
    db.run('INSERT INTO bot_answers(id,question,alt,keywords,answer,human,source,hidden,updated_at) VALUES(?,?,?,?,?,?,?,0,?) ON CONFLICT(id) DO UPDATE SET question=excluded.question, alt=excluded.alt, keywords=excluded.keywords, answer=excluded.answer, human=excluded.human, source=excluded.source, hidden=0, updated_at=excluded.updated_at',
      id, question, alt, kw, answer, req.body.human ? 1 : 0, 'admin', now);
    if (req.body.missId) db.run('UPDATE bot_misses SET done=1 WHERE id=?', Number(req.body.missId) || 0);
    answersCache = null; db.audit(req.user.email, 'assistente', 'Resposta salva: ' + question);
    return {ok: true, id};
  }));
  app.post('/api/admin/bot/answer/:id/remove', jsonOnly, api(req => {
    needAdmin(req); const r = db.get('SELECT * FROM bot_answers WHERE id=?', req.params.id) || fail(404, 'Resposta não encontrada.');
    // da base: só esconde (não volta sozinha numa atualização do site); criada no /admin: apaga
    if (r.source === 'admin' && !BASE.some(b => b.id === r.id)) db.run('DELETE FROM bot_answers WHERE id=?', r.id);
    else db.run("UPDATE bot_answers SET hidden=1, source='admin', updated_at=? WHERE id=?", Date.now(), r.id);
    answersCache = null; db.audit(req.user.email, 'assistente', 'Resposta removida: ' + r.question);
    return {ok: true};
  }));
  app.post('/api/admin/bot/restore', jsonOnly, api(req => {
    needAdmin(req); const b = BASE.find(x => x.id === req.body.id) || fail(404, 'Essa resposta não é da base.'), J = v => JSON.stringify(v || []);
    db.run("UPDATE bot_answers SET question=?, alt=?, keywords=?, answer=?, human=?, source='base', hidden=0, updated_at=? WHERE id=?", b.q, J(b.alt), J(b.kw), b.a, b.human ? 1 : 0, Date.now(), b.id);
    answersCache = null; db.audit(req.user.email, 'assistente', 'Resposta restaurada: ' + b.q);
    return {ok: true};
  }));
  app.post('/api/admin/bot/miss/:id/done', jsonOnly, api(req => { needAdmin(req); db.run('UPDATE bot_misses SET done=1 WHERE id=?', Number(req.params.id) || 0); return {ok: true}; }));
  app.post('/api/admin/bot/test', jsonOnly, api(req => {
    needAdmin(req); const text = str(req.body.text, 500) || fail(400, 'Escreva uma pergunta.');
    const r = bot.reply(text, {lang: 'pt'});
    return {text: r.unknown ? '(sem resposta na base: o cliente seria encaminhado a um especialista)' : r.handoff && !r.text ? '(pedido de especialista)' : r.text, id: r.id || '', handoff: !!r.handoff, unknown: !!r.unknown};
  }));

  return {adminReviews, adminOnline, unreadChats: () => db.get('SELECT COUNT(*) n FROM chats WHERE unread_admin>0').n, bot, stop: () => clearInterval(idleSweep)};
};
