'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Imagem enviada pelo navegador (data URL): só .jpg ou .png de verdade (confere a assinatura do arquivo) e até `max` bytes.
function decodeImage(dataUrl, max, fail) {
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) fail(400, 'Envie imagens .jpg ou .png.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > max) fail(400, `Cada imagem pode ter no máximo ${Math.round(max / 1048576)} MB.`);
  const png = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!png && !jpg) fail(400, 'Envie imagens .jpg ou .png.');
  return {buf, ext: png ? 'png' : 'jpg'};
}
module.exports = {decodeImage};
