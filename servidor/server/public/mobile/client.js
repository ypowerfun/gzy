/* GameZoney mobile member view. Credentials and CSRF tokens remain in memory. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const duration = value => {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  };
  const points = value => (Math.max(0, Number(value) || 0) / 1000).toLocaleString('pt-BR', {maximumFractionDigits:3});
  const date = value => {
    const parsed = new Date(value);
    return value && Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
  };
  const timePrize = minutes => {
    const n = Math.max(0, Number(minutes) || 0);
    if (n && n % 60 === 0) return `${n / 60} ${n === 60 ? 'hora' : 'horas'} de jogo`;
    return n ? `${n.toLocaleString('pt-BR')} minutos de jogo` : 'Prêmio na recepção';
  };
  let csrfToken = '', authenticated = false, model = null, tab = 'home', kind = 'all';
  let epoch = 0, busy = false, online = false, sampledAt = 0, lastUpdated = 0;
  const statuses = {available:'Disponível',busy:'Ocupada',offline:'Desconectada',maintenance:'Em manutenção'};
  // 3.0.55/3.0.57: ícones em SVG embutido; ilustrações (ampulhetas, medalhas, aparelhos) em /mobile/art via CSS
  const starIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="url(#g-gold)" stroke="none"/></svg>';
  const giftIcon = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="15" width="30" height="21" rx="3" fill="none" stroke="url(#g-gold)" stroke-width="2"/><path d="M3 11h34v6H3zM20 11v25" fill="none" stroke="url(#g-gold)" stroke-width="2"/><path d="M20 11c-3-7-11-7-10-2 1 3 6 2 10 2 4 0 9 1 10-2 1-5-7-5-10 2z" fill="url(#g-gold)"/></svg>';
  // 3.0.56/3.0.57: monitor das estações e do histórico
  const monitorIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>';
  const clockIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const dayOf = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? String(d.getDate()).padStart(2, '0') : '—'; };
  const monthOf = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString('pt-BR', {month:'short'}).replace('.', '').toUpperCase() : ''; };

  async function request(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const headers = {Accept:'application/json'};
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        headers['X-Prime-CSRF'] = csrfToken;
      }
      const response = await fetch('/mobile/api' + path, {
        method:body === undefined ? 'GET' : 'POST', headers,
        body:body === undefined ? undefined : JSON.stringify(body),
        credentials:'same-origin', cache:'no-store', signal:controller.signal
      });
      let value;
      try { value = await response.json(); } catch { throw Error('O servidor não retornou uma resposta válida.'); }
      if (value.csrfToken) csrfToken = value.csrfToken;
      if (!response.ok) {
        const error = Error(value.error || value.message || 'Não foi possível concluir a operação.');
        error.status = response.status;
        throw error;
      }
      return value;
    } catch (error) {
      if (error.name === 'AbortError') throw Error('O servidor demorou para responder. Confira sua conexão e tente novamente.');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function clearMember() {
    epoch++;
    authenticated = false;
    model = null;
    busy = false;
    online = false;
    sampledAt = lastUpdated = 0;
    $('#app').hidden = true;
    $('#login-screen').hidden = false;
    $('#boot').hidden = true;
    $('#password').value = '';
    $('#password').type = 'password';
    toggleNotices(false);
    toggleOptions(false);
    $('#notice-dot').hidden = true;
    rankingData = null;
    rankingAt = 0;
    rankingBusy = false;
    $('#ranking-me').hidden = true;
    tournamentsData = null;
    tournamentsAt = 0;
    tournamentsBusy = false;
    $('#show-password').classList.remove('showing');
    $('#show-password').setAttribute('aria-pressed', 'false');
    $('#show-password').setAttribute('aria-label', 'Mostrar senha');
    for (const id of ['member-name','member-nick','balance','session-time','session-station','available-count','ranking-place','points','rewards-points','next-reward','stations-list','rewards-list','medals-list','history-list','notice-list','ranking-filters','ranking-me','ranking-board','ranking-note','tournaments-list','tournaments-note']) {
      $('#' + id).textContent = '';
    }
    $('#session-card').hidden = true;
    $('#next-progress').style.width = '0%';
    document.body.classList.remove('offline-state');
    $('#offline').hidden = true;
    selectTab('home');
  }

  function selectTab(name) {
    if (!['home','stations','ranking','tournaments','rewards','history'].includes(name)) return;
    tab = name;
    document.querySelectorAll('.tab-panel').forEach(panel => panel.hidden = panel.id !== 'tab-' + tab);
    document.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    if (tab === 'ranking') loadRankings(false);
    if (tab === 'tournaments') loadTournaments(false);
  }

  function setConnected(value) {
    online = value;
    document.body.classList.toggle('offline-state', !value);
    $('#offline').hidden = value;
    $('#connection').textContent = value
      ? 'Atualizado às ' + new Date(lastUpdated).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})
      : (lastUpdated ? 'Última atualização: ' + new Date(lastUpdated).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : 'Informações indisponíveis');
  }

  function renderStations() {
    if (!model) return;
    const stations = (model.stations || []).filter(s => kind === 'all' || s.kind === kind || (kind === 'computer' && s.kind === 'pc'));
    $('#stations-list').innerHTML = stations.length ? stations.map(s => {
      const status = Object.hasOwn(statuses, s.status) ? s.status : 'offline';
      const tv = s.kind === 'tv';
      return `<article class="station-tile ${status} ${tv ? 'is-tv' : 'is-pc'}"><span class="station-art" aria-hidden="true"></span><div class="station-symbol">${monitorIcon}<span class="station-dot" aria-hidden="true"></span></div><span class="station-kind">${tv ? 'TV / CONSOLE' : 'COMPUTADOR'}</span><h3>${esc(s.name)}</h3><span class="station-state"><i aria-hidden="true"></i>${statuses[status]}</span></article>`;
    }).join('') : '<p class="empty">Nenhuma estação encontrada nesta categoria.</p>';
  }

  function render() {
    if (!model?.member) return;
    const m = model.member, rewards = model.rewards || [], medals = model.medals || [];
    $('#member-name').textContent = m.name || m.username;
    $('#member-nick').textContent = '@' + m.username;
    $('#balance').textContent = duration(m.creditSeconds);
    $('#session-card').hidden = !model.activeSession;
    $('#session-time').textContent = duration(model.activeSession?.remainingSeconds);
    $('#session-station').textContent = model.activeSession?.stationName || '';
    $('#available-count').textContent = (model.stations || []).filter(s => s.status === 'available').length;
    renderHomeRanking();
    $('#points').textContent = $('#rewards-points').textContent = points(m.pointsMilli);
    const next = rewards.filter(r => Number(r.costMilli) > Number(m.pointsMilli)).sort((a,b) => a.costMilli - b.costMilli)[0];
    const eligible = rewards.some(r => Number(r.costMilli) > 0 && Number(r.costMilli) <= Number(m.pointsMilli));
    // 3.0.67: programa fidelidade desativado para este cliente pela recepção
    const loyaltyOff = m.loyaltyEnabled === false;
    $('#next-reward').textContent = loyaltyOff ? 'O programa fidelidade está desativado na sua conta: as recargas não geram pontos. Fale com a recepção para participar.' : eligible ? 'Seu saldo já alcançou um prêmio. Confira as opções e as regras da arena.' : next ? `Faltam ${points(next.costMilli - m.pointsMilli)} pontos para ${next.name}.` : 'Acompanhe aqui os prêmios e pontos da sua conta.';
    // barra até o próximo prêmio (cheia quando já alcançou algum)
    const progress = loyaltyOff ? 0 : eligible ? 100 : next && Number(next.costMilli) > 0 ? Math.max(0, Math.min(100, (Number(m.pointsMilli) || 0) / Number(next.costMilli) * 100)) : 0;
    $('#next-progress').style.width = progress + '%';
    $('#next-progress').parentElement.setAttribute('aria-valuenow', String(Math.floor(progress)));
    renderStations();
    renderNotices();
    $('#rewards-list').innerHTML = rewards.length ? rewards.map(reward => {
      const cost = Math.max(0, Number(reward.costMilli) || 0);
      const percent = cost > 0 ? Math.max(0, Math.min(100, (Number(m.pointsMilli) || 0) / cost * 100)) : 0;
      const ready = percent === 100;
      return `<article class="reward-card${ready ? ' ready' : ''}">${Number(reward.minutes) > 0 ? '<span class="reward-mark art-hourglass" aria-hidden="true"></span>' : `<span class="reward-mark" aria-hidden="true">${giftIcon}</span>`}<div class="reward-info"><h3>${esc(reward.name)}</h3><p>${timePrize(reward.minutes)}</p><p class="reward-cost">${points(cost)} pontos</p><div class="reward-progress" role="progressbar" aria-label="${esc(reward.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(percent)}"><span style="width:${percent}%"></span></div>${ready ? '<p class="reward-status">Pontos necessários alcançados · resgate na recepção</p>' : ''}</div></article>`;
    }).join('') : '<p class="empty">A arena ainda não tem prêmios disponíveis.</p>';
    $('#medals-list').innerHTML = medals.length ? medals.map(medal => {
      const share = medal.earned ? 100 : Number.isFinite(Number(medal.progress)) ? Math.max(0, Math.min(100, Number(medal.progress) * 100)) : null;
      const bar = !medal.earned && share !== null ? `<div class="medal-progress" role="progressbar" aria-label="${esc(medal.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(share)}"><span style="width:${share}%"></span></div>` : '';
      return `<article class="medal-card ${medal.earned ? 'earned' : ''}"><div class="medal-image ${medal.earned ? 'gold' : 'silver'}" aria-hidden="true"></div><h3>${esc(medal.name)}</h3><p>${esc(medal.description)}</p>${bar}<small>${medal.earned ? 'CONQUISTADA' : 'A CONQUISTAR'}</small></article>`;
    }).join('') : '<p class="empty">Suas medalhas aparecerão aqui.</p>';
    const sessions = model.recentSessions || [];
    $('#history-list').innerHTML = sessions.length ? sessions.map(session => `<article class="history-item"><div class="history-date" aria-label="${date(session.startedAt)}"><strong>${dayOf(session.startedAt)}</strong><span>${monthOf(session.startedAt)}</span></div><div class="history-body"><div class="history-top"><h3><span class="history-icon">${monitorIcon}</span>${esc(session.stationName || 'Estação')}</h3><strong>${clockIcon}${duration(session.usedSeconds)}</strong></div><p>${date(session.startedAt)}</p><p class="small">${session.finishedAt ? 'Encerrada em ' + date(session.finishedAt) : 'Sessão em andamento'}</p></div></article>`).join('') : '<p class="empty">Seu histórico começa na próxima partida. Até lá, confira as estações disponíveis.</p>';
  }

  // 3.0.57: avisos do sino — somente fatos reais da conta (sessão em andamento, prêmio alcançado, medalhas conquistadas)
  let noticeKeys = [];
  const seenKey = () => 'pa-avisos:' + (model?.member?.username || '');
  const seenGet = () => { try { return JSON.parse(localStorage.getItem(seenKey()) || '[]'); } catch { return []; } };
  const seenSet = keys => { try { localStorage.setItem(seenKey(), JSON.stringify(keys.slice(-60))); } catch {} };
  // 3.0.62: o cliente pode remover um aviso (X); some até surgir um aviso novo (outra chave)
  const hiddenKey = () => 'pa-avisos-removidos:' + (model?.member?.username || '');
  const hiddenGet = () => { try { return JSON.parse(localStorage.getItem(hiddenKey()) || '[]'); } catch { return []; } };
  const hiddenSet = keys => { try { localStorage.setItem(hiddenKey(), JSON.stringify(keys.slice(-100))); } catch {} };
  function renderNotices() {
    const m = model.member, items = [];
    const live = model.activeSession;
    if (live) items.push({key:'session:' + (live.stationName || ''), icon:clockIcon, text:`Sessão em andamento${live.stationName ? ' em <b>' + esc(live.stationName) + '</b>' : ''}.`});
    for (const reward of model.rewards || []) {
      if (Number(reward.costMilli) > 0 && Number(reward.costMilli) <= Number(m.pointsMilli)) items.push({key:'reward:' + (reward.id || reward.name), icon:giftIcon, text:`Prêmio liberado: <b>${esc(reward.name)}</b>. Resgate na recepção.`});
    }
    for (const medal of model.medals || []) if (medal.earned) items.push({key:'medal:' + (medal.id || medal.name), icon:starIcon, text:`Medalha conquistada: <b>${esc(medal.name)}</b>.`});
    const removed = hiddenGet(), visible = items.filter(item => !removed.includes(item.key));
    noticeKeys = visible.map(item => item.key);
    $('#notice-list').innerHTML = visible.length ? visible.map(item => `<li><span class="notice-icon" aria-hidden="true">${item.icon}</span><span class="notice-text">${item.text}</span><button type="button" class="notice-close" data-key="${esc(item.key)}" aria-label="Remover aviso" title="Remover aviso">×</button></li>`).join('') : '<li class="notice-empty">Nenhum aviso no momento.</li>';
    const seen = seenGet(), fresh = noticeKeys.some(key => !seen.includes(key));
    $('#notice-dot').hidden = !fresh || !$('#notice-panel').hidden;
    $('#notices').setAttribute('aria-label', fresh ? 'Avisos (há novidades)' : 'Avisos');
  }
  function toggleOptions(open = $('#options-panel').hidden) {
    if (open) toggleNotices(false);
    $('#options-panel').hidden = !open;
    $('#options').setAttribute('aria-expanded', String(open));
  }
  function toggleNotices(open = $('#notice-panel').hidden) {
    if (open && !$('#options-panel').hidden) toggleOptions(false);
    $('#notice-panel').hidden = !open;
    $('#notices').setAttribute('aria-expanded', String(open));
    if (open) { seenSet([...new Set([...seenGet(), ...noticeKeys])]); $('#notice-dot').hidden = true; }
  }

  // 3.0.60/3.0.63: rankings do site da GameZoney. O servidor busca e confere os dados; aqui só desenha (nomes sempre escapados).
  // 3.0.65: visual do ranking de medalhas do 3.0.61 (pódio, SUA POSIÇÃO e lista) com os dados e as FOTOS do site.
  // A foto vem sempre do próprio servidor (/mobile/api/avatar/<código>); sem foto (ou se falhar) fica a letra no círculo.
  let rankingData = null, rankingBoard = '', rankingAt = 0, rankingBusy = false;
  const initials = name => esc((String(name).trim().match(/\S+/g) || ['?']).slice(0, 2).map(word => word[0]).join('').toUpperCase());
  const avatarSrc = url => typeof url === 'string' && /^\/mobile\/api\/avatar\/[a-f0-9]{32}$/.test(url) ? url : '';
  const badge = (entry, small = false) => {
    const src = avatarSrc(entry?.avatar);
    return `<span class="avatar${small ? ' small' : ''}${src ? ' has-photo' : ''}" aria-hidden="true"><span class="avatar-letter">${initials(entry?.name || '?')}</span>${src ? `<img src="${src}" alt="" loading="lazy" decoding="async" draggable="false">` : ''}</span>`;
  };
  const photoFallback = root => root.querySelectorAll('.avatar img').forEach(img => img.addEventListener('error', () => { img.parentElement?.classList.remove('has-photo'); img.remove(); }, {once: true}));
  const rankValue = value => (Number(value) || 0).toLocaleString('pt-BR', {maximumFractionDigits:3});
  const boardLabel = title => String(title).replace(/^top\s*\d+\s*/i, '') || String(title);
  async function loadRankings(force) {
    if (!authenticated || rankingBusy || (!force && rankingData && Date.now() - rankingAt < 60000)) return;
    const generation = epoch;
    rankingBusy = true;
    if (!rankingData) $('#ranking-board').innerHTML = '<p class="empty">Carregando rankings…</p>';
    try {
      const result = await request('/rankings');
      if (generation !== epoch) return;
      rankingData = result;
      rankingAt = Date.now();
      renderRankings();
    } catch (error) {
      if (generation !== epoch) return;
      if (!rankingData) $('#ranking-board').innerHTML = `<p class="empty">${esc(error.message || 'Rankings indisponíveis no momento.')}</p>`;
    } finally { if (generation === epoch) rankingBusy = false; }
  }
  // 3.0.67: atalho da Início = Ranking. Mostra a sua posição se você estiver em algum ranking do site
  // (o ranking de medalhas vem primeiro; senão, a melhor posição entre os outros quadros). Toque: abre a aba Ranking.
  function renderHomeRanking() {
    const data = rankingData, place = $('#ranking-place'), label = $('#ranking-place-label');
    if (!data) { place.textContent = '—'; label.textContent = 'no ranking da arena'; return; }
    if (!data.available || !data.boards?.length) { place.textContent = '—'; label.textContent = 'ranking indisponível'; return; }
    const mine = data.boards.filter(board => board.me && Number.isFinite(Number(board.me.position)))
      .sort((a, b) => Number(!!b.medal) - Number(!!a.medal) || a.me.position - b.me.position)[0];
    place.textContent = mine ? mine.me.position + 'º' : '—';
    label.textContent = mine ? 'lugar · ' + boardLabel(mine.title) : 'fora do ranking';
  }
  function renderRankings() {
    const data = rankingData;
    if (!data?.available || !data.boards?.length) {
      $('#ranking-filters').innerHTML = '';
      $('#ranking-note').textContent = '';
      $('#ranking-me').hidden = true;
      $('#ranking-board').innerHTML = `<p class="empty">${esc(data?.error || 'Rankings indisponíveis no momento.')} Tente novamente em alguns minutos.</p>`;
      renderHomeRanking();
      return;
    }
    if (!data.boards.some(board => board.id === rankingBoard)) rankingBoard = (data.boards.find(board => board.medal) || data.boards[0]).id;
    $('#ranking-filters').innerHTML = data.boards.length < 2 ? '' : data.boards.map(board => `<button type="button" data-board="${esc(board.id)}" class="${board.id === rankingBoard ? 'selected' : ''}" aria-pressed="${board.id === rankingBoard}">${esc(boardLabel(board.title))}</button>`).join('');
    const board = data.boards.find(item => item.id === rankingBoard), unit = esc(board.unit);
    $('#ranking-title').textContent = board.medal ? 'Ranking de medalhas' : 'Rankings da arena';
    // 3.0.66: o ranking é só do site — sem regra nem ciclo do Programa Fidelidade (as medalhas do site não são os pontos de fidelidade;
    // os pontos e o prêmio de 3 horas ficam na aba Conquistas). O cartão mostra só a SUA POSIÇÃO, achada pelo nick.
    $('#ranking-rule').textContent = 'Os mesmos rankings do site da GameZoney.';
    const nick = data.nick || model?.member?.username || '', mine = board.me;
    $('#ranking-me').hidden = false;
    $('#ranking-me').innerHTML = `<div class="ranking-me-top">${badge(mine || {name: nick})}<div class="ranking-me-who"><span class="eyebrow">SUA POSIÇÃO</span><strong>${mine ? mine.position + 'º lugar' : 'Fora do ranking'}</strong><small>@${esc(nick)}</small></div>${mine ? `<div class="ranking-me-total"><b>${rankValue(mine.value)}</b><small>${unit}</small></div>` : ''}</div>`
      + (mine ? '' : `<p>Para aparecer aqui, use no site da GameZoney o mesmo nick do servidor: <b>@${esc(nick)}</b>.</p>`);
    const you = entry => entry.me ? '<em class="you">Você</em>' : '';
    const place = (entry, n) => entry ? `<div class="podium-place p${n}${entry.me ? ' me' : ''}"><span class="podium-rank">${entry.position}º</span><div class="podium-card">${badge(entry)}<strong>${esc(entry.name)}</strong>${you(entry)}</div><div class="podium-base"><b>${rankValue(entry.value)}</b><small>${unit}</small></div></div>` : '<div class="podium-place vacant" aria-hidden="true"></div>';
    const [first, second, third] = board.entries, rest = board.entries.slice(3);
    $('#ranking-board').innerHTML = `<article class="ranking-card"><header><span class="ranking-emblem" aria-hidden="true"></span><h3>${esc(board.title)}</h3></header>${board.entries.length
      ? `<div class="podium">${place(second, 2)}${place(first, 1)}${place(third, 3)}</div>${rest.length ? `<ol class="ranking-list">${rest.map(entry => `<li class="${entry.me ? 'me' : ''}"><span class="rank-pos">${entry.position}º</span>${badge(entry, true)}<span class="rank-name">${esc(entry.name)}${you(entry)}</span><span class="rank-value"><b>${rankValue(entry.value)}</b> ${unit}</span></li>`).join('')}</ol>` : ''}`
      : `<div class="ranking-empty"><span class="medal-image gold" aria-hidden="true"></span><strong>${esc(board.emptyTitle || 'A próxima conquista pode ser sua.')}</strong><p>${esc(board.emptyText || 'Os resultados aparecerão aqui após as primeiras disputas.')}</p></div>`}</article>`;
    photoFallback($('#ranking-me'));
    photoFallback($('#ranking-board'));
    renderHomeRanking();
    const at = new Date(data.fetchedAt);
    $('#ranking-note').textContent = [data.note, Number.isFinite(at.getTime()) ? (data.stale ? 'Última atualização recebida do site às ' : 'Atualizado do site às ') + at.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) + '.' : ''].filter(Boolean).join(' ');
  }

  // 3.0.61: torneios disponíveis do site (o servidor busca e confere; aqui só desenha, sempre escapado).
  const TOURNAMENTS_PAGE = 'https://primearena1.com.br/torneios';
  const siteLink = url => typeof url === 'string' && (url === TOURNAMENTS_PAGE || url.startsWith(TOURNAMENTS_PAGE + '/') || url.startsWith(TOURNAMENTS_PAGE + '?')) ? url : TOURNAMENTS_PAGE;
  let tournamentsData = null, tournamentsAt = 0, tournamentsBusy = false;
  async function loadTournaments(force) {
    if (!authenticated || tournamentsBusy || (!force && tournamentsData && Date.now() - tournamentsAt < 60000)) return;
    const generation = epoch;
    tournamentsBusy = true;
    if (!tournamentsData) $('#tournaments-list').innerHTML = '<p class="empty">Carregando torneios…</p>';
    try {
      const result = await request('/torneios');
      if (generation !== epoch) return;
      tournamentsData = result;
      tournamentsAt = Date.now();
      renderTournaments();
    } catch (error) {
      if (generation !== epoch) return;
      if (!tournamentsData) $('#tournaments-list').innerHTML = `<p class="empty">${esc(error.message || 'Torneios indisponíveis no momento.')}</p>`;
    } finally { if (generation === epoch) tournamentsBusy = false; }
  }
  function tournamentDate(value) {
    const d = new Date(value);
    if (!value || !Number.isFinite(d.getTime())) return '';
    const options = {weekday:'short', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'};
    try { return d.toLocaleString('pt-BR', {...options, timeZone:model?.timeZone || undefined}); } catch { return d.toLocaleString('pt-BR', options); }
  }
  function renderTournaments() {
    const data = tournamentsData;
    if (!data) return;
    const list = data.available ? data.tournaments || [] : [];
    $('#tournaments-list').innerHTML = !data.available
      ? `<p class="empty">${esc(data.error || 'Torneios indisponíveis no momento.')} Veja direto no site pelo botão abaixo.</p>`
      : list.length ? list.map(item => {
        const when = tournamentDate(item.startsAt), slots = item.slots, share = slots ? Math.min(100, slots.filled / slots.total * 100) : 0;
        const facts = [
          when && `<li>${clockIcon}<span>${esc(when)}</span></li>`,
          item.format && `<li>${monitorIcon}<span>${esc(item.format)}</span></li>`,
          item.entryFee && `<li><b>Inscrição</b><span>${esc(item.entryFee)}</span></li>`,
          item.prize && `<li><b>Premiação</b><span>${esc(item.prize)}</span></li>`
        ].filter(Boolean).join('');
        return `<article class="tournament-item status-${esc(item.status)}"><span class="tournament-mark" aria-hidden="true"></span><div class="tournament-top"><span class="t-status">${esc(item.statusText)}</span>${item.game || item.platform ? `<span class="t-game">${esc([item.game, item.platform].filter(Boolean).join(' · '))}</span>` : ''}</div><h3>${esc(item.title)}</h3>${facts ? `<ul class="t-facts">${facts}</ul>` : ''}${slots ? `<div class="t-slots"><span>Vagas</span><b>${slots.filled}/${slots.total}</b></div><div class="progress"><span style="width:${share}%"></span></div>` : ''}<a class="cta" href="${esc(siteLink(item.url))}" target="_blank" rel="noopener noreferrer">${item.status === 'open' ? 'Inscrever-se no site' : 'Ver no site'} <span aria-hidden="true">→</span></a></article>`;
      }).join('')
      : '<div class="tournament-empty"><span class="tournament-art" aria-hidden="true"></span><strong>Nenhum torneio aberto agora.</strong><p>Novos campeonatos, Viradão e MIX aparecem aqui assim que forem publicados no site.</p></div>';
    const at = new Date(data.fetchedAt);
    $('#tournaments-note').textContent = data.available && Number.isFinite(at.getTime()) ? (data.stale ? 'Última atualização recebida do site às ' : 'Atualizado do site às ') + at.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) + '.' : '';
  }

  async function refresh() {
    if (!authenticated || busy) return;
    const generation = epoch;
    busy = true;
    $('#refresh').disabled = true;
    try {
      const result = await request('/me');
      if (generation !== epoch || !authenticated) return;
      if (!result.member) throw Error('Não foi possível carregar sua conta.');
      model = result;
      sampledAt = performance.now();
      lastUpdated = Date.now();
      render();
      setConnected(true);
      loadRankings(false); // 3.0.67: a posição no ranking aparece já na Início (o servidor guarda o ranking do site por 5 min)
    } catch (error) {
      if (generation !== epoch) return;
      if (error.status === 401 || error.status === 403) {
        clearMember();
        csrfToken = '';
        $('#login-error').textContent = 'Seu acesso expirou ou a conta não está disponível. Entre novamente.';
      } else {
        setConnected(false);
        $('#offline').textContent = model
          ? 'Sem conexão com o servidor. As informações abaixo são da última atualização.'
          : 'Não foi possível carregar suas informações. Toque em Atualizar para tentar novamente.';
      }
    } finally {
      if (generation === epoch) busy = false;
      $('#refresh').disabled = false;
    }
  }

  async function authenticate() {
    try {
      const result = await request('/auth');
      $('#boot').hidden = true;
      if (result.member) {
        authenticated = true;
        $('#login-screen').hidden = true;
        $('#app').hidden = false;
        await refresh();
      } else clearMember();
    } catch {
      clearMember();
      $('#login-error').textContent = 'Não foi possível conectar à arena. Confira o endereço do servidor e sua conexão.';
    }
  }

  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#login-submit');
    if (button.disabled) return;
    button.disabled = true;
    $('#login-error').textContent = '';
    try {
      if (!csrfToken) await request('/auth');
      await request('/login', {username:$('#username').value.trim(), password:$('#password').value});
      $('#password').value = '';
      epoch++;
      authenticated = true;
      $('#login-screen').hidden = true;
      $('#app').hidden = false;
      await refresh();
    } catch (error) {
      $('#password').value = '';
      if (error.status === 403) csrfToken = '';
      $('#login-error').textContent = error.message || 'Não foi possível entrar. Tente novamente.';
    } finally { button.disabled = false; }
  });
  $('#show-password').addEventListener('click', () => {
    const showing = $('#password').type === 'password';
    $('#password').type = showing ? 'text' : 'password';
    $('#show-password').classList.toggle('showing', showing);
    $('#show-password').title = showing ? 'Ocultar senha' : 'Mostrar senha';
    $('#show-password').setAttribute('aria-pressed', String(showing));
    $('#show-password').setAttribute('aria-label', showing ? 'Ocultar senha' : 'Mostrar senha');
  });
  $('#logout').addEventListener('click', async () => {
    $('#logout').disabled = true;
    try {
      await request('/logout', {});
      csrfToken = '';
      clearMember();
      $('#login-error').textContent = '';
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        csrfToken = '';
        clearMember();
      } else {
        // Do not pretend to log out when the HttpOnly session is still valid.
        setConnected(false);
        $('#offline').textContent = 'Não foi possível sair. Reconecte à arena e toque em Sair novamente.';
      }
    } finally { $('#logout').disabled = false; }
  });
  $('#refresh').addEventListener('click', refresh);
  $('#refresh').addEventListener('click', () => { if (tab === 'ranking') loadRankings(true); if (tab === 'tournaments') loadTournaments(true); });
  $('#ranking-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-board]');
    if (!button) return;
    rankingBoard = button.dataset.board;
    renderRankings();
  });
  $('#notices').addEventListener('click', event => { event.stopPropagation(); toggleNotices(); });
  $('#notice-panel').addEventListener('click', event => {
    event.stopPropagation();
    const close = event.target.closest('.notice-close');
    if (!close || !model) return;
    hiddenSet([...new Set([...hiddenGet(), close.dataset.key])]);
    renderNotices();
  });
  $('#options').addEventListener('click', event => { event.stopPropagation(); toggleOptions(); });
  $('#options-panel').addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', () => { if (!$('#notice-panel').hidden) toggleNotices(false); if (!$('#options-panel').hidden) toggleOptions(false); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!$('#notice-panel').hidden) { toggleNotices(false); $('#notices').focus(); }
    if (!$('#options-panel').hidden) { toggleOptions(false); $('#options').focus(); }
  });
  // cabeçalho transparente sobre a arena; ganha fundo ao rolar
  window.addEventListener('scroll', () => $('.app-header').classList.toggle('scrolled', window.scrollY > 8), {passive:true});
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.tab)));
  $('#home-stations').addEventListener('click', () => selectTab('stations'));
  $('#home-ranking').addEventListener('click', () => selectTab('ranking'));
  $('#home-rewards').addEventListener('click', () => selectTab('rewards'));
  $('#play-cta').addEventListener('click', () => selectTab('stations'));
  document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
    kind = button.dataset.kind;
    document.querySelectorAll('[data-kind]').forEach(item => {
      item.classList.toggle('selected', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    renderStations();
  }));
  // 3.0.63: o app não permite selecionar/copiar textos nem abrir o menu de imagens (os campos de login continuam normais)
  document.addEventListener('contextmenu', event => { if (!event.target.closest('input, textarea')) event.preventDefault(); });
  document.addEventListener('selectstart', event => { if (!event.target.closest?.('input, textarea')) event.preventDefault(); });
  document.addEventListener('dragstart', event => event.preventDefault());
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
  setInterval(() => {
    if (online && model?.activeSession) $('#session-time').textContent = duration(model.activeSession.remainingSeconds - Math.floor((performance.now() - sampledAt) / 1000));
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', refresh);
  window.addEventListener('offline', () => { if (authenticated) setConnected(false); });
  authenticate();
})();
