'use strict';
// 1.0.9: Wake-on-LAN e controle de impressão (com o GameZoney Cliente 1.0.7 ou mais novo nos PCs).
//  - Rede: o Cliente informa as placas de rede do PC (MAC, IP e máscara). O Servidor guarda em station.network e, em
//    "Ligar todos/Ligar específico", manda o "pacote mágico" (Wake-on-LAN) por broadcast em todas as redes da recepção.
//    Para o PC ligar, a placa precisa aceitar WoL (o instalador do Cliente liga no Windows) e a BIOS também.
//  - Impressão (Configuração › Controle de impressão): ligado, o Cliente PAUSA cada documento que o cliente manda
//    imprimir na sessão e avisa o Servidor. A recepção aprova (com ou sem cobrança pelo serviço Impressão no PDV) ou
//    recusa (o documento é apagado da fila do PC). Nada é impresso sem aprovação.
const dgram = require('node:dgram'), os = require('node:os');
const {fail, id, integer} = require('./store');
const MAC_RE = /^[0-9A-F]{12}$/, IP_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const ip2n = ip => ip.split('.').reduce((a, x) => (a * 256) + Number(x), 0), n2ip = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');
const broadcastOf = (ip, mask) => n2ip(((ip2n(ip) | (~ip2n(mask) >>> 0)) >>> 0));
const magicPacket = mac => { const m = Buffer.from(mac, 'hex'), b = Buffer.alloc(102, 0xff); for (let i = 0; i < 16; i++) m.copy(b, 6 + i * 6); return b; };

