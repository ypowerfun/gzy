'use strict';
// 1.0.5: pagamento combinado (2 a 3 formas, ex.: Pix R$ 10 + Cartão R$ 10 + Dinheiro R$ 10) em recargas, visitante e PDV.
// Venda combinada: paymentMethod 'mixed' + payments [{method, cents}]. Vendas antigas continuam só com paymentMethod.
const fail = message => { throw new Error(message); };
const LABEL = {cash: 'Dinheiro', pix: 'Pix', credit: 'Cartão (Crédito)', debit: 'Cartão (Débito)', card: 'Cartão', unspecified: 'Não informado', mixed: 'Combinado'};
const RECHARGE = ['cash', 'pix', 'credit', 'debit'], SHOP = ['cash', 'pix', 'card'];
const brl = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
const wants = input => Array.isArray(input?.payments) && input.payments.length > 0;
function combined(list, total, allowed) {
  const parts = (Array.isArray(list) ? list : []).filter(p => p && p.method !== undefined && p.method !== '');
  if (parts.length < 2 || parts.length > 3) fail('Pagamento combinado: use de 2 a 3 formas de pagamento.');
  const seen = new Set();
  const out = parts.map(p => {
    const method = String(p.method); if (!allowed.includes(method)) fail('Forma de pagamento inválida no pagamento combinado.');
    if (seen.has(method)) fail('Não repita a mesma forma de pagamento no combinado.'); seen.add(method);
    const cents = Number(p.cents); if (!Number.isInteger(cents) || cents < 1) fail('Informe o valor de cada forma de pagamento do combinado.');
    return {method, cents};
  });
  const sum = out.reduce((a, p) => a + p.cents, 0);
  if (sum !== total) fail(`A soma do pagamento combinado (${brl(sum)}) precisa ser igual ao total (${brl(total)}).`);
  return out;
}
function parts(sale, total) { return Array.isArray(sale.payments) && sale.payments.length ? sale.payments : [{method: sale.paymentMethod || 'unspecified', cents: total}]; }
function label(sale) { if (sale.paymentMethod === 'mixed' && Array.isArray(sale.payments)) return 'Combinado: ' + sale.payments.map(p => (LABEL[p.method] || p.method) + ' ' + brl(p.cents)).join(' + '); return LABEL[sale.paymentMethod] || ''; }
module.exports = {LABEL, RECHARGE, SHOP, combined, parts, label, wants};
