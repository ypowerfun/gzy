'use strict';
// 1.0.7: depurador ligado (ou código injetado no Node) anula a licença até abrir o GameZoney de novo
const {test} = require('node:test'), assert = require('node:assert/strict'), inspector = require('node:inspector');
const license = require('../license');
test('1.0.7: com o depurador ligado o servidor funciona como teste vencido (bloqueia vendas) e fecha o depurador', () => {
  const logs = [], store = {state: {runtime: {}, license: {}}, log: (...a) => logs.push(a)};
  const lic = license(store, {noTimer: true});
  assert.equal(lic.status().mode, 'trial');
  inspector.open(0, '127.0.0.1');
  const st = lic.status(); assert.equal(st.mode, 'expired'); assert.equal(st.tamper, true);
  assert.equal(inspector.url(), undefined, 'depurador fechado');
  let code = 0, body; lic.guard({method: 'POST', baseUrl: '', path: '/api/credit'}, {status: c => { code = c; return {json: b => { body = b; }}; }}, () => { code = 200; });
  assert.equal(code, 402); assert.match(body.error, /tentativa de alterar/);
});

test('1.0.7: opções padrão que o Node 24 repassa (--inspect-port, --inspect-publish-uid) não ativam a proteção; --inspect e --require sim', () => {
  const {spawnSync} = require('node:child_process'), path = require('node:path');
  const run = args => spawnSync(process.execPath, [...args, '-e', `const l=require(${JSON.stringify(path.join(__dirname, '..', 'license.js'))});const st={state:{runtime:{},license:{}},log(){}};console.log(l(st,{noTimer:true}).status().mode)`], {encoding: 'utf8', env: {...process.env, NODE_OPTIONS: ''}}).stdout.trim();
  assert.equal(run(['--inspect-port=127.0.0.1:9229', '--inspect-publish-uid=stderr,http']), 'trial');
  assert.equal(run(['--require', path.join(__dirname, '..', 'netinfo.js')]), 'expired');
});
