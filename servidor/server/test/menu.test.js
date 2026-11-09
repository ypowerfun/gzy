'use strict';
// 1.2.0: estrutura do menu lateral — ordem dos itens, linhas douradas e itens do Pro (evita sumir a linha entre Ranking e Configuração)
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const pub = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
test('1.2.0: menu lateral — ordem, linhas douradas que não encolhem e itens só do Pro', () => {
  const html = pub('index.html'), nav = html.slice(html.indexOf('<nav>'), html.indexOf('</nav>'));
  const items = [...nav.matchAll(/<button data-view="([a-z]+)"|<div class="nav-sep[^"]*"/g)].map(m => m[1] || '-');
  assert.deepEqual(items, ['stations', 'members', 'loyalty', 'events', 'balance', '-', 'history', 'logs', 'finance', 'stats', '-', 'cash', 'shop', 'nfe', '-', 'ranking', '-', 'app', '-', 'settings']);
  assert.match(nav, /data-view="nfe" data-pro="true" class="hidden"/);
  assert.match(nav, /data-view="app" data-pro="true" data-admin="true" class="hidden"/);
  const css = pub('theme-gamezoney.css'), rule = css.match(/nav \.nav-sep\{[^}]*\}/)[0];
  assert.match(rule, /flex:none/, 'a linha dourada não pode encolher dentro do menu (coluna flexível)');
  assert.match(rule, /min-height:1px/);
  // toggle('hidden', x) com x indefinido ALTERNA a classe a cada atualização (o item piscava)
  const app = pub('app.js');
  assert.match(app, /nav \[data-pro\]'\)\.forEach\(b=>b\.classList\.toggle\('hidden',!state\.pro\|\|\(!!b\.dataset\.admin&&!isAdmin\(\)\)\)\)/);
  assert.doesNotMatch(pub('cash-ui.js'), /Notas Fiscais/, 'NF-e saiu das abas de Produtos/Serviços');
  assert.match(pub('app-manager-ui.js'), /async function renderAppManager/);
});
