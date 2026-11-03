// Protocolo de referência: https://github.com/tombabolewski/vidaa-control
// Implementação local para teste; a compatibilidade depende do firmware da TV.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');
const mqtt = require('mqtt');

class Vidaa {
  constructor(tv, report, directory = path.join(__dirname, 'dados')) {
    this.tv = tv;
    this.report = report;
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, `tv-${tv.id}.json`);
    this.saved = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
    this.brand = tv.brand || this.saved.detectedBrand || 'his';
    if (!/^[a-z0-9]{2,16}$/.test(this.brand)) throw new Error('Marca inválida em config.json.');
    if (!this.saved.uuid) {
      const bytes = crypto.randomBytes(6);
      bytes[0] = (bytes[0] | 2) & 254;
      this.saved.uuid = [...bytes].map(b => b.toString(16).padStart(2, '0')).join(':');
      this.save();
    }
    this.waiters = new Map();
  }
  save() {
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.saved, null, 2), { mode: 0o600 });
    fs.renameSync(this.file + '.tmp', this.file);
  }
  status(message) { this.report(this.tv.id, message); }
  credentials(profile) {
    if (this.saved.brand === this.brand && this.saved.profile === profile && this.saved.token && this.saved.expires > Date.now()) {
      return { clientId: this.saved.clientId, username: this.saved.username, password: this.saved.token };
    }
    const uuid = this.saved.uuid.toUpperCase();
    const md5 = value => crypto.createHash('md5').update(value).digest('hex').toUpperCase();
    const stamp = Math.floor(Date.now() / 1000);
    const salt = '38D65DC30F45109A369A86FCE866A85B';
    const clientId = `${uuid}$${this.brand}$${md5(`${salt}$${uuid}`).slice(0, 6)}_vidaacommon_001`;
    if (profile === 'static') return {
      clientId, username: 'hisenseservice', password: 'multimqttservice'
    };
    const sum = [...String(stamp)].reduce((a, b) => a + Number(b), 0) % 10;
    return {
      clientId,
      username: `${this.brand}$${profile === 'legacy' ? stamp : BigInt(stamp) ^ 0x569814772b03a968n}`,
      password: md5(`${stamp}$${md5(`${this.brand}${sum}${profile === 'modern' ? 'h!i@s#$v%i^d&a*a' : 'h*i&s%e!r^v0i1c9'}`).slice(0, 6)}`)
    };
  }
  topic(action, service = 'ui_service', category = 'actions') {
    return `/remoteapp/tv/${service}/${this.auth.clientId}/${category}/${action}`;
  }
  failWaiters(error) {
    for (const waiter of [...this.waiters.values()]) waiter.reject(error);
  }
  disconnect() {
    this.failWaiters(new Error('Conexão encerrada.'));
    if (this.client) this.client.end(true);
    this.client = null;
    this.ready = false;
    this.subscriptions = new Set();
  }
  subscribeTopic(client, topic) {
    if (this.subscriptions.has(topic)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Sem resposta ao assinar o canal ' + topic)), 2000);
      client.subscribe(topic, { qos: 0 }, (error, grants) => {
        clearTimeout(timer);
        if (client !== this.client) return reject(new Error('Conexão substituída durante assinatura.'));
        const granted = grants?.find(item => item.topic === topic);
        if (error || !granted || granted.qos >= 128) {
          console.log(`[TV ${this.tv.id}] Canal recusado: ${topic}; ${error?.message || 'sem autorização'}`);
          return reject(new Error('A TV recusou o canal ' + topic));
        }
        this.subscriptions.add(topic);
        console.log(`[TV ${this.tv.id}] Canal aceito: ${topic}`);
        resolve();
      });
    });
  }
  async detect() {
    this.metadataRead = true;
    try {
      const response = await fetch(`http://${this.tv.ipTV}:38400/MediaServer/rendererdevicedesc.xml`, {
        signal: AbortSignal.timeout(3000), redirect: 'error'
      });
      if (!response.ok) throw new Error('Descrição indisponível');
      const date = response.headers?.get('date');
      const tvDate = date ? Date.parse(date) : NaN;
      console.log(`[TV ${this.tv.id}] Relógio do computador (UTC): ${new Date().toISOString()}`);
      if (Number.isFinite(tvDate)) {
        console.log(`[TV ${this.tv.id}] Relógio HTTP da TV (UTC): ${new Date(tvDate).toISOString()}; diferença aproximada: ${Math.round((tvDate - Date.now()) / 1000)} segundos.`);
      }
      const xml = await response.text();
      const brandMatch = xml.match(/\bbrand\s*=\s*([a-z0-9]{2,16})(?=[\s<]|$)/i);
      if (brandMatch) {
        this.brand = brandMatch[1].toLowerCase();
        this.saved.detectedBrand = this.brand;
        this.save();
        this.status('Marca informada pela TV: ' + this.brand);
      }
      const match = xml.match(/transport_protocol(?:[=:]\s*|[^>]*>\s*)(\d+)/i);
      if (match) {
        const version = Number(match[1]);
        this.status('Protocolo informado pela TV: ' + version);
        this.detectedProfile = version >= 3290 ? 'modern' : version >= 3000 ? 'middle' : 'legacy';
        return this.detectedProfile;
      }
    } catch (_) {}
    this.status('Detecção indisponível. Tentando perfil moderno; selecione outro se a TV recusar.');
    return 'modern';
  }
  async connect(profile = this.saved.profile || this.profile || 'auto') {
    if (!this.metadataRead) await this.detect();
    if (profile === 'auto') {
      const primary = this.saved.profile || this.detectedProfile || 'modern';
      const profiles = [...new Set([primary, 'modern', 'middle', 'legacy', 'static'])];
      for (const candidate of profiles) {
        try { await this.connect(candidate); return; }
        catch (error) {
          if (![4, 5].includes(Number(error.code))) throw error;
          console.log(`[TV ${this.tv.id}] Perfil ${candidate} recusado pelo MQTT (código ${error.code}).`);
        }
      }
      throw new Error('A TV recusou todos os perfis de autenticação. Envie o log completo e informe se o app VIDAA do celular controla a TV.');
    }
    if (!['modern', 'middle', 'legacy', 'static'].includes(profile)) throw new Error('Perfil inválido.');
    if (this.client && this.ready && this.profile === profile) return;
    if (this.connecting) return this.connecting;
    this.disconnect();
    this.profile = profile;
    this.auth = this.credentials(profile);
    const certPath = process.env.TV_TLS_CERT || path.join(__dirname, 'certs', 'vidaa_client.pem');
    const keyPath = process.env.TV_TLS_KEY || path.join(__dirname, 'certs', 'vidaa_client.key');
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error('Certificado de cliente ausente. Consulte LEIA-ME.txt.');
    }
    const credentials = { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
    if (process.env.TV_TLS_PASSPHRASE) credentials.passphrase = process.env.TV_TLS_PASSPHRASE;
    tls.createSecureContext(credentials);
    this.status('Conectando à TV com marca ' + this.brand + ' e perfil ' + profile + '...');
    this.connecting = new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) { this.disconnect(); reject(error); }
        else { this.ready = true; resolve(); }
      };
      const timer = setTimeout(() => finish(new Error('A TV não concluiu a conexão em 8 segundos.')), 8000);
      let client;
      try {
        client = mqtt.connect(`mqtts://${this.tv.ipTV}:36669`, {
          ...credentials, ...this.auth, rejectUnauthorized: false,
          minVersion: 'TLSv1.2', reconnectPeriod: 0, connectTimeout: 7000, protocolVersion: 4
        });
      } catch (err) { finish(err); return; }
      this.client = client;
      client.on('error', err => {
        if (this.client !== client) return;
        this.status('Falha de conexão: ' + (err.code || '') + ' ' + err.message);
        this.failWaiters(err);
        finish(err);
      });
      client.on('close', () => {
        if (this.client !== client) return;
        this.ready = false;
        const error = new Error('A TV encerrou a conexão. Verifique o perfil e o pareamento.');
        this.failWaiters(error);
        finish(error);
      });
      client.on('message', (topic, buffer) => {
        if (this.client !== client) return;
        this.message(topic, buffer);
      });
      client.on('connect', async () => {
        const base = `/remoteapp/mobile/${this.auth.clientId}`;
        try {
          // O token chega pelo platform_service, não pelo ui_service.
          await this.subscribeTopic(client, `${base}/platform_service/data/tokenissuance`);
          for (const name of ['authentication', 'authenticationcode']) {
            try { await this.subscribeTopic(client, `${base}/ui_service/data/${name}`); }
            catch (error) {
              if (this.client !== client || settled) throw error;
              console.log(`[TV ${this.tv.id}] Aviso opcional indisponível: ${name}. O canal de token está ativo.`);
            }
          }
          if (settled || this.client !== client) return;
          finish();
          this.status('Autenticação MQTT aceita e canal de token ativo.');
        } catch (error) { finish(error); }
      });
    });
    try { await this.connecting; } finally { this.connecting = null; }
  }
  message(topic, buffer) {
    const name = topic.split('/').pop();
    let data = buffer.toString();
    try { data = JSON.parse(data); } catch (_) {}
    if (name === 'tokenissuance' && data && typeof data.accesstoken === 'string' && data.accesstoken) {
      Object.assign(this.saved, { token: data.accesstoken, clientId: this.auth.clientId,
        username: this.auth.username, profile: this.profile, brand: this.brand,
        expires: Date.now() + Number(data.accesstoken_duration_day || 1) * 86400000 });
      try { this.save(); this.status('Pareamento confirmado pela TV.'); }
      catch (error) { this.status('Pareamento recebido, mas não foi possível salvar: ' + error.message); }
    }
    if (name === 'authentication') this.status('A TV solicitou autenticação. Se aparecer um PIN, digite-o abaixo.');
    if (name === 'authenticationcode' && data && typeof data === 'object') {
      if (Number(data.result) === 1) {
        this.status('PIN aceito pela TV. Solicitando o token de pareamento.');
        if (this.waiters.has('tokenissuance') && !this.tokenRequested) {
          this.tokenRequested = true;
          this.publish('gettoken', { refreshtoken: '' }, 'platform_service', 'data')
            .catch(error => this.waiters.get('tokenissuance')?.reject(error));
        }
      }
      else if (data.result !== undefined) {
        const error = new Error('A TV não aceitou o PIN. Solicite um novo código.');
        this.status(error.message);
        this.waiters.get('tokenissuance')?.reject(error);
      }
    }
    if (name === 'authenticationcodetoast') this.status('A TV enviou um aviso de autenticação. Confira o PIN na tela.');
    if (name === 'authenticationcodeclose') this.status('A TV fechou a janela de PIN.');
    this.waiters.get(name)?.resolve(data);
  }
  publish(action, payload = '', service, category = 'actions') {
    return new Promise((resolve, reject) => {
      if (!this.ready || !this.client) return reject(new Error('TV desconectada. Use Parear TV.'));
      const timeout = setTimeout(() => reject(new Error('Tempo de envio esgotado.')), 5000);
      this.client.publish(this.topic(action, service, category), typeof payload === 'string' ? payload : JSON.stringify(payload),
        { qos: 0 }, error => { clearTimeout(timeout); error ? reject(error) : resolve(); });
    });
  }
  request(action, payload, response) {
    return new Promise((resolve, reject) => {
      if (this.waiters.has(response)) return reject(new Error('Já existe uma solicitação em andamento.'));
      const cleanup = () => { clearTimeout(timer); this.waiters.delete(response); };
      const waiter = { resolve: data => { cleanup(); resolve(data); }, reject: error => { cleanup(); reject(error); } };
      const timer = setTimeout(() => waiter.reject(new Error('A TV não confirmou a solicitação. Verifique o pareamento.')), 10000);
      this.waiters.set(response, waiter);
      this.publish(action, payload).catch(waiter.reject);
    });
  }
  async pair(profile) {
    this.disconnect();
    this.metadataRead = false;
    delete this.saved.token;
    delete this.saved.expires;
    // Detecção automática deve consultar novamente o protocolo mesmo após testes manuais.
    if (profile === 'auto') delete this.saved.profile;
    this.save();
    await this.connect(profile);
    await this.publish('vidaa_app_connect', { app_version: 2, connect_result: 0, device_type: 'Mobile App' });
    this.status('Pedido de pareamento enviado. Confira a tela da TV e digite o PIN, se solicitado.');
  }
  async pin(value) {
    if (!/^\d{4}$/.test(value)) throw new Error('Digite os 4 números do PIN.');
    this.tokenRequested = false;
    try {
      const data = await this.request('authenticationcode', { authNum: Number(value) }, 'tokenissuance');
      if (!data || !data.accesstoken) throw new Error('Resposta sem confirmação de pareamento.');
      // O token já foi recebido; uma falha ao fechar o diálogo não invalida o pareamento.
      try { await this.publish('authenticationcodeclose'); }
      catch (_) { this.status('Token recebido. Feche a janela de PIN na TV, se necessário.'); }
    } finally { this.tokenRequested = false; }
  }
  async hdmi() {
    await this.connect();
    await this.subscribeTopic(this.client, `/remoteapp/mobile/${this.auth.clientId}/ui_service/data/sourcelist`);
    const response = await this.request('sourcelist', '', 'sourcelist');
    const list = Array.isArray(response) ? response : response?.sourcelist || response?.sources || response?.list;
    if (!Array.isArray(list)) {
      console.log('[VIDAA] Resposta sourcelist:', JSON.stringify(response).slice(0, 4000));
      throw new Error('Lista de entradas não reconhecida. Envie o diagnóstico para adaptação.');
    }
    const hdmi = Number(this.tv.hdmi || 1);
    const source = list.find(item => new RegExp('^HDMI\\s*'+hdmi+'(?:\\D|$)','i').test(String(item.sourcename || item.name || item.sourceName || '')));
    const id = source?.sourceid ?? source?.id ?? source?.sourceId;
    if (id === undefined) {
      console.log('[VIDAA] Entradas:', JSON.stringify(list).slice(0, 4000));
      throw new Error('A TV não informou a entrada HDMI '+hdmi+'.');
    }
    await this.publish('changesource', { sourceid: String(id) });
    this.status('Troca para HDMI '+hdmi+' enviada. Confira a imagem na TV.');
  }
  async home() {
    await this.connect();
    await this.publish('sendkey', 'KEY_HOME', 'remote_service');
    this.status('Comando HOME enviado. Confira a tela da TV.');
  }
  async openClientPage(address) {
    const url = new URL(address);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A tela do cliente precisa de um endereço HTTP ou HTTPS.');
    await this.connect();
    const topic = `/remoteapp/mobile/${this.auth.clientId}/ui_service/data/applist`;
    await this.subscribeTopic(this.client, topic);
    const response = await this.request('applist', '', 'applist');
    const apps = Array.isArray(response) ? response : response?.applist || response?.apps || response?.list;
    if (!Array.isArray(apps)) throw new Error('Formato da lista de aplicativos não reconhecido.');
    const browser = apps.find(app => /browser|navegador|internet|navigator/i.test(String(app.name || app.appName || '')));
    if (!browser) {
      console.log(`[TV ${this.tv.id}] Aplicativos informados:`, JSON.stringify(apps.map(app => ({name:app.name || app.appName,appId:app.appId,urlType:app.urlType}))).slice(0, 5000));
      throw new Error('O navegador não apareceu na lista da TV. Envie a lista de aplicativos do terminal para adaptar a abertura da página.');
    }
    // Usa os metadados do navegador fornecidos pela própria TV. O suporte à URL
    // precisa ser confirmado no aparelho; conclusão do publish não comprova abertura.
    const payload = { ...browser, url: url.href };
    await this.publish('launchapp', payload);
    this.status('Abertura de cliente.html solicitada ao navegador. Aguardando o carregamento da página na TV.');
  }
}
module.exports = Vidaa;
