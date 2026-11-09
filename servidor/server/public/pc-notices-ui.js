'use strict';
// 1.1.6: Configuração › Avisos automáticos no PC (aviso de tempo acabando e prêmio da fidelidade, como o "Enviar Mensagem").
function pcNoticesSection(d) {
  const sec = document.createElement('section'); sec.id = 'pcn-section'; sec.className = 'panel';
  sec.innerHTML = `<h2>Avisos automáticos no PC</h2><p class="hint">Aparecem na tela do PC do mesmo jeito do <strong>Enviar Mensagem</strong> (no canto, sem atrapalhar o jogo), sozinhos.</p>
    <form id="pcn-form" class="am-form">
      <label class="check"><input type="checkbox" name="timeWarning" ${d.timeWarning ? 'checked' : ''}> Avisar quando o tempo estiver acabando</label>
      <div class="row"><label>Minutos antes de acabar<input name="warnMinutes" type="number" min="1" max="60" step="1" value="${Number(d.warnMinutes) || 5}"></label><label>Tempo na tela (segundos)<input name="seconds" type="number" min="3" max="120" step="1" value="${Number(d.seconds) || 10}"></label></div>
      <div class="row"><label>Mensagem do aviso de tempo<input name="warnText" maxlength="160" value="${esc(d.warnText || '')}"></label></div>
      <p class="hint">{minutos} vira os minutos que faltam. Texto entre *asteriscos* sai em dourado. Se o cliente comprar mais tempo, o aviso volta a valer na próxima vez que o tempo estiver acabando.</p>
      <label class="check"><input type="checkbox" name="loyalty" ${d.loyalty ? 'checked' : ''}> Mostrar o prêmio automático do programa fidelidade na tela</label>
      <p class="hint">Usa a mensagem do prêmio de Fidelidade › Mensagem do prêmio.</p>
      <div class="dialog-actions" style="justify-content:flex-start;gap:10px"><button class="primary" style="flex:0 0 auto">Salvar</button><button type="button" class="ghost" data-pcn-default style="flex:0 0 auto">Texto padrão</button></div><p class="error" id="pcn-error"></p>
    </form>`;
  sec.querySelector('[data-pcn-default]').onclick = () => { sec.querySelector('[name=warnText]').value = d.defaultText || ''; };
  sec.querySelector('#pcn-form').onsubmit = async e => {
    e.preventDefault(); const f = e.target, b = e.submitter; b.disabled = true; sec.querySelector('#pcn-error').textContent = '';
    try { const r = await api('/pc-notices', {timeWarning: f.timeWarning.checked, warnMinutes: Number(f.warnMinutes.value), seconds: Number(f.seconds.value), warnText: f.warnText.value, loyalty: f.loyalty.checked}); sec.replaceWith(pcNoticesSection({...r, defaultText: d.defaultText})); toast('Avisos automáticos salvos.'); }
    catch (err) { sec.querySelector('#pcn-error').textContent = err.message; b.disabled = false; }
  };
  return sec;
}
(function () {
  const original = renderSettings;
  renderSettings = function () {
    original.apply(this, arguments);
    if (!isAdmin()) return;
    api('/pc-notices').then(d => { if (view !== 'settings') return; $('#pcn-section')?.remove(); const s = pcNoticesSection(d), anchor = $('#print-section') || $('#net-section'); if (anchor) anchor.before(s); else $('#view').append(s); }).catch(() => {});
  };
})();