module.exports = function pcDevices(store, options = {}) {
  const s = store.state;
  s.settings.printControl ??= {enabled: false, serviceId: ''};
  s.prints ??= [];
  const queues = new Map(); // stationId -> Map(jobId -> job)
  const queue = stationId => { if (!queues.has(stationId)) queues.set(stationId, new Map()); return queues.get(stationId); };
  const sessionNick = stationId => { const ses = store.activeForStation(stationId); if (!ses) return ''; const m = s.members.find(x => x.id === ses.memberId); return m?.username || ses.memberName || ''; };
  const history = (job, result, actor, extra = {}) => { s.prints.push({id: job.id, stationId: job.stationId, stationName: job.stationName, nick: job.nick, printer: job.printer, document: job.document, pages: job.pages, copies: job.copies, at: job.at, result, by: actor, decidedAt: Date.now(), ...extra}); s.prints = s.prints.slice(-500); };

  // recebido em cada consulta de estado do PC
  function receive(station, body) {
    const out = {};
    if (Array.isArray(body.network)) {
      const list = body.network.slice(0, 8).map(n => ({mac: String(n?.mac || '').toUpperCase().replace(/[^0-9A-F]/g, ''), ip: String(n?.ip || ''), mask: String(n?.mask || ''), name: String(n?.name || '').slice(0, 60), wol: n?.wol === true ? true : n?.wol === false ? false : null}))
        .filter(n => MAC_RE.test(n.mac) && n.mac !== '000000000000' && (!n.ip || IP_RE.test(n.ip)) && (!n.mask || IP_RE.test(n.mask)));
      const before = JSON.stringify(station.network?.list || []);
      if (list.length && JSON.stringify(list) !== before) { station.network = {list, at: Date.now()}; store.persist(); }
    }
    if (body.printVersion === 1) {
      const pc = s.settings.printControl, q = queue(station.id), reported = new Set();
      for (const j of (Array.isArray(body.printJobs) ? body.printJobs : []).slice(0, 30)) {
        const jid = String(j?.id || '').slice(0, 160); if (!jid) continue; reported.add(jid);
        const pages = Math.max(0, Math.min(10000, Math.floor(Number(j.pages) || 0))), copies = Math.max(1, Math.min(999, Math.floor(Number(j.copies) || 1)));
        let job = q.get(jid);
        if (!job) {
          job = {id: jid, key: id(), stationId: station.id, stationName: station.name, nick: sessionNick(station.id), printer: String(j.printer || '').slice(0, 120), document: String(j.document || 'Documento').slice(0, 200), pages, copies, at: Date.now(), status: 'pending'};
          q.set(jid, job);
          store.log('cliente:' + station.name, 'impressao', `Impressão aguardando aprovação: ${job.document} • ${pages || '?'} pág.${copies > 1 ? ' × ' + copies : ''} • ${job.printer}${job.nick ? ' • ' + job.nick : ''}`);
          options.notify?.(station, 'Sua impressão foi enviada para a recepção. Aguarde a aprovação.');
        } else { job.pages = Math.max(job.pages, pages); job.copies = copies; job.spooling = j.spooling === true; }
      }
      // documentos que o PC não informa mais: decisão aplicada no PC, ou cancelado/apagado pelo próprio cliente
      for (const [jid, job] of q) if (!reported.has(jid)) {
        if (!job.decision) { history(job, 'cancelada no PC', 'cliente:' + station.name); store.log('cliente:' + station.name, 'impressao', `Impressão cancelada no PC: ${job.document}`); }
        q.delete(jid);
      }
      store.persist();
      out.printControl = {enabled: !!pc.enabled, decisions: [...q.values()].filter(j => j.decision).map(j => ({id: j.id, action: j.decision}))};
    }
    return out;
  }

  function pending() {
    const list = [];
    for (const q of queues.values()) for (const j of q.values()) if (!j.decision) list.push({key: j.key, stationId: j.stationId, stationName: j.stationName, nick: j.nick, printer: j.printer, document: j.document, pages: j.pages, copies: j.copies, at: j.at, spooling: !!j.spooling});
    return list.sort((a, b) => a.at - b.at);
  }
  function decide(input, actor, sell) {
    let job = null; for (const q of queues.values()) for (const j of q.values()) if (j.key === String(input.key || '')) job = j;
    if (!job || job.decision) fail('Esta impressão já foi decidida ou não está mais na fila do PC.');
    const action = input.action === 'approve' ? 'approve' : input.action === 'reject' ? 'reject' : fail('Ação inválida.');
    let sale = null;
    if (action === 'approve' && input.charge) {
      const svc = s.services.find(x => x.id === String(input.serviceId || '') && x.active) || fail('Escolha o serviço para cobrar (ex.: Impressão).');
      const qty = integer(input.qty, 1, 100000, 'Quantidade');
      sale = sell({items: [{kind: 'service', id: svc.id, qty}], paymentMethod: input.paymentMethod, payments: input.payments});
    }
    job.decision = action;
    history(job, action === 'approve' ? 'aprovada' : 'recusada', actor, sale ? {saleId: sale.id, cents: sale.totalCents} : {});
    store.change(actor, 'impressao', `Impressão ${action === 'approve' ? 'APROVADA' : 'RECUSADA'}: ${job.document} • ${job.pages || '?'} pág. • ${job.stationName}${sale ? ' • cobrada R$ ' + (sale.totalCents / 100).toFixed(2) : ''}`, () => ({ok: true}));
    return {ok: true, sale};
  }
  function saveSettings(input, actor) {
    const enabled = input.enabled === true || input.enabled === 'true';
    const serviceId = String(input.serviceId || '');
    if (serviceId && !s.services.some(x => x.id === serviceId && x.active)) fail('Serviço não encontrado.');
    return store.change(actor, 'config', `Controle de impressão ${enabled ? 'LIGADO' : 'desligado'}`, () => { s.settings.printControl = {enabled, serviceId}; return s.settings.printControl; });
  }

  // ---------- Wake-on-LAN ----------
  function wakeTargets(input) {
    const pcs = s.stations.filter(x => x.kind === 'computer' && !x.removedAt && x.active);
    const list = input.scope === 'one' ? pcs.filter(x => x.id === String(input.stationId || '')) : pcs;
    if (input.scope === 'one' && !list.length) fail('Escolha um computador específico.');
    return list;
  }
  async function wake(input, actor, connected = () => false) {
    const targets = wakeTargets(input), results = [], packets = [];
    for (const st of targets) {
      if (input.scope !== 'one' && connected(st.id)) { results.push({name: st.name, ok: true, skipped: true, message: 'Já está ligado.'}); continue; }
      const nics = st.network?.list || [];
      if (!nics.length) { results.push({name: st.name, ok: false, message: 'Endereço da placa de rede (MAC) ainda desconhecido: abra o PC uma vez com o GameZoney Cliente atualizado.'}); continue; }
      for (const n of nics) packets.push(n);
      results.push({name: st.name, ok: true, message: 'Sinal para ligar enviado (' + nics.map(n => n.mac.match(/../g).join(':')).join(', ') + ').'});
    }
    if (packets.length) await (options.send || sendMagic)(packets);
    const sent = results.filter(r => r.ok && !r.skipped).length;
    store.log(actor, 'computador', `Ligar computadores (Wake-on-LAN): ${sent} sinal(is) enviado(s)${results.some(r => !r.ok) ? ', ' + results.filter(r => !r.ok).length + ' sem MAC' : ''}`);
    return {success: sent, skipped: results.filter(r => r.skipped).length, failed: results.filter(r => !r.ok).length, results};
  }
  // manda o pacote mágico em todas as redes IPv4 desta máquina (broadcast geral e da sub-rede), portas 9 e 7
  async function sendMagic(nics) {
    const local = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal);
    const dests = new Set(['255.255.255.255']);
    for (const i of local) if (i.netmask) dests.add(broadcastOf(i.address, i.netmask));
    for (const n of nics) if (n.ip && n.mask) dests.add(broadcastOf(n.ip, n.mask));
    const binds = local.length ? local.map(i => i.address) : [undefined];
    for (const address of binds) {
      await new Promise(resolve => {
        const sock = dgram.createSocket('udp4'); let left = 0; const done = () => { if (--left <= 0) { try { sock.close(); } catch { } resolve(); } };
        sock.on('error', () => { try { sock.close(); } catch { } resolve(); });
        sock.bind({address, port: 0}, () => {
          try { sock.setBroadcast(true); } catch { }
          for (const n of nics) for (const d of dests) for (const port of [9, 7]) { left++; sock.send(magicPacket(n.mac), port, d, done); }
          if (!left) done();
        });
      });
    }
  }

  return {receive, pending, decide, saveSettings, wake, history: () => s.prints.slice(-50).reverse()};
};
module.exports.magicPacket = magicPacket;
module.exports.broadcastOf = broadcastOf;
