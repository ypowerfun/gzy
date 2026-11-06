'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Banco próprio do site (SQLite do Node, arquivo em DATA_DIR/site.sqlite).
const {DatabaseSync} = require('node:sqlite');
const fs = require('node:fs'), path = require('node:path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT, google_sub TEXT UNIQUE, created_at INTEGER NOT NULL, last_login_at INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resets(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS orders(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), amount_cents INTEGER NOT NULL, status TEXT NOT NULL,
  provider TEXT NOT NULL, provider_id TEXT, pix_code TEXT, pix_qr TEXT, pix_url TEXT, expires_at INTEGER,
  created_at INTEGER NOT NULL, paid_at INTEGER, license_id TEXT, note TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
CREATE TABLE IF NOT EXISTS licenses(
  id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), order_id TEXT, plan TEXT NOT NULL DEFAULT 'lifetime',
  status TEXT NOT NULL DEFAULT 'active', install_id TEXT, machine TEXT, version TEXT, activated_at INTEGER, releases INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS licenses_user ON licenses(user_id);
CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY, name TEXT, email TEXT, comment TEXT, at TEXT, server_version TEXT, install_id TEXT, received_at INTEGER NOT NULL, ip TEXT);
CREATE TABLE IF NOT EXISTS tickets(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  reply TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, replied_at INTEGER);
CREATE TABLE IF NOT EXISTS downloads(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, file TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
`;

function open(dir) {
  fs.mkdirSync(dir, {recursive: true});
  const db = new DatabaseSync(path.join(dir, 'site.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(SCHEMA);
  // 1.1: link do pagamento com cartão (Checkout do Mercado Pago)
  if (!db.prepare('PRAGMA table_info(orders)').all().some(c => c.name === 'checkout_url')) db.exec("ALTER TABLE orders ADD COLUMN checkout_url TEXT NOT NULL DEFAULT ''");
  // 1.2: organização no perfil, avaliações e chat ao vivo
  if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'organization')) db.exec("ALTER TABLE users ADD COLUMN organization TEXT NOT NULL DEFAULT ''");
  db.exec(`
CREATE TABLE IF NOT EXISTS reviews(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, stars INTEGER NOT NULL, text TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]', featured INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chats(
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL, last_at INTEGER NOT NULL, unread_admin INTEGER NOT NULL DEFAULT 0, unread_user INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS chat_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE, sender TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS chat_messages_chat ON chat_messages(chat_id, id);
`);
  // 1.3: e-mail confirmado (obrigatório para administrador); contas ligadas ao Google já vêm confirmadas
  if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'email_verified')) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE users SET email_verified=1 WHERE google_sub IS NOT NULL");
  }
  db.exec("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)"); // 1.4: oferta editável no /admin
  // 1.6: histórico de trocas de computador das licenças (identificar revenda da chave)
  db.exec("CREATE TABLE IF NOT EXISTS license_transfers(id INTEGER PRIMARY KEY AUTOINCREMENT, license_id TEXT NOT NULL, at INTEGER NOT NULL, how TEXT NOT NULL, from_install TEXT, from_machine TEXT, to_install TEXT, to_machine TEXT, ip TEXT)");
  db.exec("CREATE INDEX IF NOT EXISTS license_transfers_lic ON license_transfers(license_id, at)");
  db.exec("CREATE TABLE IF NOT EXISTS verifications(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL)");
  // 1.8: comunicados e promoções por e-mail (envio em fila, um por pessoa) e quem não quer receber
  if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'marketing_opt_out')) db.exec("ALTER TABLE users ADD COLUMN marketing_opt_out INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY, subject TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL, button_label TEXT NOT NULL DEFAULT '', button_url TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', audience TEXT NOT NULL, status TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, created_by TEXT NOT NULL, finished_at INTEGER)");
  db.exec("CREATE TABLE IF NOT EXISTS campaign_recipients(campaign_id TEXT NOT NULL, user_id TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', at INTEGER, PRIMARY KEY(campaign_id, user_id))");
  db.exec("CREATE INDEX IF NOT EXISTS campaign_recipients_status ON campaign_recipients(status, at)");
  // 2.0: assinaturas dos planos (Standard/Pro, mensal/anual) — Mercado Pago, cortesia do admin ou vitalícia convertida
  db.exec("CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), plan TEXT NOT NULL, period TEXT NOT NULL, amount_cents INTEGER NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL, mp_id TEXT, charged_count INTEGER NOT NULL DEFAULT 0, paid_until INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, synced_at INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '')");
  db.exec("CREATE INDEX IF NOT EXISTS subscriptions_user ON subscriptions(user_id)");
  // 2.2: em qual computador (installId) cada conta usa o plano no GameZoney Servidor (1 por conta)
  db.exec("CREATE TABLE IF NOT EXISTS plan_installs(user_id TEXT PRIMARY KEY REFERENCES users(id), install_id TEXT NOT NULL, machine TEXT NOT NULL DEFAULT '', version TEXT NOT NULL DEFAULT '', activated_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, ip TEXT NOT NULL DEFAULT '')");
  // 2.4: imagens nos chamados de suporte e limite de avaliação (enviar + 1 edição; excluir não zera)
  if (!db.prepare('PRAGMA table_info(tickets)').all().some(c => c.name === 'images')) db.exec("ALTER TABLE tickets ADD COLUMN images TEXT NOT NULL DEFAULT '[]'");
  if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'review_writes')) {
    db.exec("ALTER TABLE users ADD COLUMN review_writes INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE users SET review_writes=1 WHERE id IN (SELECT user_id FROM reviews)"); // quem já avaliou ainda pode editar 1 vez
  }
  // 1.0.7: primeira data do teste grátis de cada computador (identificação anônima = SHA-256 do MachineGuid)
  db.exec("CREATE TABLE IF NOT EXISTS trial_machines(machine TEXT PRIMARY KEY, started_at INTEGER NOT NULL, first_install TEXT NOT NULL, last_install TEXT NOT NULL, last_seen_at INTEGER NOT NULL, installs INTEGER NOT NULL DEFAULT 1, ip TEXT NOT NULL DEFAULT '')");
  // 2.5: verificação em duas etapas do /admin (código por e-mail; vale 12 h por sessão)
  if (!db.prepare('PRAGMA table_info(sessions)').all().some(c => c.name === 'admin_until')) {
    db.exec("ALTER TABLE sessions ADD COLUMN admin_until INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE sessions ADD COLUMN mfa_hash TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE sessions ADD COLUMN mfa_expires INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE sessions ADD COLUMN mfa_tries INTEGER NOT NULL DEFAULT 0");
  }
  const cache = new Map();
  const stmt = sql => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  return {
    raw: db,
    get: (sql, ...a) => stmt(sql).get(...a),
    all: (sql, ...a) => stmt(sql).all(...a),
    run: (sql, ...a) => stmt(sql).run(...a),
    tx(fn) { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    audit(actor, action, detail = '') { stmt('INSERT INTO audit(at,actor,action,detail) VALUES(?,?,?,?)').run(Date.now(), String(actor), action, String(detail).slice(0, 500)); },
    close: () => db.close()
  };
}
module.exports = {open};
