'use strict';
// Simulador da API v2 da Focus NFe para os testes (servidor HTTP local de verdade).
// Campos obrigatórios copiados da documentação oficial (doc.focusnfe.com.br, consultada em 11/2026):
//  emitir_nfce, emitir_nfse (municipal) e campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html (DPS nacional).
// Diferença consciente: no padrão municipal o "tomador" sem CPF é omitido (consumidor não identificado); se vier, exige cpf ou cnpj.
const http = require('node:http');
const REQ = {
  nfce: ['cnpj_emitente', 'data_emissao', 'presenca_comprador', 'modalidade_frete', 'local_destino', 'natureza_operacao', 'items', 'formas_pagamento'],
  nfceItem: ['numero_item', 'codigo_ncm', 'codigo_produto', 'descricao', 'quantidade_comercial', 'quantidade_tributavel', 'cfop', 'valor_unitario_comercial', 'valor_unitario_tributavel', 'valor_bruto', 'unidade_comercial', 'unidade_tributavel', 'icms_origem', 'icms_situacao_tributaria'],
  nfcePay: ['forma_pagamento', 'valor_pagamento'],
  nfse: ['data_emissao', 'natureza_operacao', 'optante_simples_nacional', 'prestador', 'servico'],
  nfsePrest: ['cnpj', 'inscricao_municipal'],
  nfseServ: ['valor_servicos', 'iss_retido', 'item_lista_servico', 'discriminacao', 'codigo_municipio'],
  nfsen: ['data_emissao', 'serie_dps', 'numero_dps', 'data_competencia', 'emitente_dps', 'codigo_municipio_emissora', 'cnpj_prestador', 'codigo_opcao_simples_nacional', 'regime_especial_tributacao', 'codigo_municipio_prestacao', 'codigo_tributacao_nacional_iss', 'descricao_servico', 'valor_servico', 'tributacao_iss', 'finalidade_emissao', 'consumidor_final', 'indicador_destinatario', 'ibs_cbs_situacao_tributaria', 'ibs_cbs_classificacao_tributaria']
};
const missing = (obj, keys, prefix) => keys.filter(k => obj?.[k] === undefined || obj[k] === null || obj[k] === '').map(k => ({campo: prefix + k, mensagem: 'Campo obrigatório'}));

