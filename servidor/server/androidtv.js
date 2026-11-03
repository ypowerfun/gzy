// GameZoney 1.0.1 — controle de TVs Android / Google TV pela rede local (ADB por TCP, porta 5555).
// Mesmo uso do controle VIDAA (vidaa.js): pair(), pin(), hdmi(), home(), openClientPage(url), disconnect().
// Implementação própria do protocolo ADB (mensagens CNXN/AUTH/OPEN/OKAY/WRTE/CLSE), sem programas externos.
// Na TV: Configurações > Preferências do dispositivo > Sobre > clicar 7x em "Build" (vira desenvolvedor) e
// em Opções do desenvolvedor ligar "Depuração USB" e "Depuração pela rede"/"Depuração ADB". No primeiro
// pareamento a TV pergunta "Permitir depuração?" — marcar "Sempre permitir deste computador" e confirmar.
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');

const A = { CNXN: 0x4e584e43, AUTH: 0x48545541, OPEN: 0x4e45504f, OKAY: 0x59414b4f, CLSE: 0x45534c43, WRTE: 0x45545257, STLS: 0x534c5453 };
const VERSION = 0x01000001, MAXDATA = 256 * 1024;
const AUTH_TOKEN = 1, AUTH_SIGNATURE = 2, AUTH_RSAPUBLICKEY = 3;
const SHA1_PREFIX = Buffer.from('3021300906052b0e03021a05000414', 'hex');
const PORT = 5555;

function message(command, arg0, arg1, data = Buffer.alloc(0)) {
  const head = Buffer.alloc(24);
  let sum = 0; for (const b of data) sum = (sum + b) >>> 0;
  head.writeUInt32LE(command, 0); head.writeUInt32LE(arg0 >>> 0, 4); head.writeUInt32LE(arg1 >>> 0, 8);
  head.writeUInt32LE(data.length, 12); head.writeUInt32LE(sum, 16); head.writeUInt32LE((command ^ 0xffffffff) >>> 0, 20);
  return Buffer.concat([head, data]);
}

// Chave pública no formato que o adbd do Android aceita (estrutura RSAPublicKey em base64 + nome).
function androidPublicKey(publicKey, name = 'gamezoney@servidor') {
  const jwk = publicKey.export({ format: 'jwk' });
  const n = BigInt('0x' + Buffer.from(jwk.n, 'base64url').toString('hex'));
  const e = Number(BigInt('0x' + Buffer.from(jwk.e, 'base64url').toString('hex')));
  const words = 64, out = Buffer.alloc(4 + 4 + words * 4 * 2 + 4);
  const r32 = 1n << 32n, n0 = n % r32;
  let inv = 1n; for (let i = 0; i < 32; i++) inv = (inv * (2n - n0 * inv)) % r32; // inverso de n0 mod 2^32
  const n0inv = (r32 - inv) % r32;
  const rr = (1n << 4096n) % n;
  out.writeUInt32LE(words, 0); out.writeUInt32LE(Number(n0inv), 4);
  for (let i = 0, x = n, y = rr; i < words; i++, x >>= 32n, y >>= 32n) {
    out.writeUInt32LE(Number(x % r32), 8 + i * 4);
    out.writeUInt32LE(Number(y % r32), 8 + words * 4 + i * 4);
  }
  out.writeUInt32LE(e, 8 + words * 8);
  return Buffer.from(out.toString('base64') + ' ' + name + '\0');
}

// Uma conversa ADB: conecta, autentica e roda um comando "shell:" devolvendo a saída.
function adbShell({ host, port = PORT, key, publicKeyData, command, timeout = 8000, waitApproval = 0, onApprovalAsked = () => {} }) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let buffer = Buffer.alloc(0), signed = false, sentKey = false, done = false, output = [];
    const localId = 1;
    let timer = setTimeout(() => finish(new Error('A TV Android não respondeu a tempo.')), timeout);
    function finish(error, value) {
      if (done) return; done = true; clearTimeout(timer);
      // end() entrega o que ainda está na fila (ex.: a chave pública) antes de fechar.
      socket.end(); setTimeout(() => socket.destroy(), 1000).unref();
      error ? reject(error) : resolve(value);
    }
    socket.setNoDelay(true);
    socket.on('connect', () => socket.write(message(A.CNXN, VERSION, MAXDATA, Buffer.from('host::\0'))));
    socket.on('error', e => finish(new Error(e.code === 'ECONNREFUSED'
      ? 'A TV recusou a conexão na porta 5555. Ligue a Depuração ADB/pela rede nas Opções do desenvolvedor da TV.'
      : e.code === 'EHOSTUNREACH' || e.code === 'ETIMEDOUT' || e.code === 'ENETUNREACH'
        ? 'TV Android fora da rede. Confira se está ligada e o IP.' : 'Falha de conexão com a TV Android: ' + e.message)));
    socket.on('close', () => finish(new Error('A TV Android encerrou a conexão.')));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 24) {
        const length = buffer.readUInt32LE(12);
        if (length > MAXDATA * 4) return finish(new Error('Resposta inválida da TV Android.'));
        if (buffer.length < 24 + length) return;
        const cmd = buffer.readUInt32LE(0), arg0 = buffer.readUInt32LE(4), arg1 = buffer.readUInt32LE(8);
        const data = buffer.subarray(24, 24 + length);
        buffer = buffer.subarray(24 + length);
        handle(cmd, arg0, arg1, data);
        if (done) return;
      }
    });
    function handle(cmd, arg0, arg1, data) {
      if (cmd === A.AUTH && arg0 === AUTH_TOKEN) {
        if (!signed) {
          signed = true;
          const signature = crypto.privateEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.concat([SHA1_PREFIX, data]));
          return socket.write(message(A.AUTH, AUTH_SIGNATURE, 0, signature));
        }
        if (!sentKey) {
          // A TV ainda não conhece este servidor: envia a chave e a TV mostra "Permitir depuração?".
          sentKey = true;
          socket.write(message(A.AUTH, AUTH_RSAPUBLICKEY, 0, publicKeyData));
          if (!waitApproval) return finish(Object.assign(new Error('A TV Android ainda não autorizou este servidor. Use "Parear TV" e aceite o pedido na tela da TV.'), { code: 'NOT_AUTHORIZED' }));
          onApprovalAsked();
          clearTimeout(timer);
          timer = setTimeout(() => finish(Object.assign(new Error('O pedido "Permitir depuração" não foi aceito na TV a tempo. Use "Parear TV" de novo.'), { code: 'NOT_AUTHORIZED' })), waitApproval);
        }
        return;
      }
      if (cmd === A.STLS) return finish(new Error('Esta TV só aceita "Depuração sem fio" com código (Android 11+). Ative a "Depuração ADB" pela rede (porta 5555) nas Opções do desenvolvedor.'));
      if (cmd === A.CNXN) {
        clearTimeout(timer);
        timer = setTimeout(() => finish(new Error('A TV Android não concluiu o comando a tempo.')), timeout);
        if (command == null) return finish(null, '');
        return socket.write(message(A.OPEN, localId, 0, Buffer.from('shell:' + command + '\0')));
      }
      if (cmd === A.OKAY) return;
      if (cmd === A.WRTE) { output.push(Buffer.from(data)); return socket.write(message(A.OKAY, localId, arg0)); }
      if (cmd === A.CLSE) { socket.write(message(A.CLSE, localId, arg0)); return finish(null, Buffer.concat(output).toString('utf8')); }
    }
  });
}

