'use strict';
// 1.0.9: foto do cliente; exportar e importar todos os dados do cliente (menos a foto) — Nome, Nick, CPF, telefone, e-mail,
// tempo, medalhas, observações e situação. Serve para trazer clientes de outro sistema.
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createServer} = require('../server'), imp = require('../import');
const JPG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]).toString('base64');

async function boot(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-mph-'));
  const inst = createServer({directory, noTimer: true});
  await new Promise(r => inst.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + inst.server.address().port; let cookie = '';
  t.after(async () => { await inst.close(); fs.rmSync(directory, {recursive: true, force: true}); });
  const raw = (url, body) => fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: body === undefined ? undefined : JSON.stringify(body)});
  const call = async (url, body, status = 200) => { const r = await raw(url, body); const text = await r.text(); assert.equal(r.status, status, url + ' ' + text); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; return text ? JSON.parse(text) : null; };
  await call('/api/setup', {name: 'Dono', username: 'admin', password: 'senha123'}); await call('/api/login', {username: 'admin', password: 'senha123'});
  return {inst, call, raw, base, directory};
}

test('1.0.9: foto do cliente — salvar, ver, trocar e remover; só para quem está logado', async t => {
  const {inst, call, raw, base, directory} = await boot(t);
  assert.match((await call('/api/members', {name: 'Ana', username: 'ana', photo: 'data:image/gif;base64,R0lGOD'}, 400)).error, /Foto inválida/);
  assert.equal(inst.store.state.members.length, 0, 'foto inválida não cria o cliente');
  const m = await call('/api/members', {name: 'Ana', username: 'ana', photo: JPG}); assert.ok(m.photo.v);
  assert.ok(fs.existsSync(path.join(directory, 'photos', m.id + '.jpg')));
  const r = await raw('/api/members/photo/' + m.id); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.ok((await fetch(base + '/api/members/photo/' + m.id)).status >= 400, 'sem login não vê a foto');
  assert.doesNotMatch(JSON.stringify(await call('/api/state')), /base64/, 'a foto não vai dentro do estado');
  await call('/api/members', {id: m.id, name: 'Ana Souza', username: 'ana', photoRemove: true});
  assert.equal(inst.store.state.members[0].photo, undefined); assert.ok(!fs.existsSync(path.join(directory, 'photos', m.id + '.jpg')));
  assert.equal((await raw('/api/members/photo/' + m.id)).status, 404);
});

test('1.0.9: exportar clientes e importar em outro servidor (todos os dados, menos a foto)', async t => {
  const a = await boot(t);
  const ana = await a.call('/api/members', {name: 'Ana Souza', username: 'ana', cpf: '529.982.247-25', phone: '(92) 99999-0000', email: 'ana@x.com', notes: 'Prefere PC 3', photo: JPG});
  await a.call('/api/members', {name: 'Bia', username: 'bia', active: false});
  const s = a.inst.store.state.members.find(m => m.id === ana.id); s.creditSeconds = 5400; s.pointsMilli = 12500;
  const r = await a.raw('/api/members/export.xlsx'); assert.equal(r.status, 200);
  const file = Buffer.from(await r.arrayBuffer());
  const parsed = imp.parse('clientes.xlsx', file.toString('base64'));
  assert.ok(parsed.columns.cpf && parsed.columns.phone && parsed.columns.email);
  const row = parsed.rows.find(x => x.username === 'ana');
  assert.equal(row.seconds, 5400); assert.equal(row.pointsMilli, 12500); assert.equal(row.cpf, '52998224725'); assert.equal(row.phone, '(92) 99999-0000'); assert.equal(row.email, 'ana@x.com'); assert.equal(row.notes, 'Prefere PC 3');
  assert.equal(parsed.rows.find(x => x.username === 'bia').inactive, true);
  assert.doesNotMatch(file.toString('latin1'), /base64|photo/i, 'a foto não vai para a planilha');
  // outro servidor (troca de computador ou de sistema)
  const b = await boot(t);
  const preview = await b.call('/api/members/import/preview', {fileName: 'clientes.xlsx', data: file.toString('base64')});
  assert.deepEqual(preview.rows.map(x => x.status), ['new', 'new']);
  const done = await b.call('/api/members/import', {rows: preview.rows}); assert.equal(done.imported, 2);
  const nova = b.inst.store.state.members.find(m => m.username === 'ana');
  assert.equal(nova.cpf, '52998224725'); assert.equal(nova.email, 'ana@x.com'); assert.equal(nova.creditSeconds, 5400); assert.equal(nova.pointsMilli, 12500); assert.match(nova.notes, /Prefere PC 3/);
  assert.equal(b.inst.store.state.members.find(m => m.username === 'bia').active, false);
  // CPF repetido e e-mail inválido aparecem como erro na prévia
  const csv = Buffer.from('﻿Nome;Nick;CPF;E-mail;Tempo\nCarla;carla;529.982.247-25;;10\nDudu;dudu;;dudu@;10\nEva;eva;111.111.111-11;;10\n').toString('base64');
  const p2 = await b.call('/api/members/import/preview', {fileName: 'x.csv', data: csv});
  assert.match(p2.rows[0].error, /CPF já cadastrado/); assert.match(p2.rows[1].error, /E-mail inválido/); assert.match(p2.rows[2].error, /CPF inválido/);
});
