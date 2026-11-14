'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.25: notificação push no celular (padrão Web Push), só com o crypto do Node (sem biblioteca externa):
//  - RFC 8292 (VAPID): o site assina um JWT ES256 com a sua chave; o serviço de push (Google, Mozilla, Apple, Microsoft) confere.
//  - RFC 8291 (aes128gcm): o texto vai cifrado para a chave do navegador do cliente; o serviço de push não consegue ler.
const crypto = require('node:crypto');

const b64u = b => Buffer.from(b).toString('base64url');
const hkdf = (ikm, salt, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

// Serviços de push aceitos (o endereço vem do navegador: sem esta lista o site poderia ser usado para chamar qualquer endereço)
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com'];
function allowedEndpoint(endpoint, extra = []) {
  let u; try { u = new URL(String(endpoint || '')); } catch { return false; }
  if (u.protocol !== 'https:' || u.port || u.username || u.password || String(endpoint).length > 1000) return false;
  const h = u.hostname.toLowerCase();
  return [...PUSH_HOSTS, ...extra].some(x => h === x || h.endsWith('.' + x));
}

function generateKeys() {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const jwk = publicKey.export({format: 'jwk'});
  return {publicKey: b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')])),
    privateKey: privateKey.export({type: 'pkcs8', format: 'pem'})};
}

function vapidJwt(audience, subject, privateKeyPem, now = Date.now()) {
  const head = b64u(JSON.stringify({typ: 'JWT', alg: 'ES256'}));
  const body = b64u(JSON.stringify({aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject}));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), {key: privateKeyPem, dsaEncoding: 'ieee-p1363'});
  return head + '.' + body + '.' + b64u(sig);
}

function validKeys(p256dh, auth) {
  try { const ua = Buffer.from(String(p256dh || ''), 'base64url'), a = Buffer.from(String(auth || ''), 'base64url'); return ua.length === 65 && ua[0] === 4 && a.length === 16; } catch { return false; }
}

// cifra a mensagem para o navegador (um registro só, até 4 KB)
function encrypt(payload, p256dh, auth) {
  const ua = Buffer.from(p256dh, 'base64url'), authSecret = Buffer.from(auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const as = ecdh.getPublicKey(), shared = ecdh.computeSecret(ua);
  const ikm = hkdf(shared, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), ua, as]), 32);
  const salt = crypto.randomBytes(16);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = 65;
  return Buffer.concat([head, as, ct]);
}

// envia; devolve o código HTTP do serviço de push (201 = entregue; 404/410 = inscrição vencida)
async function send(sub, payload, keys, {fetch = globalThis.fetch, subject = 'https://gamezoney.com', ttl = 86400} = {}) {
  const u = new URL(sub.endpoint);
  const res = await fetch(sub.endpoint, {method: 'POST', signal: AbortSignal.timeout(10000), body: encrypt(payload, sub.p256dh, sub.auth),
    headers: {'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', TTL: String(ttl), Urgency: 'high',
      Authorization: `vapid t=${vapidJwt(u.origin, subject, keys.privateKey)}, k=${keys.publicKey}`}});
  try { await res.arrayBuffer(); } catch { }
  return res.status;
}

module.exports = {generateKeys, vapidJwt, encrypt, send, validKeys, allowedEndpoint, PUSH_HOSTS};
