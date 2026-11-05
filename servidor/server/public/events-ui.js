'use strict';
// 1.0.5: Corujão/Viradão (criar > adicionar participantes > confirmar pagamento > iniciar) e Ranking (Top 10).
let eventsData = null, eventsRequest = 0, rankingMonth = '', rankingRequest = 0;
const EV_KIND = {corujao: 'Corujão', viradao: 'Viradão'};
// 1.0.5: sem campo Tipo na criação; eventos antigos continuam com o prefixo Corujão/Viradão.
const evTitle = e => (EV_KIND[e.kind] ? EV_KIND[e.kind] + ' ' : '') + e.name;
const EV_STATUS = {open: ['ABERTO', ''], running: ['EM ANDAMENTO', 'on'], finished: ['ENCERRADO', 'red']};
const medalsText = n => ((n || 0) / 1000).toLocaleString('pt-BR', {maximumFractionDigits: 3});
const evDate = d => d ? d.split('-').reverse().join('/') : '—';

function eventCard(e) {
  const paid = e.participants.filter(p => p.paid).length, total = e.participants.length, open = e.status === 'open';
  const step = (n, label, done, now) => `<span class="ev-step ${done ? 'done' : now ? 'now' : ''}"><b>${done ? '✔' : n}</b>${label}</span>`;
  const steps = `<div class="ev-steps">${step(1, 'Criado', true)}${step(2, `Participantes (${total})`, total > 0, open && !total)}${step(3, `Pagamento (${paid}/${total})`, total > 0 && paid === total, open && total > 0 && paid < total)}${step(4, e.status === 'finished' ? 'Encerrado' : 'Iniciar', !open, open && paid > 0 && paid === total)}</div>`;
  const rows = e.participants.map(p => `<tr><td>${esc(p.memberUsername)}</td><td>${p.paid ? `<span class="badge on">${p.free ? 'GRÁTIS' : 'PAGO'}</span>${p.paidAt ? `<small class="subtext">${datetime(p.paidAt)}</small>` : ''}` : open ? '<span class="badge">PENDENTE</span>' : '<span class="badge red">NÃO PAGOU</span>'}</td><td>${!open && p.participated ? `${medalsText(p.medalsMilli)} medalha(s)` : '—'}</td><td class="toolbar-actions">${open && !p.paid ? `<button class="primary" data-ev-pay="${e.id}" data-member="${esc(p.memberId)}">Confirmar pagamento</button><button class="danger" data-ev-unlist="${e.id}" data-member="${esc(p.memberId)}">Remover</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum participante ainda. Clique em <strong>+ Adicionar participantes</strong>.</td></tr>';
  return `<section class="panel ev-card"><div class="toolbar"><div><h2 style="margin:0">${esc(evTitle(e))} <span class="badge ${EV_STATUS[e.status][1]}">${EV_STATUS[e.status][0]}</span></h2><small class="subtext">${evDate(e.date)} • ${money(e.priceCents)} por participante • criado por ${esc(e.createdBy)}${e.startedAt ? ' • iniciado em ' + datetime(e.startedAt) : ''}${e.finishedAt ? ' • encerrado em ' + datetime(e.finishedAt) : ''}</small></div><div class="toolbar-actions">${open ? `<button data-ev-add="${e.id}">+ Adicionar participantes</button><button class="primary" data-ev-start="${e.id}" ${paid ? '' : 'disabled'}>Iniciar ›</button>${isAdmin() ? `<button class="danger" data-ev-remove="${e.id}">Excluir</button>` : ''}` : e.status === 'running' ? `<button data-ev-finish="${e.id}">Encerrar</button>` : ''}</div></div>${steps}<div class="table-wrap"><table><thead><tr><th>Usuário/Nick</th><th>Pagamento</th><th>Medalhas</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

async function renderEvents() {
  const request = ++eventsRequest, data = await api('/events'); if (view !== 'events' || request !== eventsRequest) return; eventsData = data;
  const active = data.events.filter(e => e.status !== 'finished'), done = data.events.filter(e => e.status === 'finished');
  $('#view').innerHTML = `<div class="toolbar"><h2>Corujão/Viradão</h2><div class="toolbar-actions"><button class="primary" data-ev-create>+ Criar Corujão/Viradão</button></div></div>
  <p class="hint">Passo a passo: <strong>Criar</strong> › <strong>Adicionar participantes</strong> › <strong>Confirmar pagamento</strong> (entra no caixa como venda) › <strong>Iniciar</strong>. Ao iniciar, cada participante pago recebe <strong>${medalsText(data.medalsMilli)} medalha(s)</strong> (definido em Fidelidade) e a participação conta no Ranking.${state.cashSummary ? '' : ' <span class="badge red">CAIXA FECHADO</span> abra o caixa para confirmar pagamentos.'}</p>
  ${active.map(eventCard).join('') || '<div class="empty">Nenhum Corujão/Viradão aberto. Clique em <strong>+ Criar Corujão/Viradão</strong>.</div>'}
  ${done.length ? `<h3 style="margin-top:28px">Encerrados</h3>${done.slice(0, 20).map(eventCard).join('')}` : ''}`;
}

function eventAddModal(e) {
  const inList = new Set(e.participants.map(p => p.memberId));
  const members = (state.members || []).filter(m => !m.guest && m.active !== false && !inList.has(m.id)).sort((a, b) => String(a.username).localeCompare(String(b.username)));
  modal('Adicionar participantes', `<form><input id="ev-member-search" placeholder="Buscar Usuário/Nick" autocomplete="off"><div id="ev-member-list" class="ev-member-list"></div><p class="hint" id="ev-member-count"></p><div class="dialog-actions"><button class="primary">Adicionar selecionados</button></div></form>`);
  const checked = new Set(), list = $('#ev-member-list'), paint = () => {
    const q = $('#ev-member-search').value.trim().toLowerCase(), found = members.filter(m => String(m.username).toLowerCase().includes(q)).slice(0, 200);
    list.innerHTML = found.map(m => `<label class="ev-member"><input type="checkbox" value="${esc(m.id)}" ${checked.has(m.id) ? 'checked' : ''}><span>${esc(m.username)}</span></label>`).join('') || '<p class="hint">Nenhum cliente encontrado.</p>';
    list.querySelectorAll('input').forEach(c => c.onchange = () => { c.checked ? checked.add(c.value) : checked.delete(c.value); $('#ev-member-count').textContent = checked.size + ' selecionado(s)'; });
  };
  $('#ev-member-search').oninput = paint; paint(); $('#ev-member-search').focus();
  formAction(async () => { if (!checked.size) throw Error('Selecione pelo menos um cliente.'); for (const memberId of checked) await api('/events/participant', {eventId: e.id, memberId}); await renderEvents(); });
}

function eventPayModal(e, p) {
  if (e.priceCents === 0) { modal('Confirmar participação', `<form><p>Participação <strong>gratuita</strong> de <strong>${esc(p.memberUsername)}</strong> em ${esc(evTitle(e))}.</p><div class="dialog-actions"><button class="primary">Confirmar</button></div></form>`); return formAction(async () => { await api('/events/pay', {eventId: e.id, memberId: p.memberId}); await renderEvents(); }); }
  modal('Confirmar pagamento', `<form><p><strong>${esc(p.memberUsername)}</strong> • ${esc(evTitle(e))}</p><div class="balance"><span>Valor</span><strong>${money(e.priceCents)}</strong></div><div class="pdv-pay ev-pay">${Object.entries(eventsData.payments).map(([k, v]) => `<label class="pay-opt"><input type="radio" name="paymentMethod" value="${k}">${typeof ICON !== 'undefined' && ICON[k] ? ICON[k] : ''}<span>${v}</span></label>`).join('')}</div><p class="hint">O valor entra no caixa aberto como venda (Caixa › Vendas). Para desfazer antes de iniciar, cancele a venda.</p><div class="dialog-actions"><button class="primary">Confirmar pagamento</button></div></form>`);
  formAction(async d => { if (!d.paymentMethod) throw Error('Selecione a forma de pagamento.'); await api('/events/pay', {eventId: e.id, memberId: p.memberId, paymentMethod: d.paymentMethod}); await renderEvents(); });
}

document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-ev-create],[data-ev-add],[data-ev-pay],[data-ev-unlist],[data-ev-start],[data-ev-finish],[data-ev-remove],[data-business="event-medals"]'); if (!b) return;
  try {
    if (b.dataset.business === 'event-medals') {
      const r = await api('/events');
      modal('Medalhas por participação', `<form><p class="hint">Quantidade de medalhas que cada participante <strong>pago</strong> recebe ao <strong>Iniciar</strong> um Corujão/Viradão. Use 0 para não dar medalhas. Clientes com a fidelidade desativada não recebem.</p><label>Medalhas por participação<input name="medals" type="number" min="0" step="0.001" required value="${(r.medalsMilli || 0) / 1000}"></label><div class="dialog-actions"><button class="primary">Salvar</button></div></form>`);
      return formAction(async d => { await api('/events/medals', {medals: d.medals}); if (view === 'loyalty') await renderLoyalty(); });
    }
    if (b.dataset.evCreate !== undefined) {
      const today = new Date().toLocaleDateString('en-CA', {timeZone: state.settings.timeZone});
      modal('Criar Corujão/Viradão', `<form><label>Nome<input name="name" required maxlength="80" placeholder="Ex.: Corujão Sexta 22h às 6h"></label><div class="row"><label>Data<input name="date" type="date" required value="${today}"></label><label>Valor por participante (R$)<input name="price" type="number" min="0" step="0.01" required value="0.00"></label></div><div class="dialog-actions"><button class="primary">Criar</button></div></form>`);
      return formAction(async d => { await api('/events', {name: d.name, date: d.date, priceCents: Math.round(Number(String(d.price).replace(',', '.')) * 100)}); await renderEvents(); });
    }
    const e = eventsData?.events.find(x => x.id === (b.dataset.evAdd || b.dataset.evPay || b.dataset.evUnlist || b.dataset.evStart || b.dataset.evFinish || b.dataset.evRemove)); if (!e) return;
    const p = b.dataset.member ? e.participants.find(x => x.memberId === b.dataset.member) : null;
    if (b.dataset.evAdd) return eventAddModal(e);
    if (b.dataset.evPay) return eventPayModal(e, p);
    if (b.dataset.evUnlist) { if (!await ask(`Remover ${p.memberUsername} da lista? O cliente sai de ${evTitle(e)}.`, {ok: 'Remover'})) return; await api('/events/participant/remove', {eventId: e.id, memberId: p.memberId}); }
    if (b.dataset.evStart) { const paid = e.participants.filter(x => x.paid).length, pending = e.participants.length - paid; if (!await ask(`Iniciar ${evTitle(e)}? ${paid} participante(s) pago(s) recebem ${medalsText(eventsData.medalsMilli)} medalha(s) cada.${pending ? ` ${pending} sem pagamento ficam de fora.` : ''} Depois de iniciar não é possível adicionar participantes.`, {ok: 'Iniciar'})) return; await api('/events/start', {eventId: e.id}); toast('Iniciado. Medalhas entregues.'); }
    if (b.dataset.evFinish) { if (!await ask(`Encerrar ${evTitle(e)}?`, {ok: 'Encerrar'})) return; await api('/events/finish', {eventId: e.id}); }
    if (b.dataset.evRemove) { if (!await ask(`Excluir ${evTitle(e)}? Só é possível enquanto não há pagamentos confirmados.`, {ok: 'Excluir'})) return; await api('/events/remove', {eventId: e.id}); }
    await refresh(true); await renderEvents();
  } catch (err) { toast(err.message); }
});

// ---------------- Ranking ----------------
function rankList(title, items, value, empty) {
  return `<section class="panel rank-card"><h2>${title}</h2>${items.length ? `<ol class="rank-list">${items.map((r, i) => `<li class="rank-${i + 1}"><span class="rank-pos">${i + 1}</span><span class="rank-nick">${esc(r.username)}</span><span class="rank-value">${value(r)}</span></li>`).join('')}</ol>` : `<p class="hint">${empty}</p>`}</section>`;
}
async function renderRanking() {
  const request = ++rankingRequest, r = await api('/ranking' + (rankingMonth ? '?month=' + rankingMonth : '')); if (view !== 'ranking' || request !== rankingRequest) return;
  rankingMonth = r.month; const [y, m] = r.month.split('-'), monthName = new Date(Number(y), Number(m) - 1, 15).toLocaleDateString(({en: 'en-US', es: 'es', fr: 'fr', ru: 'ru'})[window.gzI18n && gzI18n.lang] || 'pt-BR', {month: 'long', year: 'numeric'});
  $('#view').innerHTML = `<div class="toolbar"><h2>Ranking</h2><label class="ev-month">Mês das recargas<input type="month" id="rank-month" value="${r.month}"></label></div><div class="rank-grid">
  ${rankList('Top 10 Medalhas', r.medals, x => medalsText(x.medalsMilli) + ' medalha(s)', 'Nenhum cliente com medalhas ainda.')}
  ${rankList('Top 10 Participação em Viradão', r.participations, x => x.count + ' participação(ões)', 'Nenhuma participação em Corujão/Viradão iniciado ainda.')}
  ${rankList('Top 10 Recargas Mês', r.recharges, x => `${x.count} recarga(s)<small class="subtext">${money(x.cents)}</small>`, 'Nenhuma recarga paga em ' + monthName + '.')}
  </div><p class="hint">Medalhas: total conquistado (resgates não descontam). Participação: Corujão/Viradão iniciados com pagamento confirmado. Recargas Mês: recargas pagas em ${monthName} (desempate pelo valor); visitantes e pacotes grátis não entram.</p>`;
  $('#rank-month').onchange = e => { rankingMonth = e.target.value; renderRanking().catch(err => toast(err.message)); };
}
