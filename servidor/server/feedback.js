'use strict';
// 1.0.5: Perfil > Feedback. Guarda no banco do servidor e envia ao servidor central da GameZoney
// (padrão https://gamezoney.com/api/feedback; outro endereço: variável GZ_FEEDBACK_URL).
// Sem internet ou com o site fora do ar, fica na fila e é reenviado a cada 10 minutos.
// Envio: POST JSON {id, name, email, comment, at, serverVersion, installId}; resposta 2xx = recebido.
const crypto = require('node:crypto');
const fail = m => { throw new Error(m); };
const URL_DEFAULT = 'https://gamezoney.com/api/feedback';
module.exports = function feedback(store, version) {
  store.state.feedback ??= []; store.state.runtime.installId ??= crypto.randomUUID();
  const target = () => process.env.GZ_FEEDBACK_URL || URL_DEFAULT;
  let sending = false;
  async function deliver(item) {
    const body = {id: item.id, name: item.name, email: item.email, comment: item.comment, at: new Date(item.at).toISOString(), serverVersion: version, installId: store.state.runtime.installId};
    const r = await fetch(target(), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(8000)});
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }
  async function flush() {
    if (sending) return; sending = true;
    try {
      for (const item of store.state.feedback.filter(f => !f.sentAt).slice(0, 20)) {
        try { await deliver(item); item.sentAt = Date.now(); delete item.error; }
        catch (e) { item.error = String(e.message || e).slice(0, 200); item.tries = (item.tries || 0) + 1; }
      }
      store.persist();
    } finally { sending = false; }
  }
  async function submit(input, actor) {
    const name = String(input.name ?? '').trim().slice(0, 100), email = String(input.email ?? '').trim().slice(0, 120), comment = String(input.comment ?? '').trim().slice(0, 2000);
    if (!name) fail('Informe o nome.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Informe um e-mail válido.');
    if (comment.length < 3) fail('Escreva o comentário.');
    const item = store.change(actor, 'feedback', 'Feedback registrado por ' + actor, () => { const f = {id: crypto.randomUUID(), name, email, comment, at: Date.now(), actor}; store.state.feedback.push(f); store.state.feedback = store.state.feedback.slice(-500); return f; });
    try { await deliver(item); item.sentAt = Date.now(); store.persist(); return {sent: true}; }
    catch (e) { item.error = String(e.message || e).slice(0, 200); store.persist(); return {sent: false}; }
  }
  return {submit, flush, target};
};
