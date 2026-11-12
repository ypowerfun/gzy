'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.0: PLANOS por assinatura (Standard e Pro, mensal ou anual) com cobrança automática no cartão (Mercado Pago).
//  - Preços, preço "de", selo, "mais popular" e a lista de itens de cada plano são editados no /admin (settings 'plans').
//  - O cliente escolhe o plano e o período no carrinho (/carrinho#plano-periodo) e digita o cartão nos campos do Mercado
//    Pago (Card Payment Brick, dentro do site). O site cria a assinatura com o token do cartão (nunca vê o cartão).
//  - O plano só vale depois que o Mercado Pago confirma a cobrança (summarized.charged_quantity). Cada cobrança feita
//    estende a validade por 1 mês ou 1 ano. Sem renovar: 7 dias de tolerância (GRACE), depois o plano vence.
//  - Cancelar: a cobrança automática para e o plano vale até o fim do período já pago.
//  - Licenças vitalícias vendidas antes viram Standard com 12 meses grátis (uma vez, na primeira abertura desta versão).
const DAY = 86400000, GRACE = 7 * DAY;
// 2.1: Free (teste grátis de 30 dias: só vitrine, leva para os downloads) + Standard (meio, mais popular) + Pro
const PLAN_IDS = ['free', 'standard', 'pro'], PAID = ['standard', 'pro'], PERIODS = {mensal: 1, anual: 12};
const DEFAULT_PLANS = {
  free: {name: 'Free', monthly: 0, monthlyList: 0, annual: 0, annualList: 0, badge: '', popular: false, free: true,
    features: ['Funções essenciais por 30 dias', 'Autoatendimento no PC (PIX)', 'PCs e consoles ilimitados', 'Sem cartão de crédito', 'Seus dados ficam guardados ao assinar', 'Sem anúncios']},
  standard: {name: 'Standard', monthly: 2990, monthlyList: 0, annual: 29900, annualList: 35880, badge: '', popular: true,
    features: ['Todas as funções liberadas', 'Autoatendimento no PC (PIX)', 'Controle de impressão', 'PCs e consoles ilimitados', 'VR e simuladores ilimitados', 'Suporte completo (24 horas)', 'Sem anúncios']},
  pro: {name: 'Pro', monthly: 12990, monthlyList: 0, annual: 129900, annualList: 155880, badge: '', popular: false,
    features: ['Todas as funções liberadas', 'PCs e consoles ilimitados', 'VR e simuladores ilimitados', '1 layout personalizado (Servidor/Cliente)', '1 app (Servidor/Cliente)', 'Gerenciamento de NF-e', 'Emissão de NFC-e e NFS-e', 'Multi-Unidade', 'Logo e cor da sua arena', 'Autoatendimento no PC (PIX)', 'Controle de impressão', 'Suporte completo (24 horas)', 'Sem anúncios']}
};
const addMonths = (t, n) => { const d = new Date(t); const day = d.getUTCDate(); d.setUTCMonth(d.getUTCMonth() + n); if (d.getUTCDate() < day) d.setUTCDate(0); return d.getTime(); };

