'use strict';
$('#reset-form').onsubmit = e => { e.preventDefault(); const f = e.target; busy(f.querySelector('button'), async () => {
  try { await api('/api/auth/reset', {token: new URLSearchParams(location.search).get('t') || '', password: f.password.value}); location.href = '/conta'; } catch (err) { showMsg($('#msg'), err.message); } }); };
