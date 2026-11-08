'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.0.6 (etapa 3): Configuração › Atualização do sistema › Verificar atualização.
//  1. Pergunta ao gamezoney.com se há versão nova. A resposta traz um MANIFESTO ASSINADO (Ed25519, chave pública
//     embutida em license.js) com versão, nome, tamanho e SHA-256 do instalador. Manifesto inválido = ignorado.
//  2. Baixar: só com plano ativo (o site dá um link de 30 min deste computador). O arquivo vai para
//     %LOCALAPPDATA%\GameZoney\updates (fora da pasta de dados, fora dos backups) e o SHA-256 é conferido; se não bater
//     com o manifesto assinado, o arquivo é apagado e nada é instalado.
//  3. Instalar: confere o SHA-256 de novo, faz um BACKUP COMPLETO (se falhar, não instala), fecha o servidor do jeito
//     normal (código 75: o GameZoney.exe fecha sem aviso de erro) e o update-helper.ps1 espera fechar, confere o SHA-256
//     outra vez, roda o instalador (o Windows pede a permissão de administrador) e abre o GameZoney de novo. Se a
//     permissão for negada ou algo falhar, abre a versão antiga. Os dados não são tocados pelo instalador.
// 1.1.3: o passo 3 mudou. O script escondido do PowerShell (update-helper.ps1) às vezes não chegava a rodar (o servidor fechava
//     e nada abria). Agora "Instalar" confere o SHA-256, faz o backup e grava pending-update.txt na pasta de atualizações; o
//     painel mostra "É preciso encerrar o servidor para instalar" com o botão Encerrar servidor e instalar. Quem detecta o
//     encerramento é o próprio GameZoney.exe (qualquer encerramento: botão do painel ou ícone ao lado do relógio): ele confere
//     o SHA-256 outra vez e abre o instalador (janela normal + permissão de administrador). No fim do instalador, "Abrir o
//     GameZoney" abre o servidor novo. Na abertura da versão nova, o pedido pendente é apagado.
const crypto = require('node:crypto'), fs = require('node:fs'), fsp = require('node:fs/promises'), path = require('node:path');

// só o instalador do SERVIDOR: o instalador único em modo silencioso poderia instalar também o Cliente (que trava o PC) na recepção
const NAME_RE = /^GameZoney-Servidor-(\d+\.\d+\.\d+)-Setup\.exe$/;
const MAX_SIZE = 800 * 1024 * 1024;
const SITE = () => (process.env.GZ_SITE_URL || 'https://gamezoney.com').replace(/\/+$/, '');
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
const fail = m => { throw new Error(m); };

function readManifest(token, publicKey) {
  try {
    const [body, sig] = String(token || '').split('.'); if (!body || !sig) return null;
    if (!crypto.verify(null, Buffer.from(body, 'base64url'), publicKey, Buffer.from(sig, 'base64url'))) return null;
    const m = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const v = NAME_RE.exec(m.file || '');
    if (m.v !== 1 || m.kind !== 'update' || m.product !== 'servidor' || !v || (v[1] || v[2]) !== m.version || !/^[a-f0-9]{64}$/.test(m.sha256 || '') || !(m.size > 0 && m.size <= MAX_SIZE)) return null;
    return m;
  } catch { return null; }
}
const fileSha = file => new Promise((ok, err) => { const h = crypto.createHash('sha256'); fs.createReadStream(file).on('data', c => h.update(c)).on('error', err).on('end', () => ok(h.digest('hex'))); });

