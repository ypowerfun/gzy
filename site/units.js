'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.9 (plano Pro): Multi-Unidade. Cada GameZoney Servidor com plano Pro (e a opção ligada) envia a cada 5 min um resumo da
// loja (faturamento, caixa, PCs em uso, produtos mais vendidos — sem dados de clientes) para /api/units/report.
//  - Quem envia prova que é um servidor Pro: certificado do plano assinado por nós (license-private.pem), deste installId,
//    ainda na validade, e este installId é o computador atual da conta (plan_installs).
//  - Sem código de vínculo, a unidade aparece na conta dona do plano. Com o código GZU-XXXX-XXXX (gerado pelo gestor em
//    Minha conta › Unidades; precisa de plano Pro), aparece na conta do gestor — assim um dono vê várias filiais juntas.
//  - O gestor pode remover uma unidade (deixa de aparecer; envios dela com o mesmo vínculo são ignorados) e trocar o código.
const crypto = require('node:crypto');

module.exports = function units(app, ctx) {
  const {db, needUser, needAdmin, jsonOnly, api, fail, str, limit, plans, planActivation, log} = ctx;
  db.raw.exec(`CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, plan_uid TEXT NOT NULL, install_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '{}', version TEXT NOT NULL DEFAULT '', first_at INTEGER NOT NULL, last_at INTEGER NOT NULL, removed_at INTEGER NOT NULL DEFAULT 0, ip TEXT NOT NULL DEFAULT '');
    CREATE UNIQUE INDEX IF NOT EXISTS units_owner_install ON units(owner_uid, install_id);
    CREATE TABLE IF NOT EXISTS unit_codes(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);`);
  // 2.14: até 5 unidades por conta (gestor); mais só pelo suporte — o /admin aumenta o limite da conta (unit_limits)
  db.raw.exec('CREATE TABLE IF NOT EXISTS unit_limits(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, max_units INTEGER NOT NULL, updated_at INTEGER NOT NULL)');
  const DEFAULT_MAX = 5;
  const maxOf = uid => db.get('SELECT max_units FROM unit_limits WHERE user_id=?', uid)?.max_units || DEFAULT_MAX;
  const usedOf = uid => db.get('SELECT COUNT(*) n FROM units WHERE owner_uid=? AND removed_at=0', uid).n;
  const LIMIT_MSG = m => `Limite de ${m} unidades desta conta atingido. Para registrar mais unidades, abra um chamado em gamezoney.com › Minha conta › Suporte ou escreva para suporte@gamezoney.com.`;
  const ID_RE = /^[0-9a-f-]{20,80}$/i, CODE_RE = /^GZU-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => 'GZU-' + [0, 1].map(() => Array.from(crypto.randomBytes(4), b => ALPHA[b % ALPHA.length]).join('')).join('-');
  const isPro = uid => plans.planOf(uid)?.plan === 'pro';
  const n = (v, max = 1e12) => { const x = Number(v); return Number.isFinite(x) ? Math.max(0, Math.min(max, Math.round(x))) : 0; };
  // guarda só os campos conhecidos (o resumo vem de fora: nada de texto livre além de nomes curtos)
  function clean(s = {}) {
    const d = s.day || {}, m = s.month || {}, c = s.cash || {}, st = s.stations || {};
    return {at: n(s.at), today: str(s.today, 10), timeZone: str(s.timeZone, 40),
      day: {totalCents: n(d.totalCents), rechargeCents: n(d.rechargeCents), shopCents: n(d.shopCents), recharges: n(d.recharges, 1e6), shopSales: n(d.shopSales, 1e6), sessions: n(d.sessions, 1e6)},
      month: {totalCents: n(m.totalCents), rechargeCents: n(m.rechargeCents), shopCents: n(m.shopCents)},
      cash: c.open ? {open: true, number: n(c.number, 1e7), openedAt: n(c.openedAt), openedBy: str(c.openedBy, 40), totalCents: n(c.totalCents)} : {open: false},
      stations: {total: n(st.total, 1e4), inUse: n(st.inUse, 1e4), computers: n(st.computers, 1e4), consoles: n(st.consoles, 1e4), online: st.online == null ? null : n(st.online, 1e4)},
      members: n(s.members, 1e7), lowStock: n(s.lowStock, 1e5), nfePending: n(s.nfePending, 1e5), version: str(s.version, 20),
      topProducts: (Array.isArray(s.topProducts) ? s.topProducts : []).slice(0, 5).map(p => ({name: str(p?.name, 80), qty: n(p?.qty, 1e7), cents: n(p?.cents)}))};
  }

  app.post('/api/units/report', limit('unitreport', 120, 3600000), jsonOnly, api(req => {
    const b = req.body || {}, installId = str(b.installId, 80);
    if (!ID_RE.test(installId)) fail(400, 'Instalação inválida.');
    const cert = planActivation.verify(b.token);
    if (!cert || cert.v !== 2 || cert.kind !== 'plan' || cert.installId !== installId || !cert.uid) fail(401, 'Certificado do plano inválido. Entre de novo com a conta em Configuração › Licença.');
    const plan = plans.planOf(cert.uid);
    if (!plan || plan.plan !== 'pro') fail(402, 'A Multi-Unidade faz parte do plano Pro.');
    const bound = db.get('SELECT install_id FROM plan_installs WHERE user_id=?', cert.uid);
    if (!bound || bound.install_id !== installId) fail(409, 'Esta conta passou a ser usada em outro computador. Entre de novo com a conta em Configuração › Licença.');
    let owner = cert.uid;
    const code = str(b.linkCode, 20).toUpperCase();
    if (code) {
      if (!CODE_RE.test(code)) fail(400, 'Código de vínculo inválido.');
      const row = db.get('SELECT user_id FROM unit_codes WHERE code=?', code);
      if (!row) fail(404, 'Código de vínculo não encontrado. Confira em gamezoney.com › Minha conta › Unidades da conta do gestor.');
      owner = row.user_id;
    }
    const summary = JSON.stringify(clean(b.summary)), name = str(b.name, 60) || 'Unidade', now = Date.now();
    const old = db.get('SELECT * FROM units WHERE owner_uid=? AND install_id=?', owner, installId);
    if (old?.removed_at) fail(410, 'Esta unidade foi removida pelo gestor. Peça um novo código de vínculo.');
    if (!old) { const max = maxOf(owner); if (usedOf(owner) >= max) fail(403, LIMIT_MSG(max)); }
    // a mesma loja numa só conta: se mudou de vínculo, sai da conta antiga
    db.run('DELETE FROM units WHERE install_id=? AND owner_uid<>? AND removed_at=0', installId, owner);
    if (old) db.run('UPDATE units SET name=?, summary=?, version=?, last_at=?, plan_uid=?, ip=? WHERE id=?', name, summary, str(b.summary?.version, 20), now, cert.uid, req.ip || '', old.id);
    else db.run('INSERT INTO units(id,owner_uid,plan_uid,install_id,name,summary,version,first_at,last_at,ip) VALUES(?,?,?,?,?,?,?,?,?,?)', crypto.randomUUID(), owner, cert.uid, installId, name, summary, str(b.summary?.version, 20), now, now, req.ip || '');
    const who = db.get('SELECT email FROM users WHERE id=?', owner);
    return {ok: true, owner: owner === cert.uid ? 'self' : 'linked', email: who?.email || ''};
  }));

  app.get('/api/units', api(req => {
    const u = needUser(req), now = Date.now();
    const list = db.all('SELECT * FROM units WHERE owner_uid=? AND removed_at=0 ORDER BY name COLLATE NOCASE', u.id).map(r => {
      let s = {}; try { s = JSON.parse(r.summary); } catch { }
      return {id: r.id, name: r.name, version: r.version, firstAt: r.first_at, lastAt: r.last_at, online: now - r.last_at < 15 * 60000, own: r.plan_uid === u.id, summary: s};
    });
    const sum = f => list.reduce((a, x) => a + (f(x.summary) || 0), 0);
    const code = db.get('SELECT code FROM unit_codes WHERE user_id=?', u.id)?.code || '';
    return {pro: isPro(u.id), code, units: list, maxUnits: maxOf(u.id), totals: {dayCents: sum(s => s.day?.totalCents), monthCents: sum(s => s.month?.totalCents), inUse: sum(s => s.stations?.inUse), stations: sum(s => s.stations?.total), openCash: list.filter(x => x.summary.cash?.open).length}};
  }));
  app.post('/api/units/code', jsonOnly, api(req => {
    const u = needUser(req);
    if (!isPro(u.id)) fail(402, 'O código de vínculo da Multi-Unidade faz parte do plano Pro.');
    let code; do code = newCode(); while (db.get('SELECT 1 FROM unit_codes WHERE code=?', code));
    db.run('INSERT INTO unit_codes(user_id,code,created_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET code=excluded.code, created_at=excluded.created_at', u.id, code, Date.now());
    db.audit(u.email, 'unidades', 'novo código de vínculo'); return {code};
  }));
  app.post('/api/units/remove', jsonOnly, api(req => {
    const u = needUser(req), id = str(req.body?.id, 60);
    const row = db.get('SELECT * FROM units WHERE id=? AND owner_uid=? AND removed_at=0', id, u.id) || fail(404, 'Unidade não encontrada.');
    db.run('UPDATE units SET removed_at=? WHERE id=?', Date.now(), row.id); db.audit(u.email, 'unidades', 'removeu ' + row.name); return {ok: true};
  }));
  // /admin: contas Pro (ou com unidades) com o uso e o limite; aumentar/diminuir o limite de uma conta
  app.get('/api/admin/units', api(req => {
    needAdmin(req);
    const ids = db.all("SELECT DISTINCT user_id id FROM subscriptions WHERE plan='pro' UNION SELECT DISTINCT owner_uid id FROM units WHERE removed_at=0 UNION SELECT user_id id FROM unit_limits").map(r => r.id);
    return {defaultMax: DEFAULT_MAX, accounts: ids.map(id => db.get('SELECT id, email, name FROM users WHERE id=?', id)).filter(Boolean)
      .map(u => ({id: u.id, email: u.email, name: u.name, pro: isPro(u.id), used: usedOf(u.id), max: maxOf(u.id)})).sort((a, b) => b.used - a.used || a.email.localeCompare(b.email))};
  }));
  app.post('/api/admin/units/limit', jsonOnly, api(req => {
    needAdmin(req);
    const u = db.get('SELECT id, email FROM users WHERE id=? OR email=?', str(req.body?.userId, 80), str(req.body?.email, 200).toLowerCase()) || fail(404, 'Conta não encontrada.');
    const max = Math.round(Number(req.body?.max));
    if (!Number.isFinite(max) || max < 1 || max > 500) fail(400, 'Informe um limite de 1 a 500 unidades.');
    if (max === DEFAULT_MAX) db.run('DELETE FROM unit_limits WHERE user_id=?', u.id);
    else db.run('INSERT INTO unit_limits(user_id,max_units,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET max_units=excluded.max_units, updated_at=excluded.updated_at', u.id, max, Date.now());
    db.audit(req.user.email, 'unidades', `limite de ${u.email}: ${max} unidades`);
    return {ok: true, max};
  }));
  return {clean};
};
