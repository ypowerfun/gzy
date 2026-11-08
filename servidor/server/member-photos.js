'use strict';
// 1.0.9: foto do cliente (Novo cliente / Editar cliente): tirada pela câmera da recepção ou enviada de um arquivo.
// Fica em <dados>/photos/<id>.jpg|png (entra no backup completo junto com a pasta de dados); no cadastro só vai a versão.
const fs = require('node:fs'), path = require('node:path');
const {fail} = require('./store');
const MAX = 700 * 1024;
const dir = store => path.join(store.directory, 'photos');
const file = (store, m) => m?.photo ? path.join(dir(store), m.id + (m.photo.type === 'png' ? '.png' : '.jpg')) : null;
function decode(dataUrl) {
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+=*)$/.exec(String(dataUrl || ''));
  if (!m) fail('Foto inválida (use JPG ou PNG).');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX) fail('Foto muito grande (máximo 700 KB).');
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff, png = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!jpg && !png) fail('Foto inválida (use JPG ou PNG).');
  return {buf, type: png ? 'png' : 'jpg'};
}
function apply(store, member, input, actor) {
  if (input.photoRemove === true || input.photoRemove === '1' || input.photoRemove === 'true') {
    if (!member.photo) return member;
    const f = file(store, member); store.change(actor, 'membro', 'Foto removida: ' + member.name, () => { delete member.photo; return member; }); try { fs.rmSync(f, {force: true}); } catch { }
    return member;
  }
  if (!input.photo) return member;
  const {buf, type} = decode(input.photo), old = file(store, member);
  fs.mkdirSync(dir(store), {recursive: true});
  const target = path.join(dir(store), member.id + (type === 'png' ? '.png' : '.jpg')), tmp = target + '.tmp';
  fs.writeFileSync(tmp, buf); fs.renameSync(tmp, target);
  if (old && old !== target) try { fs.rmSync(old, {force: true}); } catch { }
  store.change(actor, 'membro', 'Foto do cliente atualizada: ' + member.name, () => { member.photo = {v: Date.now(), type}; return member; });
  return member;
}
const read = (store, memberId) => { const m = store.state.members.find(x => x.id === memberId); const f = file(store, m); return f && fs.existsSync(f) ? {path: f, type: m.photo.type} : null; };
module.exports = {apply, read, decode};