const quote = value => "'" + String(value).replace(/'/g, "'\\''") + "'";

class AndroidTv {
  constructor(tv, report, directory = path.join(__dirname, 'dados')) {
    this.tv = tv;
    this.report = report;
    fs.mkdirSync(directory, { recursive: true });
    this.directory = directory;
    this.shell = adbShell;
  }
  status(message) { this.report(this.tv.id, message); }
  // Uma chave RSA para o servidor inteiro (como o adbkey do Android), guardada na pasta de pareamento.
  keys() {
    if (this.cached) return this.cached;
    const file = path.join(this.directory, 'androidtv-adbkey.pem');
    let key;
    if (fs.existsSync(file)) key = crypto.createPrivateKey(fs.readFileSync(file, 'utf8'));
    else {
      key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 65537 }).privateKey;
      fs.writeFileSync(file + '.tmp', key.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
      fs.renameSync(file + '.tmp', file);
    }
    this.cached = { key, publicKeyData: androidPublicKey(crypto.createPublicKey(key)) };
    return this.cached;
  }
  host() {
    if (!this.tv.ipTV) throw new Error('Informe o IP da TV Android.');
    return this.tv.ipTV;
  }
  run(command, extra = {}) {
    return this.shell({ host: this.host(), port: this.tv.port || PORT, ...this.keys(), command, ...extra });
  }
  disconnect() { /* cada comando abre e fecha a própria conexão */ }
  async pair() {
    const host = this.host();
    this.status('Conectando à TV Android ' + host + '...');
    let asked = false;
    const result = this.run(null, { waitApproval: 90000, onApprovalAsked: () => { asked = true; this.status('Na TV: aceite "Permitir depuração?" (marque "Sempre permitir deste computador").'); } });
    // Responde logo ao painel; a confirmação na TV pode levar até 90 s e é informada no status da estação.
    const quick = await Promise.race([result.then(() => 'ok', e => e), new Promise(r => setTimeout(() => r('waiting'), 4000))]);
    if (quick === 'ok') return this.status('TV Android pareada e pronta.');
    if (quick instanceof Error) { this.status(quick.message); throw quick; }
    if (!asked) this.status('Aguardando a TV Android responder...');
    result.then(() => this.status('TV Android pareada e pronta.'), e => this.status(e.message));
  }
  async pin() {
    throw new Error('TV Android não usa PIN: use "Parear TV" e aceite o pedido "Permitir depuração" na tela da TV.');
  }
  async hdmi() {
    const hdmi = Number(this.tv.hdmi || 1);
    if (!(hdmi >= 1 && hdmi <= 4)) throw new Error('HDMI inválido.');
    // KEYCODE_WAKEUP (224) liga a tela; KEYCODE_TV_INPUT_HDMI_1..4 = 243..246.
    await this.run(`input keyevent 224; input keyevent ${242 + hdmi}`);
    this.status('Troca para HDMI ' + hdmi + ' enviada. Confira a imagem na TV.');
  }
  async home() {
    await this.run('input keyevent 224; input keyevent 3');
    this.status('Comando HOME enviado. Confira a tela da TV.');
  }
  async openClientPage(address) {
    const url = new URL(address);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A tela do cliente precisa de um endereço HTTP ou HTTPS.');
    const out = await this.run(`input keyevent 224; am start -a android.intent.action.VIEW -d ${quote(url.href)}`);
    if (/Error|No Activity found|unable to resolve/i.test(out)) {
      console.log(`[TV Android ${this.tv.id}] am start:`, out.slice(0, 2000));
      throw new Error('A TV Android não tem navegador para abrir a página do cliente. Instale um navegador (ex.: Chrome/TV Bro) na TV.');
    }
    this.status('Abertura de cliente.html solicitada ao navegador da TV Android.');
  }
}

AndroidTv.adbShell = adbShell;
AndroidTv.androidPublicKey = androidPublicKey;
AndroidTv.message = message;
AndroidTv.A = A;
module.exports = AndroidTv;
