'use strict';
// 3.0.61: torneios disponíveis do site da GameZoney (ChatGPT Sites) na aba Torneios do app do cliente.
// O servidor busca o JSON público do site, confere e limpa os dados e guarda a última versão boa.
// O app nunca fala com o site para buscar dados: só abre a página do torneio no navegador ao tocar no botão.
const net = require('node:net');
const SITE = 'https://primearena1.com.br';
const DEFAULT_URL = SITE + '/api/torneios';
const PAGE_URL = SITE + '/torneios';
const FRESH_MS = 5 * 60 * 1000, RETRY_MS = 30 * 1000, TIMEOUT_MS = 10000, MAX_BYTES = 512 * 1024, MAX_ITEMS = 20;
const STATUSES = {open: 'Inscrições abertas', soon: 'Em breve', live: 'Em andamento', full: 'Vagas esgotadas'};

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function validateUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  let u;
  try { u = new URL(text); } catch { throw Error('Endereço dos torneios inválido.'); }
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || net.isIP(host) !== 0;
  if (u.protocol !== 'https:' || u.username || u.password || u.hash || local || !host.includes('.')) throw Error('Informe o endereço HTTPS público dos torneios do site (ex.: ' + DEFAULT_URL + ').');
  return u.href;
}

// Só aceita links do próprio site, dentro de /torneios (é o único lugar que os apps abrem fora do servidor).
function tournamentLink(value) {
  try {
    const u = new URL(String(value || ''), SITE);
    if (u.origin === SITE && !u.username && !u.password && (u.pathname === '/torneios' || u.pathname.startsWith('/torneios/'))) return u.origin + u.pathname + u.search;
  } catch {}
  return PAGE_URL;
}

// Formato esperado (o site gera): {updatedAt?, tournaments:[{id, title, game?, platform?, startsAt?, status, format?, slots?:{filled,total}, entryFee?, prize?, url?}]}
function normalize(raw) {
  const list = Array.isArray(raw?.tournaments) ? raw.tournaments : Array.isArray(raw?.torneios) ? raw.torneios : null;
  if (!list) throw Error('O site não enviou a lista de torneios (campo "tournaments").');
  const seen = new Set(), items = [];
  for (const t of list) {
    if (items.length >= MAX_ITEMS) break;
    const title = clean(t?.title, 80), status = clean(t?.status, 10).toLowerCase();
    if (!title || !STATUSES[status]) continue; // encerrados/cancelados/rascunhos não aparecem
    const id = clean(t.id, 60) || title;
    if (seen.has(id)) continue;
    seen.add(id);
    const starts = Date.parse(t.startsAt);
    const filled = Number(t.slots?.filled), total = Number(t.slots?.total);
    items.push({
      id, title, status, statusText: STATUSES[status],
      game: clean(t.game, 40), platform: clean(t.platform, 20), format: clean(t.format, 60),
      startsAt: Number.isFinite(starts) ? new Date(starts).toISOString() : null,
      slots: Number.isInteger(total) && total > 0 && total <= 10000 && Number.isInteger(filled) && filled >= 0 ? {filled: Math.min(filled, total), total} : null,
      entryFee: clean(t.entryFee, 40), prize: clean(t.prize, 80), url: tournamentLink(t.url)
    });
  }
  // abertos primeiro, depois por data (sem data no fim)
  const order = {open: 0, live: 1, soon: 2, full: 3};
  items.sort((a, b) => order[a.status] - order[b.status] || (a.startsAt ? Date.parse(a.startsAt) : Infinity) - (b.startsAt ? Date.parse(b.startsAt) : Infinity));
  const updated = Date.parse(raw.updatedAt);
  return {tournaments: items, siteUpdatedAt: Number.isFinite(updated) ? new Date(updated).toISOString() : null};
}

module.exports = function tournamentsService(store, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const now = options.now || Date.now;
  let cache = null, lastError = '', lastTry = 0, pending = null;
  const url = () => process.env.PRIME_TOURNAMENTS_URL || store.state.settings.mobile?.tournamentsUrl || DEFAULT_URL;

  async function load() {
    lastTry = now();
    const target = validateUrl(url());
    // redirect:'error' — o servidor não segue redirecionamentos para outros endereços.
    const response = await fetcher(target, {headers: {Accept: 'application/json'}, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store'});
    if (!response.ok) throw Error('O site respondeu ' + response.status + ' ao pedir os torneios.');
    if (Number(response.headers?.get?.('content-length')) > MAX_BYTES) throw Error('Resposta de torneios grande demais.');
    const text = await response.text();
    if (text.length > MAX_BYTES) throw Error('Resposta de torneios grande demais.');
    let raw;
    try { raw = JSON.parse(text); } catch { throw Error('O site não respondeu os torneios em JSON.'); }
    cache = {...normalize(raw), fetchedAt: now()};
    lastError = '';
    return cache;
  }
  function refresh() {
    if (!pending) pending = load().catch(error => { lastError = error.name === 'TimeoutError' ? 'O site demorou para responder.' : error.message; throw error; }).finally(() => { pending = null; });
    return pending;
  }
  async function forMember() {
    const stale = !cache || now() - cache.fetchedAt > FRESH_MS;
    if (stale && !pending && now() - lastTry > RETRY_MS) refresh().catch(() => {});
    if (!cache && pending) await pending.catch(() => {});
    if (!cache) return {available: false, page: PAGE_URL, error: lastError || 'Torneios indisponíveis no momento.'};
    return {available: true, page: PAGE_URL, fetchedAt: new Date(cache.fetchedAt).toISOString(), siteUpdatedAt: cache.siteUpdatedAt, stale: !!lastError, tournaments: cache.tournaments};
  }
  const status = () => ({url: url(), ok: !!cache && !lastError, fetchedAt: cache ? new Date(cache.fetchedAt).toISOString() : null, error: lastError});
  return {forMember, refresh, status};
};
module.exports.validateUrl = validateUrl;
module.exports.normalize = normalize;
module.exports.tournamentLink = tournamentLink;
module.exports.DEFAULT_URL = DEFAULT_URL;
module.exports.PAGE_URL = PAGE_URL;
