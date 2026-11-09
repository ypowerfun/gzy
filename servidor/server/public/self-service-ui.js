'use strict';
// 1.1.0: Configuração › Autoatendimento no PC — o cliente cria a conta e recarrega por PIX no próprio PC (Cliente 1.0.8+).
const PIX_STATUS = {pending: 'Aguardando pagamento', approved: 'Pago • tempo liberado', expired: 'Expirado', cancelled: 'Cancelado no PC', error: 'Pago • lance manual'};
function selfServiceSection(d) {
  const sec = document.createElement('section'); sec.id = 'self-section'; sec.className = 'panel';
  sec.innerHTML = `<h2>Autoatendimento no PC</h2><p class="hint">Com o GameZoney Cliente 1.0.11 ou mais novo, a tela de login do PC ganha <strong>Criar conta</strong> e <strong>Pagar via PIX</strong> (ao lado do Entrar) e, durante a sessão, o botão <strong>+ Tempo</strong>. Pagar via PIX sem conta pede só o e-mail e libera o PC como visitante. O cliente paga o PIX na tela e o tempo entra sozinho quando o pagamento é aprovado — o PC já entra na sessão, sem fila no balcão. A recarga entra como venda PIX no caixa aberto (com o caixa fechado, o PIX no PC fica indisponível).</p>
    <form id="self-form" class="am-form">
      <label class="check"><input type="checkbox" name="signup" ${d.signup ? 'checked' : ''}> Permitir que o cliente crie a própria conta no PC</label>
      <label class="check"><input type="checkbox" name="pix" ${d.pix ? 'checked' : ''}> Permitir recarga por PIX no PC (liberação automática)</label>
      <h3>Mercado Pago da arena</h3>
      <p class="hint">O PIX cai na conta Mercado Pago da sua arena. Em mercadopago.com.br › Seu negócio › Configurações › Credenciais (ou developers › Suas integrações), copie o <strong>Access Token de produção</strong> (começa com APP_USR-) e cole abaixo. Ele fica guardado só neste servidor e não aparece de novo na tela. ${d.tokenSet ? '<strong style="color:var(--green)">Access Token configurado.</strong>' : '<strong style="color:#ffb84d">Access Token ainda não configurado.</strong>'}</p>
      <div class="row"><label>Access Token${d.tokenSet ? ' (vazio = manter o atual)' : ''}<input name="token" type="text" data-secret autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" maxlength="200" placeholder="APP_USR-..."></label>
      <label>E-mail do pagador (opcional)<input name="payerEmail" maxlength="120" placeholder="usado quando o cliente não tem e-mail" value="${esc(d.payerEmail || '')}"></label></div>
      ${d.tokenSet ? '<label class="check"><input type="checkbox" name="removeToken"> Remover o Access Token deste servidor</label>' : ''}
      <div class="row"><label>Nome da organização ou do proprietário (OBS em cima do QR Code no PC)<input name="payeeName" maxlength="80" placeholder="ex.: Arena Gamer Centro • João da Silva" value="${esc(d.payeeName || '')}"></label></div>
      <p class="hint">Aparece no PC em cima do QR Code como <strong>OBS: ${esc(d.payeeName || 'nome da organização')}</strong>, para o cliente conferir para quem está pagando (use o mesmo nome que aparece no app do banco ao pagar).</p>
      <h3>Pacotes no PC</h3>
      <p class="hint">Marque os pacotes promocionais (cadastrados em <strong>Promoções</strong>) que aparecem para o cliente no PC.</p>
      <div class="self-promos" style="margin-bottom:12px">${(d.promotionsList || []).map(p => `<label class="check"><input type="checkbox" name="promo" value="${esc(p.id)}" ${p.active ? '' : 'disabled'} ${p.active && (d.promotionIds || []).includes(p.id) ? 'checked' : ''}> ${esc(p.name)} — ${money(p.cents)} • ${p.minutes} min${p.active ? '' : ' (inativa ou sem preço)'}</label>`).join('') || '<p class="hint"><strong>Nenhuma promoção cadastrada.</strong> Cadastre os pacotes em Promoções e volte aqui para escolher.</p>'}</div>
      <label class="check"><input type="checkbox" name="custom" ${d.custom ? 'checked' : ''}> Permitir que o cliente digite o valor que quiser (Outro valor)</label>
      <div class="row"><label>Valor mínimo (R$)<input name="customMin" inputmode="decimal" maxlength="10" value="${esc(((d.customMinCents ?? 500) / 100).toFixed(2).replace('.', ','))}"></label><label>Valor máximo (R$)<input name="customMax" inputmode="decimal" maxlength="10" value="${esc(((d.customMaxCents ?? 20000) / 100).toFixed(2).replace('.', ','))}"></label></div>
      <p class="hint">Ex.: mínimo 5,00 = o PC aceita PIX de R$ 5,00 para cima. O tempo é calculado pelo valor da hora.</p>
      <p class="hint">No PC agora: ${(d.options || []).map(o => `${esc(o.label)} = ${o.minutes} min`).join(' • ') || 'nenhum pacote marcado'}${d.customInfo ? ` • Outro valor de ${money(d.customInfo.min)} a ${money(d.customInfo.max)}` : ''}</p>
      <div class="dialog-actions" style="justify-content:flex-start;gap:10px"><button class="primary" style="flex:0 0 auto">Salvar</button>${d.tokenSet ? '<button type="button" class="ghost" data-mp-test style="flex:0 0 auto">Testar Mercado Pago</button>' : ''}</div><p class="hint" id="self-test"></p><p class="error" id="self-error"></p>
    </form>
    ${(d.charges || []).length ? `<h3 style="margin-top:18px">Últimos PIX no PC</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>PC</th><th>Cliente</th><th>Pacote</th><th>Valor</th><th>Situação</th></tr></thead><tbody>${d.charges.map(c => `<tr><td>${datetime(c.createdAt)}</td><td>${esc(c.stationName)}</td><td>${esc(c.username)}</td><td>${esc(c.label)}</td><td>${money(c.cents)}</td><td>${esc(PIX_STATUS[c.status] || c.status)}${c.error ? `<small class="subtext">${esc(c.error)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  const testBtn = sec.querySelector('[data-mp-test]');
  if (testBtn) testBtn.onclick = async () => {
    const out = sec.querySelector('#self-test'); testBtn.disabled = true; out.textContent = 'Testando…'; out.style.color = '';
    try { const r = await api('/self-service/test', {}); out.textContent = `Mercado Pago OK: conta ${r.account}${r.id ? ' (ID ' + r.id + ')' : ''}. O PIX no PC vai cair nessa conta.`; out.style.color = 'var(--green)'; }
    catch (err) { out.textContent = err.message; out.style.color = '#ff8793'; }
    finally { testBtn.disabled = false; }
  };
  sec.querySelector('#self-form').onsubmit = async e => {
    e.preventDefault(); const f = e.target, b = e.submitter; b.disabled = true; sec.querySelector('#self-error').textContent = '';
    try { const r = await api('/self-service', {signup: f.signup.checked, pix: f.pix.checked, token: f.token.value.trim(), removeToken: !!f.removeToken?.checked, payerEmail: f.payerEmail.value, promotionIds: [...f.querySelectorAll('input[name=promo]:checked')].map(x => x.value), payeeName: f.payeeName.value, custom: f.custom.checked, customMin: f.customMin.value, customMax: f.customMax.value}); sec.replaceWith(selfServiceSection(r)); toast('Autoatendimento salvo.'); }
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