module.exports = async function focusMock({token = 'tokenHomologacao123', now = () => Date.now()} = {}) {
  const docs = new Map(), log = [];
  const st = {down: false, dropAfterProcess: false, fail503: false, numero: 100, nfseReady: 1};
  const server = http.createServer((req, res) => {
    if (st.down) return req.socket.destroy();
    let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
      const url = new URL(req.url, 'http://x'), body = raw ? JSON.parse(raw) : undefined;
      log.push({method: req.method, path: url.pathname, ref: url.searchParams.get('ref'), body, auth: req.headers.authorization});
      const send = (code, data) => { if (st.dropAfterProcess && req.method === 'POST') { st.dropAfterProcess = false; return req.socket.destroy(); } res.writeHead(code, {'Content-Type': 'application/json'}); res.end(JSON.stringify(data)); };
      if (req.headers.authorization !== 'Basic ' + Buffer.from(token + ':').toString('base64')) return send(401, {codigo: 'nao_autorizado', mensagem: 'Token de acesso inválido'});
      if (st.fail503) return send(503, {codigo: 'servico_indisponivel', mensagem: 'Serviço temporariamente indisponível'});
      const m = url.pathname.match(/^\/v2\/(nfce|nfse|nfsen)(?:\/([^/]+))?$/); if (!m) return send(404, {codigo: 'nao_encontrado', mensagem: 'Rota não encontrada'});
      const [, kind, refPath] = m, ref = refPath ? decodeURIComponent(refPath) : url.searchParams.get('ref'), key = kind + ':' + ref;
      if (req.method === 'GET') {
        const d = docs.get(key); if (!d) return send(404, {codigo: 'nao_encontrado', mensagem: 'Nota fiscal não encontrada'});
        if (kind !== 'nfce' && d.status === 'processando_autorizacao' && ++d.polls > st.nfseReady) {
          if (kind === 'nfse' && d.body.servico.item_lista_servico === '9999') Object.assign(d, {status: 'erro_autorizacao', erros: [{codigo: 'E160', mensagem: 'Item da lista de serviço inválido', correcao: 'Confira o item da LC 116 com o contador'}]});
          else Object.assign(d, {status: 'autorizado', numero: String(++st.numero), codigo_verificacao: 'AB12CD34', data_emissao: d.body.data_emissao, url: 'https://prefeitura.exemplo/nfse?n=' + st.numero, caminho_xml_nota_fiscal: `/arquivos/${kind}/${ref}.xml`, ...(kind === 'nfsen' ? {url_danfse: 'https://adn.exemplo/danfse/' + st.numero} : {})});
        }
        const {body: _b, polls: _p, at: _a, ...out} = d; return send(200, out);
      }
      if (req.method === 'DELETE') {
        const d = docs.get(key); if (!d) return send(404, {codigo: 'nao_encontrado', mensagem: 'Nota fiscal não encontrada'});
        const j = String(body?.justificativa || ''); if (j.length < 15 || j.length > 255) return send(400, {codigo: 'requisicao_invalida', mensagem: 'Justificativa deve ter de 15 a 255 caracteres'});
        if (d.status !== 'autorizado') return send(422, {codigo: 'nfe_nao_autorizada', mensagem: 'Nota não autorizada'});
        if (kind === 'nfce' && now() - d.at > 30 * 60000) return send(200, {status: 'erro_cancelamento', status_sefaz: '501', mensagem_sefaz: 'Rejeição: Prazo de cancelamento superior ao previsto na legislação'});
        d.status = 'cancelado'; d.caminho_xml_cancelamento = `/arquivos/${kind}/${ref}-can.xml`;
        return send(200, kind === 'nfce' ? {status: 'cancelado', status_sefaz: '135', mensagem_sefaz: 'Evento registrado e vinculado a NFC-e', caminho_xml_cancelamento: d.caminho_xml_cancelamento, numero_protocolo: '1352600000001'} : {status: 'cancelado'});
      }
      if (req.method !== 'POST') return send(405, {codigo: 'metodo_invalido', mensagem: 'Método não suportado'});
      if (!ref) return send(400, {codigo: 'requisicao_invalida', mensagem: 'Parâmetro ref não informado'});
      if (docs.has(key)) return send(422, {codigo: 'already_processed', mensagem: 'Nota fiscal já autorizada ou em processamento com esta referência'});
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(String(body?.data_emissao)) || Math.abs(Date.parse(body.data_emissao) - now()) > 5 * 60000) return send(422, {codigo: 'requisicao_invalida', mensagem: 'data_emissao inválida (ISO com fuso, até 5 min do horário atual)', erros: [{campo: 'data_emissao', mensagem: String(body?.data_emissao)}]});
      let erros = [];
      if (kind === 'nfce') {
        erros = missing(body, REQ.nfce, '');
        for (const [i, it] of (body.items || []).entries()) { erros.push(...missing(it, REQ.nfceItem, `items[${i}].`)); if (Math.abs(it.quantidade_comercial * it.valor_unitario_comercial - it.valor_bruto) > 0.011) erros.push({campo: `items[${i}].valor_bruto`, mensagem: 'difere de quantidade × valor unitário'}); if (!/^\d{8}$/.test(it.codigo_ncm)) erros.push({campo: `items[${i}].codigo_ncm`, mensagem: 'NCM com 8 dígitos'}); }
        for (const [i, p] of (body.formas_pagamento || []).entries()) erros.push(...missing(p, REQ.nfcePay, `formas_pagamento[${i}].`));
        const tot = (body.items || []).reduce((a, i) => a + i.valor_bruto, 0), pag = (body.formas_pagamento || []).reduce((a, p) => a + p.valor_pagamento, 0);
        if (Math.abs(tot - pag) > 0.009) erros.push({campo: 'formas_pagamento', mensagem: `Total pago (${pag.toFixed(2)}) diferente do total dos produtos (${tot.toFixed(2)})`});
      } else if (kind === 'nfse') {
        erros = [...missing(body, REQ.nfse, ''), ...missing(body.prestador, REQ.nfsePrest, 'prestador.'), ...missing(body.servico, REQ.nfseServ, 'servico.')];
        if (body.tomador && !body.tomador.cpf && !body.tomador.cnpj) erros.push({campo: 'tomador.cpf', mensagem: 'Informe CPF ou CNPJ do tomador'});
      } else erros = missing(body, REQ.nfsen, '');
      if (erros.length) return send(422, {codigo: 'requisicao_invalida', mensagem: 'Campos inválidos', erros});
      if (kind === 'nfce') {
        if (body.items.some(i => i.codigo_ncm === '99999999')) { docs.set(key, {cnpj_emitente: body.cnpj_emitente, ref, status: 'erro_autorizacao', status_sefaz: '778', mensagem_sefaz: 'Rejeição: Informado NCM inexistente', body, at: now()}); return send(201, docs.get(key)); }
        const n = String(++st.numero), d = {cnpj_emitente: body.cnpj_emitente, ref, status: 'autorizado', status_sefaz: '100', mensagem_sefaz: 'Autorizado o uso da NF-e', chave_nfe: 'NFe' + '35'.padEnd(44, '1').slice(0, 44 - n.length) + n, numero: n, serie: '1', caminho_xml_nota_fiscal: `/arquivos/nfce/${ref}.xml`, caminho_danfe: `/notas_fiscais_consumidor/NFe${n}.html`, qrcode_url: 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=' + n, url_consulta_nf: 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta', body, at: now()};
        docs.set(key, d); const {body: _b, at: _a, ...out} = d; return send(201, out);
      }
      docs.set(key, {ref, status: 'processando_autorizacao', polls: 0, body, at: now(), ...(kind === 'nfse' ? {cnpj_prestador: body.prestador.cnpj} : {cnpj_prestador: body.cnpj_prestador})});
      return send(kind === 'nfsen' ? 202 : 201, {ref, status: 'processando_autorizacao', ...(kind === 'nfsen' ? {protocolo: 'P' + Date.now()} : {cnpj_prestador: body.prestador.cnpj})});
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return {base: 'http://127.0.0.1:' + server.address().port, token, docs, log, st, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); })};
};
