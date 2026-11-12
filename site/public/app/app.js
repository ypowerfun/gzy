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
  let tab = 'home', me = null, timers = [], filter = 'all', histTab = 'sessions';
  const CAT = {pc: 'PC', console: 'Console', vr: 'VR', sim: 'Simulador'};
  const FILTERS = [['all', 'Todas'], ['pc', 'PCs'], ['console', 'Consoles'], ['vr', 'VR'], ['sim', 'Simuladores']];

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
    const st = $('#arena-status'); st.textContent = d.online ? '● Online' : '● Sem conexão no momento'; st.className = d.online ? 'on' : '';
    if (d.color) { document.documentElement.style.setProperty('--accent', d.color); document.documentElement.style.setProperty('--accent2', `color-mix(in srgb, ${d.color} 70%, #fff)`); document.querySelector('meta[name=theme-color]').content = '#0b0b12'; }
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
    ({home, stations, achievements, history})[t]().catch(err => { screen.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p><button class="btn ghost" id="again">Tentar de novo</button></div>`; const a = $('#again'); if (a) a.onclick = () => show(tab); });
  }
  document.addEventListener('click', e => { const b = e.target.closest('#tabs button'); if (b) show(b.dataset.tab); });

  function countdown(sel, endAt) { const tick = () => { const el = document.querySelector(sel); if (!el) return; el.textContent = clock((endAt - Date.now()) / 1000); }; tick(); timers.push(setInterval(tick, 1000)); }
  async function home() {
    screen.innerHTML = '<div class="loading">Carregando…</div>';
    me = (await call('me')).me;
    const s = me.session, l = me.loyalty;
    const prog = l.enabled ? Math.min(100, me.medals / l.threshold * 100) : 0;
    screen.innerHTML = `<h1>Olá, ${esc(me.name?.split(' ')[0] || me.username)}!</h1><p class="sub">@${esc(me.username)}</p>
      ${s ? `<div class="card live"><span class="stat"><span>Jogando agora • ${esc(s.station)}</span></span><div class="big" id="cd">--:--:--</div><small style="color:var(--muted)">tempo restante da sessão</small></div>` : ''}
      <div class="grid2"><div class="card stat"><span>Saldo de tempo</span><strong>${hm(me.balanceSeconds)}</strong><small>para usar nos PCs e consoles</small></div>
      <div class="card stat"><span>Medalhas</span><strong>${num(me.medals)}</strong><small>${me.achievements} conquista${me.achievements === 1 ? '' : 's'}</small></div></div>
      ${l.enabled ? `<div class="card stat"><span>Programa fidelidade</span><div class="bar"><i style="width:${prog.toFixed(1)}%"></i></div><small>${num(me.medals)} de ${num(l.threshold)} medalhas para ganhar ${hm(l.rewardMinutes * 60)} de tempo</small></div>` : ''}
      <button class="btn ghost" id="out" style="margin-top:20px">Sair</button>`;
    if (s) countdown('#cd', Date.now() + s.remainingSeconds * 1000);
    $('#out').onclick = () => logout();
  }
  async function stations() {
    screen.innerHTML = '<div class="loading">Carregando…</div>';
    const paint = list => {
      const cats = new Set(list.map(x => x.category));
      const shown = list.filter(x => filter === 'all' || x.category === filter);
      const free = list.filter(x => x.status === 'free').length;
      screen.innerHTML = `<h1>Estações</h1><p class="sub">${free} livre${free === 1 ? '' : 's'} de ${list.length}</p>
        <div class="chips">${FILTERS.filter(([k]) => k === 'all' || cats.has(k)).map(([k, t]) => `<button data-f="${k}" class="${filter === k ? 'active' : ''}">${t}</button>`).join('')}</div>
        ${shown.length ? `<div class="stations">${shown.map((x, i) => `<div class="station ${x.status}"><span class="type">${CAT[x.category] || ''}</span><span class="name">${esc(x.name)}</span><span class="st" ${x.status === 'busy' ? `data-end="${Date.now() + x.remainingSeconds * 1000}"` : ''}>${x.status === 'free' ? 'Livre' : x.status === 'busy' ? clock(x.remainingSeconds) : x.status === 'maintenance' ? 'Manutenção' : 'Desligado'}</span></div>`).join('')}</div>` : '<div class="empty">Nenhuma estação neste filtro.</div>'}`;
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
      ${list.length ? list.map(a => `<div class="card ach ${a.done ? 'done' : ''}"><div class="ic">${esc(a.icon)}</div><div class="body"><strong>${esc(a.name)}</strong>${a.description ? `<small>${esc(a.description)}</small>` : ''}
        ${a.done ? `<span class="badge">✔ Completada ${esc(when(a.doneAt))}</span>` : `<div class="bar"><i style="width:${Math.min(100, a.value / a.target * 100).toFixed(1)}%"></i></div><small>${esc(a.metricLabel)}: ${esc(val(a))}</small>`}</div>
        <span class="medal">+${num(a.medals)} 🏅</span></div>`).join('') : '<div class="empty">A arena ainda não criou conquistas.</div>'}`;
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
        <div class="card">${rows.length ? rows.join('') : '<div class="empty">Nada por aqui ainda.</div>'}</div>`;
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
