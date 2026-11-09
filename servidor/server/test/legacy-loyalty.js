'use strict';
// 1.1.4: instalação nova começa com o programa fidelidade ZERADO. Os testes antigos foram escritos com a regra padrão
// de antes (1 medalha por R$ 1, prêmio de 60 min a cada 10 medalhas): aplicam essa regra de propósito.
module.exports = store => { store.state.settings.loyalty = {enabled: true, basis: 'spend', rate: 1, thresholdMilli: 10000, rewardMinutes: 60}; return store; };
