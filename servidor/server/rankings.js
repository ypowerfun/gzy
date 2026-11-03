'use strict';
// 3.0.60: rankings do site da GameZoney dentro do app do cliente.
// O servidor busca o JSON público do site (GET <url>), confere e limpa os dados e guarda a última versão boa.
// O app nunca fala com o site: só com este servidor. Sem dados pessoais além do nome exibido no próprio site.
// 3.0.65: ranking de medalhas com o visual do 3.0.61 (pódio, SUA POSIÇÃO e lista), com os dados e as fotos do site:
// - quadro de medalhas: o site pode mandar até 200 posições; o app recebe o Top 10 e a SUA posição (achada pelo nick);
// - fotos: o site manda o link da foto de cada jogador ("avatar"); o servidor baixa, confere (só PNG/JPEG/WEBP/GIF, até 512 KB,
//   endereço HTTPS público, nunca a rede interna) e entrega ao app pelo próprio servidor (/mobile/api/avatar/<código>);
// 3.0.66: sem o ciclo do Programa Fidelidade no ranking (as medalhas do site não são os pontos de fidelidade; eles ficam em Conquistas).
const net = require('node:net'), crypto = require('node:crypto'), dns = require('node:dns');
const {normalizeNick} = require('./store');
const DEFAULT_URL = 'https://primearena1.com.br/api/rankings';
const FRESH_MS = 5 * 60 * 1000, TIMEOUT_MS = 10000, MAX_BYTES = 512 * 1024;
const MAX_BOARDS = 6, MAX_ENTRIES = 10, MAX_MEDAL_ENTRIES = 200;
const AVATAR_BYTES = 512 * 1024, AVATAR_TTL = 6 * 3600 * 1000, AVATAR_RETRY = 10 * 60 * 1000, AVATAR_TIMEOUT = 8000;
const MAX_AVATARS = 400, MAX_AVATAR_CACHE = 40 * 1024 * 1024, MAX_REDIRECTS = 3;

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const hostOf = u => u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
const publicHost = host => !!host && host.includes('.') && host !== 'localhost' && !host.endsWith('.localhost') && !host.endsWith('.local') && net.isIP(host) === 0;

function validateUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  let u;
  try { u = new URL(text); } catch { throw Error('Endereço dos rankings inválido.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.hash || !publicHost(hostOf(u))) throw Error('Informe o endereço HTTPS público dos rankings do site (ex.: https://primearena1.com.br/api/rankings).');
  return u.href;
}

// Link da foto: HTTPS público (link completo ou caminho do próprio site, ex.: /avatares/power.png). Qualquer outra coisa é ignorada.
function avatarLink(value, base) {
  const text = clean(value, 600);
  if (!text) return '';
  let u;
  try { u = new URL(text, base); } catch { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password || !publicHost(hostOf(u))) return '';
  u.hash = '';
  return u.href;
}

// Endereços que a foto nunca pode apontar (rede interna, o próprio servidor, endereços especiais).
const blocked = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]]) blocked.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96]]) blocked.addSubnet(a, p, 'ipv6');
function privateAddress(address, family) {
  const v6 = family === 6 || family === 'IPv6' || net.isIPv6(address);
  if (v6 && /^::ffff:/i.test(address) && net.isIPv4(address.slice(7))) return blocked.check(address.slice(7), 'ipv4');
  return blocked.check(address, v6 ? 'ipv6' : 'ipv4');
}

function imageType(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.toString('latin1', 0, 6))) return 'image/gif';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

async function readLimited(response, max, message) {
  if (Number(response.headers?.get?.('content-length')) > max) throw Error(message);
  if (!response.body?.getReader) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > max) throw Error(message);
    return buf;
  }
  const reader = response.body.getReader(), parts = [];
  let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { try { await reader.cancel(); } catch {} throw Error(message); }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
}

