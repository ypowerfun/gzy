'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.4.7 (pedido do dono): plano FREE para sempre (sem entrar em conta) com acesso limitado:
//  até 10 PCs, 2 consoles (TVs), 10 produtos, 5 serviços e 5 categorias. Standard e Pro (lic.features().unlimited) não têm limite.
//  - Cadastrar além do limite é recusado (estação nova ou reativada, produto/serviço/categoria novos, importação de produtos).
//  - Plano Standard/Pro que não foi renovado (ou dados de antes): o que já existe além do limite CONTINUA FUNCIONANDO normalmente
//    (sessões, vendas, estoque). Só não dá para ALTERAR a configuração desses itens enquanto passar do limite; remover/desativar pode
//    (assim a arena volta para dentro do limite). Assinando de novo e entrando com a conta, tudo volta a poder ser alterado.
const {fail} = require('./store');
const LIMITS = {computer: 10, tv: 2, products: 10, services: 5, categories: 5};
const NAMES = {computer: `até ${LIMITS.computer} PCs`, tv: `até ${LIMITS.tv} consoles`, products: `até ${LIMITS.products} produtos`, services: `até ${LIMITS.services} serviços`, categories: `até ${LIMITS.categories} categorias`};
const LABEL = {computer: 'PCs', tv: 'consoles', products: 'produtos', services: 'serviços', categories: 'categorias'};
const BUY = 'Assine o Standard ou o Pro em gamezoney.com e entre com a conta em Configuração › Licença.';
const newMsg = key => `Plano Free: ${NAMES[key]}. Para cadastrar mais, ${BUY.charAt(0).toLowerCase() + BUY.slice(1)}`;
const editMsg = (key, n) => `Plano Free: você tem ${n} ${LABEL[key]} (o limite é ${LIMITS[key]}). Eles continuam funcionando normalmente, mas para alterar a configuração ${BUY.charAt(0).toLowerCase() + BUY.slice(1)}`;

module.exports = function planLimits(store, lic, options = {}) {
  const on = () => options.enabled !== false && !lic.features().unlimited;
  const stationsOf = kind => store.state.stations.filter(s => s.kind === kind && s.active !== false && !s.removedAt);
  const used = () => ({computer: stationsOf('computer').length, tv: stationsOf('tv').length,
    products: (store.state.products || []).filter(p => p.active).length, services: (store.state.services || []).filter(p => p.active).length,
    categories: (store.state.categories || []).length});
  const over = key => on() && used()[key] > LIMITS[key];
  // estação: nova, reativada, trocando de tipo ou só editando
  function station({id, kind, active}) {
    if (!on() || !LIMITS[kind]) return;
    const cur = id ? store.state.stations.find(s => s.id === id) : null;
    const same = cur && cur.active !== false && !cur.removedAt && cur.kind === kind;
    if (active === false) return; // desativar sempre pode (diminui o uso)
    if (same) { if (over(kind)) fail(editMsg(kind, used()[kind])); return; } // editar com o tipo acima do limite
    if (stationsOf(kind).filter(s => s.id !== id).length >= LIMITS[kind]) fail(newMsg(kind));
  }
  // produto/serviço/categoria novo(s) — "count" = quantos de uma vez (importação)
  function add(key, count = 1) {
    if (!on() || count <= 0) return;
    if (used()[key] + count > LIMITS[key]) fail(newMsg(key));
  }
  // alterar um item que já existe (produto, serviço, categoria) com o tipo acima do limite
  function edit(key) { if (over(key)) fail(editMsg(key, used()[key])); }
  function status() {
    const u = used();
    return {free: on(), limits: LIMITS, used: u, over: on() ? Object.keys(LIMITS).filter(k => u[k] > LIMITS[k]) : []};
  }
  return {station, add, edit, status, LIMITS};
};
module.exports.LIMITS = LIMITS;
