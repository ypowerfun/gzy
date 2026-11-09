'use strict';
// 1.0.8 (plano Pro): notas fiscais de entrada pelo XML — vínculo por EAN/código do produto, entrada no estoque e cancelamento com motivo + senha
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {createServer} = require('../server'), nfe = require('../nfe');
const sign = (data, key) => { const body = Buffer.from(JSON.stringify(data)).toString('base64url'); return body + '.' + crypto.sign(null, Buffer.from(body, 'base64url'), key).toString('base64url'); };
const KEY = '13261100000000000191550010000012341000012345';
const xml = (key = KEY) => `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${key}" versao="4.00">
<ide><cUF>13</cUF><nNF>1234</nNF><serie>1</serie><dhEmi>2026-11-05T10:00:00-04:00</dhEmi><tpNF>1</tpNF></ide>
<emit><CNPJ>00000000000191</CNPJ><xNome>Distribuidora Norte &amp; Cia LTDA</xNome><xFant>Dist Norte</xFant></emit>
<det nItem="1"><prod><cProd>REF-COCA</cProd><cEAN>7894900011517</cEAN><xProd>REFRIGERANTE COCA-COLA LATA 350ML</xProd><uCom>CX</uCom><qCom>2.0000</qCom><vUnCom>30.0000000000</vUnCom><vProd>60.00</vProd><cEANTrib>7894900011517</cEANTrib></prod></det>
<det nItem="2"><prod><cProd>BISC-01</cProd><cEAN>SEM GTIN</cEAN><xProd>BISCOITO RECHEADO 140G</xProd><uCom>UN</uCom><qCom>10.0000</qCom><vUnCom>2.0000000000</vUnCom><vProd>20.00</vProd><vDesc>2.00</vDesc><cEANTrib>SEM GTIN</cEANTrib></prod></det>
<total><ICMSTot><vNF>78.00</vNF></ICMSTot></total></infNFe></NFe><protNFe versao="4.00"><infProt><chNFe>${key}</chNFe><cStat>100</cStat><nProt>113260000000001</nProt></infProt></protNFe></nfeProc>`;

