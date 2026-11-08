'use strict';
// 2.9 (plano Pro): Minha conta › Unidades — faturamento, caixa e PCs em uso de cada loja (Multi-Unidade), atualizado a cada minuto.
(() => {
  const box = document.getElementById('units-box'); if (!box) return;
  const money = c => ((c || 0) / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  const tr = s => (window.gzSite && gzSite.t ? gzSite.t(s) : s);
  let timer = null, loading = false;
  async function load() {
    if (loading || location.hash !== '#unidades') return; loading = true;
    try {
      const d = await api('/api/units');
      const T = d.totals, stat = (label, value) => `<div class="unit-stat"><span>${esc(label)}</span><strong>${value}</strong></div>`;
      const code = d.pro ? `<div class="unit-code"><div><b>Código de vínculo das filiais</b><p class="note">Cole este código em cada GameZoney Servidor (Configuração › Multi-Unidade) para todas as lojas aparecerem aqui.</p></div>
        ${d.code ? `<code id="unit-code">${esc(d.code)}</code><button class="btn small ghost" type="button" id="unit-copy">Copiar</button>` : ''}<button class="btn small ${d.code ? 'ghost' : 'gold'}" type="button" id="unit-new">${d.code ? 'Gerar outro código' : 'Gerar código'}</button></div>`
        : '<p class="note">A Multi-Unidade faz parte do plano <b>Pro</b>. <a href="#comprar">Ver meu plano</a></p>';
      const card = u => { const s = u.summary || {}, st = s.stations || {}, c = s.cash || {};
        return `<article class="unit-card"><header><h4>${esc(u.name)}</h4><span class="pill ${u.online ? 'ok' : 'bad'}">${u.online ? 'Online' : 'Sem envio'}</span></header>
          <div class="unit-grid">${stat('Hoje', money(s.day?.totalCents))}${stat('No mês', money(s.month?.totalCents))}${stat('Em uso', `${st.inUse ?? 0}/${st.total ?? 0}`)}${stat('Caixa', c.open ? `nº ${String(c.number).padStart(4, '0')} • ${money(c.totalCents)}` : tr('Fechado'))}</div>
          <p class="note">${esc(tr('Recargas'))}: ${money(s.day?.rechargeCents)} • ${esc(tr('Lanchonete/PDV'))}: ${money(s.day?.shopCents)} • ${esc(tr('Sessões hoje'))}: ${s.day?.sessions ?? 0}${st.online != null ? ` • ${esc(tr('PCs conectados'))}: ${st.online}/${st.computers ?? 0}` : ''}</p>
          ${(s.topProducts || []).length ? `<p class="note"><b>${esc(tr('Mais vendidos no mês'))}:</b> ${s.topProducts.map(p => `${esc(p.name)} (${p.qty})`).join(', ')}</p>` : ''}
          ${s.lowStock ? `<p class="note" style="color:#ffb84d">${esc(tr('Produtos sem estoque'))}: ${s.lowStock}</p>` : ''}${s.nfePending ? `<p class="note">${esc(tr('Notas fiscais aguardando entrada'))}: ${s.nfePending}</p>` : ''}
          <footer><small>${esc(tr('Atualizado em'))} ${fmtDate(u.lastAt)}${u.version ? ' • Servidor ' + esc(u.version) : ''}</small><button class="btn small ghost" type="button" data-unit-remove="${esc(u.id)}" data-name="${esc(u.name)}">Remover</button></footer></article>`; };
      box.innerHTML = `${code}${d.units.length ? `<div class="unit-totals">${stat('Unidades', d.units.length)}${stat('Hoje (todas)', money(T.dayCents))}${stat('No mês (todas)', money(T.monthCents))}${stat('Em uso agora', `${T.inUse}/${T.stations}`)}${stat('Caixas abertos', T.openCash)}</div>
        <div class="unit-list">${d.units.map(card).join('')}</div>` : `<p class="note">${d.pro ? 'Nenhuma unidade enviando ainda. No GameZoney Servidor de cada loja, abra Configuração › Multi-Unidade, dê um nome à unidade, cole o código de vínculo (se for de outra conta) e ligue o envio.' : ''}</p>`}`;
      const copy = document.getElementById('unit-copy');
      if (copy) copy.onclick = async () => { try { await navigator.clipboard.writeText(d.code); copy.textContent = tr('Copiado'); } catch { } };
      const gen = document.getElementById('unit-new');
      if (gen) gen.onclick = async () => { if (d.code && !window.confirm(tr('Gerar outro código? As lojas que usam o código atual deixam de aparecer até você colar o novo código nelas.'))) return; await busy(gen, () => api('/api/units/code', {})); loading = false; load(); };
      $$('[data-unit-remove]', box).forEach(b => b.onclick = async () => { if (!window.confirm(tr('Remover esta unidade da sua conta?') + ' ' + b.dataset.name)) return; await busy(b, () => api('/api/units/remove', {id: b.dataset.unitRemove})); loading = false; load(); });
    } catch (e) { box.innerHTML = `<p class="note">${esc(e.message || 'Não foi possível carregar as unidades.')}</p>`; }
    finally { loading = false; }
  }
  const watch = () => { clearInterval(timer); if (location.hash === '#unidades') { load(); timer = setInterval(load, 60000); } };
  window.addEventListener('hashchange', watch); document.addEventListener('gz:account-ready', watch); watch();
})();
