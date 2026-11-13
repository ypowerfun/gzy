'use strict';
// GameZoney — app do cliente (app.gamezoney.com/<endereço-da-arena>). Software proprietário e confidencial.
// Os dados vêm do GameZoney Servidor da arena (o site só repassa). Login = mesmo nick e senha do PC.
(function () {
  const $ = s => document.querySelector(s), screen = $('#screen');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const slug = (parts[0] === 'app' ? parts[1] : parts[0]) || '';
  const base = parts[0] === 'app' ? '/app/' : '/';
  const KEY = 'gzapp:' + slug;
  let token = ''; try { token = localStorage.getItem(KEY) || ''; } catch { }
  let tab = 'home', me = null, timers = [], filter = 'all', histTab = 'sessions', rankTab = 'medals';
  // 1.3.8: VR funciona junto com o console (um tipo só: Console/VR)
  const CAT = {pc: 'PC', console: 'Console/VR', sim: 'Simulador'};
  const FILTERS = [['all', 'Todas'], ['pc', 'PCs'], ['console', 'Consoles/VR'], ['sim', 'Simuladores']];
  const catOf = x => (x.category === 'vr' ? 'console' : CAT[x.category] ? x.category : 'pc');
  // foto do card: PC, simulador, ou console pelo nome (Xbox / PlayStation); sem marca no nome = PlayStation
  const XBOX = /x\s*-?\s*box|\bseries\s*[xs]\b|\bxsx\b|\bxss\b|\bone\s*[xs]\b/i, PLAY = /play\s*-?\s*station|\bps\s*-?\s*(?:[1-5]|vr2?|vita|portal)\b|\bpsvr/i;
  const photoOf = x => { const c = catOf(x); if (c === 'pc') return 'pc'; if (c === 'sim') return 'sim'; return XBOX.test(x.name) && !PLAY.test(x.name) ? 'xbox' : 'ps'; };
  const MEDAL = '<svg class="medal-ic" viewBox="0 0 32 32" aria-hidden="true"><path d="M9 2h5l2 7-4 2zM23 2h-5l-2 7 4 2z" fill="var(--accent)"/><circle cx="16" cy="20" r="9" fill="var(--accent2)" stroke="var(--accent)" stroke-width="2"/><path d="m16 15 1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z" fill="var(--accent)"/></svg>';
  // cor da arena (Personalizar visual): troca o dourado e gira o fundo/foto do PC para o mesmo tom
  function hsl(hex) { const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l]; const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; }
  function applyColor(c) {
    if (!/^#[0-9a-f]{6}$/i.test(c || '')) return;
    const [h, sat] = hsl(c), root = document.documentElement.style, BASE_H = 44, BASE_S = .8;
    root.setProperty('--accent', c); root.setProperty('--accent2', `color-mix(in srgb, ${c} 62%, #fff)`);
    root.setProperty('--hue', Math.round(h - BASE_H) + 'deg'); root.setProperty('--sat', Math.max(.15, Math.min(1.4, sat / BASE_S)).toFixed(2));
  }

  const clock = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
  const hm = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m} min`; };
  const brl = c => (c / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  const num = n => (Math.round(n * 1000) / 1000).toLocaleString('pt-BR');
  const when = t => t ? new Date(t).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'}) : '';
  const stopTimers = () => { timers.forEach(clearInterval); timers = []; };

  async function call(action, body) {
    const r = await fetch(`/api/app/a/${encodeURIComponent(slug)}/${action}`, {method: 'POST', headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})}, body: JSON.stringify(body || {})});
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { logout(true); throw new Error(data.error || 'Entre de novo.'); }
    if (!r.ok) throw new Error(data.error || 'Não foi possível falar com a arena agora.');
    return data;
  }
  function logout(quiet) { token = ''; me = null; try { localStorage.removeItem(KEY); } catch { } $('#tabs').classList.add('hidden'); stopTimers(); if (!quiet) loginScreen(); else setTimeout(loginScreen, 0); }

  // ---------- sem endereço: escolher a arena ----------
  function pickArena(msg) {
    document.title = 'GameZoney App';
    screen.innerHTML = `${msg ? `<div class="card"><p class="error">${esc(msg)}</p></div>` : ''}<h1>App da sua arena</h1><p class="sub">Digite o endereço que a recepção informou (ex.: arena-centro).</p>
      <form id="f" class="card"><label>Endereço da arena<input name="slug" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="arena-centro" required></label><button class="btn">Abrir</button></form>
      <p class="foot">GameZoney • <a href="https://gamezoney.com">gamezoney.com</a></p>`;
    $('#f').onsubmit = e => { e.preventDefault(); const v = e.target.slug.value.trim().toLowerCase().replace(/^.*\//, ''); if (v) location.href = base + encodeURIComponent(v); };
  }
  // ---------- cabeçalho da arena ----------
  async function loadArena() {
    const r = await fetch(`/api/app/a/${encodeURIComponent(slug)}/info`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Arena não encontrada.');
    $('#arena-name').textContent = d.name || 'Arena'; document.title = (d.name || 'Arena') + ' • App';
    const st = $('#arena-status'); st.textContent = d.online ? 'Online' : 'Sem conexão no momento'; st.className = d.online ? 'on' : '';
    applyColor(d.color);
    if (d.logo) $('#logo').src = `/api/app/a/${encodeURIComponent(slug)}/logo?v=${encodeURIComponent(d.logoRev)}`;
    return d;
  }
  // ---------- login ----------
  function loginScreen() {
    stopTimers(); $('#tabs').classList.add('hidden');
    screen.innerHTML = `<h1>Entrar</h1><p class="sub">Use o mesmo usuário (nick) e senha que você usa nos PCs da arena.</p>
      <form id="f" class="card"><label>Usuário / Nick<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="32"></label>
      <label>Senha<input name="password" type="password" autocomplete="current-password" required maxlength="20"></label><button class="btn">Entrar</button><p class="error" id="err" role="alert"></p></form>
      <p class="foot">Ainda não tem cadastro ou senha? Peça na recepção ou crie a conta em um PC da arena.</p>`;
    $('#f').onsubmit = async e => {
      e.preventDefault(); const b = e.target.querySelector('button'); b.disabled = true; $('#err').textContent = '';
      try { const d = await call('login', {username: e.target.username.value, password: e.target.password.value}); token = d.token; me = d.me; try { localStorage.setItem(KEY, token); } catch { } start(); }
      catch (err) { $('#err').textContent = err.message; b.disabled = false; }
    };
  }
  // ---------- abas ----------
  function start() { $('#tabs').classList.remove('hidden'); show(tab); }
  function show(t) {
    tab = t; stopTimers(); document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t)); window.scrollTo(0, 0);
    ({home, stations, achievements, ranking, history})[t]().catch(err => { screen.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p><button class="btn ghost" id="again">Tentar de novo</button></div>`; const a = $('#again'); if (a) a.onclick = () => show(tab); });
  }
  document.addEventListener('click', e => { const b = e.target.closest('#tabs button'); if (b) show(b.dataset.tab); });

  function countdown(sel, endAt) { const tick = () => { const el = document.querySelector(sel); if (!el) return; el.textContent = clock((endAt - Date.now()) / 1000); }; tick(); timers.push(setInterval(tick, 1000)); }
  async function home() {
    screen.innerHTML = '<div class="loading">Carregando…</div>';
    me = (await call('me')).me;
    const s = me.session, l = me.loyalty;
    const prog = l.enabled ? Math.min(100, me.medals / l.threshold * 100) : 0;
    screen.innerHTML = `<h1>Olá, ${esc(me.name?.split(' ')[0] || me.username)}!</h1><p class="sub">@${esc(me.username)}</p>
      ${s ? `<div class="card live"><span class="lbl">Jogando agora • ${esc(s.station)}</span><div class="big" id="cd">--:--:--</div><small>tempo restante da sessão</small></div>` : ''}
      <div class="grid2"><div class="card stat"><span>Saldo de tempo</span><strong>${hm(me.balanceSeconds)}</strong><small>para usar nos PCs e consoles</small></div>
      <div class="card stat"><span>Medalhas</span><strong>${MEDAL}${num(me.medals)}</strong><small>${me.achievements} conquista${me.achievements === 1 ? '' : 's'}</small></div></div>
      ${l.enabled ? `<div class="card stat"><span>Programa fidelidade</span><div class="bar"><i style="width:${prog.toFixed(1)}%"></i></div><small>${num(me.medals)} de ${num(l.threshold)} medalhas para ganhar ${hm(l.rewardMinutes * 60)} de tempo</small></div>` : ''}
      <button class="btn" id="out" style="margin-top:20px">Sair</button>`;
    if (s) countdown('#cd', Date.now() + s.remainingSeconds * 1000);
    $('#out').onclick = () => logout();
  }
  async function stations() {
    screen.innerHTML = '<div class="loading">Carregando…</div>';
    // auditoria: situação só dos valores conhecidos (o texto vem da arena e entra num atributo class)
    const STATUS = ['free', 'busy', 'maintenance', 'offline'];
    const paint = list0 => { const list = (Array.isArray(list0) ? list0 : []).map(x => ({...x, status: STATUS.includes(x.status) ? x.status : 'offline'}));
      const cats = new Set(list.map(catOf));
      const shown = list.filter(x => filter === 'all' || catOf(x) === filter);
      const free = list.filter(x => x.status === 'free').length;
      screen.innerHTML = `<h1>Estações</h1><p class="sub">${free} livre${free === 1 ? '' : 's'} de ${list.length}</p>
        <div class="chips">${FILTERS.filter(([k]) => k === 'all' || cats.has(k)).map(([k, t]) => `<button data-f="${k}" class="${filter === k ? 'active' : ''}">${t}</button>`).join('')}</div>
        ${shown.length ? `<div class="stations">${shown.map(x => { const ph = photoOf(x), c = catOf(x);
          return `<div class="station ${x.status}"><img src="/app/img/${ph}.jpg" alt="" loading="lazy" class="${ph === 'pc' ? 'tint' : ''}"><div class="meta">${c === 'pc' ? '' : `<span class="pill gold">${CAT[c]}</span>`}<span class="pill gold name">${esc(x.name)}</span>
            <div class="row2">${x.status === 'busy' ? `<span class="pill gold time" data-end="${Date.now() + x.remainingSeconds * 1000}">${clock(x.remainingSeconds)}</span>` : `<span class="pill dark state">${x.status === 'free' ? 'Livre' : x.status === 'maintenance' ? 'Manutenção' : 'Desligado'}</span>`}</div></div></div>`; }).join('')}</div>` : '<div class="empty">Nenhuma estação neste filtro.</div>'}`;
      screen.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; paint(list); });
    };
    let list = (await call('stations')).stations; paint(list);
    timers.push(setInterval(() => screen.querySelectorAll('[data-end]').forEach(el => { el.textContent = clock((el.dataset.end - Date.now()) / 1000); }), 1000));
    timers.push(setInterval(async () => { try { list = (await call('stations')).stations; if (tab === 'stations') paint(list); } catch { } }, 20000));
  }
  async function achievements() {
    screen.innerHTML = '<div class="loading">Carregando…</div>';
    const list = (await call('achievements')).achievements;
    const done = list.filter(a => a.done).length;
    const val = a => a.unit === 'R$' ? brl(a.value * 100) + ' de ' + brl(a.target * 100) : a.unit === 'h' ? `${num(a.value)} de ${num(a.target)} h` : `${num(a.value)} de ${num(a.target)}`;
    screen.innerHTML = `<h1>Conquistas</h1><p class="sub">${done} de ${list.length} completadas</p>
      ${list.length ? `<div class="achs">${list.map(a => `<div class="ach ${a.done ? '' : 'todo'}"><div class="ic">${esc(a.icon)}</div><strong>${esc(a.name)}</strong>${a.description ? `<small>${esc(a.description)}</small>` : ''}
        ${a.done ? `<span class="done">✔ Completada ${esc(when(a.doneAt))}</span>` : `<div class="bar"><i style="width:${Math.min(100, a.value / a.target * 100).toFixed(1)}%"></i></div><small>${esc(val(a))}</small>`}
        <span class="plus">+${num(a.medals)}</span></div>`).join('')}</div>` : '<div class="empty">A arena ainda não criou conquistas.</div>'}`;
  }
  // 1.3.9: Ranking da arena (os mesmos Top 10 do painel; só nicks)
  async function ranking() {
    screen.innerHTML = '<div class="loading">Carregando…</div>';
    const r = await call('ranking');
    const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const monthName = (() => { const [y, m] = String(r.month || '').split('-').map(Number); return m ? `${MONTHS[m - 1]} de ${y}` : ''; })();
    const TABS = [['medals', 'Medalhas', 'Top 10 em medalhas conquistadas', v => `${num(v)}`], ['participations', 'Corujão/Viradão', 'Top 10 em participações no Corujão/Viradão', v => `${num(v)}×`],
      ['recharges', 'Recargas do mês', `Top 10 em recargas de ${monthName}`, v => `${num(v)} recarga${v === 1 ? '' : 's'}`]];
    const paint = () => {
      const [key, , title, fmt] = TABS.find(t => t[0] === rankTab), list = r[key] || [], mine = list.find(x => x.me);
      screen.innerHTML = `<h1>Ranking</h1><p class="sub">${esc(title)}</p>
        <div class="seg">${TABS.map(([k, t]) => `<button data-r="${k}" class="${rankTab === k ? 'active' : ''}">${t}</button>`).join('')}</div>
        ${list.length ? `<div class="card rank">${list.map((x, i) => `<div class="rk ${i < 3 ? 'p' + (i + 1) : ''} ${x.me ? 'mine' : ''}"><span class="pos">${i + 1}º</span><span class="nk">${esc(x.nick)}${x.me ? ' <small>(você)</small>' : ''}</span><span class="val">${esc(fmt(x.value))}${key === 'medals' ? MEDAL.replace('class="medal-ic"', 'class="medal-ic sm"') : ''}</span></div>`).join('')}</div>
        <p class="sub" style="text-align:center;margin-top:12px">${mine ? 'Você está no Top 10! 🎉' : 'Jogue, participe e recarregue para entrar no Top 10.'}</p>` : '<div class="empty">Ninguém no ranking ainda.</div>'}`;
      screen.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { rankTab = b.dataset.r; paint(); });
    };
    paint();
  }
  async function history() {
    screen.innerHTML = '<div class="loading">Carregando…</div>';
    const h = await call('history');
    const paint = () => {
      const rows = histTab === 'sessions' ? h.sessions.map(s => `<div class="row"><div>${esc(s.station)}<small>${esc(when(s.at))}</small></div><div class="v">${hm(s.usedSeconds)}</div></div>`)
        : histTab === 'recharges' ? h.recharges.map(r => `<div class="row"><div>${r.minutes ? hm(r.minutes * 60) : 'Recarga'}${r.canceled ? ' <small style="display:inline">(cancelada)</small>' : ''}<small>${esc(when(r.at))}</small></div><div class="v">${brl(r.cents)}</div></div>`)
        : h.medals.map(m => `<div class="row"><div>${esc(m.reason || 'Medalhas')}<small>${esc(when(m.at))}</small></div><div class="v ${m.medals >= 0 ? 'plus' : 'minus'}">${m.medals >= 0 ? '+' : ''}${num(m.medals)}</div></div>`);
      screen.innerHTML = `<h1>Histórico</h1><p class="sub">Últimos registros na arena</p>
        <div class="seg">${[['sessions', 'Sessões'], ['recharges', 'Recargas'], ['medals', 'Medalhas']].map(([k, t]) => `<button data-h="${k}" class="${histTab === k ? 'active' : ''}">${t}</button>`).join('')}</div>
        <div class="card rows" style="padding:4px 0">${rows.length ? rows.join('') : '<div class="empty">Nada por aqui ainda.</div>'}</div>`;
      screen.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { histTab = b.dataset.h; paint(); });
    };
    paint();
  }

  // ---------- início ----------
  (async () => {
    if (!slug || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return pickArena();
    try { await loadArena(); } catch (e) { pickArena(e.message); return; }
    if (token) start(); else loginScreen();
  })();
})();
