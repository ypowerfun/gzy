'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.27 (pedido do dono): o site não pode passar de 10–20 GB de disco em 2 anos ou mais de uso. Este módulo:
//  - apaga sozinho, uma vez por dia, o que é só registro temporário e não muda mais (prazos e limites em RULES);
//  - mantém o banco sem crescer à toa (auto_vacuum incremental + WAL limitado);
//  - mede o espaço (banco, imagens, backups, downloads e disco livre) para o /admin › Visão geral.
// Nada de conta, plano, assinatura, pedido pago, licença, avaliação ou configuração é apagado.
const fs = require('node:fs'), path = require('node:path');
const DAY = 86400000;
// prazos (dias) e tetos (linhas) — tudo que passar disso sai, sempre o mais antigo primeiro
const RULES = {
  auditDays: 730, auditMax: 300000,              // registro do /admin: 2 anos
  downloadsDays: 730, downloadsMax: 300000,      // contagem de downloads: 2 anos
  chatDays: 365, chatMessagesMax: 500000,        // conversas encerradas há mais de 1 ano (mensagens vão junto)
  botMissDoneDays: 90, botMissDays: 365, botMissMax: 20000,
  campaignRecipientsDays: 90,                    // destinatários de comunicado já concluído (o total enviado fica no comunicado)
  pixQrDays: 7,                                  // imagem do QR do PIX em pedido que não está mais esperando pagamento
  ticketImageDays: 365,                          // imagens de chamado respondido/fechado há mais de 1 ano
  transfersMax: 100000, trialMachinesDays: 730,
  ticketMediaMaxMB: 2048,                        // imagens de chamados: até 2 GB (passou = saem as dos chamados respondidos mais antigos)
  mediaMaxGB: 4                                  // todas as imagens enviadas (avaliações + chamados + design): até 4 GB; passou = envio de imagem recusado
};

