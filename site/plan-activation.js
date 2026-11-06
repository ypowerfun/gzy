'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.2 (etapa 2): o GameZoney Servidor usa o PLANO da conta. Em Configuração › Licença o dono entra com o e-mail e a senha
// do site; o site devolve um certificado assinado (Ed25519, chave privada só no VPS) com o plano, até quando está pago e
// o fim da tolerância de 7 dias, preso a este computador (installId). Uma conta = 1 servidor por vez.
//  - /api/plan/login: e-mail + senha (mesmo bloqueio de senha errada do site). Conta já usada em outro computador:
//    pede confirmação (transfer) e avisa o dono por e-mail; a troca fica registrada (suspeita de revenda no /admin).
//  - /api/plan/refresh: o Servidor renova o certificado sozinho (renovações da assinatura). Se a conta passou para outro
//    computador ou o plano acabou, responde revoked e o certificado antigo deixa de ser renovado (vale no máximo até o
//    fim da tolerância que ele já trazia).
//  - /api/plan/from-license: servidores com licença vitalícia antiga (certificado v1) passam sozinhos para o plano
//    Standard convertido (12 meses), sem pedir senha.
const crypto = require('node:crypto');

module.exports = function planActivation(app, ctx) {
  const {db, api, fail, str, limit, plans, checkAccount, privateKey, notify, SITE, log} = ctx;
  const publicKey = privateKey ? crypto.createPublicKey(privateKey) : null;
  const ID_RE = /^[0-9a-f-]{20,80}$/i;
  const b64 = s => Buffer.from(s, 'base64url');
  function sign(data) {
    if (!privateKey) fail(503, 'Ativação temporariamente indisponível. Fale com o suporte.');
    const body = Buffer.from(JSON.stringify(data)).toString('base64url');
    return body + '.' + crypto.sign(null, Buffer.from(body, 'base64url'), privateKey).toString('base64url');
  }
  function verify(token) {
    try {
      const [body, sig] = String(token || '').split('.'); if (!body || !sig || !publicKey) return null;
      if (!crypto.verify(null, b64(body), publicKey, b64(sig))) return null;
      return JSON.parse(b64(body).toString('utf8'));
    } catch { return null; }
  }
  function certificate(user, plan, installId) {
    return sign({v: 2, kind: 'plan', uid: user.id, email: user.email, plan: plan.plan, planName: plan.name, period: plan.period, installId, paidUntil: plan.paidUntil, graceUntil: plan.graceUntil, issuedAt: Date.now()});
  }
  const binding = uid => db.get('SELECT * FROM plan_installs WHERE user_id=?', uid);
  function bind(user, installId, machine, version, ip) {
    const old = binding(user.id), now = Date.now();
    if (old && old.install_id !== installId) {
      db.run('INSERT INTO license_transfers(license_id,at,how,from_install,from_machine,to_install,to_machine,ip) VALUES(?,?,?,?,?,?,?,?)', 'plan:' + user.id, now, 'plano', old.install_id, old.machine, installId, machine, ip || '');
      db.audit(user.email, 'plano', `trocou de computador: ${old.machine || '?'} → ${machine || '?'}`);
      Promise.resolve(notify(user.email, 'GameZoney: seu plano passou para outro computador', {preheader: 'Seu plano foi ativado em outro computador.',
        lines: [`Olá, ${user.name}!`, `Seu plano GameZoney foi ativado no computador "${machine || 'sem nome'}" e deixou de valer no computador "${old.machine || 'sem nome'}".`],
        after: ['Se não foi você, troque a senha da sua conta agora e fale com o suporte.'], button: {label: 'Trocar minha senha', url: `${SITE}/entrar.html`}})).catch(() => {});
    }
    db.run('INSERT INTO plan_installs(user_id,install_id,machine,version,activated_at,last_seen_at,ip) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET install_id=excluded.install_id, machine=excluded.machine, version=excluded.version, activated_at=CASE WHEN plan_installs.install_id=excluded.install_id THEN plan_installs.activated_at ELSE excluded.activated_at END, last_seen_at=excluded.last_seen_at, ip=excluded.ip',
      user.id, installId, machine, version, now, now, ip || '');
  }
  const input = req => ({installId: str(req.body?.installId, 80), machine: str(req.body?.machine, 60), version: str(req.body?.version, 20)});
  const reply = (user, plan, installId) => ({token: certificate(user, plan, installId), email: user.email, plan: plan.plan, planName: plan.name, period: plan.period, paidUntil: plan.paidUntil, graceUntil: plan.graceUntil});

  app.post('/api/plan/login', limit('planlogin', 30, 3600000), api(req => {
    const {installId, machine, version} = input(req); if (!ID_RE.test(installId)) fail(400, 'Instalação inválida.');
    const user = checkAccount(req.body?.email, req.body?.password);
    const plan = plans.planOf(user.id);
    if (!plan) fail(402, 'Esta conta não tem plano ativo. Assine o Standard ou o Pro em gamezoney.com (o teste grátis continua valendo neste computador).', {noPlan: true});
    const old = binding(user.id);
    if (old && old.install_id !== installId && req.body?.transfer !== true)
      fail(409, `Esta conta já está sendo usada no computador "${old.machine || 'sem nome'}". Usar o plano neste computador? O outro deixa de usar.`, {needTransfer: true, machine: old.machine || ''});
    bind(user, installId, machine, version, req.ip);
    db.audit(user.email, 'plano', `entrou no GameZoney Servidor ${version} em ${machine || '?'}`);
    return reply(user, plan, installId);
  }));
  app.post('/api/plan/refresh', limit('planrefresh', 240, 3600000), api(req => {
    const {installId, machine, version} = input(req), cert = verify(req.body?.token);
    if (!cert || cert.v !== 2 || cert.kind !== 'plan' || cert.installId !== installId || !ID_RE.test(installId)) fail(401, 'Certificado inválido. Entre de novo com a sua conta.', {revoked: true, reason: 'invalid'});
    const user = db.get('SELECT * FROM users WHERE id=?', cert.uid); if (!user) return {revoked: true, reason: 'account'};
    const b = binding(user.id);
    if (!b || b.install_id !== installId) return {revoked: true, reason: 'moved', machine: b ? b.machine : ''};
    const plan = plans.planOf(user.id); if (!plan) return {revoked: true, reason: 'expired'};
    db.run('UPDATE plan_installs SET last_seen_at=?, machine=?, version=? WHERE user_id=?', Date.now(), machine || b.machine, version || b.version, user.id);
    return reply(user, plan, installId);
  }));
  app.post('/api/plan/logout', limit('planrefresh', 240, 3600000), api(req => {
    const {installId} = input(req), cert = verify(req.body?.token);
    if (cert && cert.v === 2 && cert.installId === installId) { const b = binding(cert.uid); if (b && b.install_id === installId) { db.run('DELETE FROM plan_installs WHERE user_id=?', cert.uid); db.audit(cert.email, 'plano', 'saiu da conta no GameZoney Servidor'); } }
    return {ok: true};
  }));
  // licença vitalícia antiga (certificado v1) → plano Standard convertido, sem senha
  app.post('/api/plan/from-license', limit('planrefresh', 240, 3600000), api(req => {
    const {installId, machine, version} = input(req), cert = verify(req.body?.token);
    if (!cert || cert.v !== 1 || cert.installId !== installId || !ID_RE.test(installId)) fail(401, 'Certificado inválido.');
    const lic = db.get('SELECT * FROM licenses WHERE key=?', String(cert.key || ''));
    if (!lic || lic.status !== 'active' || lic.install_id !== installId) fail(403, 'Licença antiga não está mais ativa neste computador. Entre com a sua conta.', {needLogin: true});
    const user = db.get('SELECT * FROM users WHERE id=?', lic.user_id), plan = plans.planOf(user.id);
    if (!plan) fail(402, 'O plano desta conta terminou. Assine em gamezoney.com e entre com a sua conta.', {noPlan: true});
    const b = binding(user.id); if (b && b.install_id !== installId) fail(409, 'Esta conta já está sendo usada em outro computador. Entre com a sua conta.', {needLogin: true});
    bind(user, installId, machine, version, req.ip);
    db.audit(user.email, 'plano', `licença vitalícia ${lic.key.slice(0, 7)}… passou para o plano ${plan.name} em ${machine || '?'}`);
    return reply(user, plan, installId);
  }));
  // /admin: em qual computador cada conta está usando o plano
  const machineOf = uid => { const b = binding(uid); return b ? {machine: b.machine, version: b.version, lastSeenAt: b.last_seen_at} : null; };
  if (!publicKey) log.error('Planos: chave de assinatura ausente; o GameZoney Servidor não consegue entrar com a conta.');
  return {verify, machineOf};
};
