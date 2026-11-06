'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Integrações externas: Mercado Pago (PIX), login com Google e envio de e-mail (SMTP).
// Todas são configuradas por variáveis de ambiente (/etc/gamezoney-site.env no VPS).

// ---------- Mercado Pago: PIX e cartão ----------
// MP_ACCESS_TOKEN = Access Token de PRODUÇÃO (Mercado Pago > Suas integrações > Credenciais).
const MP = 'https://api.mercadopago.com';
function mercadoPago(env, fetchImpl = fetch) {
  const token = env.MP_ACCESS_TOKEN;
  const call = async (method, url, body, idem) => {
    const r = await fetchImpl(MP + url, {method, signal: AbortSignal.timeout(20000), headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', ...(idem ? {'X-Idempotency-Key': idem} : {})}, body: body ? JSON.stringify(body) : undefined});
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Mercado Pago: ' + (data.message || ('HTTP ' + r.status)));
    return data;
  };
  return {
    enabled: !!token,
    async createPix({orderId, amountCents, description, email, name, notificationUrl, expiresAt}) {
      const p = await call('POST', '/v1/payments', {
        transaction_amount: amountCents / 100, description, payment_method_id: 'pix', external_reference: orderId,
        notification_url: notificationUrl, date_of_expiration: new Date(expiresAt).toISOString().replace('Z', '-00:00'),
        payer: {email, first_name: (name || '').split(' ')[0] || 'Cliente'}
      }, orderId);
      const t = p.point_of_interaction?.transaction_data || {};
      return {providerId: String(p.id), status: p.status, pixCode: t.qr_code || '', pixQr: t.qr_code_base64 || '', pixUrl: t.ticket_url || ''};
    },
    // cartão de crédito ou débito: Checkout do Mercado Pago (o cliente digita o cartão no Mercado Pago; o site nunca vê os dados do cartão)
    async createCardCheckout({orderId, amountCents, title, email, notificationUrl, backUrl}) {
      const p = await call('POST', '/checkout/preferences', {
        items: [{id: 'gamezoney-licenca-vitalicia', title, quantity: 1, currency_id: 'BRL', unit_price: amountCents / 100}],
        payer: {email}, external_reference: orderId, notification_url: notificationUrl, statement_descriptor: 'GAMEZONEY',
        back_urls: {success: backUrl, pending: backUrl, failure: backUrl}, auto_return: 'approved',
        payment_methods: {excluded_payment_types: [{id: 'ticket'}, {id: 'atm'}, {id: 'bank_transfer'}], installments: 12}
      }, 'pref-' + orderId);
      return {providerId: String(p.id), url: p.init_point};
    },
    // 1.9: pagamento feito no Checkout Bricks (quadro do Mercado Pago dentro do site: PIX, crédito e débito).
    // O valor vem SEMPRE do pedido (nunca do navegador). O cartão chega como token de uso único: o site nunca vê o cartão.
    async createBrickPayment({orderId, amountCents, description, email, notificationUrl, formData, deviceId, attempt}) {
      const f = formData || {}, method = String(f.payment_method_id || '');
      if (!/^[a-z_]{2,30}$/.test(method)) throw new Error('Forma de pagamento inválida.');
      const pix = method === 'pix', idn = f.payer && f.payer.identification;
      const body = {transaction_amount: amountCents / 100, description, payment_method_id: method, external_reference: orderId, notification_url: notificationUrl, statement_descriptor: 'GAMEZONEY',
        payer: {email: String((f.payer && f.payer.email) || email).slice(0, 200), ...(idn && idn.type && idn.number ? {identification: {type: String(idn.type).slice(0, 10), number: String(idn.number).replace(/\D/g, '').slice(0, 20)}} : {})}};
      if (pix) body.date_of_expiration = new Date(Date.now() + 30 * 60000).toISOString().replace('Z', '-00:00');
      else {
        if (!/^[A-Za-z0-9_-]{8,200}$/.test(String(f.token || ''))) throw new Error('Dados do cartão incompletos.');
        body.token = String(f.token); body.installments = Math.max(1, Math.min(12, Math.floor(Number(f.installments) || 1)));
        if (f.issuer_id && /^\d{1,12}$/.test(String(f.issuer_id))) body.issuer_id = Number(f.issuer_id);
      }
      const r = await fetchImpl(MP + '/v1/payments', {method: 'POST', signal: AbortSignal.timeout(30000), body: JSON.stringify(body),
        headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Idempotency-Key': orderId + '-' + attempt, ...(deviceId && /^[A-Za-z0-9.:_-]{6,120}$/.test(deviceId) ? {'X-meli-session-id': deviceId} : {})}});
      const p = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error('Mercado Pago: ' + (p.message || ('HTTP ' + r.status))); e.mp = p; throw e; }
      const t = p.point_of_interaction?.transaction_data || {};
      return {providerId: String(p.id), status: p.status, detail: p.status_detail || '', amountCents: Math.round(Number(p.transaction_amount) * 100), orderId: p.external_reference || '',
        pix, pixCode: t.qr_code || '', pixQr: t.qr_code_base64 || '', pixUrl: t.ticket_url || ''};
    },
    // pagamentos de um pedido (procurados pela referência do pedido)
    async findPayments(orderId) {
      const r = await call('GET', '/v1/payments/search?' + new URLSearchParams({external_reference: orderId, sort: 'date_created', criteria: 'desc'}));
      return (r.results || []).map(p => ({id: String(p.id), status: p.status, amountCents: Math.round(Number(p.transaction_amount) * 100), orderId: p.external_reference || ''}));
    },
    // nunca confiar no corpo do aviso: o pagamento é sempre consultado no Mercado Pago
    async getPayment(id) { const p = await call('GET', '/v1/payments/' + encodeURIComponent(id)); return {id: String(p.id), status: p.status, amountCents: Math.round(Number(p.transaction_amount) * 100), orderId: p.external_reference || ''}; }
  };
}

// ---------- Google (OAuth 2.0 / OpenID Connect) ----------
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (Google Cloud Console > APIs e serviços > Credenciais > ID do cliente OAuth, tipo "Aplicativo da Web").
// URI de redirecionamento autorizado: https://gamezoney.com/auth/google/callback
function google(env, fetchImpl = fetch) {
  const id = env.GOOGLE_CLIENT_ID, secret = env.GOOGLE_CLIENT_SECRET;
  return {
    enabled: !!(id && secret),
    authUrl(redirectUri, state) {
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.search = new URLSearchParams({client_id: id, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account'}).toString();
      return u.href;
    },
    async profile(code, redirectUri) {
      const r = await fetchImpl('https://oauth2.googleapis.com/token', {method: 'POST', signal: AbortSignal.timeout(15000), headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({code, client_id: id, client_secret: secret, redirect_uri: redirectUri, grant_type: 'authorization_code'})});
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.id_token) throw new Error('Google recusou o login.');
      // o id_token veio direto do Google por HTTPS: confere emissor, destinatário, validade e e-mail verificado
      const claims = JSON.parse(Buffer.from(data.id_token.split('.')[1], 'base64url').toString('utf8'));
      if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) || claims.aud !== id || claims.exp * 1000 < Date.now()) throw new Error('Login do Google inválido.');
      if (!claims.email || claims.email_verified === false) throw new Error('O e-mail da conta Google não está verificado.');
      return {sub: String(claims.sub), email: String(claims.email).toLowerCase(), name: String(claims.name || '')};
    }
  };
}

// ---------- E-mail (SMTP) ----------
// SMTP_HOST, SMTP_PORT (465 ou 587), SMTP_USER, SMTP_PASS, MAIL_FROM (ex.: "GameZoney <contato@gamezoney.com>").
// A HostGator oferece contas de e-mail do domínio (servidor SMTP: o nome do servidor mostrado no cPanel, ex.: br123.hostgator.com.br). Sem SMTP o site funciona e grava o e-mail no log.
function mailer(env, log = console) {
  let transport = null;
  if (env.SMTP_HOST) {
    const nodemailer = require('nodemailer');
    const port = Number(env.SMTP_PORT || 465);
    // o servidor se apresenta (EHLO) com o domínio do site: o Titan recusa o login quando vem o nome da máquina do VPS
    let ehlo = env.SMTP_EHLO_NAME; try { ehlo ||= new URL(env.SITE_URL || 'https://gamezoney.com').hostname; } catch { ehlo ||= 'gamezoney.com'; }
    transport = nodemailer.createTransport({host: env.SMTP_HOST, port, secure: port === 465, name: ehlo, auth: env.SMTP_USER ? {user: env.SMTP_USER, pass: env.SMTP_PASS} : undefined});
  }
  return {
    enabled: !!transport,
    // 1.8: todo e-mail vai com o visual GameZoney (HTML) + o texto simples; opts.html vem pronto do modelo (email-template.js)
    async send(to, subject, text, opts = {}) {
      if (!transport) { log.log(`[e-mail não enviado: SMTP não configurado] para ${to}: ${subject}`); return false; }
      const html = opts.html || require('./email-template').fromText(text, env.SITE_URL);
      try { await transport.sendMail({from: env.MAIL_FROM || env.SMTP_USER, to, subject, text, html, headers: opts.headers || undefined}); return true; }
      catch (e) { log.error('Falha ao enviar e-mail:', e.message); return false; }
    }
  };
}
module.exports = {mercadoPago, google, mailer};