module.exports = function retention({db, dataDir, log = console, rules = {}, intervalMs, now = () => Date.now()}) {
  const R = {...RULES, ...rules};
  const mediaDir = path.join(dataDir, 'media');
  const ticketDir = path.join(dataDir, 'media', 'tickets');
  // banco: auto_vacuum incremental (devolve ao disco o espaço do que foi apagado) — 1ª vez faz um VACUUM (rápido em banco pequeno)
  try {
    db.raw.exec('PRAGMA journal_size_limit=67108864'); // o arquivo -wal não fica maior que 64 MB depois de cada checkpoint
    const mode = db.raw.prepare('PRAGMA auto_vacuum').get().auto_vacuum;
    const size = (() => { try { return fs.statSync(path.join(dataDir, 'site.sqlite')).size; } catch { return 0; } })();
    if (mode !== 2 && size < 1024 * 1024 * 1024) { db.raw.exec('PRAGMA auto_vacuum=INCREMENTAL'); db.raw.exec('VACUUM'); }
  } catch (e) { log.error?.('Retenção: não foi possível ajustar o banco: ' + e.message); }

  const cap = (table, order, max) => db.run(`DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} ORDER BY ${order} DESC LIMIT -1 OFFSET ?)`, max).changes;
  function run() {
    const t = now(), out = {};
    try {
      out.audit = db.run('DELETE FROM audit WHERE at<?', t - R.auditDays * DAY).changes + cap('audit', 'id', R.auditMax);
      out.downloads = db.run('DELETE FROM downloads WHERE at<?', t - R.downloadsDays * DAY).changes + cap('downloads', 'id', R.downloadsMax);
      // conversas encerradas (ou paradas) há mais de 1 ano; as mensagens saem junto (ON DELETE CASCADE)
      out.chats = db.run('DELETE FROM chats WHERE last_at<?', t - R.chatDays * DAY).changes;
      // teto de mensagens: sai a conversa mais antiga inteira (nunca pela metade)
      while (db.get('SELECT COUNT(*) n FROM chat_messages').n > R.chatMessagesMax) {
        const old = db.get('SELECT id FROM chats ORDER BY last_at LIMIT 1'); if (!old) break;
        db.run('DELETE FROM chat_messages WHERE chat_id=?', old.id); db.run('DELETE FROM chats WHERE id=?', old.id); out.chats++;
      }
      out.botMisses = db.run('DELETE FROM bot_misses WHERE (done=1 AND at<?) OR at<?', t - R.botMissDoneDays * DAY, t - R.botMissDays * DAY).changes + cap('bot_misses', 'id', R.botMissMax);
      out.campaignRecipients = db.run(`DELETE FROM campaign_recipients WHERE campaign_id IN (SELECT id FROM campaigns WHERE status IN ('done','canceled') AND COALESCE(finished_at,created_at)<?)`, t - R.campaignRecipientsDays * DAY).changes;
      out.pixQr = db.run("UPDATE orders SET pix_qr='' WHERE pix_qr<>'' AND pix_qr IS NOT NULL AND status<>'pending' AND created_at<?", t - R.pixQrDays * DAY).changes;
      out.transfers = cap('license_transfers', 'id', R.transfersMax);
      out.trialMachines = db.run('DELETE FROM trial_machines WHERE last_seen_at<?', t - R.trialMachinesDays * DAY).changes;
      // imagens de chamados antigos já respondidos/fechados
      out.ticketImages = 0;
      for (const k of db.all("SELECT id, images FROM tickets WHERE images<>'[]' AND status<>'open' AND COALESCE(replied_at,created_at)<?", t - R.ticketImageDays * DAY)) {
        let files = []; try { files = JSON.parse(k.images || '[]'); } catch { }
        for (const f of files) if (/^[\w.-]+$/.test(String(f))) { try { fs.rmSync(path.join(ticketDir, f), {force: true}); out.ticketImages++; } catch { } }
        db.run("UPDATE tickets SET images='[]' WHERE id=?", k.id);
      }
      // teto das imagens de chamados: saem as dos chamados já respondidos/fechados mais antigos
      let tsize = dirSize(ticketDir);
      if (tsize > R.ticketMediaMaxMB * 1048576) for (const k of db.all("SELECT id, images FROM tickets WHERE images<>'[]' AND status<>'open' ORDER BY COALESCE(replied_at,created_at)")) {
        if (tsize <= R.ticketMediaMaxMB * 1048576) break;
        let files = []; try { files = JSON.parse(k.images || '[]'); } catch { }
        for (const f of files) if (/^[\w.-]+$/.test(String(f))) { const p = path.join(ticketDir, f); try { tsize -= fs.statSync(p).size; fs.rmSync(p, {force: true}); out.ticketImages++; } catch { } }
        db.run("UPDATE tickets SET images='[]' WHERE id=?", k.id);
      }
      mediaUsed = null;
      db.raw.exec('PRAGMA incremental_vacuum'); db.raw.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      const total = Object.values(out).reduce((a, b) => a + b, 0);
      if (total) log.log?.('Limpeza automática do site: ' + Object.entries(out).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', '));
    } catch (e) { log.error?.('Limpeza automática do site falhou: ' + e.message); }
    return out;
  }

  // espaço usado (para o /admin) — conta arquivos com limite para não pesar
  function dirSize(dir, limit = 200000) {
    let total = 0, n = 0; const stack = [dir];
    while (stack.length && n < limit) {
      const d = stack.pop(); let list; try { list = fs.readdirSync(d, {withFileTypes: true}); } catch { continue; }
      for (const e of list) { const p = path.join(d, e.name); if (e.isDirectory()) stack.push(p); else if (e.isFile()) { try { total += fs.statSync(p).size; n++; } catch { } } }
    }
    return total;
  }
  // cabe mais imagem? (avaliações e chamados chamam antes de gravar; conta de novo a cada 10 min)
  let mediaUsed = null, mediaAt = 0;
  function mediaRoom(bytes) {
    if (!bytes) return true;
    if (mediaUsed == null || now() - mediaAt > 10 * 60000) { mediaUsed = dirSize(mediaDir); mediaAt = now(); }
    if (mediaUsed + bytes > R.mediaMaxGB * 1073741824) return false;
    mediaUsed += bytes; return true;
  }
  let cached = null, cachedAt = 0;
  function usage(downloadsDir) {
    if (cached && now() - cachedAt < 10 * 60000) return cached;
    const file = n => { try { return fs.statSync(path.join(dataDir, n)).size; } catch { return 0; } };
    let free = null, size = null; try { const s = fs.statfsSync(dataDir); free = s.bavail * s.bsize; size = s.blocks * s.bsize; } catch { }
    cached = {db: file('site.sqlite') + file('site.sqlite-wal'), media: dirSize(path.join(dataDir, 'media')), backups: dirSize(path.join(dataDir, 'backups')),
      downloads: downloadsDir ? dirSize(downloadsDir) : 0, diskFree: free, diskSize: size};
    cachedAt = now(); return cached;
  }

  const first = intervalMs === 0 ? null : setTimeout(run, 60000), timer = intervalMs === 0 ? null : setInterval(run, intervalMs || DAY);
  first?.unref?.(); timer?.unref?.();
  return {run, usage, mediaRoom, stop: () => { clearTimeout(first); clearInterval(timer); }, RULES: R};
};
module.exports.RULES = RULES;
