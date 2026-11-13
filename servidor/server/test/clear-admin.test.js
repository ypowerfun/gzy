'use strict';
// 1.4.3: ClearAd (substitui o ClearAll) — redefine a senha do administrador principal com o servidor encerrado,
// sem mexer em mais nada (clientes, vendas, contas, configurações).
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {execFileSync} = require('node:child_process');
const {Store, passwordHash, verify} = require('../store');
const {info, resetAdmin} = require('../clear-admin');
const {createServer} = require('../server');

test('1.4.3: ClearAd redefine só a senha do administrador principal, encerra as sessões dele e registra no Log', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-clearad-')); let store = new Store(dir);
  try {
    assert.throws(() => { store.close(); info(dir); }, /ainda não tem administrador/); store = new Store(dir);
    store.state.operators.push({id: 'o1', username: 'dono', hash: passwordHash('esqueci-a-senha'), role: 'admin', owner: true, active: false, disabledAt: 5},
      {id: 'o2', username: 'caixa', hash: passwordHash('caixa-123'), role: 'operator', active: true});
    store.state.panelSessions = [{hash: 'a'.repeat(64), id: 'o1', until: Date.now() + 1e9}, {hash: 'b'.repeat(64), id: 'o1', until: Date.now() + 1e9, remote: true}, {hash: 'c'.repeat(64), id: 'o2', until: Date.now() + 1e9}];
    const m = store.memberSave({name: 'Ana', username: 'ana'}, 'dono'); store.credit(m.id, {minutes: 60, paymentMethod: 'cash'}, 'dono');
    store.persist(); store.close();
    assert.deepEqual(info(dir), {username: 'dono', active: false});
    await assert.rejects(resetAdmin(dir, '1234567'), /entre 8 e 24/);
    // pela linha de comando: a senha vai pela entrada padrão (não aparece na lista de processos)
    const out = JSON.parse(execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'clear-admin.js'), dir], {input: 'Nova-Senha-1\n', encoding: 'utf8', env: {...process.env, FORCE_COLOR: '0', NO_COLOR: '1'}}));
    assert.equal(out.username, 'dono'); assert.equal(out.reactivated, true); assert.equal(out.sessionsClosed, 2); assert.ok(fs.existsSync(out.backup));
    store = new Store(dir); const s = store.state;
    const dono = s.operators.find(o => o.id === 'o1'), caixa = s.operators.find(o => o.id === 'o2');
    assert.ok(verify('Nova-Senha-1', dono.hash)); assert.ok(!verify('esqueci-a-senha', dono.hash)); assert.equal(dono.active, true); assert.equal(dono.disabledAt, undefined);
    assert.ok(verify('caixa-123', caixa.hash), 'a outra conta não muda');
    assert.deepEqual(s.panelSessions.map(x => x.id), ['o2'], 'só as sessões do administrador principal caem');
    assert.equal(s.members.length, 1); assert.equal(s.members[0].creditSeconds, 3600, 'clientes e saldos ficam');
    assert.ok(store.logs().some(l => l.actor === 'ClearAd' && /Senha do administrador principal \(dono\) redefinida/.test(l.detail)));
    store.close();
    // o servidor abre e entra com a senha nova
    const inst = createServer({directory: dir, noTimer: true}); await new Promise(r => inst.server.listen(0, '127.0.0.1', r));
    try {
      const login = p => fetch('http://127.0.0.1:' + inst.server.address().port + '/api/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'dono', password: p})});
      assert.equal((await login('esqueci-a-senha')).status, 401); assert.equal((await login('Nova-Senha-1')).status, 200);
    } finally { await inst.close(); }
  } finally { try { store.close(); } catch { } fs.rmSync(dir, {recursive: true, force: true, maxRetries: 5}); }
});
