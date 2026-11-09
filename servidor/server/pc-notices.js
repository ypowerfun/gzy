'use strict';
// 1.1.6: AVISOS AUTOMÁTICOS NA TELA DO PC, do mesmo jeito do "Enviar Mensagem" (comunicado no canto da tela, sem atrapalhar o jogo):
//  - Aviso de tempo: quando faltar o tempo configurado (padrão 5 minutos) para acabar a sessão do PC.
//  - Prêmio do programa fidelidade: quando o prêmio automático é liberado (o aviso ao lado do nome na barra continua igual).
// Configuração › Avisos automáticos no PC. Vale para todos os PCs (não para TVs) e funciona com qualquer versão do Cliente
// que já mostra o "Enviar Mensagem" (1.0.5 ou mais novo), porque o aviso vai pela mesma fila de mensagens.
const {fail, integer} = require('./store');
const DEFAULT = {timeWarning: true, warnMinutes: 5, warnText: 'Restam apenas *{minutos} minutos* de tempo. Faça uma recarga para continuar jogando!', loyalty: true, seconds: 10};
const clean = t => String(t ?? '').replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim();

module.exports = function pcNotices(store, pc) {
  const s = store.state;
  s.settings.pcNotices = {...DEFAULT, ...(s.settings.pcNotices || {})};
  const cfg = () => s.settings.pcNotices;
  const warned = new Set();   // sessões que já receberam o aviso de tempo (zera se o tempo voltar a passar do limite)

  // chamado pelo relógio do servidor (1 vez por segundo)
  function check(now = Date.now()) {
    const c = cfg(), limit = Number(c.warnMinutes) * 60000, active = new Set();
    for (const session of s.sessions) {
      if (session.status !== 'active') continue;
      active.add(session.id);
      const station = s.stations.find(x => x.id === session.stationId);
      if (!station || station.kind !== 'computer') continue;
      const left = session.endsAt - now;
      if (left > limit + 60000) { warned.delete(session.id); continue; }   // ganhou mais tempo (+ Tempo/recarga): pode avisar de novo
      if (!c.timeWarning || left > limit || left <= 15000 || warned.has(session.id)) continue;
      warned.add(session.id);
      const minutes = Math.max(1, Math.ceil(left / 60000));
      pc.sendMessage(station.id, clean(c.warnText).replace(/\{minutos\}/g, String(minutes)).slice(0, 200), c.seconds);
    }
    for (const id of warned) if (!active.has(id)) warned.delete(id);
  }
  // prêmio automático da fidelidade liberado (pc.js chama quando entrega o aviso do prêmio ao PC)
  function loyalty(stationId, title) {
    const c = cfg(); if (!c.loyalty || !title) return;
    pc.sendMessage(stationId, ('*Programa fidelidade*\n' + clean(title)).slice(0, 200), c.seconds);
  }
  function save(input, actor) {
    const warnText = clean(input.warnText) || DEFAULT.warnText;
    if (warnText.length > 160) fail('A mensagem do aviso de tempo pode ter até 160 caracteres.');
    const next = {timeWarning: input.timeWarning === true, warnMinutes: integer(input.warnMinutes, 1, 60, 'Minutos antes de acabar'), warnText,
      loyalty: input.loyalty === true, seconds: integer(input.seconds, 3, 120, 'Tempo na tela (segundos)')};
    return store.change(actor, 'config', `Avisos automáticos no PC: tempo ${next.timeWarning ? next.warnMinutes + ' min antes' : 'desligado'}, fidelidade ${next.loyalty ? 'ligado' : 'desligado'}, ${next.seconds} s na tela`, () => { s.settings.pcNotices = next; return next; });
  }
  return {check, loyalty, settings: () => ({...cfg(), defaultText: DEFAULT.warnText}), save};
};
