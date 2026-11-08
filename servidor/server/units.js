'use strict';
// 1.0.8 (plano Pro): Multi-Unidade. Com a opção ligada (Configuração › Multi-Unidade), este Servidor envia a cada 5 minutos
// um RESUMO da loja para a conta do gamezoney.com (faturamento do dia e do mês, caixa, PCs/consoles em uso, clientes,
// produtos mais vendidos). O gestor vê todas as unidades em gamezoney.com › Minha conta › Unidades, pelo celular ou
// computador. Não envia dados de clientes (nomes, CPF, telefone) nem senhas. Sem o código de vínculo, a unidade aparece
// na própria conta do plano; com o código (gerado pelo gestor no site), aparece na conta do gestor.
const stats = require('./stats'), cash = require('./cash');
const fail = m => { throw new Error(m); };
const SITE = () => (process.env.GZ_SITE_URL || 'https://gamezoney.com').replace(/\/+$/, '');
const EVERY = 5 * 60 * 1000;

function config(store) { return store.state.settings.units ||= {enabled: false, name: '', linkCode: ''}; }

function summary(store, extra = {}, now = Date.now()) {
  const s = store.state, tz = s.settings.timeZone || 'America/Manaus', today = stats.localDate(now, tz);
  const dayStart = stats.startOf(today, tz), monthStart = stats.startOf(today.slice(0, 8) + '01', tz);
  const live = x => x.status !== 'canceled';
  const rec = s.sales.filter(x => live(x) && x.at >= monthStart), shop = (s.shopSales || []).filter(x => live(x) && x.at >= monthStart);
  const sum = (list, f, from) => list.filter(x => x.at >= from).reduce((a, x) => a + (f(x) || 0), 0);
  const top = new Map();
  for (const sale of shop) for (const i of sale.items || []) { const r = top.get(i.name) || {name: i.name, qty: 0, cents: 0}; r.qty += i.qty; r.cents += i.totalCents; top.set(i.name, r); }
  const c = cash.current(store), cs = c ? cash.summary(store, c) : null;
  const stations = s.stations.filter(x => !x.removedAt && x.active), active = s.sessions.filter(x => x.status === 'active');
  return {at: now, today, timeZone: tz,
    day: {totalCents: sum(rec, x => x.cents, dayStart) + sum(shop, x => x.totalCents, dayStart), rechargeCents: sum(rec, x => x.cents, dayStart), shopCents: sum(shop, x => x.totalCents, dayStart),
      recharges: rec.filter(x => x.at >= dayStart).length, shopSales: shop.filter(x => x.at >= dayStart).length, sessions: s.sessions.filter(x => x.startedAt >= dayStart).length},
    month: {totalCents: sum(rec, x => x.cents, monthStart) + sum(shop, x => x.totalCents, monthStart), rechargeCents: sum(rec, x => x.cents, monthStart), shopCents: sum(shop, x => x.totalCents, monthStart)},
    cash: c ? {open: true, number: c.number, openedAt: c.openedAt, openedBy: c.openedBy, totalCents: cs.totalCents} : {open: false},
    stations: {total: stations.length, inUse: active.length, computers: stations.filter(x => x.kind === 'computer').length, consoles: stations.filter(x => x.kind === 'tv').length, online: extra.online ?? null},
    members: s.members.filter(m => !m.guest && m.active !== false).length,
    lowStock: (s.products || []).filter(p => p.active && p.stock <= 0).length,
    topProducts: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    nfePending: (s.nfe?.entries || []).filter(e => e.status === 'pending').length, version: extra.version || ''};
}

module.exports = function units(store, lic, options = {}) {
  const fetchImpl = options.fetch || ((...a) => fetch(...a));
  let sending = null;
  async function send(actor) {
    const c = config(store);
    if (!lic.isPro()) fail('Recurso do plano Pro.');
    if (!c.enabled) fail('Ligue o envio para a Minha conta antes.');
    const token = lic.planToken(); if (!token) fail('Entre com a conta gamezoney.com em Configuração › Licença.');
    if (sending) return sending;
    sending = (async () => {
      try {
        const r = await fetchImpl(SITE() + '/api/units/report', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(15000),
          body: JSON.stringify({token, installId: store.state.runtime.installId, name: c.name || 'Unidade', linkCode: c.linkCode || '', summary: summary(store, {online: options.online?.(), version: options.version})})});
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'O gamezoney.com não aceitou o envio (HTTP ' + r.status + ').');
        Object.assign(c, {lastSentAt: Date.now(), lastError: '', owner: data.owner || '', ownerEmail: data.email || ''}); store.persist();
        if (actor) store.log(actor, 'config', 'Multi-Unidade: resumo enviado para ' + (data.email || 'gamezoney.com'));
        return status();
      } catch (e) { c.lastError = String(e.message || e).slice(0, 200); store.persist(); throw e; }
      finally { sending = null; }
    })();
    return sending;
  }
  function save(input, actor) {
    const name = String(input.name ?? '').trim().slice(0, 60), linkCode = String(input.linkCode ?? '').trim().toUpperCase();
    if (input.enabled && !name) fail('Informe o nome da unidade (ex.: Loja Centro).');
    if (linkCode && !/^GZU-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(linkCode)) fail('Código de vínculo inválido (formato GZU-XXXX-XXXX).');
    return store.change(actor, 'config', `Multi-Unidade ${input.enabled ? 'LIGADA' : 'desligada'}${name ? ': ' + name : ''}${linkCode ? ' • vinculada ao gestor ' + linkCode : ''}`, () => {
      Object.assign(config(store), {enabled: !!input.enabled, name, linkCode}); return status();
    });
  }
  const status = () => { const c = config(store); return {...c, pro: lic.isPro(), every: EVERY, preview: summary(store, {online: options.online?.(), version: options.version})}; };
  if (!options.noTimer) {
    const tick = () => { const c = config(store); if (c.enabled && lic.isPro() && lic.planToken()) send().catch(() => {}); };
    setTimeout(tick, 30000).unref(); setInterval(tick, EVERY).unref();
  }
  return {send, save, status, summary: () => summary(store)};
};
module.exports.summary = summary;
