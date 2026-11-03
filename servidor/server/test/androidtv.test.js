// GameZoney 1.0.1: controle de TV Android (ADB por TCP) contra uma TV falsa que fala o protocolo de verdade:
// confere a assinatura RSA do token, pede a chave pública quando o servidor ainda não é autorizado e
// devolve a saída dos comandos "shell:".
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const AndroidTv = require('../androidtv');
const { A, message } = AndroidTv;

const SHA1_PREFIX = Buffer.from('3021300906052b0e03021a05000414', 'hex');

// Converte a chave no formato do Android de volta para uma chave RSA (como o adbd faz).
function keyFromAndroid(data) {
  const raw = Buffer.from(data.toString('utf8').split(' ')[0], 'base64');
  const words = raw.readUInt32LE(0);
  let n = 0n;
  for (let i = words - 1; i >= 0; i--) n = (n << 32n) | BigInt(raw.readUInt32LE(8 + i * 4));
  const e = raw.readUInt32LE(8 + words * 8);
  const hex = n.toString(16);
  return crypto.createPublicKey({ key: { kty: 'RSA', n: Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex').toString('base64url'), e: Buffer.from([e >>> 16 & 255, e >>> 8 & 255, e & 255]).toString('base64url') }, format: 'jwk' });
}

function fakeTv({ approve = true, reply = cmd => 'Starting: Intent { ' + cmd + ' }\n' } = {}) {
  const tv = { commands: [], keyOffers: 0, trusted: [] };
  tv.server = net.createServer(socket => {
    let buffer = Buffer.alloc(0), token = crypto.randomBytes(20);
    const send = (...m) => socket.write(message(...m));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 24) {
        const length = buffer.readUInt32LE(12);
        if (buffer.length < 24 + length) return;
        const cmd = buffer.readUInt32LE(0), arg0 = buffer.readUInt32LE(4), arg1 = buffer.readUInt32LE(8);
        const data = buffer.subarray(24, 24 + length);
        let sum = 0; for (const b of data) sum += b;
        assert.equal(buffer.readUInt32LE(16), sum >>> 0, 'checksum');
        assert.equal(buffer.readUInt32LE(20), (cmd ^ 0xffffffff) >>> 0, 'magic');
        buffer = buffer.subarray(24 + length);
        if (cmd === A.CNXN) send(A.AUTH, 1, 0, token);
        else if (cmd === A.AUTH && arg0 === 2) {
          const ok = tv.trusted.some(key => { try { return crypto.publicDecrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, data).equals(Buffer.concat([SHA1_PREFIX, token])); } catch { return false; } });
          if (ok) send(A.CNXN, 0x01000001, 4096, Buffer.from('device::ro.product.name=tv;\0'));
          else { token = crypto.randomBytes(20); send(A.AUTH, 1, 0, token); }
        } else if (cmd === A.AUTH && arg0 === 3) {
          tv.keyOffers++;
          assert.match(data.toString('utf8'), / gamezoney@servidor\0$/);
          if (approve) { tv.trusted.push(keyFromAndroid(data)); setTimeout(() => send(A.CNXN, 0x01000001, 4096, Buffer.from('device::\0')), 50); }
        } else if (cmd === A.OPEN) {
          const shell = data.toString('utf8').replace(/\0$/, '');
          assert.match(shell, /^shell:/);
          tv.commands.push(shell.slice(6));
          send(A.OKAY, 77, arg0);
          send(A.WRTE, 77, arg0, Buffer.from(reply(shell.slice(6))));
        } else if (cmd === A.OKAY && arg1 === 77) send(A.CLSE, 77, arg0);
      }
    });
    socket.on('error', () => {});
  });
  return new Promise(resolve => tv.server.listen(0, '127.0.0.1', () => { tv.port = tv.server.address().port; resolve(tv); }));
}

function makeTv(port, directory, reports = []) {
  return new AndroidTv({ id: '7', ipTV: '127.0.0.1', port, hdmi: 3 }, (id, text) => reports.push(text), directory);
}

