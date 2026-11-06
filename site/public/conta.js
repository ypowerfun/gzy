'use strict';
(() => {
  let me = null, poll = null;
  const STATUS = {paid: ['Pago', 'ok'], pending: ['Aguardando pagamento', 'wait'], expired: ['Vencido', 'bad'], canceled: ['Cancelado', 'bad']};
  const METHOD = o => o.method === 'card' ? 'Cartão' : 'PIX';
  const size = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.ceil(b / 1024) + ' KB';
  async function load() {
    me = await loadMe();
    if (!me.user) { location.href = '/entrar.html?next=' + encodeURIComponent(location.pathname + location.hash); return; }
    $('#hello').textContent = 'Olá, ' + (me.user.name || me.user.email).split(' ')[0];
    $('#hello-sub').textContent = me.user.email + (me.user.google ? ' • conta Google' : '');
    $('#admin-link').classList.toggle('hidden', !me.admin);
    document.dispatchEvent(new CustomEvent('gz:account-ready'));
    // 1.3: confirmação do e-mail
    const vb = $('#verify-box'), vq = new URLSearchParams(location.search).get('verificado');
    if (vq === '1') { vb.className = 'msg ok'; vb.style.display = 'block'; vb.textContent = 'E-mail confirmado. Obrigado!'; }
    else if (!me.user.emailVerified) {
      vb.className = 'msg err'; vb.style.display = 'block';
      vb.innerHTML = `<span>${vq === '0' ? 'Link de confirmação inválido ou vencido.' : 'Confirme o seu e-mail pelo link que enviamos.'}</span> <button type="button" class="btn small ghost" id="verify-resend">Reenviar confirmação</button>`;
      $('#verify-resend').onclick = () => busy($('#verify-resend'), async () => { try { const r = await api('/api/auth/verify/resend', {}); vb.firstElementChild.textContent = r.sent ? 'Enviamos um novo link. Confira a caixa de entrada e o spam.' : 'Não foi possível enviar agora. Fale com o suporte.'; } catch (e) { vb.firstElementChild.textContent = e.message; } });
    } else vb.style.display = 'none';
    $('#download-list').innerHTML = me.downloads.length ? me.downloads.map(d => `<a class="btn ghost" href="/download/${encodeURIComponent(d.file)}">⬇ ${esc(d.file)} <small style="opacity:.7">(${size(d.size)})</small></a>`).join('') : '<p class="note">Os instaladores estarão disponíveis aqui em breve.</p>';
    $('#license-list').innerHTML = me.licenses.length ? `<div class="table"><table><thead><tr><th>Chave</th><th>Situação</th><th>Computador</th><th></th></tr></thead><tbody>${me.licenses.map(l => `<tr><td><span class="key">${esc(l.key)}</span><button type="button" class="copy-license" data-copy-license="${esc(l.key)}">Copiar chave</button><br><small class="note">Vitalícia • desde ${fmtDate(l.createdAt)}</small></td><td>${l.status !== 'active' ? '<span class="pill bad">Bloqueada</span>' : l.active ? '<span class="pill ok">Ativada</span>' : '<span class="pill wait">Pronta para ativar</span>'}</td><td>${l.active ? esc(l.machine || '—') + '<br><small class="note">' + fmtDate(l.activatedAt) + '</small>' : '—'}</td><td>${l.active ? `<button class="btn small ghost" data-release="${l.id}">Liberar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Você ainda não tem licença. <a href="/conta#comprar">Comprar licença</a></p>';
    $$('[data-copy-license]').forEach(button => button.onclick = async () => {
      try { await navigator.clipboard.writeText(button.dataset.copyLicense); button.textContent = 'Chave copiada'; }
      catch { button.textContent = 'Selecione a chave para copiar'; }
    });
    $$('[data-release]').forEach(b => b.onclick = async () => {
      const q = 'Liberar esta chave do computador atual? Depois ative-a no computador novo (Configuração › Licença).'; if (!window.confirm(window.gzSite ? gzSite.t(q) : q)) return;
      await busy(b, () => api('/api/licenses/' + b.dataset.release + '/release', {})); load();
    });
    $('#order-list').innerHTML = me.orders.length ? `<table><thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Situação</th><th>Chave</th></tr></thead><tbody>${me.orders.map(o => `<tr><td>${fmtDate(o.createdAt)}</td><td>${money(o.amountCents)}</td><td>${METHOD(o)}</td><td><span class="pill ${(STATUS[o.status] || [])[1] || ''}">${(STATUS[o.status] || [o.status])[0]}</span></td><td>${o.licenseKey ? `<span class="key" style="font-size:14px">${esc(o.licenseKey)}</span>` : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="note">Nenhum pedido ainda.</p>';
    $('#ticket-list').innerHTML = me.tickets.length ? `<table><thead><tr><th>Chamado</th><th>Resposta</th></tr></thead><tbody>${me.tickets.map(t => `<tr><td><b>${esc(t.subject)}</b> <span class="pill ${t.status === 'open' ? 'wait' : 'ok'}">${t.status === 'open' ? 'Aberto' : 'Respondido'}</span><br><small class="note">${fmtDate(t.created_at)}</small><p style="white-space:pre-wrap;margin:6px 0 0">${esc(t.message)}</p>${(t.images || []).length ? `<div class="thumbs ticket-imgs">${t.images.map(src => `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="Imagem do chamado"></a>`).join('')}</div>` : ''}</td><td style="white-space:pre-wrap">${t.reply ? esc(t.reply) : '<span class="note">Aguardando resposta</span>'}</td></tr>`).join('')}</tbody></table>` : '';
    // 2.4: um chamado por vez — enquanto houver chamado aguardando resposta, o formulário fica fechado
    const waiting = me.tickets.some(t => t.status === 'open');
    $('#support-form').classList.toggle('hidden', waiting); $('#support-wait').classList.toggle('hidden', !waiting);
    const pf = $('#profile-form'); pf.name.value = me.user.name || ''; pf.phone.value = me.user.phone || ''; pf.organization.value = me.user.organization || ''; pf.marketing.checked = me.user.marketing !== false;
    const c = siteConfig || await api('/api/config').catch(() => ({}));
    const contacts = [c.supportWhatsapp ? `WhatsApp: <a href="https://wa.me/${esc(c.supportWhatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(c.supportWhatsapp)}</a>` : '', c.supportEmail ? `E-mail: <a href="mailto:${esc(c.supportEmail)}">${esc(c.supportEmail)}</a>` : ''].filter(Boolean);
    if (contacts.length) $('#support-contacts').innerHTML = 'Abra um chamado (respondemos pelo e-mail da sua conta) ou fale direto: ' + contacts.join(' • ');
  }
  function showOrder(o, navigate = true) {
    const box = $('#checkout'); box.classList.remove('hidden'); if (navigate && location.hash !== '#comprar') location.hash = 'comprar';
    if (o.status === 'paid') {
      clearInterval(poll); poll = null;
      box.innerHTML = `<div class="msg ok" style="display:block;margin-top:18px">Pagamento confirmado! Sua chave de licença vitalícia:<br><span class="key" style="font-size:22px">${esc(o.licenseKey || '')}</span><br>Ative no GameZoney Servidor em Configuração › Licença. Também enviamos por e-mail.</div>`;
      load(); return;
    }
    if (o.status !== 'pending') { clearInterval(poll); poll = null; box.innerHTML = '<p class="msg err" style="display:block">Este PIX venceu. Clique em Pagar com PIX para gerar outro.</p>'; return; }
    if (o.method === 'brick') { if (!poll) poll = setInterval(async () => { try { const n = (await api('/api/orders/' + o.id)).order; if (n.status === 'paid' || n.pixCode) showOrder(n, false); } catch { } }, 5000); return; }
    if (o.method === 'card') {
      box.innerHTML = `<div class="msg ok" style="display:block;margin-top:18px">Confirmando o pagamento com cartão… Assim que o Mercado Pago aprovar, a chave aparece aqui (pode levar alguns minutos). <a href="${esc(o.checkoutUrl)}">Abrir o pagamento de novo</a></div>`;
      if (!poll) poll = setInterval(async () => { try { showOrder((await api('/api/orders/' + o.id)).order, false); } catch { } }, 5000);
      return;
    }
    if (o.provider === 'manual') {
      box.innerHTML = `<div style="margin-top:18px"><p>Faça um PIX de <b>${money(o.amountCents)}</b> para a chave abaixo e envie o comprovante pelo Suporte (informe o e-mail da conta). A licença aparece aqui assim que o pagamento for confirmado.</p>${o.pixKey ? `<p class="key">${esc(o.pixKey)}</p>` : ''}<p class="note">Pedido ${esc(o.id.slice(0, 8))}</p></div>`;
      return;
    }
    box.innerHTML = `<div class="pix">${o.pixQr ? `<img alt="QR Code PIX" src="data:image/png;base64,${esc(o.pixQr)}">` : ''}<div><p>Abra o app do seu banco, escolha <b>PIX › Ler QR Code</b> ou <b>PIX Copia e Cola</b> e pague <b>${money(o.amountCents)}</b>.</p><label>PIX Copia e Cola<textarea readonly id="pix-code">${esc(o.pixCode)}</textarea></label><div class="row" style="margin-top:10px"><button class="btn small" id="copy-pix" type="button">Copiar código</button><span class="note">Vence às ${new Date(o.expiresAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} • a confirmação é automática</span></div></div></div>`;
    $('#copy-pix').onclick = () => { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(o.pixCode).then(() => { $('#copy-pix').textContent = 'Copiado!'; }, () => { $('#pix-code').select(); }); else $('#pix-code').select(); };
    if (!poll) poll = setInterval(async () => { try { showOrder((await api('/api/orders/' + o.id)).order, false); } catch { } }, 5000);
  }
  $('#buy').onclick = () => busy($('#buy'), async () => { try { showOrder((await api('/api/checkout', {method: 'pix'})).order); load(); } catch (e) { showMsg($('#buy-msg'), e.message); } });
  // cartão de crédito ou débito: vai para o Checkout do Mercado Pago e volta para /conta?pedido=...
  $('#buy-card').onclick = () => busy($('#buy-card'), async () => { try { const o = (await api('/api/checkout', {method: 'card'})).order; if (o.status === 'paid') return showOrder(o); location.href = o.checkoutUrl; } catch (e) { showMsg($('#buy-msg'), e.message); } });
  // 1.9: Checkout Bricks — PIX, crédito e débito num só quadro do Mercado Pago, dentro desta página (sem ir para o Mercado Pago).
  // Os campos do cartão são do Mercado Pago (o site recebe só um token de uso único); o valor é sempre o do pedido no servidor.
  let brickCtl = null;
  const loadMpSdk = () => window.MercadoPago ? Promise.resolve() : new Promise((ok, err) => { const s = document.createElement('script'); s.src = 'https://sdk.mercadopago.com/js/v2'; s.onload = ok; s.onerror = () => err(new Error('Não foi possível carregar o pagamento do Mercado Pago. Confira a internet e tente de novo.')); document.head.appendChild(s); });
  async function openBrick(c) {
    showMsg($('#buy-msg'), '', true); $('#buy-msg').className = 'msg';
    const o = (await api('/api/checkout', {method: 'brick'})).order;
    if (o.status === 'paid' || o.pixCode) return showOrder(o);
    await loadMpSdk();
    const box = $('#checkout'); box.classList.remove('hidden'); box.innerHTML = '<div id="mp-brick" class="mp-brick" data-no-i18n></div><p class="note" style="margin-top:8px">Pagamento processado pelo Mercado Pago. Os dados do cartão são digitados direto no Mercado Pago e não passam pelo site da GameZoney.</p>';
    if (brickCtl) { try { brickCtl.unmount(); } catch { } brickCtl = null; }
    const lang = (window.gzSite && gzSite.lang) || 'pt', mp = new MercadoPago(c.mpPublicKey, {locale: lang === 'en' ? 'en-US' : lang === 'es' ? 'es-AR' : 'pt-BR'});
    brickCtl = await mp.bricks().create('payment', 'mp-brick', {
      initialization: {amount: o.amountCents / 100, payer: {email: (me && me.user && me.user.email) || ''}},
      customization: {paymentMethods: {bankTransfer: ['pix'], creditCard: 'all', debitCard: 'all', maxInstallments: 12},
        visual: {style: {theme: 'dark', customVariables: {baseColor: '#FDD034', baseColorFirstVariant: '#F0B11E', baseColorSecondVariant: '#FFEC6C', textPrimaryColor: '#F2F4F8', formBackgroundColor: '#121720', inputBackgroundColor: '#0B0E13'}}}},
      callbacks: {
        onReady: () => {},
        onError: err => { console.error(err); },
        onSubmit: ({formData}) => api('/api/checkout/brick', {orderId: o.id, formData, deviceId: window.MP_DEVICE_SESSION_ID || ''}).then(r => {
          if (r.payment.status === 'rejected') { showMsg($('#buy-msg'), r.payment.message); throw new Error(r.payment.message); }
          try { brickCtl.unmount(); } catch { } brickCtl = null;
          if (r.order.status === 'paid' || r.order.pixCode) showOrder(r.order, false);
          else { $('#checkout').innerHTML = '<div class="msg ok" style="display:block;margin-top:18px">Pagamento em análise no Mercado Pago… Assim que for aprovado, a chave aparece aqui e chega por e-mail (pode levar alguns minutos).</div>'; showOrder(r.order, false); }
        }, e => { showMsg($('#buy-msg'), e.message); throw e; })
      }
    });
  }
  // 2.0: Meu plano (assinatura Standard/Pro); a compra da licença vitalícia só aparece se a venda antiga estiver ligada
  const PERIOD = {mensal: 'mensal', anual: 'anual'};
  function renderPlan(m) {
    const box = $('#plan-box'); if (!box || !m) return;
    const p = m.plan, subs = m.subscriptions || [], d = t => new Date(t).toLocaleDateString('pt-BR');
    const cur = subs.find(s => s.source === 'mp' && ['pending', 'authorized', 'paused'].includes(s.status));
    let html = '<p class="eyebrow">Seu plano</p><h3>Meu plano</h3>';
    if (p) html += `<div class="plan-now"><div><span class="pill ${p.inGrace ? 'wait' : 'ok'}">${p.inGrace ? 'Renovação pendente' : 'Ativo'}</span><h4>${esc(p.name)} <small>${esc(PERIOD[p.period] || p.period)}</small></h4>
      <p class="note">${p.inGrace ? `O período pago terminou em ${d(p.paidUntil)}. Regularize até ${d(p.graceUntil)} para não bloquear recargas, sessões novas e vendas.` : `Válido até <b>${d(p.paidUntil)}</b>${p.autoRenew ? ' • renova sozinho no cartão' : ''}.`}</p></div>
      ${cur ? `<button type="button" class="btn small ghost" data-sub-cancel="${esc(cur.id)}">Cancelar assinatura</button>` : '<a class="btn small" href="/#precos">Assinar / renovar</a>'}</div>`;
    else if (cur) html += `<div class="plan-now"><div><span class="pill wait">${esc(cur.statusText)}</span><h4>${esc(cur.planName)} <small>${esc(cur.period)}</small></h4><p class="note">Assim que o Mercado Pago confirmar a cobrança no cartão, o plano fica ativo e você recebe um e-mail.</p></div><button type="button" class="btn small ghost" data-sub-cancel="${esc(cur.id)}">Cancelar assinatura</button></div>`;
    else html += '<div class="plan-now"><div><h4>Nenhum plano ativo</h4><p class="note">Escolha o Standard ou o Pro, mensal ou anual. Teste grátis de 30 dias no GameZoney Servidor.</p></div><a class="btn gold small" href="/#precos">Ver planos</a></div>';
    html += '<p class="note">O plano fica ligado a esta conta: no GameZoney Servidor, entre com o mesmo e-mail e senha do site.</p>';
    if (subs.length) html += `<details class="plan-history"><summary>Histórico de assinaturas</summary><div class="table"><table><thead><tr><th>Plano</th><th>Situação</th><th>Valor</th><th>Válido até</th></tr></thead><tbody>${subs.map(s => `<tr><td>${esc(s.planName)} <small class="note">${esc(s.period)}</small></td><td>${esc(s.statusText)}${s.note ? `<br><small class="note">${esc(s.note)}</small>` : ''}</td><td>${s.amountCents ? money(s.amountCents) : '—'}</td><td>${s.paidUntil ? d(s.paidUntil) : '—'}</td></tr>`).join('')}</tbody></table></div></details>`;
    box.innerHTML = html;
    $$('[data-sub-cancel]').forEach(b => b.onclick = () => { if (!window.confirm('Cancelar a assinatura? A cobrança automática para e o plano continua valendo até o fim do período já pago.')) return;
      busy(b, async () => { try { await api('/api/subscriptions/' + b.dataset.subCancel + '/cancel', {}); renderPlan(await api('/api/me')); } catch (e) { alert(e.message); } }); });
  }
  api('/api/me').then(renderPlan).catch(() => {});
  api('/api/config').then(c => {
    if (c.legacySales) $('#legacy-buy').classList.remove('hidden');
    if (c.bricks && c.mpPublicKey) {
      // um botão só: abre o quadro do Mercado Pago com PIX, crédito e débito
      $('#buy').textContent = 'Pagar com PIX ou cartão'; $('#buy-card').classList.add('hidden'); $('#card-note').classList.add('hidden');
      $('#buy').onclick = () => busy($('#buy'), async () => { try { await openBrick(c); } catch (e) { showMsg($('#buy-msg'), e.message); } });
      return;
    }
    if (c.card) { $('#buy-card').classList.remove('hidden'); $('#card-note').classList.remove('hidden'); }
  }).catch(() => {});
  const back = new URLSearchParams(location.search).get('pedido');
  if (back) api('/api/orders/' + encodeURIComponent(back)).then(r => showOrder(r.order)).catch(() => {});
  $('#logout').onclick = async () => { await api('/api/auth/logout', {}).catch(() => {}); location.href = '/'; };
  // 2.4: até 2 imagens/prints .jpg ou .png de até 1 MB cada
  const readFile = file => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
  let ticketImgs = [];
  const paintTicketThumbs = () => { $('#support-thumbs').innerHTML = ticketImgs.map((src, i) => `<div><img src="${src}" alt=""><button type="button" data-timg="${i}" aria-label="Remover">✕</button></div>`).join('');
    $$('[data-timg]').forEach(b => b.onclick = () => { ticketImgs.splice(Number(b.dataset.timg), 1); paintTicketThumbs(); }); };
  const sf = $('#support-form');
  sf.files.onchange = async () => {
    for (const file of [...sf.files.files]) {
      if (ticketImgs.length >= 2) { showMsg($('#support-msg'), 'No máximo 2 imagens.'); break; }
      if (!/^image\/(jpeg|png)$/.test(file.type)) { showMsg($('#support-msg'), 'Envie imagens .jpg ou .png.'); continue; }
      if (file.size > 1024 * 1024) { showMsg($('#support-msg'), 'Cada imagem pode ter no máximo 1 MB.'); continue; }
      ticketImgs.push(await readFile(file));
    }
    sf.files.value = ''; paintTicketThumbs();
  };
  sf.onsubmit = e => { e.preventDefault(); const f = e.target; busy(f.querySelector('button.btn'), async () => {
    try { await api('/api/support', {subject: f.subject.value, message: f.message.value, images: ticketImgs}); f.reset(); ticketImgs = []; paintTicketThumbs(); showMsg($('#support-msg'), 'Chamado enviado! Responderemos pelo e-mail da sua conta.', true); load(); } catch (err) { showMsg($('#support-msg'), err.message); } }); };
  // 2.4: redefinir a senha pelo link enviado ao e-mail da conta (também serve para criar senha numa conta Google)
  $('#password-reset').onclick = () => busy($('#password-reset'), async () => {
    try { const r = await api('/api/auth/forgot', {email: me.user.email}); showMsg($('#profile-msg'), r.mail === false ? 'O envio de e-mails está indisponível agora. Fale com o suporte.' : 'Enviamos para ' + me.user.email + ' um link para criar uma nova senha (vale 1 hora). Confira também o spam.', r.mail !== false); }
    catch (err) { showMsg($('#profile-msg'), err.message); } });
  $('#profile-form').onsubmit = e => { e.preventDefault(); const f = e.target; busy(f.querySelector('button'), async () => {
    try { await api('/api/profile', {name: f.name.value, phone: f.phone.value, organization: f.organization.value, marketing: f.marketing.checked}); showMsg($('#profile-msg'), 'Dados salvos.', true); load(); } catch (err) { showMsg($('#profile-msg'), err.message); } }); };
  // ---------- 1.2: avaliação (1 a 5 estrelas, texto e até 2 imagens .jpg/.png) ----------
  let stars = 0, kept = [], added = [];
  const pick = $('#star-pick');
  const paintStars = () => { pick.innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" class="${n <= stars ? 'on' : ''}" aria-label="${n}">★</button>`).join(''); $$('[data-star]').forEach(b => b.onclick = () => { stars = Number(b.dataset.star); paintStars(); }); };
  const paintThumbs = () => {
    $('#review-thumbs').innerHTML = [...kept.map((src, i) => `<div><img src="${esc(src)}" alt=""><button type="button" data-kept="${i}" aria-label="Remover">✕</button></div>`), ...added.map((src, i) => `<div><img src="${src}" alt=""><button type="button" data-added="${i}" aria-label="Remover">✕</button></div>`)].join('');
    $$('[data-kept]').forEach(b => b.onclick = () => { kept.splice(Number(b.dataset.kept), 1); paintThumbs(); });
    $$('[data-added]').forEach(b => b.onclick = () => { added.splice(Number(b.dataset.added), 1); paintThumbs(); });
  };
  const rf = $('#review-form'), rmsg = $('#review-msg');
  rf.files.onchange = async () => {
    for (const file of [...rf.files.files]) {
      if (kept.length + added.length >= 2) { showMsg(rmsg, 'No máximo 2 imagens.'); break; }
      if (!/^image\/(jpeg|png)$/.test(file.type)) { showMsg(rmsg, 'Envie imagens .jpg ou .png.'); continue; }
      if (file.size > 2 * 1024 * 1024) { showMsg(rmsg, 'Cada imagem pode ter no máximo 2 MB.'); continue; }
      added.push(await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); }));
    }
    rf.files.value = ''; paintThumbs();
  };
  // 2.4: depois de enviada, a avaliação aparece em modo lista; pode ser editada 1 vez e depois fica fechada
  let mine = null, canWrite = true, editing = false;
  const showReview = () => {
    const view = $('#review-view'), note = $('#review-view-note');
    $('#review-remove').classList.toggle('hidden', !mine);
    if (mine && !editing) {
      $('#review-view-stars').innerHTML = [1, 2, 3, 4, 5].map(n => `<span class="${n <= mine.stars ? '' : 'off'}">★</span>`).join('');
      $('#review-view-stars').setAttribute('aria-label', mine.stars + ' / 5');
      $('#review-view-text').textContent = mine.text;
      $('#review-view-imgs').innerHTML = mine.images.map(src => `<div><img src="${esc(src)}" alt=""></div>`).join('');
      $('#review-edit').classList.toggle('hidden', !canWrite);
      note.textContent = canWrite ? 'Você pode editar a sua avaliação uma vez.' : 'Avaliação já editada: não pode mais ser alterada.';
      view.classList.remove('hidden'); rf.classList.add('hidden'); return;
    }
    view.classList.add('hidden');
    if (!mine && !canWrite) { rf.classList.add('hidden'); view.classList.remove('hidden'); $('#review-view-stars').innerHTML = ''; $('#review-view-text').textContent = 'Você já avaliou o GameZoney. Obrigado!'; $('#review-view-imgs').innerHTML = ''; $('#review-edit').classList.add('hidden'); note.textContent = ''; return; }
    rf.classList.remove('hidden');
    $('#review-submit').textContent = editing ? 'Salvar edição' : 'Enviar avaliação';
    $('#review-cancel').classList.toggle('hidden', !editing); $('#review-edit-note').classList.toggle('hidden', !editing);
  };
  $('#review-edit').onclick = () => { editing = true; stars = mine.stars; rf.text.value = mine.text; kept = [...mine.images]; added = []; paintStars(); paintThumbs(); showReview(); rf.text.focus(); };
  $('#review-cancel').onclick = () => { editing = false; showReview(); };
  rf.onsubmit = e => { e.preventDefault(); busy($('#review-submit'), async () => {
    if (!stars) return showMsg(rmsg, 'Escolha de 1 a 5 estrelas.');
    try { const r = await api('/api/reviews', {stars, text: rf.text.value, keepImages: kept, images: added}); mine = r.review; canWrite = r.canWrite; const was = editing; editing = false; added = []; showReview(); showMsg(rmsg, was ? 'Avaliação editada. Obrigado!' : 'Avaliação enviada. Obrigado!', true); }
    catch (err) { showMsg(rmsg, err.message); } }); };
  $('#review-remove').onclick = async () => {
    const q = canWrite ? 'Excluir a sua avaliação?' : 'Excluir a sua avaliação? Ela já foi editada: depois de excluir, não será possível avaliar de novo.'; if (!window.confirm(window.gzSite ? gzSite.t(q) : q)) return;
    await api('/api/reviews/remove', {}).catch(() => {}); mine = null; stars = 0; kept = []; added = []; rf.text.value = ''; editing = false; paintStars(); paintThumbs(); showReview(); showMsg(rmsg, 'Avaliação excluída.', true);
  };
  api('/api/reviews/mine').then(r => { mine = r.review; canWrite = r.canWrite !== false; paintStars(); paintThumbs(); showReview(); }).catch(() => { paintStars(); showReview(); });
  load();
})();