// Formato esperado (o site gera): {updatedAt?, note?, boards:[{id, title, unit?, emptyTitle?, emptyText?, entries:[{name, nick?, value, position?, avatar?}]}]}
function normalize(raw, base = DEFAULT_URL) {
  const list = Array.isArray(raw?.boards) ? raw.boards : Array.isArray(raw?.rankings) ? raw.rankings : null;
  if (!list) throw Error('O site não enviou a lista de rankings (campo "boards").');
  const seen = new Set(), boards = [];
  for (const board of list.slice(0, MAX_BOARDS)) {
    const title = clean(board?.title, 60);
    let id = clean(board?.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'ranking-' + (boards.length + 1);
    if (!title || seen.has(id)) continue;
    seen.add(id);
    const unit = clean(board.unit, 30), medal = /medalh/i.test(id + ' ' + title + ' ' + unit);
    const entries = (Array.isArray(board.entries) ? board.entries : []).slice(0, MAX_MEDAL_ENTRIES * 2)
      .map(entry => ({name: clean(entry?.name, 40), nick: clean(entry?.nick, 40), value: Number(entry?.value), position: Number(entry?.position), avatarUrl: avatarLink(entry?.avatar ?? entry?.foto ?? entry?.photo, base)}))
      .filter(entry => entry.name && Number.isFinite(entry.value) && entry.value >= 0)
      .slice(0, medal ? MAX_MEDAL_ENTRIES : MAX_ENTRIES)
      .map((entry, index) => ({position: Number.isInteger(entry.position) && entry.position >= 1 && entry.position <= 999 ? entry.position : index + 1, name: entry.name, ...(entry.nick ? {nick: entry.nick} : {}), value: Math.round(entry.value * 1000) / 1000, avatarUrl: entry.avatarUrl}));
    boards.push({id, title, unit, medal, emptyTitle: clean(board.emptyTitle, 80), emptyText: clean(board.emptyText, 160), entries});
  }
  if (!boards.length) throw Error('O site enviou rankings sem título.');
  boards.sort((a, b) => Number(b.medal) - Number(a.medal)); // o app abre no ranking de medalhas, como no 3.0.61
  const updated = Date.parse(raw.updatedAt);
  return {boards, note: clean(raw.note, 300), siteUpdatedAt: Number.isFinite(updated) ? new Date(updated).toISOString() : null};
}

module.exports = function rankingsService(store, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const lookup = options.lookup || dns.promises.lookup;
  const now = options.now || Date.now;
  let cache = null, lastError = '', lastTry = 0, pending = null;
  let avatarIndex = new Map();
  const avatarCache = new Map(), avatarPending = new Map();
  const avatarId = url => digest(url).slice(0, 32);
  const url = () => process.env.PRIME_RANKINGS_URL || store.state.settings.mobile?.rankingsUrl || DEFAULT_URL;

  async function load() {
    lastTry = now();
    const target = validateUrl(url());
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    // redirect:'error' — o servidor não segue redirecionamentos para outros endereços.
    const response = await fetcher(target, {headers: {Accept: 'application/json'}, redirect: 'error', signal, cache: 'no-store'});
    if (!response.ok) throw Error('O site respondeu ' + response.status + ' ao pedir os rankings.');
    const text = (await readLimited(response, MAX_BYTES, 'Resposta de rankings grande demais.')).toString('utf8');
    let raw;
    try { raw = JSON.parse(text); } catch { throw Error('O site não respondeu os rankings em JSON.'); }
    cache = {...normalize(raw, target), fetchedAt: now()};
    // só as fotos citadas no JSON atual do site podem ser baixadas (o app pede pelo código, nunca por endereço)
    avatarIndex = new Map(cache.boards.flatMap(board => board.entries).filter(entry => entry.avatarUrl).map(entry => [avatarId(entry.avatarUrl), entry.avatarUrl]));
    for (const id of avatarCache.keys()) if (!avatarIndex.has(id)) avatarCache.delete(id);
    lastError = '';
    return cache;
  }
  function refresh() {
    if (!pending) pending = load().catch(error => { lastError = error.name === 'TimeoutError' ? 'O site demorou para responder.' : error.message; throw error; }).finally(() => { pending = null; });
    return pending;
  }
  async function current() {
    const stale = !cache || now() - cache.fetchedAt > FRESH_MS;
    if (stale && !pending && now() - lastTry > 30000) refresh().catch(() => {});
    if (!cache && pending) await pending.catch(() => {});
    return cache;
  }

  async function download(link) {
    let target = link;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const u = new URL(target);
      if (u.protocol !== 'https:' || u.username || u.password || !publicHost(hostOf(u))) throw Error('Endereço da foto não permitido.');
      const addresses = await lookup(hostOf(u), {all: true});
      if (!addresses?.length || addresses.some(item => privateAddress(item.address, item.family))) throw Error('O endereço da foto aponta para a rede interna.');
      const response = await fetcher(u.href, {headers: {Accept: 'image/png,image/jpeg,image/webp,image/gif'}, redirect: 'manual', signal: AbortSignal.timeout(AVATAR_TIMEOUT), cache: 'no-store'});
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw Error('Redirecionamento da foto sem destino.');
        target = new URL(location, u).href;
        continue;
      }
      if (!response.ok) throw Error('O site respondeu ' + response.status + ' ao pedir a foto.');
      const buf = await readLimited(response, AVATAR_BYTES, 'Foto grande demais (máximo 512 KB).');
      const type = imageType(buf);
      if (!type) throw Error('A foto não é PNG, JPEG, WEBP ou GIF.');
      return {type, buf};
    }
    throw Error('Redirecionamentos demais na foto.');
  }
  function trimAvatars() {
    let bytes = 0;
    for (const item of avatarCache.values()) bytes += item.buf?.length || 0;
    for (const [id, item] of avatarCache) {
      if (avatarCache.size <= MAX_AVATARS && bytes <= MAX_AVATAR_CACHE) break;
      bytes -= item.buf?.length || 0;
      avatarCache.delete(id);
    }
  }
  // Foto pelo código: devolve {type, buf} ou null (sem foto: o app mostra a letra). Falha recente não tenta de novo por 10 min.
  async function avatar(id) {
    if (!/^[a-f0-9]{32}$/.test(String(id))) return null;
    const link = avatarIndex.get(id);
    if (!link) return null;
    const hit = avatarCache.get(id), t = now();
    if (hit?.buf && hit.url === link && t - hit.at < AVATAR_TTL) return hit;
    if (hit && !hit.buf && hit.url === link && t - hit.failedAt < AVATAR_RETRY) return null;
    if (!avatarPending.has(id)) {
      avatarPending.set(id, download(link).then(img => {
        const item = {...img, url: link, at: now()};
        avatarCache.delete(id);
        avatarCache.set(id, item);
        trimAvatars();
        return item;
      }, error => {
        if (hit?.buf && hit.url === link) return hit; // a foto anterior continua valendo se o site falhar
        avatarCache.set(id, {url: link, failedAt: now(), error: error.message});
        return null;
      }).finally(() => avatarPending.delete(id)));
    }
    return avatarPending.get(id);
  }

  // Marca "você" quando o NICK do site (campo "nick"; sem ele, o nome exibido) é o nick do cliente no servidor,
  // ou quando o nome exibido no site é o nome completo cadastrado no servidor.
  const nickKey = value => normalizeNick(value).toLowerCase();
  async function forMember(member) {
    const data = await current();
    const who = (member?.id && store.state.members?.find(m => m.id === member.id)) || member || {};
    const nick = who.username || '';
    if (!data) return {available: false, error: lastError || 'Rankings indisponíveis no momento.', nick};
    const mineNick = nickKey(nick), mineName = clean(who.name, 80).toLowerCase();
    const isMe = entry => (!!mineNick && nickKey(entry.nick || entry.name) === mineNick) || (!!mineName && clean(entry.name, 80).toLowerCase() === mineName);
    const view = entry => ({position: entry.position, name: entry.name, value: entry.value, me: isMe(entry), avatar: entry.avatarUrl ? '/mobile/api/avatar/' + avatarId(entry.avatarUrl) : null});
    return {available: true, fetchedAt: new Date(data.fetchedAt).toISOString(), siteUpdatedAt: data.siteUpdatedAt, note: data.note, stale: !!lastError, nick,
      boards: data.boards.map(board => {
        const all = board.entries.map(view);
        return {id: board.id, title: board.title, unit: board.unit, medal: board.medal, emptyTitle: board.emptyTitle, emptyText: board.emptyText, entries: all.slice(0, MAX_ENTRIES), me: all.find(entry => entry.me) || null};
      })};
  }
  const status = () => ({url: url(), ok: !!cache && !lastError, fetchedAt: cache ? new Date(cache.fetchedAt).toISOString() : null, error: lastError, avatars: avatarIndex.size});
  return {current, refresh, forMember, status, avatar};
};
module.exports.validateUrl = validateUrl;
module.exports.normalize = normalize;
module.exports.avatarLink = avatarLink;
module.exports.imageType = imageType;
module.exports.privateAddress = privateAddress;
module.exports.DEFAULT_URL = DEFAULT_URL;