module.exports = function plans(app, ctx) {
  const {db, needUser, needAdmin, jsonOnly, api, limit, fail, str, uid, pay, env, SITE, log, notify, intervalMs} = ctx;
  // tabela subscriptions: criada em db.js
  const setting = k => { try { return JSON.parse(db.get('SELECT value FROM settings WHERE key=?', k)?.value || 'null'); } catch { return null; } };
  const saveSetting = (k, v) => db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, JSON.stringify(v));

  // licenças vitalícias já vendidas viram Standard com 12 meses grátis (uma vez só)
  if (!setting('legacy_converted')) {
    const now = Date.now(), users = db.all("SELECT DISTINCT user_id FROM licenses WHERE status='active' AND plan='lifetime'");
    db.tx(() => {
      for (const {user_id} of users) db.run('INSERT INTO subscriptions(id,user_id,plan,period,amount_cents,status,source,paid_until,created_at,updated_at,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        uid(), user_id, 'standard', 'anual', 0, 'granted', 'legacy', addMonths(now, 12), now, now, 'Licença vitalícia convertida: Standard por 12 meses grátis');
      saveSetting('legacy_converted', {at: now, users: users.length});
    });
    if (users.length) db.audit('sistema', 'planos', `${users.length} licença(s) vitalícia(s) convertida(s) em Standard por 12 meses grátis`);
  }

  // 2.10: listas de itens dos planos definidas pelo dono (Free / Standard / Pro). Se o /admin já tinha salvo listas antigas, troca
  // UMA vez só os itens (preços, selo e "mais popular" salvos continuam). Depois disso, o que for editado no /admin vale.
  // 2.12: o teste grátis não tem mais todas as funções (NF-e, App, Multi-Unidade e Impressão dependem do plano): troca de novo uma vez
  if (!setting('plans_features_v3')) {
    const saved = setting('plans');
    if (saved) { for (const id of PLAN_IDS) if (saved[id]) saved[id].features = [...DEFAULT_PLANS[id].features]; saveSetting('plans', saved); db.audit('sistema', 'planos', 'Itens dos planos Free/Standard/Pro atualizados para a lista nova'); }
    saveSetting('plans_features_v3', {at: Date.now()});
  }
  // 2.13: Pro passa a emitir NFC-e e NFS-e (Focus NFe): só ACRESCENTA o item no Pro salvo no /admin, uma vez, sem trocar a lista
  if (!setting('plans_features_v4')) {
    const saved = setting('plans');
    if (saved?.pro?.features && !saved.pro.features.some(f => /NFC-e/i.test(f))) { const i = saved.pro.features.findIndex(f => /NF-e/i.test(f)); saved.pro.features.splice(i >= 0 ? i + 1 : saved.pro.features.length, 0, 'Emissão de NFC-e e NFS-e'); saved.pro.features = saved.pro.features.slice(0, 12); saveSetting('plans', saved); db.audit('sistema', 'planos', 'Plano Pro: item "Emissão de NFC-e e NFS-e" acrescentado'); }
    saveSetting('plans_features_v4', {at: Date.now()});
  }
  // 2.14: Standard sem "1 layout personalizado" (pedido do dono): só RETIRA esse item do Standard salvo no /admin, uma vez
  if (!setting('plans_features_v5')) {
    const saved = setting('plans');
    if (saved?.standard?.features?.some(f => /layout personalizado/i.test(f))) { saved.standard.features = saved.standard.features.filter(f => !/layout personalizado/i.test(f)); saveSetting('plans', saved); db.audit('sistema', 'planos', 'Plano Standard: item "1 layout personalizado" retirado'); }
    saveSetting('plans_features_v5', {at: Date.now()});
  }
  // 2.15: Pro ganha "Logo e cor da sua arena" (Personalizar visual): só ACRESCENTA no Pro salvo no /admin, uma vez
  if (!setting('plans_features_v6')) {
    const saved = setting('plans');
    if (saved?.pro?.features && !saved.pro.features.some(f => /logo e cor/i.test(f))) { const i = saved.pro.features.findIndex(f => /Multi-Unidade/i.test(f)); saved.pro.features.splice(i >= 0 ? i + 1 : saved.pro.features.length, 0, 'Logo e cor da sua arena'); saved.pro.features = saved.pro.features.slice(0, 13); saveSetting('plans', saved); db.audit('sistema', 'planos', 'Plano Pro: item "Logo e cor da sua arena" acrescentado'); }
    saveSetting('plans_features_v6', {at: Date.now()});
  }
  function plansConfig() {
    const saved = setting('plans') || {}, out = {};
    for (const id of PLAN_IDS) out[id] = {...DEFAULT_PLANS[id], ...(saved[id] || {}), id};
    return out;
  }
  const priceOf = (p, period) => period === 'anual' ? p.annual : p.monthly;
  const publicPlans = () => Object.values(plansConfig()).map(p => ({id: p.id, name: p.name, monthly: p.monthly, monthlyList: p.monthlyList, annual: p.annual, annualList: p.annualList, badge: p.badge, popular: !!p.popular, free: !!p.free, features: p.features}));

  // plano em vigor da conta (o melhor que ainda vale, contando os 7 dias de tolerância)
  function planOf(userId, now = Date.now()) {
    const list = db.all('SELECT * FROM subscriptions WHERE user_id=? AND paid_until>? ORDER BY paid_until DESC', userId, now - GRACE);
    const rank = s => (s.plan === 'pro' ? 2 : 1);
    const best = list.sort((a, b) => rank(b) - rank(a) || b.paid_until - a.paid_until)[0];
    if (!best) return null;
    return {plan: best.plan, name: plansConfig()[best.plan]?.name || best.plan, period: best.period, paidUntil: best.paid_until, graceUntil: best.paid_until + GRACE, inGrace: best.paid_until < now, subscriptionId: best.id, autoRenew: best.status === 'authorized'};
  }
  const STATUS = {pending: 'Aguardando a primeira cobrança', authorized: 'Ativa (renova sozinha)', paused: 'Pausada no Mercado Pago', cancelled: 'Cancelada', granted: 'Cortesia', failed: 'Pagamento recusado'};
  const publicSub = s => ({id: s.id, plan: s.plan, planName: plansConfig()[s.plan]?.name || s.plan, period: s.period, amountCents: s.amount_cents, status: s.status, statusText: s.source === 'mp' && s.status === 'authorized' && !s.charged_count ? STATUS.pending : (STATUS[s.status] || s.status),
    source: s.source, paidUntil: s.paid_until, createdAt: s.created_at, active: s.paid_until + GRACE > Date.now() && s.charged_count + (s.source !== 'mp' ? 1 : 0) > 0, note: s.note});

  // confere a assinatura no Mercado Pago e atualiza a validade (cada cobrança feita = +1 período)
  async function sync(s, force) {
    if (s.source !== 'mp' || !s.mp_id || !pay.enabled) return s;
    if (!force && Date.now() - s.synced_at < 60000) return s;
    try {
      const r = await pay.getSubscription(s.mp_id), months = PERIODS[s.period] || 1, now = Date.now();
      let paidUntil = s.paid_until;
      if (r.chargedQuantity > s.charged_count) {
        const base = r.lastChargedDate ? new Date(r.lastChargedDate).getTime() : now;
        paidUntil = Math.max(s.paid_until, addMonths(Number.isFinite(base) ? base : now, months));
      }
      const status = ['authorized', 'paused', 'cancelled'].includes(r.status) ? r.status : s.status;
      db.run('UPDATE subscriptions SET status=?, charged_count=?, paid_until=?, synced_at=?, updated_at=? WHERE id=?', status, Math.max(s.charged_count, r.chargedQuantity), paidUntil, now, now, s.id);
      const fresh = db.get('SELECT * FROM subscriptions WHERE id=?', s.id);
      if (fresh.charged_count > s.charged_count) {
        const u = db.get('SELECT * FROM users WHERE id=?', s.user_id), first = s.charged_count === 0, name = plansConfig()[s.plan]?.name || s.plan;
        db.audit(u.email, 'assinatura', `${name} ${s.period}: cobrança confirmada (${fresh.charged_count}ª), vale até ${new Date(paidUntil).toISOString().slice(0, 10)}`);
        notify(u.email, first ? `GameZoney: plano ${name} ativado` : `GameZoney: plano ${name} renovado`, {preheader: first ? 'Seu plano está ativo.' : 'Pagamento da assinatura confirmado.',
          lines: [`Olá, ${u.name}!`, first ? `Seu plano ${name} (${s.period}) está ativo. Obrigado por escolher o GameZoney!` : `Recebemos o pagamento da sua assinatura do plano ${name}.`],
          title: 'Plano válido até', code: new Date(paidUntil).toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'}), codeNote: 'A renovação é automática no cartão. Cancele quando quiser em Minha conta.',
          button: {label: 'Minha conta', url: `${SITE}/conta#comprar`}});
      }
      return fresh;
    } catch (e) { log.error('Assinatura (consulta):', e.message); return s; }
  }

  app.get('/api/plans', api(() => ({plans: publicPlans(), graceDays: GRACE / DAY})));
  // assinar: cria a assinatura no Mercado Pago com o token do cartão (Card Payment Brick)
  app.post('/api/subscriptions', jsonOnly, limit('subscribe', 10, 3600000), api(async req => {
    const u = needUser(req), planId = String(req.body.plan || ''), period = String(req.body.period || '');
    const p = PAID.includes(planId) && plansConfig()[planId]; if (!p || !PERIODS[period]) fail(400, 'Escolha o plano e o período.');
    if (!pay.enabled || !env.MP_PUBLIC_KEY) fail(400, 'Assinatura indisponível no momento. Fale com o suporte.');
    const current = db.get("SELECT * FROM subscriptions WHERE user_id=? AND source='mp' AND status IN ('pending','authorized','paused') ORDER BY created_at DESC LIMIT 1", u.id);
    if (current) fail(409, 'Você já tem uma assinatura ativa. Para trocar de plano ou período, cancele a atual em Minha conta e assine de novo (o período já pago continua valendo).');
    const amount = priceOf(p, period), id = uid(), now = Date.now();
    const email = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(req.body.payerEmail || '')) ? String(req.body.payerEmail).toLowerCase() : u.email;
    let r;
    try { r = await pay.createSubscription({reason: `GameZoney ${p.name} (${period})`, externalReference: id, payerEmail: email, cardTokenId: str(req.body.token, 200), amountCents: amount, months: PERIODS[period], backUrl: SITE + '/conta#comprar'}); }
    catch (e) { log.error('Assinatura (criar):', e.message); fail(400, /incompletos/.test(e.message) ? e.message : 'O Mercado Pago não aceitou o cartão para a assinatura. Confira os dados ou use outro cartão.'); }
    const status = r.status === 'authorized' ? (r.chargedQuantity ? 'authorized' : 'pending') : (['paused', 'cancelled'].includes(r.status) ? 'failed' : 'pending');
    db.run('INSERT INTO subscriptions(id,user_id,plan,period,amount_cents,status,source,mp_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', id, u.id, planId, period, amount, status, 'mp', r.id, now, now);
    db.audit(u.email, 'assinatura', `${p.name} ${period} ${(amount / 100).toFixed(2)} criada no Mercado Pago ${r.id} (${r.status})`);
    const s = await sync(db.get('SELECT * FROM subscriptions WHERE id=?', id), true);
    return {subscription: publicSub(db.get('SELECT * FROM subscriptions WHERE id=?', id)), plan: planOf(u.id)};
  }));
  app.post('/api/subscriptions/:id/cancel', jsonOnly, api(async req => {
    const u = needUser(req), s = db.get('SELECT * FROM subscriptions WHERE id=? AND user_id=?', req.params.id, u.id) || fail(404, 'Assinatura não encontrada.');
    return cancel(s, u.email);
  }));
  async function cancel(s, who) {
    if (s.source === 'mp' && s.mp_id && !['cancelled', 'failed'].includes(s.status)) {
      try { await pay.cancelSubscription(s.mp_id); } catch (e) { log.error('Assinatura (cancelar):', e.message); fail(502, 'Não foi possível cancelar no Mercado Pago agora. Tente de novo em alguns minutos.'); }
    }
    db.run("UPDATE subscriptions SET status='cancelled', updated_at=? WHERE id=?", Date.now(), s.id);
    db.audit(who, 'assinatura', `cancelada (${s.plan} ${s.period}); vale até ${new Date(s.paid_until).toISOString().slice(0, 10)}`);
    return {ok: true, subscription: publicSub(db.get('SELECT * FROM subscriptions WHERE id=?', s.id))};
  }
  // dados da conta (Minha conta): plano em vigor e assinaturas (confere no Mercado Pago as que estão esperando)
  async function forUser(userId) {
    for (const s of db.all("SELECT * FROM subscriptions WHERE user_id=? AND source='mp' AND status IN ('pending','authorized','paused')", userId)) await sync(s);
    return {plan: planOf(userId), subscriptions: db.all('SELECT * FROM subscriptions WHERE user_id=? ORDER BY created_at DESC LIMIT 20', userId).map(publicSub)};
  }
  // aviso do Mercado Pago sobre assinatura (o conteúdo do aviso nunca é usado: sempre consulta a assinatura)
  async function webhook(type, id) {
    if (!pay.enabled || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return false;
    try {
      let mpId = null;
      if (/preapproval/.test(type) && !/authorized_payment/.test(type)) mpId = id;
      else if (/authorized_payment/.test(type)) mpId = (await pay.getAuthorizedPayment(id)).preapprovalId;
      else return false;
      const s = mpId && db.get('SELECT * FROM subscriptions WHERE mp_id=?', mpId); if (s) await sync(s, true);
      return true;
    } catch (e) { log.error('Assinatura (aviso):', e.message); return true; }
  }

  // ---------- administrador ----------
  const cents = v => { const t = String(v ?? '').trim().replace(/[^0-9.,]/g, ''); return Math.round(Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) * 100) || 0; };
  const toCents = v => typeof v === 'number' ? Math.round(v) : cents(v);
  app.post('/api/admin/plans', jsonOnly, api(req => {
    needAdmin(req); const input = req.body.plans || {}, cur = plansConfig(), out = {};
    for (const id of PLAN_IDS) {
      const i = input[id] || {}, c = cur[id], isFree = id === 'free';
      const monthly = isFree ? 0 : toCents(i.monthly ?? c.monthly), annual = isFree ? 0 : toCents(i.annual ?? c.annual), monthlyList = isFree ? 0 : toCents(i.monthlyList ?? c.monthlyList), annualList = isFree ? 0 : toCents(i.annualList ?? c.annualList);
      if (!isFree && (monthly < 100 || annual < 100)) fail(400, `${c.name}: o preço precisa ser de pelo menos R$ 1,00.`);
      if ((monthlyList && monthlyList <= monthly) || (annualList && annualList <= annual)) fail(400, `${c.name}: o preço "de" precisa ser maior que o preço "por" (ou vazio).`);
      const features = (Array.isArray(i.features) ? i.features : c.features).map(f => str(f, 120)).filter(Boolean).slice(0, 12);
      out[id] = {name: str(i.name ?? c.name, 40) || c.name, monthly, monthlyList, annual, annualList, badge: str(i.badge ?? c.badge, 40), popular: req.body.popular ? req.body.popular === id : !!c.popular, ...(isFree ? {free: true} : {}), features};
    }
    saveSetting('plans', out); db.audit(req.user.email, 'planos', Object.values(out).map(p => `${p.name}: ${(p.monthly / 100).toFixed(2)}/mês, ${(p.annual / 100).toFixed(2)}/ano`).join(' • '));
    return {ok: true, plans: publicPlans()};
  }));
  const adminSub = s => ({...publicSub(s), email: s.email, name: s.name, mpId: s.mp_id || '', chargedCount: s.charged_count, machine: s.pc_machine || '', machineSeenAt: s.pc_seen || 0});
  function adminData() {
    const now = Date.now(), active = db.all('SELECT DISTINCT user_id FROM subscriptions WHERE paid_until>?', now - GRACE).length;
    const mrr = db.all("SELECT period, amount_cents FROM subscriptions WHERE source='mp' AND status='authorized' AND paid_until>?", now).reduce((a, s) => a + (s.period === 'anual' ? s.amount_cents / 12 : s.amount_cents), 0);
    return {plans: publicPlans(), stats: {activePlans: active, monthlyRevenueCents: Math.round(mrr)},
      subscriptions: db.all('SELECT s.*, u.email, u.name, pi.machine pc_machine, pi.last_seen_at pc_seen FROM subscriptions s JOIN users u ON u.id=s.user_id LEFT JOIN plan_installs pi ON pi.user_id=s.user_id ORDER BY s.created_at DESC LIMIT 300').map(adminSub)};
  }
  app.get('/api/admin/plans', api(req => { needAdmin(req); return adminData(); }));
  app.post('/api/admin/subscriptions/grant', jsonOnly, api(req => {
    needAdmin(req); const email = str(req.body.email, 200).toLowerCase(), planId = String(req.body.plan || ''), months = Math.floor(Number(req.body.months) || 0);
    const u = db.get('SELECT * FROM users WHERE email=?', email) || fail(404, 'Nenhuma conta com este e-mail. A pessoa precisa criar a conta no site primeiro.');
    if (!PAID.includes(planId) || months < 1 || months > 60) fail(400, 'Escolha o plano e de 1 a 60 meses.');
    const now = Date.now(), id = uid();
    db.run('INSERT INTO subscriptions(id,user_id,plan,period,amount_cents,status,source,paid_until,created_at,updated_at,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, u.id, planId, months >= 12 ? 'anual' : 'mensal', 0, 'granted', 'admin', addMonths(now, months), now, now, str(req.body.note, 200) || `Cortesia: ${months} mês(es)`);
    db.audit(req.user.email, 'assinatura', `cortesia ${planId} ${months} mês(es) para ${email}`);
    return {ok: true};
  }));
  app.post('/api/admin/subscriptions/:id/cancel', jsonOnly, api(req => {
    needAdmin(req); const s = db.get('SELECT * FROM subscriptions WHERE id=?', req.params.id) || fail(404, 'Assinatura não encontrada.');
    if (req.body.endNow) { db.run("UPDATE subscriptions SET status='cancelled', paid_until=?, updated_at=? WHERE id=?", Date.now() - GRACE - 1, Date.now(), s.id); db.audit(req.user.email, 'assinatura', `encerrada na hora (${s.id})`); }
    return cancel(db.get('SELECT * FROM subscriptions WHERE id=?', s.id), req.user.email);
  }));

  // conferência periódica das assinaturas (além dos avisos do Mercado Pago)
  const timer = intervalMs === 0 ? null : setInterval(async () => {
    for (const s of db.all("SELECT * FROM subscriptions WHERE source='mp' AND status IN ('pending','authorized','paused') AND synced_at<?", Date.now() - 2 * 3600000)) await sync(s, true);
  }, intervalMs || 600000);
  if (timer && timer.unref) timer.unref();
  return {planOf, plansConfig, publicPlans, forUser, webhook, stop: () => timer && clearInterval(timer), GRACE, adminData};
};
module.exports.DEFAULT_PLANS = DEFAULT_PLANS;
module.exports.addMonths = addMonths;