test('1.0.8/1.2.8: notas fiscais de entrada (só Pro; teste grátis e Standard não) — importar XML, vincular pelo código, dar entrada e cancelar com motivo e senha', async t => {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-nfe-'));
  const inst = createServer({directory, noTimer: true, license: {publicKey: publicKey.export({type: 'spki', format: 'pem'})}});
  await new Promise(r => inst.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + inst.server.address().port; let cookie = '';
  t.after(async () => { await inst.close(); fs.rmSync(directory, {recursive: true, force: true}); });
  const call = async (url, body, status = 200) => { const r = await fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)}); const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; return text ? JSON.parse(text) : null; };
  await call('/api/setup', {name: 'Dono', username: 'admin', password: 'senha123'}); await call('/api/login', {username: 'admin', password: 'senha123'});
  const S = inst.store.state, plan = p => { S.license.planToken = sign({v: 2, kind: 'plan', uid: 'u1', email: 'dono@arena.com', plan: p, planName: p === 'pro' ? 'Pro' : 'Standard', period: 'mensal', installId: S.runtime.installId, paidUntil: Date.now() + 20 * 86400000, graceUntil: Date.now() + 27 * 86400000, issuedAt: Date.now()}, privateKey); };

  // 1.1.9: teste grátis (Free) libera todas as funções, inclusive a NF-e; Standard não tem NF-e
  // 1.2.8: teste grátis sem login = NF-e, App, Multi-Unidade e impressão bloqueados; autoatendimento liberado
  { const st = await call('/api/state'); assert.equal(st.pro, false); assert.deepEqual(st.features, {}); }
  assert.match((await call('/api/nfe', undefined, 400)).error, /plano Pro/); await call('/api/self-service');
  assert.match((await call('/api/prints/settings', {enabled: true}, 400)).error, /Standard e Pro/); assert.equal((await call('/api/prints')).allowed, false);
  plan('standard'); { const st = await call('/api/state'); assert.equal(st.pro, false); assert.deepEqual(st.features, {print: true}); } await call('/api/prints/settings', {enabled: true}); assert.equal((await call('/api/state')).printControl, true); await call('/api/nfe/import', {xml: xml()}, 400);
  assert.match((await call('/api/nfe', undefined, 400)).error, /plano Pro/);
  // Standard: PIX no PC (autoatendimento) e Controle de impressão funcionam
  await call('/api/self-service'); await call('/api/prints'); await call('/api/pc-notices');
  plan('pro'); { const st = await call('/api/state'); assert.equal(st.pro, true); assert.deepEqual(st.features, {print: true, nfe: true, app: true, units: true}); }

  // produtos com código sequencial; a Coca tem o EAN da nota
  const coke = S.products.find(p => p.name === 'Coca-cola'), bisc = S.products.find(p => p.name === 'Biscoito');
  assert.deepEqual(S.products.map(p => p.code), [1, 2, 3]);
  await call('/api/shop/product', {id: coke.id, name: 'Coca-cola', category: 'Bebidas', costCents: 350, priceCents: 600, barcode: '7894900011517', stock: 24});
  const novo = await call('/api/shop/product', {name: 'Água', category: 'Bebidas', costCents: 100, priceCents: 300, stock: 0}); assert.equal(novo.code, 4);

  // arquivos inválidos
  assert.match((await call('/api/nfe/import', {xml: '<html></html>'}, 400)).error, /não é o XML de uma NF-e/);
  assert.match((await call('/api/nfe/import', {xml: '<!DOCTYPE x [<!ENTITY a "b">]>' + xml()}, 400)).error, /não aceito/);

  // importa: item 1 vinculado sozinho pelo EAN; item 2 sem vínculo
  let e = await call('/api/nfe/import', {fileName: 'nota.xml', xml: xml()});
  assert.equal(e.number, '1234'); assert.equal(e.supplier.name, 'Dist Norte'); assert.equal(e.totalCents, 7800); assert.equal(e.authorized, true); assert.equal(e.linked, 1);
  assert.equal(e.items[0].product.id, coke.id); assert.equal(e.items[0].auto, 'ean'); assert.equal(e.items[1].product, null); assert.equal(e.items[1].totalCents, 1800);
  assert.match((await call('/api/nfe/import', {xml: xml()}, 400)).error, /já foi importada/);
  assert.match((await call('/api/nfe/post', {id: e.id}, 400)).error, /Faltam 1 item sem produto/);

  // vincula pelo código do produto; caixa da Coca com 12 latas
  assert.match((await call('/api/nfe/link', {id: e.id, n: 2, code: '999'}, 400)).error, /Nenhum produto com o código 999/);
  await call('/api/nfe/link', {id: e.id, n: 2, code: String(bisc.code)});
  // a Coca vem em CX: antes de dar entrada precisa converter em UN (quantas latas em cada caixa)
  assert.equal(e.items[0].pack, true); assert.equal(e.items[1].pack, false);
  assert.match((await call('/api/nfe/post', {id: e.id}, 400)).error, /Converta em UN: informe quantas unidades vêm em cada CX do item 1/);
  assert.equal((await call('/api/nfe/link', {id: e.id, n: 1, code: String(coke.code), factor: ''})).items[0].factorSet, false);
  e = await call('/api/nfe/link', {id: e.id, n: 1, code: String(coke.code), factor: 12});
  assert.equal(e.linked, 2); assert.equal(e.items[0].units, 24);

  // entrada: estoque somado e custo atualizado (60,00 / 24 latas; (20-2) / 10 biscoitos)
  e = await call('/api/nfe/post', {id: e.id}); assert.equal(e.status, 'posted');
  assert.equal(coke.stock, 48); assert.equal(coke.costCents, 250); assert.equal(bisc.stock, 40); assert.equal(bisc.costCents, 180);
  assert.ok(S.stockMoves.some(m => m.type === 'entrada' && m.productId === coke.id && m.qty === 24));
  const list = await call('/api/nfe'); assert.equal(list.summary.postedMonth, 1); assert.equal(list.summary.postedMonthCents, 7800); assert.equal(list.entries[0].itemCount, 2);

  // a próxima nota do mesmo fornecedor já vem vinculada (vínculo anterior + 12 por caixa)
  const key2 = KEY.slice(0, -4) + '9999';
  const e2 = await call('/api/nfe/import', {xml: xml(key2)}); assert.equal(e2.linked, 2); assert.equal(e2.items[1].auto, 'anterior'); assert.equal(e2.items[0].factor, 12); assert.equal(e2.items[0].factorSet, true);
  await call('/api/nfe/cancel', {id: e2.id}); assert.equal(S.nfe.entries.find(x => x.id === e2.id).status, 'discarded'); assert.equal(coke.stock, 48);

  // cancelar a entrada: exige motivo e a senha do administrador
  assert.match((await call('/api/nfe/cancel', {id: e.id, reason: 'x', authPassword: 'senha123'}, 400)).error, /motivo/);
  assert.match((await call('/api/nfe/cancel', {id: e.id, reason: 'Lançada em duplicidade', authPassword: 'errada'}, 400)).error, /Senha do administrador incorreta/);
  coke.stock -= 30; // vendeu parte do que entrou
  e = await call('/api/nfe/cancel', {id: e.id, reason: 'Lançada em duplicidade', authPassword: 'senha123'});
  assert.equal(e.status, 'cancelled'); assert.equal(e.cancelReason, 'Lançada em duplicidade'); assert.equal(e.cancelledBy, 'admin');
  assert.equal(coke.stock, 0); assert.match(e.shortfall[0], /faltaram 6 un/); assert.equal(bisc.stock, 30); assert.equal(bisc.costCents, 150); assert.equal(coke.costCents, 350);
  const logs = await call('/api/logs?type=nota'); assert.ok(logs.some(l => /Entrada CANCELADA.*Lançada em duplicidade/.test(l.detail))); assert.ok(logs.some(l => /recusado/.test(l.detail)));
  // nota cancelada pode ser importada de novo
  assert.equal((await call('/api/nfe/import', {xml: xml()})).status, 'pending');
});

test('1.0.8: leitura do XML da NF-e', () => {
  const d = nfe.parse(xml());
  assert.equal(d.key, KEY); assert.equal(d.series, '1'); assert.equal(d.supplier.cnpj, '00000000000191'); assert.equal(d.items.length, 2);
  assert.equal(d.items[0].ean, '7894900011517'); assert.equal(d.items[1].ean, ''); assert.equal(d.items[0].qty, 2); assert.equal(d.items[0].unit, 'CX');
  assert.equal(nfe.parse(xml().replace(/<protNFe[\s\S]*<\/protNFe>/, '')).authorized, false);
});
