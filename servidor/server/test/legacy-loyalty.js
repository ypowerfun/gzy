'use strict';
// 1.1.4: instalação nova começa com o programa fidelidade ZERADO. Os testes antigos foram escritos com a regra padrão
// de antes (1 medalha por R$ 1, prêmio de 60 min a cada 10 medalhas): aplicam essa regra de propósito.
// 1.4.4: a regra escondida (rate) saiu; a mesma regra agora é a tabela por dia: R$ 1,00 = 1 medalha todos os dias
module.exports = store => { store.state.settings.loyalty = {enabled: true, basis: 'spend', thresholdMilli: 10000, rewardMinutes: 60, weekly: Array.from({length: 7}, (_, day) => ({day, cents: 100, pointsMilli: 1000}))}; return store; };
