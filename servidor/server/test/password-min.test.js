'use strict';
// 1.4.3: senha do servidor (administrador e operadores) com 8 a 24 caracteres para CRIAR ou TROCAR.
// Conta antiga com senha curta continua entrando no painel do servidor, mas o painel pede para trocar (weak).
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createServer} = require('../server');
const {passwordHash} = require('../store');

test('1.4.3: senha do servidor com mínimo de 8 caracteres; senha antiga curta entra e é avisada', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-pw8-'));
  const inst = createServer({directory, noTimer: true});
  await new Promise(r => inst.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + inst.server.address().port;
  t.after(async () => { await inst.close(); fs.rmSync(directory, {recursive: true, force: true, maxRetries: 5}); });
  let cookie = '';
  const call = async (url, body, status = 200) => {
    const r = await fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const j = await r.json(); assert.equal(r.status, status, url + ' ' + JSON.stringify(j)); return j;
  };
  assert.match((await call('/api/setup', {username: 'dono', password: '1234567'}, 400)).error, /entre 8 e 24/);
  assert.match((await call('/api/setup', {username: 'dono', password: 'x'.repeat(25)}, 400)).error, /entre 8 e 24/);
  await call('/api/setup', {username: 'dono', password: '12345678'});
  assert.equal((await call('/api/login', {username: 'dono', password: '12345678'})).weak, false);
  assert.match((await call('/api/operators', {username: 'caixa', password: 'abc', role: 'operator'}, 400)).error, /entre 8 e 24/);
  await call('/api/operators', {username: 'caixa', password: 'caixa-01', role: 'operator'});
  assert.match((await call('/api/password', {current: '12345678', password: '1234'}, 400)).error, /entre 8 e 24/);
  // conta antiga (antes da 1.4.3) com senha de 4 caracteres: entra no servidor, com aviso para trocar
  inst.store.state.operators.push({id: 'velho', username: 'antigo', hash: passwordHash('1234', undefined, 4), role: 'operator', active: true, createdAt: 1}); inst.store.persist();
  cookie = ''; const r = await call('/api/login', {username: 'antigo', password: '1234'}); assert.equal(r.weak, true);
  await call('/api/password', {current: '1234', password: 'nova-senha'});
  cookie = ''; assert.equal((await call('/api/login', {username: 'antigo', password: 'nova-senha'})).weak, false);
});
