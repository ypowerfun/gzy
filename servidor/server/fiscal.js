'use strict';
// 1.3.0 (plano Pro): notas fiscais de SAÍDA pela Focus NFe (API v2, documentação oficial doc.focusnfe.com.br).
//  - NFC-e (POST /v2/nfce, síncrona): produtos vendidos no PDV.
//  - NFS-e (serviço: recargas/tempo de PC ou console e serviços/Corujão do PDV):
//      municipal  POST /v2/nfse  (assíncrona: processando_autorizacao → autorizado/erro_autorizacao)
//      nacional   POST /v2/nfsen (DPS do padrão nacional; assíncrona)
//  - Autenticação HTTP Basic: usuário = token da empresa (da arena), senha vazia.
// Cada arena contrata a Focus NFe e sobe o certificado A1 no painel da Focus; o GameZoney só guarda o token
// em state.secrets.focusToken (fora de settings: nunca vai ao painel, ao snapshot nem ao instalador).
// As notas entram numa fila (state.fiscalDocs). O envio acontece fora da fila de operações do painel, então a
// internet lenta/fora do ar nunca trava o caixa: a nota fica "pendente" e é reenviada sozinha.
const crypto = require('node:crypto');
const {id, fail, verify} = require('./store');
const BASE = {homologacao: 'https://homologacao.focusnfe.com.br', producao: 'https://api.focusnfe.com.br'};
const ENVS = Object.keys(BASE);
const PAY = {cash: '01', credit: '03', debit: '04', pix: '17'};
const KEEP = 5000;                       // notas guardadas no estado (as mais antigas saem da lista; os XMLs ficam na Focus)
const LOOKBACK = 3 * 86400000;           // vendas dos últimos 3 dias entram na fila automática
const RETRY = [15e3, 30e3, 60e3, 120e3, 300e3, 600e3, 1800e3];
const digits = v => String(v ?? '').replace(/\D/g, '');
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const reais = c => Math.round(c) / 100;

