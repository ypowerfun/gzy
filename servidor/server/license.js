'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Licença do GameZoney Servidor.
//  - Teste grátis de 30 dias, contados da primeira vez que o servidor abre (state.license.trialStartedAt).
//    Uma cópia da data fica em %LOCALAPPDATA%\GameZoney\gz-license.json (fora da pasta data), para que
//    reinstalar ou apagar os dados não reinicie o teste.
//  - 1.0.6: PLANO DA CONTA (Standard/Pro). Em Configuração › Licença o dono entra com o e-mail e a senha da conta
//    gamezoney.com; o site devolve um certificado assinado (Ed25519) com o plano, "pago até" e o fim da tolerância de
//    7 dias, preso a esta instalação (installId). O servidor renova o certificado sozinho quando tem internet (a cada
//    6 h). Sem internet, continua valendo até o fim da tolerância que o certificado já traz. Se a conta passar para
//    outro computador ou o plano acabar, o site não renova e este computador volta a ficar sem plano.
//  - Licença vitalícia antiga (certificado v1, chave GZ-...): continua valendo como Standard até 12 meses depois da
//    primeira abertura desta versão e passa sozinha para o plano da conta quando houver internet.
//  - Sem plano (teste encerrado ou plano vencido depois dos 7 dias): os dados ficam guardados e o painel continua
//    abrindo; só ficam bloqueadas as ações que geram venda/tempo novo (recargas, iniciar sessão, visitantes, PDV,
//    Corujão/Viradão, abrir caixa, novo cliente).
//  - Relógio: o servidor guarda a maior data já vista; voltar o relógio do Windows não estende teste nem plano.
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const TRIAL_DAYS = 30, DAY = 86400000, LEGACY_DAYS = 365, REFRESH_EVERY = 6 * 3600000;
const SITE = () => (process.env.GZ_SITE_URL || 'https://gamezoney.com').replace(/\/+$/, '');
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAMFrzAwdfdPAGS2NkTlKe29nnB0en88wSERUzJeOcqwM=
-----END PUBLIC KEY-----`;
const KEY_RE = /^GZ(-[A-Z0-9]{4}){4}$/;
// 1.0.7: proteção contra alteração em funcionamento. Depurador (inspector) ligado ou código injetado no Node
// (--require/--import/--loader, inclusive por NODE_OPTIONS) poderiam trocar a conferência da licença: nesse caso o
// GameZoney funciona como teste vencido até ser aberto de novo do jeito normal. O GameZoney.exe já limpa NODE_* ao abrir.
// Só o que injeta código ou LIGA o depurador. --inspect-port/--inspect-publish-uid sozinhos só escolhem a porta (o Node 24
// repassa esses padrões aos processos dos testes); depurador realmente ligado é pego por inspector.url().
const DANGER = /^(-r|--require|--import|--loader|--experimental-loader|--inspect|--inspect-brk|--inspect-wait|--debug|--debug-brk)(=|$)/;
const dangerousArgs = list => list.some(a => DANGER.test(String(a)));
let tamperReason = '';
function checkTamper() {
  if (tamperReason) return tamperReason;
  try { if (dangerousArgs(process.execArgv) || dangerousArgs(String(process.env.NODE_OPTIONS || '').split(/\s+/))) tamperReason = dangerousArgs(process.execArgv) ? 'código injetado na linha de comando do Node' : 'código injetado pela variável NODE_OPTIONS do Windows'; } catch { }
  try { const ins = require('node:inspector'); if (ins.url()) { tamperReason = 'depurador ligado'; ins.close(); } } catch { }
  return tamperReason;
}
const BLOCKED = new Set(['/api/credit', '/api/start', '/api/guest-start', '/api/guest-start-batch', '/api/shop/sale', '/api/events', '/api/events/pay', '/api/events/start', '/api/cash/open', '/api/members', '/api/members/import', '/api/loyalty/redeem']);
const fail = (m, extra) => { throw Object.assign(new Error(m), extra || {}); };
const b64 = s => Buffer.from(s, 'base64url');

function normalizeKey(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('GZ') ? raw.slice(2) : raw;
  return body.length === 16 ? 'GZ-' + body.match(/.{4}/g).join('-') : '';
}
function readCert(token, publicKey) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    if (!crypto.verify(null, b64(body), publicKey, b64(sig))) return null;
    return JSON.parse(b64(body).toString('utf8'));
  } catch { return null; }
}
// Certificado v1 (licença vitalícia antiga) = base64url(JSON) + "." + base64url(assinatura Ed25519 do JSON)
function verifyToken(token, installId, publicKey = PUBLIC_KEY) {
  const data = readCert(token, publicKey);
  if (!data || data.v !== 1 || data.installId !== installId || !KEY_RE.test(data.key || '')) return null;
  return data;
}
// Certificado v2 (plano da conta)
function verifyPlan(token, installId, publicKey = PUBLIC_KEY) {
  const d = readCert(token, publicKey);
  if (!d || d.v !== 2 || d.kind !== 'plan' || d.installId !== installId || !Number.isFinite(d.paidUntil) || !Number.isFinite(d.graceUntil) || !d.email) return null;
  return d;
}

// 1.0.7: teste grátis preso ao COMPUTADOR. Identificação anônima = SHA-256 do MachineGuid do Windows (não dá para
// voltar ao valor original). Uma cópia do início do teste fica também no registro do Windows (HKCU\Software\GameZoney)
// e, com internet, o gamezoney.com guarda a primeira data deste computador: desinstalar, apagar a pasta de dados e
// reinstalar não reinicia os 30 dias.
const REG_KEY = 'HKCU\\Software\\GameZoney';
function winMachineId() {
  try {
    const out = require('node:child_process').execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], {encoding: 'utf8', timeout: 5000, windowsHide: true});
    const g = /MachineGuid\s+REG_SZ\s+([0-9a-f-]{20,})/i.exec(out)?.[1]; return g ? crypto.createHash('sha256').update('gz-machine:' + g.toLowerCase()).digest('hex') : null;
  } catch { return null; }
}
const winRegistry = {
  get() { try { const out = require('node:child_process').execFileSync('reg', ['query', REG_KEY, '/v', 'TrialStart'], {encoding: 'utf8', timeout: 5000, windowsHide: true}); return Number(/TrialStart\s+REG_SZ\s+(\d+)/.exec(out)?.[1]) || 0; } catch { return 0; } },
  set(v) { try { require('node:child_process').execFile('reg', ['add', REG_KEY, '/v', 'TrialStart', '/t', 'REG_SZ', '/d', String(v), '/f'], {timeout: 5000, windowsHide: true}, () => {}); } catch { } }
};
const noRegistry = {get: () => 0, set() {}};

module.exports = function license(store, options = {}) {
  const s = store.state; s.license ??= {}; s.runtime.installId ??= crypto.randomUUID();
  const publicKey = options.publicKey || PUBLIC_KEY;
  const markerFile = options.markerFile === undefined ? null : options.markerFile;
  const fetchImpl = options.fetch || ((...a) => fetch(...a));
  // relógio protegido: nunca anda para trás (voltar o relógio do Windows não estende teste nem plano)
  const now = () => { const t = Date.now(), seen = Number(s.license.lastSeenAt) || 0; if (t > seen + 60000) s.license.lastSeenAt = t; return Math.max(t, seen); };
  function readMarker() { try { return markerFile ? JSON.parse(fs.readFileSync(markerFile, 'utf8')) : {}; } catch { return {}; } }
  function writeMarker(data) { try { if (markerFile) { fs.mkdirSync(path.dirname(markerFile), {recursive: true}); fs.writeFileSync(markerFile, JSON.stringify(data)); } } catch {} }
  // início do teste: o mais antigo entre o banco e a cópia fora da pasta de dados
  const marker = readMarker();
  const win = process.platform === 'win32' && options.machineBound === true; // só no uso real (os testes não tocam no registro do PC)
  const registry = options.registry || (win ? winRegistry : noRegistry);
  const machineId = options.machineId !== undefined ? options.machineId : (win ? winMachineId() : null);
  const starts = [s.license.trialStartedAt, marker.trialStartedAt, registry.get()].map(Number).filter(t => t > 0 && t <= Date.now() + DAY);
  s.license.trialStartedAt = starts.length ? Math.min(...starts) : Date.now();
  s.license.lastSeenAt = Math.max(Number(s.license.lastSeenAt) || 0, Number(marker.lastSeenAt) || 0);
  if (Number(marker.trialStartedAt) !== s.license.trialStartedAt) writeMarker({...marker, trialStartedAt: s.license.trialStartedAt});
  registry.set(s.license.trialStartedAt);
  // certificados guardados também fora da pasta de dados (restaurar backup antigo não perde a ativação)
  if (!s.license.token && marker.token && verifyToken(marker.token, s.runtime.installId, publicKey)) s.license.token = marker.token;
  if (!s.license.planToken && marker.planToken && verifyPlan(marker.planToken, s.runtime.installId, publicKey)) s.license.planToken = marker.planToken;
  const saveMarker = () => writeMarker({...readMarker(), trialStartedAt: s.license.trialStartedAt, lastSeenAt: s.license.lastSeenAt, token: s.license.token || undefined, planToken: s.license.planToken || undefined});

  const licensed = () => verifyToken(s.license.token, s.runtime.installId, publicKey);
  const planCert = () => verifyPlan(s.license.planToken, s.runtime.installId, publicKey);
  // licença vitalícia antiga: vale como Standard por 12 meses a partir da primeira abertura desta versão
  if (licensed() && !s.license.legacyUntil) s.license.legacyUntil = Date.now() + LEGACY_DAYS * DAY;
  const mask = k => k.slice(0, 7) + '-****-****-' + k.slice(-4);
  if (checkTamper() && typeof store.log === 'function') store.log('sistema', 'licenca', 'Proteção: ' + tamperReason + '. Recargas, sessões novas e vendas bloqueadas até abrir o GameZoney de novo.');
  if (!options.noTimer) setInterval(() => { const before = tamperReason; if (checkTamper() && !before) store.log('sistema', 'licenca', 'Proteção: ' + tamperReason + '. Recargas, sessões novas e vendas bloqueadas até abrir o GameZoney de novo.'); }, 3000).unref();

  function status() {
    const t = now(), endsAt = s.license.trialStartedAt + TRIAL_DAYS * DAY, left = Math.max(0, Math.ceil((endsAt - t) / DAY));
    const base = {installId: s.runtime.installId, trialDays: TRIAL_DAYS, trialStartedAt: s.license.trialStartedAt, trialEndsAt: endsAt, buyUrl: SITE() + '/#precos', accountUrl: SITE() + '/conta',
      checkedAt: s.license.planCheckedAt || 0, lastError: s.license.planError || ''};
    if (checkTamper()) return {...base, mode: 'expired', daysLeft: 0, tamper: true, tamperReason};
    const p = planCert();
    if (p && t <= p.graceUntil) {
      const info = {...base, email: p.email, plan: p.plan, planName: p.planName || p.plan, period: p.period || '', paidUntil: p.paidUntil, graceUntil: p.graceUntil};
      return t <= p.paidUntil ? {...info, mode: 'plan'} : {...info, mode: 'plan-grace', daysLeft: Math.max(0, Math.ceil((p.graceUntil - t) / DAY))};
    }
    const lic = licensed();
    if (lic && t <= s.license.legacyUntil) return {...base, mode: 'licensed', legacy: true, legacyUntil: s.license.legacyUntil, key: mask(lic.key), email: lic.email || '', activatedAt: lic.issuedAt};
    if (endsAt > t) return {...base, mode: 'trial', daysLeft: left, ...(p ? {planEnded: p.planName || p.plan, email: p.email} : {})};
    return {...base, mode: 'expired', daysLeft: 0, ...(p ? {planEnded: p.planName || p.plan, email: p.email, paidUntil: p.paidUntil} : lic ? {legacyEnded: true} : {})};
  }
  const expired = () => status().mode === 'expired';
  // bloqueio sem plano (somente ações que geram venda/tempo novo)
  function guard(req, res, next) {
    if (req.method === 'POST' && BLOCKED.has((req.baseUrl + req.path).replace(/\/+$/, '')) && expired()) {
      const st = status();
      const error = st.tamper ? 'Foi detectada uma tentativa de alterar o GameZoney em funcionamento. Feche o GameZoney pelo ícone perto do relógio e abra de novo. Seus dados continuam guardados.' : st.planEnded ? `O plano ${st.planEnded} venceu. Renove em gamezoney.com e clique em Atualizar plano em Configuração › Licença. Seus dados continuam guardados.`
        : 'O teste grátis de 30 dias terminou. Entre com a sua conta gamezoney.com (com plano ativo) em Configuração › Licença. Seus dados continuam guardados.';
      return res.status(402).json({error, license: 'expired'});
    }
    next();
  }
  async function call(url, body) {
    let r, data;
    try {
      r = await fetchImpl(SITE() + url, {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({...body, installId: s.runtime.installId, machine: os.hostname().slice(0, 60), version: options.version || ''})});
      data = await r.json().catch(() => ({}));
    } catch { fail('Sem conexão com gamezoney.com. Confira a internet deste computador e tente de novo.', {offline: true}); }
    if (!r.ok) fail(data.error || 'gamezoney.com recusou (HTTP ' + r.status + ').', {status: r.status, needTransfer: !!data.needTransfer, noPlan: !!data.noPlan, needLogin: !!data.needLogin, machine: String(data.machine || '').slice(0, 60), revoked: !!data.revoked});
    return data;
  }
  function savePlan(token, actor, text) {
    const p = verifyPlan(token, s.runtime.installId, publicKey); if (!p) fail('Resposta inválida de gamezoney.com.');
    const changed = s.license.planToken !== token;
    if (changed) store.change(actor, 'licenca', text || `Plano ${p.planName || p.plan} válido até ${new Date(p.paidUntil).toLocaleDateString('pt-BR')}`, () => { s.license.planToken = token; s.license.planError = ''; s.license.planCheckedAt = now(); });
    else { s.license.planCheckedAt = now(); s.license.planError = ''; store.persist(); }
    saveMarker(); return p;
  }
  // entrar com a conta gamezoney.com (o mesmo e-mail e senha do site); a senha não é guardada
  async function login(input, actor) {
    const email = String(input.email || '').trim().slice(0, 200), password = String(input.password || '').slice(0, 200);
    if (!email || !password) fail('Informe o e-mail e a senha da sua conta gamezoney.com.');
    const data = await call('/api/plan/login', {email, password, transfer: input.transfer === true});
    const p = savePlan(data.token, actor, `Conta conectada: ${p0(data)} (plano ${data.planName || data.plan})`);
    return {...status(), justLoggedIn: !!p};
  }
  const p0 = d => String(d.email || '').replace(/^(.{2}).*(@.*)$/, '$1***$2');
  // renova o certificado (assinatura renovada, plano trocado) e passa a licença antiga para o plano da conta
  let refreshing = null;
  function refresh(actor = 'sistema') {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        if (s.license.planToken) {
          const data = await call('/api/plan/refresh', {token: s.license.planToken});
          if (data.revoked) {
            const why = data.reason === 'moved' ? `a conta passou a ser usada no computador "${data.machine || 'outro'}"` : data.reason === 'expired' ? 'o plano da conta terminou' : 'a conta não está mais disponível';
            store.change(actor, 'licenca', 'Plano desconectado deste computador: ' + why, () => { s.license.planToken = null; s.license.planError = 'Plano desconectado: ' + why + '.'; s.license.planCheckedAt = now(); });
            saveMarker();
          } else savePlan(data.token, actor);
        } else if (licensed()) {
          const data = await call('/api/plan/from-license', {token: s.license.token});
          savePlan(data.token, actor, `Licença vitalícia passou para o plano ${data.planName || data.plan} da conta ${p0(data)}`);
        } else await anchorTrial(actor);
      } catch (e) {
        if (!e.offline) { s.license.planError = e.message; s.license.planCheckedAt = now(); store.persist(); }
        if (e.status === 401 && s.license.planToken) { s.license.planToken = null; store.persist(); saveMarker(); }
      } finally { refreshing = null; }
      return status();
    })();
    return refreshing;
  }
  // 1.0.7: o gamezoney.com devolve (assinada) a primeira data de teste deste computador; vale a mais antiga
  async function anchorTrial(actor) {
    if (!machineId) return;
    let data; try { data = await call('/api/trial/anchor', {machineId, trialStartedAt: s.license.trialStartedAt}); } catch { return; } // sem site: vale a data local e a do registro
    const c = readCert(data.token, publicKey);
    if (!c || c.v !== 1 || c.kind !== 'trial' || c.machine !== machineId || !(c.startedAt > 0)) return;
    if (c.startedAt < s.license.trialStartedAt - 60000) {
      store.change(actor, 'licenca', `Teste grátis: este computador já usava o GameZoney desde ${new Date(c.startedAt).toLocaleDateString('pt-BR')} (a contagem de 30 dias continua dessa data)`, () => { s.license.trialStartedAt = c.startedAt; });
      saveMarker(); registry.set(c.startedAt);
    }
  }
  async function logout(actor) {
    const token = s.license.planToken;
    if (token) { try { await call('/api/plan/logout', {token}); } catch { } }
    store.change(actor, 'licenca', 'Conta gamezoney.com desconectada deste computador', () => { s.license.planToken = null; s.license.planError = ''; });
    saveMarker(); return status();
  }
  // licença antiga por chave (mantida para servidores que ainda usam a chave GZ-...)
  async function activate(input, actor) {
    const key = normalizeKey(input.key); if (!key) fail('Chave inválida. Formato: GZ-XXXX-XXXX-XXXX-XXXX.');
    const data = await call('/api/license/activate', {key, ...(input.email !== undefined || input.password !== undefined ? {email: String(input.email || '').trim().slice(0, 200), password: String(input.password || '').slice(0, 200)} : {})});
    const lic = verifyToken(data.token, s.runtime.installId, publicKey); if (!lic || lic.key !== key) fail('Resposta de ativação inválida.');
    store.change(actor, 'licenca', `Licença ativada: ${mask(key)}`, () => { s.license.token = data.token; s.license.activatedAt = Date.now(); if (!s.license.legacyUntil) s.license.legacyUntil = Date.now() + LEGACY_DAYS * DAY; });
    saveMarker();
    return status();
  }
  // 1.0.8: recursos só do plano Pro (Notas fiscais de entrada, Gerenciamento do App, Multi-Unidade)
  const isPro = () => { const st = status(); return (st.mode === 'plan' || st.mode === 'plan-grace') && st.plan === 'pro'; };
  // 1.2.8: recursos por plano (pedido do dono). Teste grátis (sem entrar na conta) = Free: só o essencial + Autoatendimento.
  //  Standard: + Controle de impressão. Pro: + NF-e, Gerenciar App e Multi-Unidade. Licença vitalícia antiga = Standard.
  const features = () => { const st = status(); if (st.mode === 'plan' || st.mode === 'plan-grace') return st.plan === 'pro' ? {print: true, nfe: true, app: true, units: true} : {print: true}; if (st.mode === 'licensed') return {print: true}; return {}; };
  // (1.1.9 deixava o teste grátis com tudo; desfeito na 1.2.8)
  // 1.1.9: o plano Free (teste de 30 dias) libera TODAS as funções, inclusive as do Pro que rodam só no servidor (Notas Fiscais e
  // Gerenciamento do App). Multi-Unidade continua exigindo o Pro de verdade (o site confere o certificado do plano).
  const proFeatures = () => isPro();
  const planToken = () => (planCert() ? s.license.planToken : null);
  return {status, guard, activate, login, logout, refresh, expired, isPro, proFeatures, features, planToken, REFRESH_EVERY, publicKey, verifyToken: t => verifyToken(t, s.runtime.installId, publicKey)};
};
module.exports.normalizeKey = normalizeKey;
module.exports.verifyToken = verifyToken;
module.exports.verifyPlan = verifyPlan;
module.exports.BLOCKED = BLOCKED;
module.exports.TRIAL_DAYS = TRIAL_DAYS;
