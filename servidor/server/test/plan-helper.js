'use strict';
// Simula a conta gamezoney.com logada num plano: certificado v2 assinado por uma chave de teste (a do site fica só na VPS).
const crypto = require('node:crypto');
const sign = (data, key) => { const body = Buffer.from(JSON.stringify(data)).toString('base64url'); return body + '.' + crypto.sign(null, Buffer.from(body, 'base64url'), key).toString('base64url'); };
module.exports = function planHelper() {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
  const license = {publicKey: publicKey.export({type: 'spki', format: 'pem'})};
  const plan = (inst, p) => { const S = inst.store.state; if (!p) { delete S.license.planToken; return; } S.license.planToken = sign({v: 2, kind: 'plan', uid: 'u1', email: 'dono@arena.com', plan: p, planName: p === 'pro' ? 'Pro' : 'Standard', period: 'mensal', installId: S.runtime.installId, paidUntil: Date.now() + 20 * 86400000, graceUntil: Date.now() + 27 * 86400000, issuedAt: Date.now()}, privateKey); };
  return {license, plan};
};
