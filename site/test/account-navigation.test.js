'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('payment status polling preserves the account section chosen by the customer', async () => {
  // Exercise the actual checkout renderer with only its browser/API boundaries stubbed.
  const source = fs.readFileSync(path.join(__dirname, '../public/conta.js'), 'utf8');
  const renderer = source.slice(source.indexOf('  function showOrder('), source.indexOf("  $('#buy').onclick"));
  const box = {classList: {remove() {}}, innerHTML: ''};
  const location = {hash: '#visao-geral'};
  let tick;
  let refreshed = 0;
  let order = {id: 'local-test', status: 'pending', method: 'card', checkoutUrl: 'https://example.test/checkout'};
  const context = vm.createContext({
    $: () => box, location, poll: null, esc: String,
    load: () => { refreshed++; },
    api: async () => ({order}),
    setInterval: callback => { tick = callback; return 1; },
    clearInterval() {}
  });
  vm.runInContext(renderer, context);
  context.showOrder(order);
  assert.equal(location.hash, 'comprar');
  assert.match(box.innerHTML, /Confirmando o pagamento/);

  location.hash = '#suporte';
  await tick();
  assert.equal(location.hash, '#suporte');
  order = {...order, status: 'paid', licenseKey: 'DEMONSTRACAO'};
  await tick();
  assert.equal(location.hash, '#suporte');
  assert.match(box.innerHTML, /Pagamento confirmado/);
  assert.equal(refreshed, 1);
});
