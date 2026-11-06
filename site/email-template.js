'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.8: modelo visual dos e-mails (topo escuro com a logo, título, código/chave ou botão em destaque, texto,
// aviso de segurança e rodapé). Feito com tabelas e estilos na própria tag (é o que Gmail, Outlook e Hotmail aceitam).
// Todo texto variável passa por esc(): nada do usuário vira HTML.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const para = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u}" style="color:#9a6b00;text-decoration:underline">${u}</a>`).replace(/\n/g, '<br>');

/**
 * @param {object} o
 *  site        endereço do site (https://gamezoney.com)
 *  title       título em destaque (ex.: "Código de verificação", "Confirme seu e-mail")
 *  lines       parágrafos antes do destaque
 *  code        texto grande em destaque (chave da licença, código)
 *  codeNote    observação pequena embaixo do código
 *  button      {label, url} botão dourado
 *  after       parágrafos depois do destaque
 *  image       URL absoluta de um banner (comunicados)
 *  marketing   true = comunicado/promoção (rodapé com "cancelar inscrição")
 *  unsubscribe URL para cancelar a inscrição
 *  preheader   resumo que aparece na lista de e-mails
 */
function renderEmail(o) {
  const site = String(o.site || 'https://gamezoney.com').replace(/\/+$/, '');
  const host = site.replace(/^https?:\/\//, '');
  const P = list => (list || []).filter(x => x !== undefined && x !== null && x !== '').map(t => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3b4250">${para(t)}</p>`).join('');
  const highlight = [
    o.title ? `<p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#11151d">${esc(o.title)}</p>` : '',
    o.code ? `<p style="margin:0;font-size:${String(o.code).length > 12 ? 26 : 36}px;font-weight:800;letter-spacing:${String(o.code).length > 12 ? 1 : 4}px;color:#11151d;font-family:Consolas,'Courier New',monospace">${esc(o.code)}</p>` : '',
    o.codeNote ? `<p style="margin:8px 0 0;font-size:11px;color:#6b7280">${esc(o.codeNote)}</p>` : '',
    o.button && o.button.url ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:${o.code ? 18 : 6}px auto 0"><tr><td bgcolor="#FDD034" style="border-radius:6px;background:#FDD034;background-image:linear-gradient(180deg,#FFEC6C,#FDD034 55%,#F0B11E)"><a href="${esc(o.button.url)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#11151d;text-decoration:none;border-radius:6px">${esc(o.button.label || 'Abrir')}</a></td></tr></table>` : ''
  ].join('');
  const footer = o.marketing
    ? `Você recebeu este e-mail porque tem uma conta em ${esc(host)}.${o.unsubscribe ? ` Não quer mais receber comunicados e promoções? <a href="${esc(o.unsubscribe)}" style="color:#6b7280;text-decoration:underline">Cancelar inscrição</a>.` : ''}`
    : `Este é um e-mail automático da GameZoney sobre a sua conta em ${esc(host)}.`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.subject || o.title || 'GameZoney')}</title></head>
<body style="margin:0;padding:0;background:#eef0f3;font-family:Arial,Helvetica,sans-serif">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef0f3" style="background:#eef0f3"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:4px;overflow:hidden">
<tr><td align="center" bgcolor="#151a23" style="background:#151a23;padding:22px 20px 18px;border-bottom:3px solid #F0B11E"><a href="${esc(site)}" style="text-decoration:none"><img src="${esc(site)}/logo-gamezoney.png" width="190" alt="GameZoney" style="display:block;width:190px;max-width:70%;height:auto;border:0;color:#FDD034;font-size:22px;font-weight:700"></a></td></tr>
${o.image ? `<tr><td><img src="${esc(o.image)}" width="560" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>` : ''}
${o.lines && o.lines.length ? `<tr><td style="padding:28px 34px 4px">${P(o.lines)}</td></tr>` : ''}
${highlight ? `<tr><td align="center" style="padding:${o.lines && o.lines.length ? 8 : 30}px 34px 26px">${highlight}</td></tr>` : ''}
${o.after && o.after.length ? `<tr><td style="padding:0 34px 12px">${P(o.after)}</td></tr>` : ''}
<tr><td style="padding:0 34px"><div style="border-top:1px solid #e3e6ea;height:1px;line-height:1px">&nbsp;</div></td></tr>
<tr><td style="padding:18px 34px 26px;font-size:13px;line-height:1.55;color:#6b7280">A GameZoney nunca envia e-mails pedindo que você informe ou confirme sua senha, número de cartão de crédito ou dados bancários. Se receber um e-mail suspeito em nome da GameZoney, não clique nos links e encaminhe para <a href="mailto:suporte@gamezoney.com" style="color:#6b7280">suporte@gamezoney.com</a>.</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px"><tr><td align="center" style="padding:16px 20px 0;font-size:11px;line-height:1.6;color:#8a919c">${footer}<br>GameZoney • Gestão para lan houses e arenas gamer • <a href="${esc(site)}" style="color:#8a919c">${esc(host)}</a></td></tr></table>
</td></tr></table></body></html>`;
}

// texto simples equivalente (vai junto, para quem não mostra HTML e para os filtros de spam)
function renderText(o) {
  const out = [];
  for (const l of o.lines || []) if (l) out.push(l);
  if (o.title) out.push(o.title);
  if (o.code) out.push('    ' + o.code);
  if (o.codeNote) out.push(o.codeNote);
  if (o.button && o.button.url) out.push((o.button.label || 'Abrir') + ': ' + o.button.url);
  for (const l of o.after || []) if (l) out.push(l);
  if (o.marketing && o.unsubscribe) out.push('Cancelar inscrição: ' + o.unsubscribe);
  return out.join('\n\n') + '\n\nEquipe GameZoney\n' + String(o.site || 'https://gamezoney.com').replace(/\/+$/, '');
}

// e-mail antigo só com texto (avisos internos): vira o mesmo visual, com os links clicáveis
function fromText(text, site) {
  const blocks = String(text || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return renderEmail({site, lines: blocks});
}

module.exports = {renderEmail, renderText, fromText, esc};
