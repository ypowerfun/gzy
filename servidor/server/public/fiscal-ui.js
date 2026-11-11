'use strict';
// 1.3.0 (plano Pro): Gerenciamento NF-e › Notas emitidas (NFC-e dos produtos do PDV / NFS-e das recargas e serviços)
// e › Configuração fiscal (Focus NFe). O token da Focus é digitado aqui, salvo só no servidor e nunca volta à tela.
let nfeTab = 'entrada', fiscalFilter = '', fiscalKind = '';
const FISCAL_STATUS = {pendente: ['Pendente', 'gold'], processando: ['Processando', 'gold'], autorizado: ['Autorizada', 'on'], erro: ['Com erro', 'red'], denegado: ['Denegada', 'red'], cancelado: ['Cancelada', ''], descartada: ['Descartada', '']};
const fiscalBadge = s => { const [t, c] = FISCAL_STATUS[s] || [s, '']; return `<span class="badge ${c}">${esc(t)}</span>`; };
function fiscalTabs() {
  const t = (k, l) => `<button type="button" data-nfe-tab="${k}" class="${nfeTab === k ? 'active' : ''}">${l}</button>`;
  return `<div class="shop-tabs">${t('entrada', '▤ Notas de entrada (XML)')}${t('emitidas', '▣ Notas emitidas (NFC-e / NFS-e)')}${t('config', '⚙ Configuração fiscal')}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-nfe-tab]'); if (!b) return; nfeTab = b.dataset.nfeTab; renderNfe().catch(x => toast(x.message)); });
const fiscalLink = (url, label) => url ? `<a class="button-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';

async function renderFiscal(node) {
  const q = new URLSearchParams(); if (fiscalFilter) q.set('status', fiscalFilter); if (fiscalKind) q.set('kind', fiscalKind);
  const data = await api('/fiscal?' + q); if (view !== 'nfe') return;
  const S = data.settings, C = data.counts || {};
  if (nfeTab === 'config') return fiscalConfig(node, S);
  const card = (t, v) => `<div class="stat"><span>${t}</span><strong>${v || 0}</strong></div>`;
  const off = !S.enabled ? `<div class="panel warn-panel"><h2>Emissão de notas desligada</h2><p class="hint">Configure a sua conta da Focus NFe e os dados da empresa na aba <b>Configuração fiscal</b>.</p></div>` : '';
  const homolog = S.enabled && S.env === 'homologacao' ? '<p class="hint"><span class="badge gold">HOMOLOGAÇÃO</span> <span>Ambiente de testes: as notas não têm valor fiscal.</span></p>' : '';
  node.innerHTML = `<div class="shop-area">${fiscalTabs()}${off}
    <div class="stats">${card('Autorizadas', C.autorizado)}${card('Pendentes / processando', (C.pendente || 0) + (C.processando || 0))}${card('Com erro', (C.erro || 0) + (C.denegado || 0))}${card('Canceladas', C.cancelado)}</div>
    <div class="panel"><div class="toolbar"><div><h2>Notas emitidas</h2><p class="hint">NFC-e para os produtos vendidos no PDV e NFS-e para as recargas de tempo e os serviços. As vendas entram aqui sozinhas; sem internet a nota fica pendente e sai quando a conexão voltar.</p>${homolog}</div></div>
      <div class="filters"><select id="fiscal-kind"><option value="">NFC-e e NFS-e</option><option value="nfce" ${fiscalKind === 'nfce' ? 'selected' : ''}>NFC-e</option><option value="nfse" ${fiscalKind === 'nfse' ? 'selected' : ''}>NFS-e</option></select><select id="fiscal-status"><option value="">Todas</option>${Object.entries(FISCAL_STATUS).map(([k, [t]]) => `<option value="${k}" ${fiscalFilter === k ? 'selected' : ''}>${t}</option>`).join('')}</select><button id="fiscal-filter">Filtrar</button><button id="fiscal-refresh">Atualizar</button></div>
      <div class="table-wrap"><table><thead><tr><th>Data</th><th>Nota</th><th>Origem</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
      ${data.docs.map(d => `<tr><td>${datetime(d.at)}</td><td>${d.kind === 'nfce' ? 'NFC-e' : 'NFS-e'}${d.numero ? ' nº ' + esc(d.numero) : ''}${d.serie ? '/' + esc(d.serie) : ''}${d.env === 'homologacao' ? '<small class="subtext">homologação</small>' : ''}</td>
        <td>${d.source === 'shop' ? 'Cupom nº ' + esc(d.number) : 'Recarga de tempo'}${d.memberName ? `<small class="subtext">${esc(d.memberName)}</small>` : ''}${d.cpf ? '<small class="subtext">com CPF</small>' : ''}</td><td>${money(d.cents)}</td>
        <td>${fiscalBadge(d.status)}${d.message ? `<small class="subtext">${esc(d.message)}</small>` : ''}${d.cancelReason ? `<small class="subtext">${esc(d.cancelReason)}</small>` : ''}</td>
        <td class="actions-cell">${fiscalLink(d.links?.danfe || d.links?.danfse || d.links?.url, d.kind === 'nfce' ? 'DANFC-e' : 'Ver nota')}${fiscalLink(d.links?.xml, 'XML')}${fiscalLink(d.links?.consulta, 'Consulta')}${fiscalLink(d.links?.xmlCancel, 'XML do cancelamento')}
          ${['erro', 'pendente'].includes(d.status) ? `<button data-fiscal-retry="${d.id}">Reenviar</button>` : ''}${d.status === 'autorizado' ? `<button class="danger" data-fiscal-cancel="${d.id}">Cancelar nota</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Nenhuma nota emitida ainda.</td></tr>'}
      </tbody></table></div></div></div>`;
  $('#fiscal-filter').onclick = () => { fiscalFilter = $('#fiscal-status').value; fiscalKind = $('#fiscal-kind').value; renderNfe().catch(e => toast(e.message)); };
  $('#fiscal-refresh').onclick = () => renderNfe().catch(e => toast(e.message));
  node.querySelectorAll('[data-fiscal-retry]').forEach(b => b.onclick = async () => { b.disabled = true; try { await api('/fiscal/retry', {id: b.dataset.fiscalRetry}); toast('Nota reenviada para a fila.'); setTimeout(() => view === 'nfe' && renderNfe().catch(() => {}), 2500); } catch (e) { toast(e.message); b.disabled = false; } });
  node.querySelectorAll('[data-fiscal-cancel]').forEach(b => b.onclick = () => fiscalCancel(data.docs.find(d => d.id === b.dataset.fiscalCancel)));
}

function fiscalCancel(d) {
  modal('Cancelar nota fiscal', `<form><p class="hint"><span>${d.kind === 'nfce' ? 'A NFC-e só pode ser cancelada em até 30 minutos depois de autorizada.' : 'Algumas prefeituras não aceitam cancelamento pela internet; nesse caso, cancele no site da prefeitura.'}</span> <span>O cancelamento é definitivo.</span></p>
    <label>Motivo (de 15 a 255 caracteres)<textarea name="reason" minlength="15" maxlength="255" required placeholder="Ex.: venda desfeita, cliente devolveu o produto"></textarea></label>
    <label>Senha do administrador<input name="authPassword" type="text" data-secret autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" maxlength="128" required></label>
    <button class="danger">Cancelar nota</button></form>`);
  formAction(async x => { await api('/fiscal/cancel', {id: d.id, reason: x.reason, authPassword: x.authPassword}); toast('Nota cancelada.'); if (view === 'nfe') renderNfe().catch(e => toast(e.message)); });
}

function fiscalConfig(node, S) {
  const v = x => esc(x ?? ''), ck = x => x ? 'checked' : '', sel = (cur, val) => cur === val ? 'selected' : '';
  const nc = S.nfce || {}, ns = S.nfse || {};
  node.innerHTML = `<div class="shop-area">${fiscalTabs()}<form id="fiscal-form" class="panel fiscal-form">
    <div class="toolbar"><div><h2>Configuração fiscal (Focus NFe)</h2><p class="hint">Antes de ligar: conta na Focus NFe com o certificado digital A1 da arena enviado lá; inscrição estadual e CSC da Sefaz para a NFC-e; inscrição municipal para a NFS-e. Os códigos fiscais (NCM, CFOP, CST, item de serviço, alíquota) são passados pelo contador.</p></div></div>
    <label class="check"><input type="checkbox" name="enabled" ${ck(S.enabled)}> Emitir notas fiscais</label>
    <div class="row"><label>Ambiente<select name="env"><option value="homologacao" ${sel(S.env, 'homologacao')}>Homologação (testes, sem valor fiscal)</option><option value="producao" ${sel(S.env, 'producao')}>Produção (notas válidas)</option></select></label>
      <label>Token da Focus NFe<input name="token" type="text" data-secret autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" maxlength="200" placeholder="${S.tokenSet ? 'Token salvo — deixe vazio para manter' : 'Cole o token da empresa (painel da Focus)'}"></label></div>
    <p class="hint"><span>${S.tokenSet ? '✓ Token salvo neste servidor.' : 'Nenhum token salvo.'}</span> <span>Use o token do mesmo ambiente escolhido (homologação ou produção).</span> <button type="button" id="fiscal-test">Testar conexão</button></p>
    <h3>Empresa (emitente)</h3>
    <div class="row"><label>CNPJ<input name="cnpj" inputmode="numeric" maxlength="18" value="${v(S.cnpj)}"></label><label>Razão social<input name="razao" maxlength="120" value="${v(S.razao)}"></label></div>
    <div class="row"><label>Inscrição estadual<input name="ie" maxlength="20" value="${v(S.ie)}"></label><label>Inscrição municipal<input name="im" maxlength="20" value="${v(S.im)}"></label></div>
    <div class="row"><label>Código IBGE do município<input name="municipio" inputmode="numeric" maxlength="7" placeholder="Ex.: 3550308 (São Paulo)" value="${v(S.municipio)}"></label><label>UF<input name="uf" maxlength="2" value="${v(S.uf)}"></label>
      <label>Regime tributário<select name="regime"><option value="simples" ${sel(S.regime, 'simples')}>Simples Nacional (ME/EPP)</option><option value="mei" ${sel(S.regime, 'mei')}>MEI</option><option value="normal" ${sel(S.regime, 'normal')}>Regime normal (Lucro Presumido/Real)</option></select></label></div>
    <h3>NFC-e — produtos vendidos no PDV</h3>
    <label class="check"><input type="checkbox" name="nfce.enabled" ${ck(nc.enabled)}> Emitir NFC-e</label><label class="check"><input type="checkbox" name="nfce.auto" ${ck(nc.auto)}> Emitir sozinho a cada venda</label>
    <div class="row"><label>CFOP padrão<input name="nfce.cfop" inputmode="numeric" maxlength="4" value="${v(nc.cfop)}"></label><label>CST/CSOSN padrão do ICMS<input name="nfce.cst" inputmode="numeric" maxlength="3" value="${v(nc.cst)}"></label><label>Origem<select name="nfce.origem">${['0 – Nacional', '1 – Estrangeira (importação direta)', '2 – Estrangeira (mercado interno)'].map((t, i) => `<option value="${i}" ${sel(String(nc.origem), String(i))}>${t}</option>`).join('')}</select></label></div>
    <div class="row"><label>NCM padrão (opcional)<input name="nfce.ncm" inputmode="numeric" maxlength="10" placeholder="Usado no produto sem NCM" value="${v(nc.ncm)}"></label><label>Unidade<input name="nfce.unidade" maxlength="6" value="${v(nc.unidade)}"></label>
      <label>Cartão no PDV conta como<select name="nfce.cardAs"><option value="03" ${sel(nc.cardAs, '03')}>Cartão de crédito</option><option value="04" ${sel(nc.cardAs, '04')}>Cartão de débito</option></select></label></div>
    <label>Natureza da operação<input name="nfce.natureza" maxlength="60" value="${v(nc.natureza)}"></label>
    <h3>NFS-e — recargas de tempo e serviços</h3>
    <label class="check"><input type="checkbox" name="nfse.enabled" ${ck(ns.enabled)}> Emitir NFS-e</label><label class="check"><input type="checkbox" name="nfse.auto" ${ck(ns.auto)}> Emitir sozinho a cada recarga</label><label class="check"><input type="checkbox" name="nfse.services" ${ck(ns.services)}> Incluir os serviços vendidos no PDV (xerox, impressão, Corujão…)</label>
    <div class="row"><label>Padrão da NFS-e<select name="nfse.mode"><option value="municipal" ${sel(ns.mode, 'municipal')}>Da prefeitura (municipal)</option><option value="nacional" ${sel(ns.mode, 'nacional')}>NFS-e Nacional</option></select></label><label>Alíquota do ISS (%)<input name="nfse.aliquota" inputmode="decimal" maxlength="7" value="${v(ns.aliquota)}"></label></div>
    <div class="row"><label>Item da lista de serviços (LC 116)<input name="nfse.itemLista" maxlength="10" placeholder="Municipal" value="${v(ns.itemLista)}"></label><label>Código tributário do município<input name="nfse.codTribMun" maxlength="20" value="${v(ns.codTribMun)}"></label><label>CNAE<input name="nfse.cnae" inputmode="numeric" maxlength="7" value="${v(ns.cnae)}"></label></div>
    <div class="row"><label>Código de tributação nacional do ISSQN<input name="nfse.codTribNac" inputmode="numeric" maxlength="6" placeholder="Nacional (6 dígitos)" value="${v(ns.codTribNac)}"></label><label>CST do IBS/CBS<input name="nfse.ibsCbsCst" inputmode="numeric" maxlength="3" value="${v(ns.ibsCbsCst)}"></label><label>Classificação tributária do IBS/CBS<input name="nfse.ibsCbsClass" inputmode="numeric" maxlength="6" value="${v(ns.ibsCbsClass)}"></label></div>
    <div class="row"><label>Código NBS (opcional)<input name="nfse.nbs" inputmode="numeric" maxlength="9" value="${v(ns.nbs)}"></label><label>Indicador da operação (opcional)<input name="nfse.indOp" inputmode="numeric" maxlength="6" value="${v(ns.indOp)}"></label><label>Série da DPS<input name="nfse.serieDps" type="number" min="1" max="49999" value="${v(ns.serieDps)}"></label><label>Próximo número da DPS<input name="nfse.nextDps" type="number" min="1" value="${v(ns.nextDps)}"></label></div>
    <label>Descrição do serviço na nota<textarea name="nfse.descricao" maxlength="900">${v(ns.descricao)}</textarea></label>
    <p class="hint">Clientes com CPF no cadastro saem identificados na NFS-e; visitantes e clientes sem CPF saem como consumidor não identificado (se a sua prefeitura exigir CPF, cadastre o CPF do cliente).</p>
    <button class="primary">Salvar configuração fiscal</button></form></div>`;
  $('#fiscal-test').onclick = async e => { e.target.disabled = true; try { toast((await api('/fiscal/test', {})).message); } catch (x) { toast(x.message); } e.target.disabled = false; };
  $('#fiscal-form').onsubmit = async e => {
    e.preventDefault(); const f = e.target, body = {nfce: {}, nfse: {}};
    for (const el of f.elements) { if (!el.name) continue; const val = el.type === 'checkbox' ? el.checked : el.value; const [a, b] = el.name.split('.'); if (b) body[a][b] = val; else body[a] = val; }
    if (!body.token) delete body.token;
    const btn = f.querySelector('button.primary'); btn.disabled = true;
    try { await api('/fiscal/settings', body); toast('Configuração fiscal salva.'); renderNfe().catch(x => toast(x.message)); } catch (x) { toast(x.message); btn.disabled = false; }
  };
}
