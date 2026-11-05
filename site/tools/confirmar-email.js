'use strict';
// GameZoney — site gamezoney.com — confirma o e-mail de uma conta direto no banco (uso do dono, no VPS).
// Uso: sudo -u gamezoney node /opt/gamezoney-site/tools/confirmar-email.js seu-email@exemplo.com
const {open} = require('../db');
const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) { console.log('Uso: sudo -u gamezoney node /opt/gamezoney-site/tools/confirmar-email.js seu-email@exemplo.com'); process.exit(1); }
const db = open(process.env.DATA_DIR || '/var/lib/gamezoney-site');
const u = db.get('SELECT id, email_verified FROM users WHERE email=?', email);
if (!u) { console.log('Nenhuma conta com este e-mail. Crie a conta no site primeiro.'); process.exit(1); }
db.run('UPDATE users SET email_verified=1 WHERE id=?', u.id); db.audit('vps', 'conta', 'e-mail confirmado pelo VPS: ' + email);
console.log('OK: e-mail confirmado para ' + email); db.close();
