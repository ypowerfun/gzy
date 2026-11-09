'use strict';
// 1.0.9: Wake-on-LAN (MAC informado pelo Cliente 1.0.7) e controle de impressão com aprovação na recepção
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {Store} = require('../store'), pcDevices = require('../pc-devices'), diskless = require('../diskless');
const {createServer} = require('../server');

test('1.0.9: pacote mágico e broadcast da sub-rede', () => {
  const p = pcDevices.magicPacket('AABBCCDDEEFF'); assert.equal(p.length, 102); assert.ok(p.subarray(0, 6).every(b => b === 0xff));
  assert.equal(p.subarray(6, 12).toString('hex'), 'aabbccddeeff'); assert.equal(p.subarray(96).toString('hex'), 'aabbccddeeff');
  assert.equal(pcDevices.broadcastOf('192.168.1.37', '255.255.255.0'), '192.168.1.255'); assert.equal(pcDevices.broadcastOf('10.0.5.9', '255.255.0.0'), '10.0.255.255');
});

test('1.0.9: PC informa as placas; impressão fica parada até aprovar/recusar; ligar pela rede', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-dev-')), store = new Store(dir), sent = [], notes = [];
  try {
    const d = pcDevices(store, {send: async n => sent.push(...n), notify: (st, text) => notes.push(text)});
    const pc = store.state.stations.find(s => s.kind === 'computer');
    // rede: MAC normalizado, virtual/zerado descartado
    d.receive(pc, {network: [{mac: 'aa-bb-cc-dd-ee-ff', ip: '192.168.1.37', mask: '255.255.255.0', name: 'Ethernet'}, {mac: '00-00-00-00-00-00'}, {mac: 'xyz'}]});
    assert.deepEqual(pc.network.list.map(n => n.mac), ['AABBCCDDEEFF']);
    // controle desligado: o PC recebe enabled=false
    let r = d.receive(pc, {printVersion: 1, printJobs: []}); assert.equal(r.printControl.enabled, false);
    d.saveSettings({enabled: true}, 'admin');
    r = d.receive(pc, {printVersion: 1, printJobs: [{id: 'HP|5|1', printer: 'HP', document: 'Trabalho.pdf', pages: 3}]});
    assert.equal(r.printControl.enabled, true); assert.deepEqual(r.printControl.decisions, []);
    assert.equal(d.pending().length, 1); assert.equal(notes.length, 1);
    const job = d.pending()[0]; assert.equal(job.document, 'Trabalho.pdf'); assert.equal(job.pages, 3);
    // aprovação com cobrança pelo serviço Impressão
    const svc = store.state.services.find(s => s.name === 'Impressão'); let sold = null;
    const out = d.decide({key: job.key, action: 'approve', charge: true, serviceId: svc.id, qty: 3, paymentMethod: 'pix'}, 'admin', sale => (sold = sale, require('../shop').sell(store, sale, 'admin')));
    assert.deepEqual(sold.items, [{kind: 'service', id: svc.id, qty: 3}]); assert.equal(out.sale.totalCents, 3 * svc.priceCents);
    assert.throws(() => d.decide({key: job.key, action: 'reject'}, 'admin'), /já foi decidida/);
    r = d.receive(pc, {printVersion: 1, printJobs: [{id: 'HP|5|1', printer: 'HP', document: 'Trabalho.pdf', pages: 3}]});
    assert.deepEqual(r.printControl.decisions, [{id: 'HP|5|1', action: 'approve'}]);
    d.receive(pc, {printVersion: 1, printJobs: []}); assert.equal(d.pending().length, 0);
    // recusa e cancelamento pelo próprio PC
    d.receive(pc, {printVersion: 1, printJobs: [{id: 'HP|6|2', printer: 'HP', document: 'Fotos.docx', pages: 40}, {id: 'HP|7|3', printer: 'HP', document: 'X'}]});
    d.decide({key: d.pending()[0].key, action: 'reject'}, 'admin');
    assert.deepEqual(d.receive(pc, {printVersion: 1, printJobs: [{id: 'HP|6|2'}]}).printControl.decisions, [{id: 'HP|6|2', action: 'reject'}]);
    const h = d.history(); assert.deepEqual(h.map(x => x.result), ['cancelada no PC', 'recusada', 'aprovada']); assert.equal(h[2].cents, 3 * svc.priceCents);
    // ligar: só os desligados; PC sem MAC avisa
    const res = await d.wake({scope: 'all'}, 'admin', () => false);
    assert.equal(res.success, 1); assert.equal(sent[0].mac, 'AABBCCDDEEFF');
    store.state.stations.push({id: '9', name: 'PC Novo', kind: 'computer', active: true});
    const r2 = await d.wake({scope: 'all'}, 'admin', id => id === pc.id); assert.equal(r2.skipped, 1); assert.equal(r2.failed, 1); assert.match(r2.results.find(x => x.name === 'PC Novo').message, /GameZoney Cliente atualizado/);
    // diskless: pré-configuração e conferência
    assert.throws(() => diskless.save(store, {serverIp: '999.1.1.1'}, 'admin'), /IP do servidor de imagem inválido/);
    diskless.save(store, {enabled: true, serverIp: '127.0.0.1', port: 9, stations: [pc.id, 'nao-existe'], image: 'Win11'}, 'admin');
    const st = await diskless.status(store); assert.deepEqual(st.config.stations, [pc.id]);
    assert.equal(st.checks.find(c => /respondendo/.test(c.name)).ok, false); assert.ok(st.checks.find(c => /Wake-on-LAN/.test(c.name)).ok);
  } finally { store.close(); fs.rmSync(dir, {recursive: true, force: true}); }
});

test('1.0.9: painel — aprovar e cobrar entra no caixa; ligar exige administrador', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-dev-api-')), sent = [];
  const inst = createServer({directory, noTimer: true, wakeSend: async n => sent.push(...n)});
  await new Promise(r => inst.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + inst.server.address().port; let cookie = '';
  t.after(async () => { await inst.close(); fs.rmSync(directory, {recursive: true, force: true}); });
  const call = async (url, body, status = 200) => { const r = await fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)}); const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; return text ? JSON.parse(text) : null; };
  await call('/api/setup', {name: 'Dono', username: 'admin', password: 'senha123'}); await call('/api/login', {username: 'admin', password: 'senha123'});
  await call('/api/prints/settings', {enabled: true});
  const S = inst.store.state, pc = S.stations.find(s => s.kind === 'computer');
  pc.network = {list: [{mac: '001122334455', ip: '', mask: ''}], at: Date.now()};
  // simula o PC informando um documento (mesma função que a rota /state do PC usa)
  let st = await call('/api/state'); assert.equal(st.printControl, true); assert.deepEqual(st.prints, []);
  assert.equal((await call('/api/pc/wake', {scope: 'one', stationId: pc.id})).success, 1); assert.equal(sent[0].mac, '001122334455');
  assert.match((await call('/api/diskless', {serverIp: 'x'}, 400)).error, /inválido/);
});
