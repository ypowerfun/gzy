'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.4.3: ClearAd — redefine a senha do ADMINISTRADOR PRINCIPAL quando ela foi esquecida (substitui o antigo ClearAll,
// que apagava todos os registros). Executado pelo ClearAd.exe no computador do servidor, com o servidor ENCERRADO:
//   node clear-admin.js "<pasta de dados>" --info      → {"username": "...", "count": n}
//   node clear-admin.js "<pasta de dados>"             → a nova senha chega pela entrada padrão (nunca na linha de comando)
// Muda SÓ a senha do administrador principal (e reativa a conta, se estava desativada). Clientes, vendas, sessões,
// configurações e as outras contas ficam como estão. As sessões abertas dessa conta (no servidor e no app da recepção)
// são encerradas. Antes, uma cópia do banco vai para <pasta de dados>\backups\antes-clearad-*.sqlite. Fica no Log.
const fs = require('node:fs'), path = require('node:path');
const {DatabaseSync, backup} = require('node:sqlite');
const {passwordHash} = require('./store');

const ownerOf = state => {
  const ops = Array.isArray(state.operators) ? state.operators : [];
  return ops.find(o => o.owner && o.role === 'admin') || ops.find(o => o.role === 'admin') || null;
};

function open(directory) {
  const file = path.join(directory, 'gamezoney.sqlite');
  if (!fs.existsSync(file)) throw new Error('Banco de dados do servidor não encontrado em ' + file);
  const db = new DatabaseSync(file);
  const row = db.prepare('SELECT data FROM state WHERE id=1').get();
  if (!row) { db.close(); throw new Error('O banco de dados não possui dados do servidor.'); }
  return {db, state: JSON.parse(row.data)};
}

function info(directory) {
  const {db, state} = open(directory);
  try {
    const op = ownerOf(state);
    if (!op) throw new Error('Este servidor ainda não tem administrador. Abra o GameZoney e crie o administrador principal.');
    return {username: op.username, active: op.active !== false};
  } finally { db.close(); }
}

async function resetAdmin(directory, password, now = Date.now()) {
  const hash = passwordHash(password); // 8 a 24 caracteres (mesma regra do painel)
  const {db, state} = open(directory);
  try {
    const op = ownerOf(state);
    if (!op) throw new Error('Este servidor ainda não tem administrador. Abra o GameZoney e crie o administrador principal.');
    const dir = path.join(directory, 'backups'); fs.mkdirSync(dir, {recursive: true});
    const copy = path.join(dir, 'antes-clearad-' + new Date(now).toISOString().replace(/[:.]/g, '-') + '.sqlite');
    await backup(db, copy);
    const was = op.active === false;
    op.hash = hash; op.active = true; delete op.disabledAt; op.passwordResetAt = now; op.passwordResetBy = 'ClearAd';
    const before = Array.isArray(state.panelSessions) ? state.panelSessions.length : 0;
    state.panelSessions = (state.panelSessions || []).filter(s => s && s.id !== op.id);
    const closed = before - state.panelSessions.length;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE state SET data=? WHERE id=1').run(JSON.stringify(state));
      db.prepare('INSERT INTO logs(at,actor,type,detail) VALUES(?,?,?,?)').run(new Date(now).toISOString(), 'ClearAd', 'operador',
        `Senha do administrador principal (${op.username}) redefinida pelo ClearAd no computador do servidor` + (was ? '; conta reativada' : '') + (closed ? `; ${closed} sessão(ões) dessa conta encerrada(s)` : '') + '. Cópia anterior: ' + path.basename(copy));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return {username: op.username, backup: copy, reactivated: was, sessionsClosed: closed};
  } finally { db.close(); }
}

module.exports = {ownerOf, info, resetAdmin};

if (require.main === module) {
  const dir = process.argv[2] || process.env.GZ_DATA_DIR || path.join(process.env.LOCALAPPDATA || require('os').homedir(), 'GameZoney', 'data');
  const fail = e => { process.stderr.write(String(e && e.message || e)); process.exit(1); };
  if (process.argv.includes('--info')) {
    try { process.stdout.write(JSON.stringify(info(dir))); } catch (e) { fail(e); }
  } else {
    let input = ''; process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { input += c; if (input.length > 1000) fail('Senha inválida.'); });
    process.stdin.on('end', () => {
      const password = input.replace(/\r?\n$/, '');
      resetAdmin(dir, password).then(r => process.stdout.write(JSON.stringify(r)), fail);
    });
  }
}
