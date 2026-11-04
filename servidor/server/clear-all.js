'use strict';
// 3.0.34: ClearAll — apaga todos os registros do servidor e mantem somente a configuracao.
// Executado pelo ClearAll.exe com o servidor FECHADO:  node clear-all.js "<pasta de dados>"
//
// MANTEM: estacoes (TVs e computadores) com o pareamento (token dos PCs, IP, HDMI, layout),
//         certificado dos PCs (pc-server.pfx), pareamento das TVs (pasta pairing), imagens/wallpapers,
//         configuracoes gerais (valor da hora, fuso, URL, politica das maquinas, regra da fidelidade, backup).
// APAGA:  clientes, administradores e operadores, recargas/faturas, sessoes, pontos e premios,
//         promocoes, produtos e servicos, vendas do PDV, caixas, estoque, despesas, contas a pagar,
//         transferencias de saldo, estatisticas e o Sistema de log.
// Antes de apagar, uma copia completa do banco e salva em <pasta de dados>\backups\antes-clearall-*.sqlite
const fs = require('fs'), path = require('path');
const {DatabaseSync, backup} = require('node:sqlite');

function clearState(state, now = Date.now()) {
  const settings = {...(state.settings || {})};
  settings.cashflow = {balanceCents: 0};   // saldo do fluxo de caixa e um registro financeiro
  return {
    schema: state.schema || 1,
    settings,
    stations: (state.stations || []).filter(s => !s.removedAt),
    runtime: {...(state.runtime || {}), cleanShutdown: true, clearedAt: now},
    operators: [], members: [], promotions: [], sessions: [], sales: [],
    shopSeeded: true,            // nao recriar os produtos de exemplo
    freeGrantsBackfilled: true,
    clearedAt: now
  };
}

async function clearAll(directory, now = Date.now()) {
  const file = path.join(directory, 'gamezoney.sqlite');
  if (!fs.existsSync(file)) throw new Error('Banco de dados não encontrado em ' + file);
  const db = new DatabaseSync(file);
  try {
    const row = db.prepare('SELECT data FROM state WHERE id=1').get();
    if (!row) throw new Error('O banco de dados não possui dados para limpar.');
    const old = JSON.parse(row.data);
    const dir = path.join(directory, 'backups'); fs.mkdirSync(dir, {recursive: true});
    const copy = path.join(dir, 'antes-clearall-' + new Date(now).toISOString().replace(/[:.]/g, '-') + '.sqlite');
    await backup(db, copy);
    const before = {
      clientes: (old.members || []).filter(m => !m.guest).length,
      contas: (old.operators || []).length,
      recargas: (old.sales || []).length,
      sessoes: (old.sessions || []).length,
      produtos: (old.products || []).length + (old.services || []).length,
      vendas: (old.shopSales || []).length,
      caixas: (old.cashRegisters || []).length,
      logs: db.prepare('SELECT COUNT(*) AS n FROM logs').get().n
    };
    const next = clearState(old, now);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE state SET data=? WHERE id=1').run(JSON.stringify(next));
      db.exec('DELETE FROM logs');
      try { db.exec("DELETE FROM sqlite_sequence WHERE name='logs'"); } catch {}
      db.prepare('INSERT INTO logs(at,actor,type,detail) VALUES(?,?,?,?)').run(new Date(now).toISOString(), 'ClearAll', 'sistema', 'Todos os registros foram apagados pelo ClearAll. Estações e pareamentos mantidos. Cópia anterior: ' + path.basename(copy));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    try { db.exec('VACUUM'); } catch {}
    return {backup: copy, before, stations: next.stations.length};
  } finally { db.close(); }
}

module.exports = {clearState, clearAll};

if (require.main === module) {
  const dir = process.argv[2] || process.env.PRIME_DATA_DIR || path.join(process.env.LOCALAPPDATA || require('os').homedir(), 'GameZoney', 'data');
  clearAll(dir).then(r => {
    const b = r.before;
    console.log(`Limpeza concluída.\n\nApagados: ${b.clientes} cliente(s), ${b.contas} conta(s) de administrador/operador, ${b.recargas} recarga(s), ${b.sessoes} sessão(ões), ${b.produtos} produto(s)/serviço(s), ${b.vendas} venda(s) do PDV, ${b.caixas} caixa(s) e ${b.logs} registro(s) de log.\n\nMantidos: ${r.stations} estação(ões) com o pareamento das TVs e computadores e as configurações.\n\nCópia de segurança dos dados anteriores:\n${r.backup}`);
  }).catch(e => { console.error(e.message); process.exit(1); });
}
