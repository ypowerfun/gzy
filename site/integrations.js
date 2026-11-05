'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Integrações externas: Mercado Pago (PIX), login com Google e envio de e-mail (SMTP).
// Todas são configuradas por variáveis de ambiente (/etc/gamezoney-site.env no VPS).

// ---------- Mercado Pago: PIX ----------
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
// A HostGator oferece contas de e-mail do domínio (servidor SMTP: mail.gamezoney.com). Sem SMTP o site funciona e grava o e-mail no log.
function mailer(env, log = console) {
  let transport = null;
  if (env.SMTP_HOST) {
    const nodemailer = require('nodemailer');
    const port = Number(env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({host: env.SMTP_HOST, port, secure: port === 465, auth: env.SMTP_USER ? {user: env.SMTP_USER, pass: env.SMTP_PASS} : undefined});
  }
  return {
    enabled: !!transport,
    async send(to, subject, text) {
      if (!transport) { log.log(`[e-mail não enviado: SMTP não configurado] para ${to}: ${subject}`); return false; }
      try { await transport.sendMail({from: env.MAIL_FROM || env.SMTP_USER, to, subject, text}); return true; }
      catch (e) { log.error('Falha ao enviar e-mail:', e.message); return false; }
    }
  };
}
module.exports = {mercadoPago, google, mailer};
