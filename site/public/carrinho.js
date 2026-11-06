'use strict';
// GameZoney — site gamezoney.com — 2.0: carrinho do plano (Standard/Pro, mensal ou anual) e assinatura no cartão.
// Os campos do cartão são do Mercado Pago (Card Payment Brick): o site recebe só um token de uso único e cria a assinatura.
(async () => {
  const [hp, hper] = (location.hash.slice(1) || '').split('-');
  let plan = hp || 'standard', period = hper === 'anual' ? 'anual' : 'mensal', cfg, me, brick = null, poll = null;
  try { [cfg, me] = await Promise.all([api('/api/config'), api('/api/me')]); } catch (e) { $('#cart-loading').textContent = e.message; return; }
  if (!me.user) { location.href = '/entrar.html?next=' + encodeURIComponent(`/carrinho#${plan}-${period}`); return; }
  const plans = (cfg.plans || []).filter(p => !p.free); if (!plans.some(p => p.id === plan)) plan = (plans[0] || {}).id;
  $('#cart-loading').classList.add('hidden'); $('#cart').classList.remove('hidden');
  $('#cart-plan').innerHTML = plans.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  const msg = (t, ok) => showMsg($('#cart-msg'), t, ok);
  const closePay = () => { if (brick) { try { brick.unmount(); } catch { } brick = null; } $('#cart-pay').classList.add('hidden'); $('#cart-continue').classList.remove('hidden'); };

  function render() {
    const p = plans.find(x => x.id === plan), v = planView(p, period), annual = period === 'anual', months = annual ? 12 : 1;
    const full = annual ? (p.annualList || p.monthly * 12) : (p.monthlyList || 0), save = full > v.total ? full - v.total : 0;
    $('#cart-plan').value = plan; $('#cart-period').value = period;
    $('#cart-name').textContent = `Plano ${p.name}`; $('#cart-month').textContent = money(v.price); $('#cart-old').textContent = v.old ? money(v.old) + '/mês' : '';
    $('#cart-save').textContent = v.badge ? (save ? `Economize ${Math.round(save / full * 100)}%` : v.badge) : ''; $('#cart-save').classList.toggle('hidden', !v.badge);
    $('#cart-renew').textContent = annual ? `Cobrado ${money(p.annual)} a cada 12 meses no cartão. Cancele quando quiser.` : `Cobrado ${money(p.monthly)} a cada mês no cartão. Cancele quando quiser.`;
    const yearSave = p.monthly * 12 - p.annual;
    $('#cart-upsell').classList.toggle('hidden', annual || yearSave <= 0); $('#cart-upsell-text').textContent = yearSave > 0 ? ` Economize ${money(yearSave)} por ano com a assinatura de 12 meses.` : '';
    $('#cart-feats').innerHTML = p.features.map(f => `<li>${PLAN_ICON}<span>${esc(f)}</span></li>`).join('');
    $('#sum-plan').textContent = `Plano ${p.name}`; $('#sum-period').textContent = annual ? 'Duração de 12 meses' : 'Duração de 1 mês';
    $('#sum-old').textContent = full > v.total ? money(full) : ''; $('#sum-price').textContent = money(v.total);
    $('#sum-total-old').textContent = full > v.total ? money(full) : ''; $('#sum-total').textContent = money(v.total);
    $('#sum-renew').textContent = `Renovação automática: ${money(v.total)} a cada ${annual ? '12 meses' : 'mês'}. Cancele quando quiser.`;
    $('#sum-economy').textContent = save ? `🎉 Você está economizando ${money(save)} hoje` : ''; $('#sum-economy').classList.toggle('hidden', !save);
    history.replaceState(null, '', `#${plan}-${period}`); void months;
  }
  $('#cart-plan').onchange = e => { plan = e.target.value; closePay(); render(); };
  $('#cart-period').onchange = e => { period = e.target.value; closePay(); render(); };
  $('#cart-to-annual').onclick = () => { period = 'anual'; closePay(); render(); };
  render();

  // já tem plano com renovação automática: não deixa assinar outro por cima
  const auto = (me.subscriptions || []).find(s => s.source === 'mp' && ['pending', 'authorized', 'paused'].includes(s.status));
  if (auto) {
    $('#cart-continue').disabled = true;
    msg(`Você já tem a assinatura ${auto.planName} (${auto.period}). Para trocar de plano ou período, cancele a atual em Minha conta e assine de novo: o período já pago continua valendo.`);
  }
  if (!cfg.subscriptions) { $('#cart-continue').disabled = true; msg('A assinatura pelo site estará disponível em breve. Fale com a gente pelo Atendimento.'); }

  const loadSdk = () => window.MercadoPago ? Promise.resolve() : new Promise((ok, err) => { const s = document.createElement('script'); s.src = 'https://sdk.mercadopago.com/js/v2'; s.onload = ok; s.onerror = () => err(new Error('Não foi possível carregar o pagamento do Mercado Pago. Confira a internet e tente de novo.')); document.head.appendChild(s); });
  function done(r) {
    closePay(); $('#cart-continue').classList.add('hidden');
    const box = $('#cart-done'); box.classList.remove('hidden');
    if (r.plan && r.subscription && r.subscription.active) box.innerHTML = `<h2>Plano ativado! 🎉</h2><p>O plano <b>${esc(r.subscription.planName)}</b> está ativo até <b>${new Date(r.plan.paidUntil).toLocaleDateString('pt-BR')}</b>. A renovação é automática no cartão.</p><p>No GameZoney Servidor, entre com o mesmo e-mail e senha do site para usar o plano.</p><a class="btn gold" href="/conta#comprar">Ir para Minha conta</a>`;
    else {
      box.innerHTML = '<h2>Assinatura criada</h2><p>Aguardando o Mercado Pago confirmar a primeira cobrança no cartão… (normalmente leva poucos segundos; você também recebe um e-mail).</p><a class="btn outline" href="/conta#comprar">Ir para Minha conta</a>';
      clearInterval(poll); let tries = 0;
      poll = setInterval(async () => { if (++tries > 60) return clearInterval(poll); try { const m = await api('/api/me'); const s = (m.subscriptions || []).find(x => x.id === r.subscription.id); if (s && s.active) { clearInterval(poll); done({plan: m.plan, subscription: s}); } else if (s && ['failed', 'cancelled'].includes(s.status)) { clearInterval(poll); box.innerHTML = '<h2>Pagamento não confirmado</h2><p>O Mercado Pago não confirmou a cobrança no cartão. Tente outro cartão ou fale com o Atendimento.</p>'; } } catch { } }, 5000);
    }
  }
  $('#cart-continue').onclick = () => busy($('#cart-continue'), async () => {
    try {
      msg('', true); $('#cart-msg').className = 'msg';
      await loadSdk(); $('#cart-pay').classList.remove('hidden'); $('#cart-continue').classList.add('hidden');
      const p = plans.find(x => x.id === plan), total = planView(p, period).total, lang = (window.gzSite && gzSite.lang) || 'pt';
      const mp = new MercadoPago(cfg.mpPublicKey, {locale: lang === 'en' ? 'en-US' : lang === 'es' ? 'es-AR' : 'pt-BR'});
      if (brick) { try { brick.unmount(); } catch { } }
      brick = await mp.bricks().create('cardPayment', 'mp-card', {
        initialization: {amount: total / 100, payer: {email: me.user.email}},
        customization: {paymentMethods: {maxInstallments: 1, types: {excluded: ['debit_card', 'prepaid_card']}},
          visual: {style: {theme: 'dark', customVariables: {baseColor: '#FDD034', baseColorFirstVariant: '#F0B11E', baseColorSecondVariant: '#FFEC6C', textPrimaryColor: '#F2F4F8', formBackgroundColor: '#121720', inputBackgroundColor: '#0B0E13'}}}},
        callbacks: {
          onReady: () => $('#cart-pay').scrollIntoView({behavior: 'smooth', block: 'start'}),
          onError: err => console.error(err),
          onSubmit: data => api('/api/subscriptions', {plan, period, token: data.token, payerEmail: data.payer && data.payer.email}).then(done, e => { msg(e.message); throw e; })
        }
      });
    } catch (e) { msg(e.message); closePay(); }
  });
})();