function cnpjOk(c) {
  c = digits(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = n => { let s = 0, w = n - 7; for (let i = 0; i < n; i++) { s += Number(c[i]) * w--; if (w < 2) w = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}
const cpfOk = c => { c = digits(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false; for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); if ((s * 10 % 11) % 10 !== Number(c[n])) return false; } return true; };

const DEFAULTS = () => ({
  enabled: false, env: 'homologacao', since: 0,
  cnpj: '', razao: '', ie: '', im: '', municipio: '', uf: '', regime: 'simples',
  nfce: {enabled: false, auto: true, natureza: 'VENDA AO CONSUMIDOR', cfop: '5102', ncm: '', cst: '102', origem: '0', unidade: 'UN', cardAs: '03'},
  nfse: {enabled: false, auto: true, mode: 'municipal', itemLista: '', codTribMun: '', cnae: '', aliquota: null, codTribNac: '', regimeEspecial: '', descricao: 'Locação de tempo de uso de computador/console', serieDps: 1, nextDps: 1, services: true, nbs: '', ibsCbsCst: '', ibsCbsClass: '', indOp: ''}
});

module.exports = function fiscal(store, options = {}) {
  const s = store.state;
  s.secrets ??= {};
  s.fiscalDocs ??= [];
  const cur = s.settings.fiscal || {}, d = DEFAULTS();
  s.settings.fiscal = {...d, ...cur, nfce: {...d.nfce, ...(cur.nfce || {})}, nfse: {...d.nfse, ...(cur.nfse || {})}};
  const cfg = () => s.settings.fiscal;
  const fetchImpl = options.fetch || globalThis.fetch;
  const base = () => options.base || BASE[cfg().env] || BASE.homologacao;
  const allowed = () => (typeof options.allowed === 'function' ? !!options.allowed() : true);
  const now = () => (options.now ? options.now() : Date.now());
  let running = false, timer = null;

  // ---------- data/hora local do servidor com o fuso (a Focus aceita até 5 min de diferença) ----------
  function iso(t) {
    const off = require('./netinfo').zoneOffset(s.settings.timeZone || 'UTC', t), sign = off < 0 ? '-' : '+', a = Math.abs(off);
    return new Date(t + off * 60000).toISOString().slice(0, 19) + sign + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
  }

  // ---------- configuração ----------
  function settings() {
    const c = cfg();
    return {...c, tokenSet: !!s.secrets.focusToken, allowed: allowed(), envs: ENVS, base: BASE[c.env]};
  }
  function save(input, actor) {
    const c = cfg(), n = JSON.parse(JSON.stringify(c)), b = input || {};
    const bool = (v, dflt) => (v === undefined ? dflt : v === true || v === 'on' || v === 'true' || v === 1);
    n.enabled = bool(b.enabled, c.enabled);
    if (n.enabled && !allowed()) fail('Notas fiscais (NFC-e e NFS-e): recurso do plano Pro. Entre com a sua conta gamezoney.com em Configuração › Licença.');
    if (b.env !== undefined) n.env = ENVS.includes(b.env) ? b.env : fail('Ambiente inválido.');
    if (b.cnpj !== undefined) n.cnpj = digits(b.cnpj);
    if (b.razao !== undefined) n.razao = str(b.razao, 120);
    if (b.ie !== undefined) n.ie = digits(b.ie).slice(0, 14);
    if (b.im !== undefined) n.im = str(b.im, 20).replace(/[^0-9A-Za-z./-]/g, '');
    if (b.municipio !== undefined) n.municipio = digits(b.municipio);
    if (b.uf !== undefined) n.uf = String(b.uf || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    if (b.regime !== undefined) n.regime = ['simples', 'mei', 'normal'].includes(b.regime) ? b.regime : fail('Regime tributário inválido.');
    const nc = b.nfce || {}, ns = b.nfse || {};
    n.nfce.enabled = bool(nc.enabled, c.nfce.enabled); n.nfce.auto = bool(nc.auto, c.nfce.auto);
    if (nc.natureza !== undefined) n.nfce.natureza = str(nc.natureza, 60) || 'VENDA AO CONSUMIDOR';
    if (nc.cfop !== undefined) n.nfce.cfop = digits(nc.cfop);
    if (nc.ncm !== undefined) n.nfce.ncm = digits(nc.ncm);
    if (nc.cst !== undefined) n.nfce.cst = digits(nc.cst);
    if (nc.origem !== undefined) n.nfce.origem = digits(nc.origem).slice(0, 1) || '0';
    if (nc.unidade !== undefined) n.nfce.unidade = str(nc.unidade, 6).toUpperCase() || 'UN';
    if (nc.cardAs !== undefined) n.nfce.cardAs = ['03', '04'].includes(String(nc.cardAs)) ? String(nc.cardAs) : '03';
    n.nfse.enabled = bool(ns.enabled, c.nfse.enabled); n.nfse.auto = bool(ns.auto, c.nfse.auto); n.nfse.services = bool(ns.services, c.nfse.services);
    if (ns.mode !== undefined) n.nfse.mode = ['municipal', 'nacional'].includes(ns.mode) ? ns.mode : fail('Padrão da NFS-e inválido.');
    if (ns.itemLista !== undefined) n.nfse.itemLista = str(ns.itemLista, 10).replace(/[^0-9.]/g, '');
    if (ns.codTribMun !== undefined) n.nfse.codTribMun = str(ns.codTribMun, 20).replace(/[^0-9A-Za-z.-]/g, '');
    if (ns.cnae !== undefined) n.nfse.cnae = digits(ns.cnae);
    if (ns.codTribNac !== undefined) n.nfse.codTribNac = digits(ns.codTribNac);
    if (ns.regimeEspecial !== undefined) n.nfse.regimeEspecial = /^[0-9]?$/.test(String(ns.regimeEspecial)) ? String(ns.regimeEspecial) : fail('Regime especial inválido.');
    if (ns.nbs !== undefined) n.nfse.nbs = digits(ns.nbs).slice(0, 9);
    if (ns.ibsCbsCst !== undefined) n.nfse.ibsCbsCst = digits(ns.ibsCbsCst).slice(0, 3);
    if (ns.ibsCbsClass !== undefined) n.nfse.ibsCbsClass = digits(ns.ibsCbsClass).slice(0, 6);
    if (ns.indOp !== undefined) n.nfse.indOp = digits(ns.indOp).slice(0, 6);
    if (ns.descricao !== undefined) n.nfse.descricao = str(ns.descricao, 900) || DEFAULTS().nfse.descricao;
    if (ns.aliquota !== undefined) { const a = String(ns.aliquota).trim().replace(',', '.'); n.nfse.aliquota = a === '' ? null : (Number.isFinite(Number(a)) && Number(a) >= 0 && Number(a) <= 100 ? Math.round(Number(a) * 10000) / 10000 : fail('Alíquota do ISS: informe de 0 a 100 (%).')); }
    if (ns.serieDps !== undefined) { const v = Number(ns.serieDps); n.nfse.serieDps = Number.isInteger(v) && v >= 1 && v <= 49999 ? v : fail('Série da DPS: de 1 a 49999.'); }
    if (ns.nextDps !== undefined) { const v = Number(ns.nextDps); n.nfse.nextDps = Number.isInteger(v) && v >= 1 && v < 1e15 ? Math.max(v, 1) : fail('Próximo número da DPS inválido.'); }
    if (n.enabled) {
      if (!cnpjOk(n.cnpj)) fail('Informe o CNPJ da arena (emitente), com 14 dígitos válidos.');
      if (!n.nfce.enabled && !n.nfse.enabled) fail('Ligue a NFC-e, a NFS-e ou as duas.');
      if (n.nfce.enabled) {
        if (!/^\d{4}$/.test(n.nfce.cfop)) fail('NFC-e: CFOP padrão com 4 dígitos (ex.: 5102).');
        if (!/^\d{2,3}$/.test(n.nfce.cst)) fail('NFC-e: CST/CSOSN do ICMS com 2 ou 3 dígitos (ex.: 102 no Simples Nacional).');
        if (n.nfce.ncm && !/^\d{8}$/.test(n.nfce.ncm)) fail('NFC-e: NCM padrão com 8 dígitos.');
      }
      if (n.nfse.enabled) {
        if (!/^\d{7}$/.test(n.municipio)) fail('NFS-e: informe o código IBGE do município da arena (7 dígitos).');
        if (n.nfse.mode === 'municipal') {
          if (!n.im) fail('NFS-e: informe a inscrição municipal da arena.');
          if (!n.nfse.itemLista) fail('NFS-e: informe o item da lista de serviços (LC 116), passado pelo contador.');
        } else {
          if (!/^\d{6}$/.test(n.nfse.codTribNac)) fail('NFS-e Nacional: informe o código de tributação nacional do ISSQN (6 dígitos), passado pelo contador.');
          if (!/^\d{3}$/.test(n.nfse.ibsCbsCst) || !/^\d{6}$/.test(n.nfse.ibsCbsClass)) fail('NFS-e Nacional (reforma tributária): informe o CST do IBS/CBS (3 dígitos) e a classificação tributária do IBS/CBS (6 dígitos), passados pelo contador.');
        }
      }
    }
    if (n.enabled && !c.enabled) n.since = now();      // só entram na fila as vendas feitas depois de ligar
    const tokenIn = typeof b.token === 'string' ? b.token.trim() : null;
    if (tokenIn !== null && tokenIn && !/^[A-Za-z0-9_-]{8,200}$/.test(tokenIn)) fail('Token da Focus NFe inválido (copie o token da empresa no painel da Focus).');
    if (n.enabled && !s.secrets.focusToken && !tokenIn) fail('Cole o token da Focus NFe da sua empresa.');
    return store.change(actor, 'fiscal', `Notas fiscais: ${n.enabled ? 'ligadas' : 'desligadas'} (${n.env === 'producao' ? 'produção' : 'homologação'}${n.nfce.enabled ? ', NFC-e' : ''}${n.nfse.enabled ? ', NFS-e ' + n.nfse.mode : ''})${tokenIn ? ' • token atualizado' : ''}`, () => {
      s.settings.fiscal = n;
      if (tokenIn) s.secrets.focusToken = tokenIn;
      if (b.removeToken === true) delete s.secrets.focusToken;
      return settings();
    });
  }

  // ---------- chamada à Focus ----------
  async function call(method, path, body) {
    const token = s.secrets.focusToken; if (!token) { const e = new Error('Token da Focus NFe não configurado.'); e.local = true; throw e; }
    let r;
    try {
      r = await fetchImpl(base() + path, {method, signal: AbortSignal.timeout(options.timeoutMs || 30000), headers: {'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Basic ' + Buffer.from(token + ':').toString('base64'), 'User-Agent': 'GameZoney-Servidor'}, body: body === undefined ? undefined : JSON.stringify(body)});
    } catch (e) { const x = new Error('Sem conexão com a Focus NFe (internet). A nota fica pendente e é reenviada sozinha.'); x.network = true; throw x; }
    let data = null; const raw = await r.text().catch(() => '');
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    return {status: r.status, data: data || {}};
  }
  const errText = d => { const parts = []; if (d.mensagem_sefaz) parts.push(d.mensagem_sefaz); if (d.mensagem) parts.push(d.mensagem); for (const e of [].concat(d.erros || [])) parts.push([e.campo, e.mensagem, e.correcao].filter(Boolean).join(': ')); return str([...new Set(parts)].join(' • '), 600) || 'Erro sem detalhe da Focus NFe.'; };
  const abs = p => (!p ? '' : /^https?:\/\//i.test(p) ? p : base() + (p.startsWith('/') ? '' : '/') + p);
  const pathOf = doc => (doc.kind === 'nfce' ? '/v2/nfce/' : doc.mode === 'nacional' ? '/v2/nfsen/' : '/v2/nfse/') + encodeURIComponent(doc.ref);

  async function test() {
    if (!allowed()) fail('Recurso do plano Pro.');
    if (!s.secrets.focusToken) fail('Cole e salve o token da Focus NFe primeiro.');
    let r; try { r = await call('GET', '/v2/nfce/gz-teste-' + crypto.randomBytes(4).toString('hex')); } catch (e) { fail(e.message); }
    if (r.status === 401 || r.status === 403) fail('A Focus NFe recusou o token (' + (cfg().env === 'producao' ? 'produção' : 'homologação') + '). Confira se é o token deste ambiente.');
    if (r.status === 404 || r.status === 200) return {ok: true, env: cfg().env, message: 'Conexão com a Focus NFe funcionando (' + (cfg().env === 'producao' ? 'produção' : 'homologação') + ').'};
    fail('Resposta inesperada da Focus NFe (HTTP ' + r.status + '): ' + errText(r.data));
  }

  // ---------- montagem das notas ----------
  const productOf = itemId => s.products.find(p => p.id === itemId) || {};
  function nfceBody(doc, sale, t) {
    const c = cfg(), items = sale.items.filter(i => i.kind === 'product');
    const lines = items.map((i, k) => {
      const p = productOf(i.itemId), f = p.fiscal || {};
      const ncm = f.ncm || c.nfce.ncm; if (!/^\d{8}$/.test(ncm || '')) { const e = new Error(`Produto "${i.name}" sem NCM. Informe o NCM no cadastro do produto (ou o NCM padrão em Gerenciamento NF-e › Configuração fiscal).`); e.local = true; throw e; }
      const unit = reais(i.unitCents), u = f.unidade || c.nfce.unidade || 'UN';
      return {numero_item: String(k + 1), codigo_ncm: ncm, codigo_produto: String(p.code || i.itemId), descricao: str(i.name, 120), quantidade_comercial: i.qty, quantidade_tributavel: i.qty, cfop: f.cfop || c.nfce.cfop, valor_unitario_comercial: unit, valor_unitario_tributavel: unit, valor_bruto: reais(i.totalCents), unidade_comercial: u, unidade_tributavel: u, icms_origem: f.origem ?? c.nfce.origem ?? '0', icms_situacao_tributaria: f.cst || c.nfce.cst};
    });
    const total = items.reduce((a, i) => a + i.totalCents, 0);
    const methodCode = m => (m === 'card' ? c.nfce.cardAs : PAY[m] || '99');
    let pays = sale.paymentMethod === 'mixed' && Array.isArray(sale.payments) ? sale.payments.map(p => ({m: p.method, c: p.cents})) : [{m: sale.paymentMethod, c: sale.totalCents}];
    // venda com produtos E serviços: a forma de pagamento da NFC-e é a parte proporcional dos produtos
    const sum = pays.reduce((a, p) => a + p.c, 0) || 1; let left = total;
    pays = pays.map((p, k) => { const v = k === pays.length - 1 ? left : Math.round(p.c * total / sum); left -= v; return {forma_pagamento: methodCode(p.m), valor_pagamento: reais(v)}; }).filter(p => p.valor_pagamento > 0);
    const body = {cnpj_emitente: c.cnpj, data_emissao: iso(t), natureza_operacao: c.nfce.natureza || 'VENDA AO CONSUMIDOR', presenca_comprador: '1', modalidade_frete: '9', local_destino: '1', items: lines, formas_pagamento: pays, informacoes_adicionais_contribuinte: `Cupom GameZoney nº ${sale.number}`};
    if (doc.cpf) body.cpf_destinatario = doc.cpf;
    return body;
  }
  function nfseBody(doc, t) {
    const c = cfg(), ns = c.nfse, valor = reais(doc.cents), opt = c.regime !== 'normal';
    const desc = str(doc.description || ns.descricao, 900);
    if (ns.mode === 'nacional') {
      const local = iso(t);
      const b = {data_emissao: local, data_competencia: local.slice(0, 10), serie_dps: Number(ns.serieDps) || 1, numero_dps: doc.dps, emitente_dps: '1', codigo_municipio_emissora: Number(c.municipio), cnpj_prestador: c.cnpj, codigo_opcao_simples_nacional: c.regime === 'normal' ? '1' : c.regime === 'mei' ? '2' : '3', regime_especial_tributacao: ns.regimeEspecial || '0', codigo_municipio_prestacao: c.municipio, codigo_tributacao_nacional_iss: ns.codTribNac, descricao_servico: desc, valor_servico: valor, tributacao_iss: '1', tipo_retencao_iss: '1', finalidade_emissao: '0', consumidor_final: '1', indicador_destinatario: '0', ibs_cbs_situacao_tributaria: ns.ibsCbsCst, ibs_cbs_classificacao_tributaria: ns.ibsCbsClass};
      if (ns.nbs) b.codigo_nbs = ns.nbs;
      if (ns.indOp) b.codigo_indicador_operacao = ns.indOp;
      if (c.regime === 'simples') b.regime_tributario_simples_nacional = '1';
      if (c.im) b.inscricao_municipal_prestador = c.im;
      if (ns.codTribMun) b.codigo_tributacao_municipal_iss = ns.codTribMun;
      if (ns.aliquota !== null && ns.aliquota !== undefined) b.percentual_aliquota_relativa_municipio = ns.aliquota;
      if (doc.cpf) { b.cpf_tomador = doc.cpf; if (doc.name) b.razao_social_tomador = str(doc.name, 150); if (doc.email) b.email_tomador = str(doc.email, 80); }
      return b;
    }
    const servico = {valor_servicos: valor, iss_retido: false, item_lista_servico: ns.itemLista, discriminacao: desc, codigo_municipio: c.municipio};
    if (ns.codTribMun) servico.codigo_tributario_municipio = ns.codTribMun;
    if (ns.cnae) servico.codigo_cnae = ns.cnae;
    if (ns.aliquota !== null && ns.aliquota !== undefined) servico.aliquota = ns.aliquota;
    // campos novos da reforma tributária (alguns municípios ainda ignoram): só vão quando o contador informou
    if (ns.nbs) servico.codigo_nbs = ns.nbs;
    if (ns.indOp) servico.codigo_indicador_operacao = ns.indOp;
    if (ns.ibsCbsCst) servico.ibs_cbs_situacao_tributaria = ns.ibsCbsCst;
    if (ns.ibsCbsClass) servico.ibs_cbs_classificacao_tributaria = ns.ibsCbsClass;
    const b = {data_emissao: iso(t), natureza_operacao: '1', optante_simples_nacional: opt, prestador: {cnpj: c.cnpj, inscricao_municipal: c.im, codigo_municipio: c.municipio}, servico};
    if (ns.regimeEspecial) b.regime_especial_tributacao = ns.regimeEspecial;
    if (doc.cpf) b.tomador = {cpf: doc.cpf, ...(doc.name ? {razao_social: str(doc.name, 115)} : {}), ...(doc.email ? {email: str(doc.email, 80)} : {})};
    return b;
  }

  // ---------- fila: vendas novas viram notas pendentes ----------
  const has = (source, sourceId, kind) => s.fiscalDocs.some(x => x.source === source && x.sourceId === sourceId && x.kind === kind && x.status !== 'substituida');
  function newDoc(kind, source, src, cents, extra = {}) {
    const c = cfg(), doc = {id: id(), kind, mode: kind === 'nfse' ? c.nfse.mode : undefined, env: c.env, source, sourceId: src.id, number: src.number || null, at: src.at, cents, status: 'pendente', tries: 0, nextTryAt: 0, createdAt: now(), ...extra};
    doc.ref = `gz${String(store.state.runtime?.installId || 'x').replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}-${kind}-${doc.id.slice(0, 12)}`;
    if (kind === 'nfse' && doc.mode === 'nacional') { doc.dps = c.nfse.nextDps; c.nfse.nextDps += 1; }
    return doc;
  }
  function memberInfo(memberId) { const m = memberId && s.members.find(x => x.id === memberId); if (!m || m.guest) return {}; const cpf = digits(m.cpf); return cpfOk(cpf) ? {cpf, name: m.name, email: m.email || ''} : {}; }
  function queue(t) {
    const c = cfg(); if (!c.enabled || !allowed()) return 0;
    const from = Math.max(c.since || 0, t - LOOKBACK), found = [];   // [at, ordem, criar()] — lidos do fim e numerados em ordem cronológica
    if (c.nfce.enabled && c.nfce.auto || c.nfse.enabled && c.nfse.auto && c.nfse.services) for (let i = s.shopSales.length - 1; i >= 0; i--) {
      const sale = s.shopSales[i]; if (sale.at < from) break; if (sale.status !== 'paid') continue;
      const prod = sale.items.filter(x => x.kind === 'product').reduce((a, x) => a + x.totalCents, 0), serv = sale.totalCents - prod;
      if (c.nfce.enabled && c.nfce.auto && prod > 0 && !has('shop', sale.id, 'nfce')) found.push([sale.at, i, () => newDoc('nfce', 'shop', sale, prod)]);
      if (c.nfse.enabled && c.nfse.auto && c.nfse.services && serv > 0 && !has('shop', sale.id, 'nfse')) found.push([sale.at, i + 0.5, () => newDoc('nfse', 'shop', sale, serv, {description: str(sale.items.filter(x => x.kind !== 'product').map(x => `${x.qty}x ${x.name}`).join(', '), 900)})]);
    }
    if (c.nfse.enabled && c.nfse.auto) for (let i = s.sales.length - 1; i >= 0; i--) {
      const r = s.sales[i]; if (r.at < from) break; if (!(r.cents > 0) || r.status === 'canceled') continue;
      if (!has('recharge', r.id, 'nfse')) found.push([r.at, 1e9 + i, () => newDoc('nfse', 'recharge', {id: r.id, at: r.at, number: null}, r.cents, {memberName: r.memberName || '', ...memberInfo(r.memberId)})]);
    }
    if (!found.length) return 0;
    s.fiscalDocs.push(...found.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(f => f[2]()));
    if (s.fiscalDocs.length > KEEP) s.fiscalDocs.splice(0, s.fiscalDocs.length - KEEP);
    store.persist();
    return found.length;
  }

  // ---------- envio e consulta ----------
  function apply(doc, d, t) {
    const st = String(d.status || '');
    if (doc.kind === 'nfce') {
      Object.assign(doc, {chave: d.chave_nfe || doc.chave || '', numero: d.numero || doc.numero || '', serie: d.serie || doc.serie || '', statusSefaz: d.status_sefaz || '', links: {danfe: abs(d.caminho_danfe), xml: abs(d.caminho_xml_nota_fiscal), qrcode: d.qrcode_url || '', consulta: d.url_consulta_nf || '', xmlCancel: abs(d.caminho_xml_cancelamento)}});
    } else {
      Object.assign(doc, {numero: d.numero || doc.numero || '', codigoVerificacao: d.codigo_verificacao || doc.codigoVerificacao || '', links: {url: d.url || '', danfse: d.url_danfse || '', xml: abs(d.caminho_xml_nota_fiscal), xmlCancel: abs(d.caminho_xml_cancelamento)}});
    }
    if (st === 'autorizado') { doc.status = 'autorizado'; doc.authorizedAt ??= t; doc.message = ''; }
    else if (st === 'cancelado') { doc.status = 'cancelado'; doc.canceledAt ??= t; }
    else if (st === 'processando_autorizacao' || st === 'processando') { doc.status = 'processando'; doc.nextTryAt = t + 10000; }
    else if (st === 'denegado' || st === 'negado') { doc.status = 'denegado'; doc.message = errText(d); }
    else if (st === 'erro_autorizacao') { doc.status = 'erro'; doc.message = errText(d); }
    else { doc.status = 'erro'; doc.message = errText(d); }
  }
  function changed(doc, before) {
    if (doc.status === before) return store.persist();
    const label = doc.kind === 'nfce' ? 'NFC-e' : 'NFS-e', what = doc.source === 'shop' ? `cupom ${doc.number}` : 'recarga';
    const detail = doc.status === 'autorizado' ? `${label} autorizada${doc.numero ? ' nº ' + doc.numero : ''} (${what}, R$ ${(doc.cents / 100).toFixed(2)})`
      : doc.status === 'erro' || doc.status === 'denegado' ? `${label} recusada (${what}): ${doc.message}` : doc.status === 'cancelado' ? `${label} cancelada${doc.numero ? ' nº ' + doc.numero : ''} (${what})` : `${label} em processamento (${what})`;
    store.change('sistema', 'fiscal', detail, () => {});
  }
  async function send(doc, t) {
    const before = doc.status; doc.tries += 1; doc.lastTryAt = t;
    try {
      let r;
      if (doc.kind === 'nfce' || doc.status === 'pendente') {
        // envio pode ter chegado à Focus sem resposta (queda): consulta antes de mandar de novo
        if (doc.sentAt) { r = await call('GET', pathOf(doc)); if (r.status === 200 && r.data.status) { apply(doc, r.data, t); return changed(doc, before); } }
        if (doc.kind === 'nfce') { const sale = s.shopSales.find(x => x.id === doc.sourceId); if (!sale || sale.status !== 'paid') { doc.status = 'descartada'; doc.message = 'Venda cancelada antes da emissão.'; return changed(doc, before); } }
        else if (doc.source === 'shop') { const sale = s.shopSales.find(x => x.id === doc.sourceId); if (!sale || sale.status !== 'paid') { doc.status = 'descartada'; doc.message = 'Venda cancelada antes da emissão.'; return changed(doc, before); } }
        const body = doc.kind === 'nfce' ? nfceBody(doc, s.shopSales.find(x => x.id === doc.sourceId), now()) : nfseBody(doc, now());
        doc.sentAt = t;
        const path = doc.kind === 'nfce' ? '/v2/nfce?ref=' : doc.mode === 'nacional' ? '/v2/nfsen?ref=' : '/v2/nfse?ref=';
        r = await call('POST', path + encodeURIComponent(doc.ref), body);
      } else r = await call('GET', pathOf(doc));
      if (r.status === 401 || r.status === 403) { doc.status = before === 'processando' ? 'processando' : 'pendente'; doc.message = 'A Focus NFe recusou o token. Confira em Gerenciamento NF-e › Configuração fiscal.'; doc.nextTryAt = t + RETRY.at(-1); return changed(doc, before); }
      if (r.status === 429 || r.status >= 500) { doc.message = 'Focus NFe indisponível no momento (HTTP ' + r.status + '). Nova tentativa automática.'; doc.nextTryAt = t + RETRY[Math.min(doc.tries - 1, RETRY.length - 1)]; return changed(doc, before); }
      if (r.status >= 400) { doc.status = 'erro'; doc.message = errText(r.data); return changed(doc, before); }
      apply(doc, r.data, t); return changed(doc, before);
    } catch (e) {
      if (e.local) { doc.status = 'erro'; doc.message = e.message; doc.sentAt = undefined; return changed(doc, before); }
      doc.message = e.message; doc.nextTryAt = t + RETRY[Math.min(doc.tries - 1, RETRY.length - 1)];
      return changed(doc, before);
    }
  }
  let current = null;
  // uma verificação por vez; quem chega enquanto outra roda espera ela terminar e roda de novo (nada se perde)
  async function tick() { while (current) await current.catch(() => {}); current = run(); try { return await current; } finally { current = null; } }
  async function run() {
    if (running) return; running = true;
    try {
      const t = now(); queue(t);
      const due = s.fiscalDocs.filter(x => (x.status === 'pendente' || x.status === 'processando') && (x.nextTryAt || 0) <= t && x.env === cfg().env).slice(0, 20);
      for (const doc of due) { if (!cfg().enabled || !allowed()) break; await send(doc, now()); }
    } finally { running = false; }
  }
  const kick = () => setImmediate(() => tick().catch(() => {}));

  // ---------- ações do painel ----------
  function list(q = {}) {
    const st = String(q.status || ''), kind = String(q.kind || ''), out = s.fiscalDocs.filter(x => (!st || x.status === st) && (!kind || x.kind === kind)).slice(-500).reverse();
    const counts = {}; for (const x of s.fiscalDocs) counts[x.status] = (counts[x.status] || 0) + 1;
    return {docs: out.map(x => ({...x})), counts, settings: settings()};
  }
  function retry(input, actor) {
    const doc = s.fiscalDocs.find(x => x.id === String(input.id || '')) || fail('Nota não encontrada.');
    if (!['erro', 'pendente'].includes(doc.status)) fail('Só notas com erro ou pendentes podem ser reenviadas.');
    return store.change(actor, 'fiscal', `${doc.kind === 'nfce' ? 'NFC-e' : 'NFS-e'} reenviada (${doc.source === 'shop' ? 'cupom ' + doc.number : 'recarga'})`, () => {
      const c = cfg();
      // nova referência (a anterior foi recusada); a numeração da DPS nacional é mantida
      if (doc.status === 'erro') { doc.ref = doc.ref.replace(/-r\d+$/, '') + '-r' + ((doc.retries || 0) + 1); doc.retries = (doc.retries || 0) + 1; doc.sentAt = undefined; }
      Object.assign(doc, {status: 'pendente', nextTryAt: 0, message: '', env: c.env, mode: doc.kind === 'nfse' ? c.nfse.mode : undefined});
      kick(); return {...doc};
    });
  }
  function emit(input, actor) {
    const c = cfg(); if (!c.enabled) fail('Ligue as notas fiscais em Gerenciamento NF-e › Configuração fiscal.');
    const kind = input.kind === 'nfse' ? 'nfse' : input.kind === 'nfce' ? 'nfce' : fail('Tipo de nota inválido.');
    if (kind === 'nfce' && !c.nfce.enabled) fail('A NFC-e está desligada.'); if (kind === 'nfse' && !c.nfse.enabled) fail('A NFS-e está desligada.');
    const source = input.source === 'recharge' ? 'recharge' : 'shop', sid = String(input.id || '');
    if (has(source, sid, kind)) fail('Esta venda já tem nota fiscal na lista.');
    let doc;
    if (source === 'shop') {
      const sale = s.shopSales.find(x => x.id === sid) || fail('Venda não encontrada.'); if (sale.status !== 'paid') fail('Venda cancelada.');
      const prod = sale.items.filter(x => x.kind === 'product').reduce((a, x) => a + x.totalCents, 0), serv = sale.totalCents - prod;
      const cpf = digits(input.cpf); if (input.cpf && !cpfOk(cpf)) fail('CPF inválido.');
      if (kind === 'nfce') { if (!prod) fail('Esta venda não tem produtos (NFC-e é só para produtos).'); doc = newDoc('nfce', 'shop', sale, prod, cpf ? {cpf} : {}); }
      else { if (!serv) fail('Esta venda não tem serviços.'); doc = newDoc('nfse', 'shop', sale, serv, {description: str(sale.items.filter(x => x.kind !== 'product').map(x => `${x.qty}x ${x.name}`).join(', '), 900), ...(cpf ? {cpf} : {})}); }
    } else {
      if (kind !== 'nfse') fail('Recarga de tempo usa NFS-e.');
      const r = s.sales.find(x => x.id === sid) || fail('Recarga não encontrada.'); if (!(r.cents > 0)) fail('Recarga sem valor.');
      doc = newDoc('nfse', 'recharge', {id: r.id, at: r.at, number: null}, r.cents, {memberName: r.memberName || '', ...memberInfo(r.memberId)});
    }
    return store.change(actor, 'fiscal', `${kind === 'nfce' ? 'NFC-e' : 'NFS-e'} solicitada (${source === 'shop' ? 'cupom ' + doc.number : 'recarga'})`, () => { s.fiscalDocs.push(doc); kick(); return {...doc}; });
  }
  async function cancel(input, operator, actor) {
    const doc = s.fiscalDocs.find(x => x.id === String(input.id || '')) || fail('Nota não encontrada.');
    if (doc.status !== 'autorizado') fail('Só notas autorizadas podem ser canceladas.');
    const reason = str(input.reason, 255); if (reason.length < 15) fail('Motivo do cancelamento: de 15 a 255 caracteres (exigência da Sefaz/prefeitura).');
    if (typeof input.authPassword !== 'string' || !input.authPassword || !operator || !verify(input.authPassword, operator.hash)) fail('Senha do administrador incorreta.');
    if (doc.kind === 'nfce' && doc.authorizedAt && now() - doc.authorizedAt > 30 * 60000) fail('A NFC-e só pode ser cancelada em até 30 minutos depois de autorizada. Fale com o contador.');
    let r; try { r = await call('DELETE', pathOf(doc), {justificativa: reason}); } catch (e) { fail(e.message); }
    const d = r.data || {};
    if (r.status >= 400 || d.status === 'erro_cancelamento') { const msg = errText(d); store.change(actor, 'fiscal', `Cancelamento recusado (${doc.kind === 'nfce' ? 'NFC-e' : 'NFS-e'}${doc.numero ? ' nº ' + doc.numero : ''}): ${msg}`, () => {}); fail('Cancelamento recusado: ' + msg); }
    return store.change(actor, 'fiscal', `${doc.kind === 'nfce' ? 'NFC-e' : 'NFS-e'} cancelada${doc.numero ? ' nº ' + doc.numero : ''}: ${reason}`, () => {
      Object.assign(doc, {status: 'cancelado', canceledAt: now(), cancelReason: reason, canceledBy: actor});
      if (d.caminho_xml_cancelamento) doc.links = {...(doc.links || {}), xmlCancel: abs(d.caminho_xml_cancelamento)};
      return {...doc};
    });
  }
  function ofSale(source, sid) { return s.fiscalDocs.filter(x => x.source === source && x.sourceId === sid).map(x => ({id: x.id, kind: x.kind, status: x.status, numero: x.numero, links: x.links || {}, message: x.message || ''})); }

  function start() { if (timer || options.noTimer) return; timer = setInterval(() => tick().catch(() => {}), options.intervalMs || 5000); if (timer.unref) timer.unref(); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return {settings, save, test, tick, kick, list, retry, emit, cancel, ofSale, start, stop, nfceBody, nfseBody, iso, cnpjOk, cpfOk, BASE};
};
module.exports.cnpjOk = cnpjOk;
module.exports.cpfOk = cpfOk;
module.exports.BASE = BASE;
