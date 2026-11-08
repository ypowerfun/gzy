'use strict';
// 1.1.0: Configuração › Autoatendimento no PC — o cliente cria a conta e recarrega por PIX no próprio PC (Cliente 1.0.8+).
const PIX_STATUS = {pending: 'Aguardando pagamento', approved: 'Pago • tempo liberado', expired: 'Expirado', cancelled: 'Cancelado no PC', error: 'Pago • lance manual'};
function selfServiceSection(d) {
  const sec = document.createElement('section'); sec.id = 'self-section'; sec.className = 'panel';
  sec.innerHTML = `<h2>Autoatendimento no PC</h2><p class="hint">Com o GameZoney Cliente 1.0.8 ou mais novo, a tela de login do PC ganha <strong>Criar conta</strong> e <strong>Recarregar com PIX</strong>. O cliente paga o PIX na tela e o tempo entra sozinho quando o pagamento é aprovado — o PC já entra na sessão, sem fila no balcão. A recarga entra como venda PIX no caixa aberto (com o caixa fechado, o PIX no PC fica indisponível).</p>
    <form id="self-form" class="am-form">
      <label class="check"><input type="checkbox" name="signup" ${d.signup ? 'checked' : ''}> Permitir que o cliente crie a própria conta no PC</label>
      <label class="check"><input type="checkbox" name="pix" ${d.pix ? 'checked' : ''}> Permitir recarga por PIX no PC (liberação automática)</label>
      <h3>Mercado Pago da arena</h3>
      <p class="hint">O PIX cai na conta Mercado Pago da sua arena. Em mercadopago.com.br › Seu negócio › Configurações › Credenciais (ou developers › Suas integrações), copie o <strong>Access Token de produção</strong> (começa com APP_USR-) e cole abaixo. Ele fica guardado só neste servidor e não aparece de novo na tela. ${d.tokenSet ? '<strong style="color:var(--green)">Access Token configurado.</strong>' : '<strong style="color:#ffb84d">Access Token ainda não configurado.</strong>'}</p>
      <div class="row"><label>Access Token${d.tokenSet ? ' (vazio = manter o atual)' : ''}<input name="token" type="text" data-secret autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" maxlength="200" placeholder="APP_USR-..."></label>
      <label>E-mail do pagador (opcional)<input name="payerEmail" maxlength="120" placeholder="usado quando o cliente não tem e-mail" value="${esc(d.payerEmail || '')}"></label></div>
      ${d.tokenSet ? '<label class="check"><input type="checkbox" name="removeToken"> Remover o Access Token deste servidor</label>' : ''}
      <h3>Pacotes no PC</h3>
      <div class="row"><label>Valores em reais (separados por vírgula)<input name="values" maxlength="60" value="${esc((d.values || []).map(v => String(v / 100).replace('.', ',')).join(', '))}"></label></div>
      <label class="check"><input type="checkbox" name="promotions" ${d.promotions !== false ? 'checked' : ''}> Mostrar também as promoções ativas</label>
      <label class="check"><input type="checkbox" name="custom" ${d.custom ? 'checked' : ''}> Permitir que o cliente digite o valor que quiser (Outro valor)</label>
      <div class="row"><label>Valor mínimo (R$)<input name="customMin" inputmode="decimal" maxlength="10" value="${esc(((d.customMinCents ?? 500) / 100).toFixed(2).replace('.', ','))}"></label><label>Valor máximo (R$)<input name="customMax" inputmode="decimal" maxlength="10" value="${esc(((d.customMaxCents ?? 20000) / 100).toFixed(2).replace('.', ','))}"></label></div>
      <p class="hint">Ex.: mínimo 5,00 = o PC aceita PIX de R$ 5,00 para cima. O tempo é calculado pelo valor da hora.</p>
      <p class="hint">No PC agora: ${(d.options || []).map(o => `${esc(o.label)} = ${o.minutes} min`).join(' • ') || 'nenhum pacote (configure o valor da hora ou os valores acima)'}${d.customInfo ? ` • Outro valor de ${money(d.customInfo.min)} a ${money(d.customInfo.max)}` : ''}</p>
      <div class="dialog-actions" style="justify-content:flex-start"><button class="primary" style="flex:0 0 auto">Salvar</button></div><p class="error" id="self-error"></p>
    </form>
    ${(d.charges || []).length ? `<h3 style="margin-top:18px">Últimos PIX no PC</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>PC</th><th>Cliente</th><th>Pacote</th><th>Valor</th><th>Situação</th></tr></thead><tbody>${d.charges.map(c => `<tr><td>${datetime(c.createdAt)}</td><td>${esc(c.stationName)}</td><td>${esc(c.username)}</td><td>${esc(c.label)}</td><td>${money(c.cents)}</td><td>${esc(PIX_STATUS[c.status] || c.status)}${c.error ? `<small class="subtext">${esc(c.error)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  sec.querySelector('#self-form').onsubmit = async e => {
    e.preventDefault(); const f = e.target, b = e.submitter; b.disabled = true; sec.querySelector('#self-error').textContent = '';
    try { const r = await api('/self-service', {signup: f.signup.checked, pix: f.pix.checked, token: f.token.value.trim(), removeToken: !!f.removeToken?.checked, payerEmail: f.payerEmail.value, values: f.values.value, promotions: f.promotions.checked, custom: f.custom.checked, customMin: f.customMin.value, customMax: f.customMax.value}); sec.replaceWith(selfServiceSection(r)); toast('Autoatendimento salvo.'); }
    catch (err) { sec.querySelector('#self-error').textContent = err.message; b.disabled = false; }
  };
  return sec;
}
(function () {
  const original = renderSettings;
  renderSettings = function () {
    original.apply(this, arguments);
    if (!isAdmin()) return;
    api('/self-service').then(d => { if (view !== 'settings') return; $('#self-section')?.remove(); const s = selfServiceSection(d), anchor = $('#print-section') || $('#net-section'); if (anchor) anchor.before(s); else $('#view').append(s); }).catch(() => {});
  };
})();
