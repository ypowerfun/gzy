'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.0.5: licença comercial.
//  - Teste grátis de 30 dias, contados da primeira vez que o servidor abre (state.license.trialStartedAt).
//    Uma cópia da data fica em %LOCALAPPDATA%\GameZoney\gz-license.json (fora da pasta data), para que
//    reinstalar ou apagar os dados não reinicie o teste.
//  - Licença vitalícia (nunca expira): o cliente compra em gamezoney.com, recebe a chave GZ-XXXX-XXXX-XXXX-XXXX e
//    ativa em Configuração › Licença. O site devolve um certificado assinado (Ed25519) preso a esta instalação
//    (installId). Depois de ativada, a licença é conferida offline, sem internet.
//  - Teste encerrado sem licença: os dados ficam guardados e o painel continua abrindo; só ficam bloqueadas as
//    ações que geram venda/tempo novo (recargas, iniciar sessão, visitantes, PDV, Corujão/Viradão, abrir caixa, novo cliente).
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const TRIAL_DAYS = 30, DAY = 86400000;
const SITE = () => (process.env.GZ_SITE_URL || 'https://gamezoney.com').replace(/\/+$/, '');
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAMFrzAwdfdPAGS2NkTlKe29nnB0en88wSERUzJeOcqwM=
-----END PUBLIC KEY-----`;
const KEY_RE = /^GZ(-[A-Z0-9]{4}){4}$/;
const BLOCKED = new Set(['/api/credit', '/api/start', '/api/guest-start', '/api/guest-start-batch', '/api/shop/sale', '/api/events', '/api/events/pay', '/api/events/start', '/api/cash/open', '/api/members', '/api/members/import', '/api/loyalty/redeem']);
const fail = m => { throw new Error(m); };
const b64 = s => Buffer.from(s, 'base64url');

function normalizeKey(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('GZ') ? raw.slice(2) : raw;
  return body.length === 16 ? 'GZ-' + body.match(/.{4}/g).join('-') : '';
}
// Certificado = base64url(JSON) + "." + base64url(assinatura Ed25519 do JSON)
function verifyToken(token, installId, publicKey = PUBLIC_KEY) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    if (!crypto.verify(null, b64(body), publicKey, b64(sig))) return null;
    const data = JSON.parse(b64(body).toString('utf8'));
    if (data.v !== 1 || data.installId !== installId || !KEY_RE.test(data.key || '')) return null;
    return data;
  } catch { return null; }
}

module.exports = function license(store, options = {}) {
  const s = store.state; s.license ??= {}; s.runtime.installId ??= crypto.randomUUID();
  const publicKey = options.publicKey || PUBLIC_KEY;
  const markerFile = options.markerFile === undefined ? null : options.markerFile;
  const now = () => Date.now();
  function readMarker() { try { return markerFile ? JSON.parse(fs.readFileSync(markerFile, 'utf8')) : {}; } catch { return {}; } }
  function writeMarker(data) { try { if (markerFile) { fs.mkdirSync(path.dirname(markerFile), {recursive: true}); fs.writeFileSync(markerFile, JSON.stringify(data)); } } catch {} }
  // início do teste: o mais antigo entre o banco e a cópia fora da pasta de dados
  const marker = readMarker();
  const starts = [s.license.trialStartedAt, marker.trialStartedAt].map(Number).filter(t => t > 0 && t <= now() + DAY);
  s.license.trialStartedAt = starts.length ? Math.min(...starts) : now();
  if (Number(marker.trialStartedAt) !== s.license.trialStartedAt) writeMarker({...marker, trialStartedAt: s.license.trialStartedAt});
  // certificado guardado também fora da pasta de dados (restaurar backup antigo não perde a ativação)
  if (!s.license.token && marker.token && verifyToken(marker.token, s.runtime.installId, publicKey)) s.license.token = marker.token;

  const licensed = () => verifyToken(s.license.token, s.runtime.installId, publicKey);
  function status() {
    const lic = licensed(), endsAt = s.license.trialStartedAt + TRIAL_DAYS * DAY, left = Math.max(0, Math.ceil((endsAt - now()) / DAY));
    const base = {installId: s.runtime.installId, trialDays: TRIAL_DAYS, trialStartedAt: s.license.trialStartedAt, trialEndsAt: endsAt, buyUrl: SITE() + '/#precos', accountUrl: SITE() + '/conta'};
    if (lic) return {...base, mode: 'licensed', key: lic.key.slice(0, 7) + '-****-****-' + lic.key.slice(-4), email: lic.email || '', activatedAt: lic.issuedAt};
    return {...base, mode: endsAt > now() ? 'trial' : 'expired', daysLeft: left};
  }
  const expired = () => status().mode === 'expired';
  // bloqueio depois do teste (somente ações que geram venda/tempo novo)
  function guard(req, res, next) {
    if (req.method === 'POST' && BLOCKED.has((req.baseUrl + req.path).replace(/\/+$/, '')) && expired())
      return res.status(402).json({error: 'O teste grátis de 30 dias terminou. Ative sua licença em Configuração › Licença (compre em gamezoney.com). Seus dados continuam guardados.', license: 'expired'});
    next();
  }
  async function activate(input, actor) {
    const key = normalizeKey(input.key); if (!key) fail('Chave inválida. Formato: GZ-XXXX-XXXX-XXXX-XXXX.');
    let r, data;
    try {
      r = await fetch(SITE() + '/api/license/activate', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({key, installId: s.runtime.installId, machine: os.hostname().slice(0, 60), version: options.version || '',
          // 1.0.5 (troca de computador): chave já ativada em outro computador — o site só troca com o e-mail e a senha da conta gamezoney.com dona da chave
          ...(input.email !== undefined || input.password !== undefined ? {email: String(input.email || '').trim().slice(0, 200), password: String(input.password || '').slice(0, 200)} : {})})});
      data = await r.json().catch(() => ({}));
    } catch { fail('Sem conexão com gamezoney.com. Confira a internet deste computador e tente de novo.'); }
    if (!r.ok) throw Object.assign(new Error(data.error || 'Não foi possível ativar (HTTP ' + r.status + ').'), data.needLogin ? {needLogin: true, machine: String(data.machine || '').slice(0, 60)} : {});
    const lic = verifyToken(data.token, s.runtime.installId, publicKey); if (!lic || lic.key !== key) fail('Resposta de ativação inválida.');
    store.change(actor, 'licenca', `Licença ativada: ${key.slice(0, 7)}-****-****-${key.slice(-4)}`, () => { s.license.token = data.token; s.license.activatedAt = now(); });
    writeMarker({...readMarker(), trialStartedAt: s.license.trialStartedAt, token: data.token});
    return status();
  }
  return {status, guard, activate, expired, verifyToken: t => verifyToken(t, s.runtime.installId, publicKey)};
};
module.exports.normalizeKey = normalizeKey;
module.exports.verifyToken = verifyToken;
module.exports.BLOCKED = BLOCKED;
module.exports.TRIAL_DAYS = TRIAL_DAYS;
