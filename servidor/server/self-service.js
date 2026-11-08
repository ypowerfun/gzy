'use strict';
// 1.1.0: AUTOATENDIMENTO NO PC (com o GameZoney Cliente 1.0.8 ou mais novo), ligado em Configuração › Autoatendimento.
//  - Criar conta: na tela de login do PC o cliente cria o próprio cadastro (nome, nick, senha, telefone opcional).
//  - Recarregar com PIX: o cliente escolhe um pacote (promoção ou valor), paga o PIX na tela do PC e o tempo entra sozinho
//    assim que o pagamento é aprovado; o PC já entra na sessão. Sem fila no balcão.
// O PIX é gerado na conta do Mercado Pago DA ARENA (Access Token colado pelo dono; fica guardado só neste servidor e nunca
// aparece no painel). O Servidor confere o pagamento no Mercado Pago a cada poucos segundos (não precisa de endereço público).
// A recarga entra como venda PIX no caixa aberto, igual à recarga feita na recepção (actor "pix-automatico").
const crypto = require('node:crypto');
const {fail, verify, integer} = require('./store');
const MP = 'https://api.mercadopago.com';
const EXPIRE_MIN = 15;

module.exports = function selfService(store, options = {}) {
  const s = store.state;
  s.settings.selfService ??= {signup: false, pix: false, values: [500, 1000, 2000], promotions: true, payerEmail: ''};
  // 1.1.2: o admin escolhe QUAIS pacotes promocionais (Promoções cadastradas) aparecem no PC; o campo de valores soltos saiu.
  //  Configuração anterior: com "mostrar promoções" ligado, as promoções ativas de hoje ficam marcadas (mesmo resultado no PC).
  const sellable = () => s.promotions.filter(p => p.active && !p.removedAt && p.cents > 0);
  if (!Array.isArray(s.settings.selfService.promotionIds)) s.settings.selfService.promotionIds = s.settings.selfService.promotions !== false ? sellable().map(p => p.id) : [];
  s.settings.selfService.customMinCents ??= 500;   // 1.1.1: valor livre digitado pelo cliente (mínimo configurável)
  s.settings.selfService.customMaxCents ??= 20000;
  s.secrets ??= {};                 // fora de settings: não vai no estado do painel
  s.pixCharges ??= [];
  const fetchImpl = options.fetch || ((...a) => fetch(...a));
  const cfg = () => s.settings.selfService;
  const signups = new Map();         // estação -> tentativas (limite por hora)
  const now = () => Date.now();

  function flags() { const c = cfg(); return {signup: !!c.signup, pix: !!(c.pix && s.secrets.mpToken)}; }

  function signup(station, body) {
    if (!cfg().signup) fail('O cadastro pelo PC está desligado. Procure a recepção.');
    const list = (signups.get(station.id) || []).filter(t => now() - t < 3600000);
    if (list.length >= 6) fail('Muitos cadastros neste PC na última hora. Procure a recepção.');
    if (typeof body.password !== 'string' || body.password !== body.repeatPassword) fail('As senhas não coincidem.');
    if (String(body.password).length < 4 || String(body.password).length > 20) fail('A senha deve ter de 4 a 20 caracteres.');
    const name = String(body.name ?? '').trim(), username = String(body.username ?? '').trim();
    if (!name) fail('Informe o seu nome.');
    if (s.members.some(m => (m.username || '').toLowerCase() === username.replace(/\s+/g, ' ').toLowerCase())) fail('Este Usuário/Nick já existe. Escolha outro.');
    const m = store.memberSave({name, username, password: body.password, phone: String(body.phone ?? '').slice(0, 40), notes: 'Cadastro feito no ' + station.name + ' (autoatendimento).'}, 'cliente:' + station.name);
    list.push(now()); signups.set(station.id, list);
    return {ok: true, username: m.username};
  }

  function options_() {
    const c = cfg(), list = [];
    const chosen = new Set(c.promotionIds || []);
    for (const p of sellable().filter(p => chosen.has(p.id))) list.push({id: 'p:' + p.id, label: p.name, cents: p.cents, minutes: p.minutes});
    return list;
  }
  // 1.1.1: "Outro valor" — o cliente digita quanto quer recarregar (entre o mínimo e o máximo da Configuração)
  function custom() { const c = cfg(), hour = Number(s.settings.hourCents) || 0; return c.custom && hour > 0 ? {min: c.customMinCents, max: c.customMaxCents, hourCents: hour} : null; }
  function customOption(cents) {
    const k = custom(); if (!k) fail('O valor livre está desligado. Escolha um dos pacotes.');
    const v = Math.round(Number(cents));
    if (!Number.isInteger(v) || v < k.min) fail('O valor mínimo para recarga por PIX é ' + brl(k.min) + '.');
    if (v > k.max) fail('O valor máximo para recarga por PIX é ' + brl(k.max) + '.');
    return {id: 'c:' + v, label: brl(v), cents: v, minutes: Math.round(v * 60 / k.hourCents)};
  }
  const brl = v => 'R$ ' + (v / 100).toFixed(2).replace('.', ',');
  function member(body) {
    const nick = String(body.username ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    const m = s.members.find(x => !x.guest && (x.username || '').toLowerCase() === nick);
    if (!m || !m.active || !m.passwordHash || !verify(String(body.password ?? ''), m.passwordHash)) fail('Usuário ou senha incorretos.');
    return m;
  }
  const publicCharge = c => ({id: c.id, status: c.status, cents: c.cents, minutes: c.minutes, label: c.label, qr: c.qr || '', copy: c.copy || '', expiresAt: c.expiresAt, username: c.username});

  async function create(station, body) {
    const f = flags(); if (!f.pix) fail('A recarga por PIX no PC está desligada. Procure a recepção.');
    const m = member(body);
    require('./cash').requireOpen(store, 'recarregar por PIX');
    const opt = String(body.option || '') === 'custom' ? customOption(body.cents) : options_().find(o => o.id === String(body.option || '')) || fail('Escolha um pacote.');
    const open = s.pixCharges.filter(c => c.memberId === m.id && c.status === 'pending' && c.expiresAt > now());
    if (open.length >= 2) fail('Você já tem PIX aguardando pagamento. Pague ou espere expirar.');
    const c = {id: crypto.randomUUID(), memberId: m.id, username: m.username, stationId: station.id, stationName: station.name, option: opt.id, label: opt.label, cents: opt.cents, minutes: opt.minutes,
      status: 'pending', createdAt: now(), expiresAt: now() + EXPIRE_MIN * 60000};
    const payer = m.email || cfg().payerEmail || 'cliente@gamezoney.com';
    let r, data;
    try {
      r = await fetchImpl(MP + '/v1/payments', {method: 'POST', signal: AbortSignal.timeout(20000), headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + s.secrets.mpToken, 'X-Idempotency-Key': c.id},
        body: JSON.stringify({transaction_amount: c.cents / 100, description: `GameZoney • recarga ${opt.label} • ${m.username}`, payment_method_id: 'pix', payer: {email: payer}, external_reference: c.id,
          date_of_expiration: new Date(c.expiresAt).toISOString().replace('Z', '+00:00')})});
      data = await r.json().catch(() => ({}));
    } catch { fail('Sem conexão com o Mercado Pago. Tente de novo ou pague na recepção.'); }
    if (!r.ok || !data.id) { store.log('sistema', 'recarga', 'PIX no PC não gerado (Mercado Pago ' + r.status + '): ' + String(data.message || '').slice(0, 120)); fail('Não foi possível gerar o PIX agora. Pague na recepção.'); }
    const t = data.point_of_interaction?.transaction_data || {};
    Object.assign(c, {mpId: String(data.id), copy: String(t.qr_code || ''), qr: String(t.qr_code_base64 || '')});
    s.pixCharges.push({...c, qr: undefined}); s.pixCharges = s.pixCharges.slice(-1000); qrs.set(c.id, c.qr); store.persist();
    store.log('cliente:' + station.name, 'recarga', `PIX gerado no PC: ${m.username} • ${opt.label} • R$ ${(c.cents / 100).toFixed(2)}`);
    return publicCharge(c);
  }
  const qrs = new Map();

  // confere no Mercado Pago; aprovado = credita o tempo uma única vez
  const checking = new Map();
  async function check(c, force) {
    if (c.status !== 'pending' && c.status !== 'cancelled') return c;
    if (!force && now() - (checking.get(c.id) || 0) < 3000) return c;
    checking.set(c.id, now());
    let data;
    try { const r = await fetchImpl(MP + '/v1/payments/' + encodeURIComponent(c.mpId), {headers: {Authorization: 'Bearer ' + s.secrets.mpToken}, signal: AbortSignal.timeout(15000)}); if (!r.ok) return c; data = await r.json(); } catch { return c; }
    if (String(data.external_reference || '') !== c.id) return c;
    if (data.status === 'approved' && Math.round(Number(data.transaction_amount) * 100) === c.cents && !c.credited) {
      const input = c.option.startsWith('p:') ? {promotionId: c.option.slice(2), paymentMethod: 'pix'} : {mode: 'value', cents: c.cents, paymentMethod: 'pix'};
      try { const sale = store.credit(c.memberId, input, 'pix-automatico'); Object.assign(c, {status: 'approved', credited: true, saleId: sale.id, paidAt: now()}); }
      catch (e) { Object.assign(c, {status: 'error', error: e.message}); store.log('sistema', 'recarga', `PIX aprovado mas o tempo não entrou (${c.username}): ${e.message}. Lance a recarga manualmente.`); }
      store.persist();
      if (c.status === 'approved') store.log('pix-automatico', 'recarga', `PIX aprovado no PC: ${c.username} • ${c.label} • R$ ${(c.cents / 100).toFixed(2)} • tempo liberado`);
    } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(data.status) || (c.expiresAt + 5 * 60000 < now() && data.status !== 'approved')) {
      if (c.status === 'pending') { c.status = 'expired'; store.persist(); }
    }
    return c;
  }
  async function status(station, body) {
    const c = s.pixCharges.find(x => x.id === String(body.id || '') && x.stationId === station.id) || fail('PIX não encontrado.');
    await check(c);
    return {...publicCharge(c), qr: c.status === 'pending' ? qrs.get(c.id) || '' : ''};
  }
  function cancel(station, body) {
    const c = s.pixCharges.find(x => x.id === String(body.id || '') && x.stationId === station.id);
    if (c && c.status === 'pending') { c.status = 'cancelled'; store.persist(); }   // se pagar mesmo assim, ainda é creditado
    return {ok: true};
  }
  // conferência em segundo plano (PC desligado no meio do pagamento não perde a recarga)
  async function sweep() { for (const c of s.pixCharges.filter(c => (c.status === 'pending' || c.status === 'cancelled') && c.expiresAt + 10 * 60000 > now())) await check(c); }
  if (!options.noTimer) setInterval(() => { sweep().catch(() => {}); }, 5000).unref();

  // ---------- painel ----------
  function settings() { const c = cfg(); return {...c, tokenSet: !!s.secrets.mpToken, options: options_(), customInfo: custom(), promotionsList: s.promotions.filter(p => !p.removedAt).map(p => ({id: p.id, name: p.name, cents: p.cents, minutes: p.minutes, active: !!p.active && p.cents > 0})), charges: s.pixCharges.slice(-30).reverse().map(c => ({...publicCharge(c), qr: undefined, copy: undefined, stationName: c.stationName, createdAt: c.createdAt, paidAt: c.paidAt, error: c.error}))}; }
  function save(input, actor) {
    const valid = new Set(sellable().map(p => p.id));
    const promotionIds = [...new Set((Array.isArray(input.promotionIds) ? input.promotionIds : []).map(String))].filter(x => valid.has(x)).slice(0, 50);
    const token = String(input.token ?? '').trim();
    if (token && !/^(APP_USR|TEST)-[0-9a-f-]{8,}[A-Za-z0-9-]*$/i.test(token)) fail('Access Token do Mercado Pago inválido (começa com APP_USR-).');
    const email = String(input.payerEmail ?? '').trim(); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('E-mail inválido.');
    const reais = (v, d) => { const t = String(v ?? '').trim(); if (!t) return d; const n = Math.round(Number(t.replace(/r\$|\s/gi, '').replace(',', '.')) * 100); if (!Number.isInteger(n) || n < 100 || n > 100000) fail('Valor livre: use reais entre 1 e 1000 (ex.: 5,00).'); return n; };
    const old = cfg(), customMinCents = reais(input.customMin, old.customMinCents ?? 500), customMaxCents = reais(input.customMax, old.customMaxCents ?? 20000);
    if (customMaxCents < customMinCents) fail('Valor livre: o máximo precisa ser maior ou igual ao mínimo.');
    const next = {signup: input.signup === true, pix: input.pix === true, values: cfg().values || [], promotionIds, payerEmail: email, custom: input.custom === true, customMinCents, customMaxCents};
    if (next.pix && !token && !s.secrets.mpToken) fail('Cole o Access Token do Mercado Pago da arena para ligar o PIX no PC.');
    if (next.pix && !next.promotionIds.length && !next.custom) fail('Marque pelo menos um pacote promocional ou o Outro valor para o PIX no PC.');
    store.change(actor, 'config', `Autoatendimento no PC: cadastro ${next.signup ? 'ligado' : 'desligado'}, PIX ${next.pix ? 'ligado' : 'desligado'}, ${promotionIds.length} pacote(s) promocional(is), valor livre ${next.custom ? 'a partir de ' + brl(customMinCents) + ' até ' + brl(customMaxCents) : 'desligado'}${token ? ' (Access Token atualizado)' : ''}${input.removeToken ? ' (Access Token removido)' : ''}`, () => {
      s.settings.selfService = next; if (token) s.secrets.mpToken = token; if (input.removeToken === true) { delete s.secrets.mpToken; next.pix = false; } return null;
    });
    return settings();
  }
  return {flags, signup, options: options_, custom, create, status, cancel, check, sweep, settings, save};
};