test('TV Android: pareia (TV aceita a chave), troca HDMI, abre a página e reaproveita a chave salva', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-atv-'));
  const tv = await fakeTv();
  try {
    const reports = [];
    const control = makeTv(tv.port, dir, reports);
    await assert.rejects(control.hdmi(), /ainda não autorizou/);
    await new Promise(r => setTimeout(r, 150)); // a TV recebe a chave logo depois que o servidor desiste
    assert.equal(tv.keyOffers, 1);
    tv.trusted = [];
    await control.pair();
    await new Promise(r => setTimeout(r, 200));
    assert.match(reports.at(-1), /pareada e pronta/);
    await control.hdmi();
    assert.equal(tv.commands.at(-1), 'input keyevent 224; input keyevent 245');
    await control.openClientPage("http://192.168.1.100:3000/cliente.html?session=ab'c;reboot");
    assert.equal(tv.commands.at(-1), "input keyevent 224; am start -a android.intent.action.VIEW -d 'http://192.168.1.100:3000/cliente.html?session=ab%27c;reboot'"); // fica entre aspas: nada vira comando
    await control.home();
    assert.equal(tv.commands.at(-1), 'input keyevent 224; input keyevent 3');
    await assert.rejects(control.pin('1234'), /não usa PIN/);
    assert.ok(fs.existsSync(path.join(dir, 'androidtv-adbkey.pem')));
    // Outro objeto (ex.: servidor reiniciado) usa a mesma chave: a TV já confia, sem pedir de novo.
    const offers = tv.keyOffers;
    await makeTv(tv.port, dir).hdmi();
    assert.equal(tv.keyOffers, offers);
  } finally { tv.server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('TV Android: sem navegador e porta fechada viram mensagens claras', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-atv-'));
  const tv = await fakeTv({ reply: () => 'Error: Activity not started, unable to resolve Intent\n' });
  try {
    const control = makeTv(tv.port, dir);
    await control.pair();
    await new Promise(r => setTimeout(r, 200));
    await assert.rejects(control.openClientPage('http://192.168.1.100:3000/cliente.html'), /não tem navegador/);
    await assert.rejects(control.openClientPage('file:///etc/passwd'), /HTTP ou HTTPS/);
  } finally { tv.server.close(); }
  const closed = makeTv(tv.port, dir);
  await assert.rejects(closed.hdmi(), /recusou a conexão na porta 5555|Falha de conexão/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Painel: estação com "Sistema da TV" Android usa o controle Android; VIDAA continua como antes', async t => {
  const { createServer } = require('../server');
  const used = [];
  class FakeVidaa { constructor(tv) { this.tv = tv } async hdmi() { used.push(['vidaa', this.tv.id]) } disconnect() {} }
  class FakeAndroid { constructor(tv) { this.tv = tv } async hdmi() { used.push(['android', this.tv.id, this.tv.ipTV, this.tv.hdmi]) } async pair() { used.push(['android-pair']) } disconnect() {} }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-atv-api-'));
  const app = createServer({ directory: dir, Vidaa: FakeVidaa, AndroidTv: FakeAndroid, noTimer: true });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + app.server.address().port; let cookie = '';
  async function call(url, body, status = 200) { const r = await fetch(base + '/api' + url, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) }); assert.equal(r.status, status, await r.clone().text()); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; return r.json(); }
  await call('/setup', { username: 'admin', password: 'password123' }); await call('/login', { username: 'admin', password: 'password123' });
  await call('/hdmi', { stationId: '1' });
  const s = await call('/stations', { id: '2', name: 'TV 2 • Android', kind: 'tv', ip: '192.168.1.120', hdmi: 2, tvType: 'android' });
  assert.equal(s.tvType, 'android');
  await call('/hdmi', { stationId: '2' }); await call('/pair', { stationId: '2' });
  assert.deepEqual(used, [['vidaa', '1'], ['android', '2', '192.168.1.120', 2], ['android-pair']]);
  await call('/pairing/import', { stationId: '2', data: { uuid: 'aa:bb:cc:dd:ee:ff' } }, 400);
  const v = await call('/stations', { id: '2', name: 'TV 2', kind: 'tv', ip: '192.168.1.120', hdmi: 2, tvType: 'qualquer' });
  assert.equal(v.tvType, 'vidaa');
});
