'use strict';
// Independent certificate checks for the standalone website archive. The desktop
// server module referenced by the original tests is not included in this ZIP.
const crypto = require('node:crypto');
function verifyToken(token, installId, publicKey) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 2 || !parts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) return null;
    const payload = Buffer.from(parts[0], 'base64url');
    if (!crypto.verify(null, payload, publicKey, Buffer.from(parts[1], 'base64url'))) return null;
    const certificate = JSON.parse(payload);
    if (certificate.v !== 1 || certificate.installId !== installId || certificate.plan !== 'lifetime') return null;
    return certificate;
  } catch { return null; }
}
module.exports = {verifyToken};
