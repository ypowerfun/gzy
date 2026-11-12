'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.3.2: nome da Arena/Organização (todos os planos). Sai no cupom do PDV, no fechamento de caixa, nas faturas,
// no relatório financeiro e no nome dos arquivos exportados. Em branco = "GameZoney".
const MAX = 60;
const clean = v => String(v ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
const name = store => clean(store.state.settings.organization) || 'GameZoney';
// nome seguro para arquivo: só letras/números sem acento, hífen
const fileTag = store => (clean(store.state.settings.organization).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || 'gamezoney';
function save(store, input, actor) {
  const value = clean(input?.name);
  if (value.length > MAX) require('./store').fail(`Nome da arena/organização: no máximo ${MAX} caracteres.`);
  return store.change(actor, 'config', value ? `Nome da arena/organização: ${value}` : 'Nome da arena/organização em branco (sai "GameZoney")', () => { store.state.settings.organization = value; return {name: value}; });
}
module.exports = {name, fileTag, save, clean, MAX};
