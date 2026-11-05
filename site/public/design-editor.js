'use strict';
// GameZoney — site gamezoney.com — 1.7: editor visual do design (somente administrador; abre com ?design=1).
// Clique num texto, imagem, botão ou bloco para editar: texto (por idioma), link, imagem, tamanho, posição
// (computador e celular separados), excluir/mostrar e restaurar. Nada é salvo até clicar em "Salvar alterações".
(async () => {
  const G = window.gzDesign; if (!G || document.getElementById('gz-design')) return;
  try { await api('/api/admin/design'); } catch (e) {
    alert(e.status === 401 || e.status === 403 ? 'O modo design é só para o administrador. Entre com a conta de administrador e abra de novo pelo /admin.' : e.message); return;
  }
  G.state.editing = true;
  const key = G.state.key || location.pathname;
  // cópia de trabalho das listas (página, topo, rodapé)
  const lists = {page: G.state.lists.page.map(x => JSON.parse(JSON.stringify(x))), '*h': G.state.lists['*h'].map(x => JSON.parse(JSON.stringify(x))), '*f': G.state.lists['*f'].map(x => JSON.parse(JSON.stringify(x)))};
  G.state.lists = lists; G.applyAll();
  let sel = null, dirty = new Set();
  const DYN = '[data-price],[data-price-label],[data-list-price],[data-banner],#promo-badge,#promo-strip [data-banner],.review,.chat-widget,#checkout,#buy-msg,.account-loading';
  const isMobile = () => innerWidth <= G.MOBILE;
  const LNAME = {pt: 'Português', en: 'English', es: 'Español'};
  const PAGES = [['/', 'Página inicial'], ['/atendimento.html', 'Atendimento'], ['/atualizacoes.html', 'Atualizações'], ['/entrar.html', 'Entrar / Criar conta'], ['/conta', 'Minha conta'], ['/guia', 'Guia'], ['/termos.html', 'Termos de uso'], ['/privacidade.html', 'Privacidade'], ['/redefinir.html', 'Redefinir senha'], ['/404', 'Página não encontrada']];

  const panel = document.createElement('aside'); panel.id = 'gz-design'; panel.dataset.gzDyn = ''; panel.setAttribute('data-no-i18n', '');
  panel.innerHTML = `<header><b>Design do site</b><button type="button" data-a="min" title="Minimizar">–</button></header>
  <div class="gzd-body">
    <label>Página<select data-a="page">${PAGES.map(([u, n]) => `<option value="${u}">${n}</option>`).join('')}</select></label>
    <div class="gzd-row"><span class="gzd-note">Idioma:</span>${['pt', 'en', 'es'].map(l => `<button type="button" data-lang-ed="${l}">${LNAME[l]}</button>`).join('')}</div>
    <p class="gzd-note">Clique em qualquer texto, imagem, botão ou bloco da página. Topo e rodapé valem para todas as páginas. Tamanho e posição são separados para <b>computador</b> e <b>celular</b> (estreite a janela para editar o celular).</p>
    <div id="gzd-edit"></div>
  </div>
  <div class="gzd-foot"><p class="gzd-msg" id="gzd-msg"></p>
    <button type="button" class="gold" data-a="save">Salvar alterações</button>
    <div class="gzd-row"><button type="button" data-a="discard">Descartar</button><button type="button" class="danger" data-a="reset">Restaurar página original</button></div>
    <div class="gzd-row"><button type="button" data-a="exit">Sair do modo design</button><a href="/admin#design" style="color:#ffdb73;font-size:12px">Voltar ao /admin</a></div></div>`;
  document.body.appendChild(panel);
  const $p = s => panel.querySelector(s), msg = (t, ok) => { const m = $p('#gzd-msg'); m.textContent = t; m.className = 'gzd-msg ' + (ok ? 'ok' : 'err'); };
  const pageSel = $p('[data-a=page]'); const here = PAGES.find(([u]) => u === key || u === location.pathname); if (here) pageSel.value = here[0]; else { const o = document.createElement('option'); o.value = location.pathname; o.textContent = location.pathname; pageSel.prepend(o); pageSel.value = location.pathname; }
  const status = () => { msg(dirty.size ? 'Alterações não salvas.' : '', false); $p('[data-a=save]').disabled = !dirty.size; document.querySelectorAll('[data-lang-ed]').forEach(b => b.classList.toggle('gold', b.dataset.langEd === ((window.gzSite && gzSite.lang) || 'pt'))); };

  // ---------- seleção ----------
  const pickable = el => el && el.nodeType === 1 && el !== document.body && el !== document.documentElement && !el.closest('#gz-design,[data-gz-dyn],script,style');
  let hover = null;
  document.addEventListener('mouseover', e => { const t = target(e.target); if (hover && hover !== t) hover.classList.remove('gz-hover'); hover = pickable(t) && t !== sel ? t : null; if (hover) hover.classList.add('gz-hover'); }, true);
  function target(el) { if (!el || !el.closest) return null; if (el.closest('svg')) el = el.closest('svg').parentElement; return el; }
  // no modo design os cliques não navegam: só selecionam
  document.addEventListener('click', e => { if (e.target.closest('#gz-design')) return; e.preventDefault(); e.stopPropagation(); const t = target(e.target); if (pickable(t) && !dragged) select(t); dragged = false; }, true);
  document.addEventListener('submit', e => { if (!e.target.closest('#gz-design')) e.preventDefault(); }, true);

  function itemFor(el, create) {
    const at = G.pathOf(el); if (!at) return null;
    const scope = at.key === 'page' ? 'page' : at.key, list = lists[scope], s = G.sigOf(el);
    let it = list.find(x => x.p === at.p && x.s === s);
    if (!it && create) { it = {p: at.p, s}; list.push(it); }
    return it ? {it, scope} : {it: null, scope};
  }
  function touch(el, scope, it) { G.applyItem(el, it, true); dirty.add(scope); status(); }
  const tagName = el => ({IMG: 'Imagem', A: el.classList.contains('btn') ? 'Botão' : 'Link', BUTTON: 'Botão', H1: 'Título', H2: 'Título', H3: 'Título', H4: 'Título', P: 'Texto', SPAN: 'Texto', LI: 'Item', SECTION: 'Seção', HEADER: 'Topo', FOOTER: 'Rodapé', NAV: 'Menu', DIV: 'Bloco', SMALL: 'Texto', B: 'Texto', STRONG: 'Texto'})[el.tagName] || el.tagName.toLowerCase();

  function select(el) {
    if (sel) sel.classList.remove('gz-sel'); sel = el; el.classList.remove('gz-hover'); el.classList.add('gz-sel');
    const {it, scope} = itemFor(el, false) || {}; const o = G.snap(el), dyn = el.closest(DYN), dev = isMobile() ? 'm' : 'd', box = (it && it[dev]) || {z: 100, dx: 0, dy: 0};
    const lang = (window.gzSite && gzSite.lang) || 'pt', where = scope === '*h' ? 'Topo (todas as páginas)' : scope === '*f' ? 'Rodapé (todas as páginas)' : 'Esta página';
    const txt = o.text !== null && !dyn ? ((it && it.t && it.t[lang]) ?? el.textContent.replace(/\s+/g, ' ').trim()) : null;
    const ed = $p('#gzd-edit');
    ed.innerHTML = `<div class="gzd-sel"><span class="gzd-tag">${tagName(el)}</span>${esc((el.tagName === 'IMG' ? el.getAttribute('alt') || el.getAttribute('src') : el.textContent).replace(/\s+/g, ' ').trim().slice(0, 80)) || '—'}<br><span class="gzd-note">${where}</span></div>
      <div class="gzd-row"><button type="button" data-e="up" title="Selecionar o bloco que contém este elemento">⬑ Bloco acima</button>${el.children.length ? '<button type="button" data-e="down">Primeiro item de dentro</button>' : ''}</div>
      ${dyn ? '<p class="gzd-note">Este conteúdo é automático (preço, faixa, avaliações…). Preço e faixa mudam em /admin › Preço e promoção. Aqui dá para mudar tamanho, posição ou esconder.</p>' : ''}
      ${txt !== null ? `<label>Texto (${LNAME[lang]})<textarea data-e="text" maxlength="3000">${esc(txt)}</textarea></label><p class="gzd-note">Para editar outro idioma, troque o idioma acima. Sem texto no idioma, aparece o de Português.</p>` : (o.text === null && !dyn && el.tagName !== 'IMG' ? '<p class="gzd-note">Este elemento tem outros dentro. Para mudar o texto, clique direto no texto (ou use "Primeiro item de dentro").</p>' : '')}
      ${el.tagName === 'A' ? `<label>Link (https://…, /pagina ou #secao)<input data-e="href" value="${esc(el.getAttribute('href') || '')}"></label>` : ''}
      ${el.tagName === 'IMG' ? `<label>Trocar imagem (.png, .jpg ou .webp, até 3 MB)<input type="file" data-e="img" accept="image/png,image/jpeg,image/webp"></label><label>Descrição da imagem<input data-e="alt" maxlength="200" value="${esc(el.getAttribute('alt') || '')}"></label>` : ''}
      <label>Tamanho no ${isMobile() ? 'celular' : 'computador'}: <b data-e="zv">${box.z}%</b><input type="range" min="30" max="300" step="5" data-e="zoom" value="${box.z}"></label>
      <div><span class="gzd-note">Mover no ${isMobile() ? 'celular' : 'computador'} (ou arraste o elemento selecionado): <b data-e="pos">${box.dx}, ${box.dy}</b></span>
        <div class="gzd-pad" style="margin-top:6px"><span></span><button type="button" data-mv="0,-1">↑</button><span></span><button type="button" data-mv="-1,0">←</button><button type="button" data-mv="0,0" title="Voltar à posição original">•</button><button type="button" data-mv="1,0">→</button><span></span><button type="button" data-mv="0,1">↓</button><span></span></div>
        <p class="gzd-note">Cada clique move 5 px (Shift + clique: 25 px).</p></div>
      <div class="gzd-row"><button type="button" class="danger" data-e="hide">${it && it.x ? 'Mostrar de novo' : 'Excluir (esconder)'}</button><button type="button" data-e="restore">Restaurar este elemento</button></div>`;
    const get = () => itemFor(el, true);
    const t = ed.querySelector('[data-e=text]');
    if (t) t.oninput = () => { const {it, scope} = get(); it.t = it.t || {}; it.t[(window.gzSite && gzSite.lang) || 'pt'] = t.value; touch(el, scope, it); };
    const h = ed.querySelector('[data-e=href]'); if (h) h.onchange = () => { const {it, scope} = get(); it.h = h.value.trim(); touch(el, scope, it); };
    const a = ed.querySelector('[data-e=alt]'); if (a) a.onchange = () => { const {it, scope} = get(); it.a = a.value.trim(); touch(el, scope, it); };
    const f = ed.querySelector('[data-e=img]'); if (f) f.onchange = async () => {
      const file = f.files[0]; if (!file) return; if (file.size > 3 * 1024 * 1024) return msg('Imagem muito grande (máximo 3 MB).');
      msg('Enviando imagem…', true);
      try { const data = await new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = err; r.readAsDataURL(file); });
        const r = await api('/api/admin/design/image', {data}); const {it, scope} = get(); it.i = r.url; touch(el, scope, it); msg('Imagem trocada. Clique em Salvar alterações.', true); } catch (e) { msg(e.message); }
    };
    const z = ed.querySelector('[data-e=zoom]'); z.oninput = () => { const {it, scope} = get(); const k = isMobile() ? 'm' : 'd'; it[k] = {...(it[k] || {z: 100, dx: 0, dy: 0}), z: Number(z.value)}; ed.querySelector('[data-e=zv]').textContent = z.value + '%'; touch(el, scope, it); };
    ed.querySelectorAll('[data-mv]').forEach(b => b.onclick = e => { const [x, y] = b.dataset.mv.split(',').map(Number), step = e.shiftKey ? 25 : 5; move(el, x * step, y * step, !x && !y); });
    ed.querySelector('[data-e=hide]').onclick = () => { const {it, scope} = get(); it.x = it.x ? 0 : 1; touch(el, scope, it); select(el); };
    ed.querySelector('[data-e=restore]').onclick = () => { const at = itemFor(el, false); if (at && at.it) { lists[at.scope].splice(lists[at.scope].indexOf(at.it), 1); dirty.add(at.scope); } G.restore(el); status(); select(el); };
    ed.querySelector('[data-e=up]').onclick = () => { const p = el.parentElement; if (pickable(p)) select(p); };
    const dn = ed.querySelector('[data-e=down]'); if (dn) dn.onclick = () => { const c = [...el.children].find(pickable); if (c) select(c); };
    status();
  }
  function move(el, dx, dy, reset) {
    const {it, scope} = itemFor(el, true), k = isMobile() ? 'm' : 'd', b = {...(it[k] || {z: 100, dx: 0, dy: 0})};
    if (reset) { b.dx = 0; b.dy = 0; } else { b.dx += dx; b.dy += dy; }
    it[k] = b; touch(el, scope, it); const pos = $p('[data-e=pos]'); if (pos) pos.textContent = `${b.dx}, ${b.dy}`;
  }
  // arrastar o elemento selecionado com o mouse/dedo
  let drag = null, dragged = false;
  document.addEventListener('pointerdown', e => { if (!sel || !sel.contains(e.target) || e.target.closest('#gz-design')) return; drag = {x: e.clientX, y: e.clientY, sx: 0, sy: 0}; e.preventDefault(); }, true);
  document.addEventListener('pointermove', e => {
    if (!drag) return; const dx = Math.round(e.clientX - drag.x), dy = Math.round(e.clientY - drag.y);
    if (Math.abs(dx) + Math.abs(dy) < 4 && !dragged) return; dragged = true;
    move(sel, dx - drag.sx, dy - drag.sy); drag.sx = dx; drag.sy = dy;
  }, true);
  document.addEventListener('pointerup', () => { drag = null; }, true);
  document.addEventListener('dragstart', e => { if (!e.target.closest('#gz-design')) e.preventDefault(); }, true);

  // ---------- botões do painel ----------
  panel.addEventListener('click', async e => {
    const lb = e.target.closest('[data-lang-ed]'); if (lb) { window.gzSite && gzSite.set(lb.dataset.langEd); setTimeout(() => { G.applyAll(); if (sel) select(sel); status(); }, 0); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const act = b.dataset.a;
    if (act === 'min') { panel.classList.toggle('min'); b.textContent = panel.classList.contains('min') ? '+' : '–'; }
    if (act === 'save') {
      b.disabled = true; msg('Salvando…', true);
      const pages = {}; for (const s of dirty) pages[s === 'page' ? key : s] = lists[s];
      try { await api('/api/admin/design', {pages}); dirty.clear(); try { localStorage.removeItem('gz-design:' + location.pathname); } catch { } msg('Alterações salvas. Já estão no site.', true); }
      catch (err) { msg(err.message); } finally { b.disabled = !dirty.size; }
    }
    if (act === 'discard') { if (!dirty.size || confirmBox('Descartar as alterações não salvas?')) { dirty.clear(); location.reload(); } }
    if (act === 'reset') { if (confirmBox('Restaurar esta página como era originalmente? (Topo e rodapé continuam com as alterações; restaure-os pelo /admin.)')) { try { await api('/api/admin/design/reset', {page: key}); dirty.clear(); try { localStorage.removeItem('gz-design:' + location.pathname); } catch { } location.reload(); } catch (err) { msg(err.message); } } }
    if (act === 'exit') { if (!dirty.size || confirmBox('Sair sem salvar as alterações?')) { dirty.clear(); location.href = location.pathname; } }
  });
  pageSel.onchange = () => { if (dirty.size && !confirmBox('Trocar de página sem salvar as alterações?')) { pageSel.value = here ? here[0] : location.pathname; return; } dirty.clear(); location.href = pageSel.value + '?design=1'; };
  function confirmBox(text) { return window.confirm(text); }
  addEventListener('beforeunload', e => { if (dirty.size) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('resize', () => { if (sel) select(sel); });
  status(); msg('Modo design ativo. Clique em um elemento.', true);
})();