module.exports = function updater(store, lic, options = {}) {
  const version = options.version, dir = options.dir, appDir = options.appDir || __dirname, publicKey = options.publicKey;
  const fetchImpl = options.fetch || ((...a) => fetch(...a)), platform = options.platform || process.platform;
  let st = {status: 'idle', current: version, checkedAt: 0, error: ''}, manifest = null, job = null;
  const PENDING = path.join(dir, 'pending-update.txt');
  // pedido pendente da abertura anterior: já instalado (versão igual/menor) = apaga; senão continua esperando o encerramento
  try {
    const [tag, pv, pf, ps] = fs.readFileSync(PENDING, 'utf8').split(/\r?\n/);
    if (tag !== 'GZUPDATE1' || !NAME_RE.test(pf || '') || cmp(pv, version) <= 0) {
      fs.rmSync(PENDING, {force: true});
      if (NAME_RE.test(pf || '')) fs.rmSync(path.join(dir, pf), {force: true});
      if (tag === 'GZUPDATE1' && cmp(pv, version) === 0) store.log('sistema', 'atualizacao', `Atualização ${pv} instalada`);
    } else if (fs.existsSync(path.join(dir, pf))) { manifest = {version: pv, file: pf, sha256: ps}; st = {...st, status: 'waiting', available: {version: pv, notes: '', size: fs.statSync(path.join(dir, pf)).size, canDownload: true}}; }
    else fs.rmSync(PENDING, {force: true});
  } catch {}
  const status = () => ({...st, current: version});
  const set = patch => { st = {...st, ...patch}; return status(); };

  async function check() {
    if (['downloading', 'installing', 'waiting'].includes(st.status)) return status();
    set({status: 'checking', error: ''});
    let r, data;
    try {
      r = await fetchImpl(SITE() + '/api/update/check', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({installId: store.state.runtime.installId, version, token: store.state.license.planToken || ''})});
      data = await r.json().catch(() => ({}));
    } catch { return set({status: 'error', error: 'Sem conexão com gamezoney.com. Confira a internet deste computador e tente de novo.', checkedAt: Date.now()}); }
    if (!r.ok) return set({status: 'error', error: data.error || 'gamezoney.com não respondeu (HTTP ' + r.status + ').', checkedAt: Date.now()});
    if (!data.available) { manifest = null; return set({status: 'latest', latest: data.latest || version, checkedAt: Date.now(), available: null}); }
    const m = readManifest(data.manifest, publicKey);
    if (!m || m.version !== data.version || cmp(m.version, version) <= 0) { manifest = null; return set({status: 'error', error: 'Resposta de atualização inválida (assinatura não confere). Nada foi baixado.', checkedAt: Date.now()}); }
    manifest = {...m, download: data.download || null, downloadsUrl: data.downloadsUrl || SITE() + '/conta#downloads'};
    const file = path.join(dir, m.file), ready = fs.existsSync(file) && (await fileSha(file).catch(() => '')) === m.sha256;
    return set({status: ready ? 'ready' : 'available', checkedAt: Date.now(), available: {version: m.version, notes: m.notes || '', size: m.size, canDownload: !!data.download, downloadsUrl: manifest.downloadsUrl}});
  }

  function download() {
    if (!manifest) fail('Clique em Verificar atualização primeiro.');
    if (!manifest.download) fail('O download automático faz parte do plano. Entre com a sua conta gamezoney.com (com plano ativo) ou baixe o instalador em gamezoney.com › Minha conta › Downloads.');
    if (st.status === 'downloading') return status();
    const m = manifest; set({status: 'downloading', progress: 0, error: ''});
    job = (async () => {
      const file = path.join(dir, m.file), partial = file + '.partial';
      try {
        await fsp.mkdir(dir, {recursive: true});
        const r = await fetchImpl(SITE() + m.download, {signal: AbortSignal.timeout(30 * 60000)});
        if (!r.ok || !r.body) fail('gamezoney.com recusou o download (HTTP ' + r.status + ').');
        const h = crypto.createHash('sha256'), out = fs.createWriteStream(partial); let got = 0;
        for await (const chunk of r.body) {
          got += chunk.length; if (got > m.size) { out.destroy(); fail('O arquivo baixado é maior do que o informado. Download cancelado.'); }
          h.update(chunk); if (!out.write(chunk)) await new Promise(ok => out.once('drain', ok)); st.progress = Math.floor(got * 100 / m.size);
        }
        await new Promise((ok, err) => out.end(e => e ? err(e) : ok()));
        if (got !== m.size || h.digest('hex') !== m.sha256) fail('O arquivo baixado não confere com a assinatura da GameZoney (pode ter sido alterado). Ele foi apagado e nada foi instalado.');
        await fsp.rename(partial, file);
        // deixa só o instalador novo na pasta
        for (const f of await fsp.readdir(dir)) if (f !== m.file && /\.exe(\.partial)?$/i.test(f)) await fsp.rm(path.join(dir, f), {force: true}).catch(() => {});
        store.log('sistema', 'atualizacao', `Atualização ${m.version} baixada e conferida (SHA-256 ${m.sha256.slice(0, 12)}…)`);
        set({status: 'ready', progress: 100});
      } catch (e) { await fsp.rm(partial, {force: true}).catch(() => {}); set({status: 'error', error: e.message}); }
      finally { job = null; }
    })();
    return status();
  }

  async function install(actor) {
    if (!manifest || st.status !== 'ready') fail('Baixe a atualização antes de instalar.');
    if (platform !== 'win32') fail('A instalação automática funciona só no Windows.');
    const m = manifest, file = path.join(dir, m.file);
    if ((await fileSha(file).catch(() => '')) !== m.sha256) { await fsp.rm(file, {force: true}).catch(() => {}); set({status: 'available'}); fail('O instalador baixado foi alterado neste computador. Ele foi apagado; baixe de novo.'); }
    set({status: 'installing', error: '', step: 'backup'});
    try { if (options.backups) { options.backups.start(actor); await options.backups.wait(); } }
    catch (e) { set({status: 'ready', step: ''}); fail('Não foi possível fazer o backup antes de atualizar: ' + e.message + ' A atualização não foi instalada.'); }
    // 1.1.3: grava o pedido; o GameZoney.exe abre o instalador quando o servidor for encerrado
    try { await fsp.writeFile(PENDING, ['GZUPDATE1', m.version, m.file, m.sha256, ''].join('\r\n')); }
    catch (e) { set({status: 'ready', step: ''}); fail('Não foi possível preparar a instalação: ' + e.message); }
    store.change(actor, 'atualizacao', `Atualização ${m.version} pronta para instalar (backup feito): aguardando o servidor ser encerrado`, () => {});
    return set({status: 'waiting', step: ''});
  }
  // botão "Encerrar servidor e instalar": fecha com o código 75 (o GameZoney.exe fecha sem aviso de erro e abre o instalador)
  function closeNow(actor) {
    if (st.status !== 'waiting' || !fs.existsSync(PENDING)) fail('Clique em Instalar agora primeiro.');
    store.change(actor, 'atualizacao', `Servidor encerrado para instalar a atualização ${manifest?.version || ''}`, () => {});
    set({step: 'closing'});
    if (options.onExit) setTimeout(() => options.onExit(), 1500);
    return status();
  }
  function cancel(actor) {
    if (st.status !== 'waiting') return status();
    fs.rmSync(PENDING, {force: true});
    store.change(actor, 'atualizacao', `Instalação da atualização ${manifest?.version || ''} cancelada (o arquivo baixado continua guardado)`, () => {});
    return set({status: fs.existsSync(path.join(dir, manifest?.file || '-')) ? 'ready' : 'idle', step: ''});
  }
  return {status, check, download, install, closeNow, cancel, pendingFile: PENDING, readManifest: t => readManifest(t, publicKey), wait: () => job || Promise.resolve()};
};
module.exports.readManifest = readManifest;
module.exports.cmp = cmp;
