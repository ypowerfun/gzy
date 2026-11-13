'use strict';
// 1.0.9: foto do cliente em Novo cliente / Editar cliente — câmera da recepção (webcam) ou arquivo JPG/PNG.
// A foto é reduzida para 480 px no próprio painel e vai junto ao salvar o cadastro.
function memberPhotoSetup(m) {
  const box = $('#member-photo'); if (!box) return;
  let stream = null;
  const current = m.photo ? `api/members/photo/${encodeURIComponent(m.id)}?v=${m.photo.v}` : '';
  box.className = 'member-photo';
  box.innerHTML = `<div class="mp-frame"><img id="mp-img" alt="" ${current ? `src="${current}"` : 'hidden'}><video id="mp-video" autoplay playsinline muted hidden></video><span id="mp-empty" ${current ? 'hidden' : ''}>Sem foto</span></div>
    <div class="mp-actions"><button type="button" id="mp-cam">Tirar foto</button><button type="button" id="mp-shot" class="primary" hidden>Capturar</button><button type="button" id="mp-pick">Enviar arquivo</button><button type="button" id="mp-del" class="ghost" ${current ? '' : 'hidden'}>Remover foto</button>
    <input type="file" id="mp-file" accept="image/jpeg,image/png" hidden><input type="hidden" name="photo" id="mp-data"><input type="hidden" name="photoRemove" id="mp-remove"></div>`;
  const img = $('#mp-img'), video = $('#mp-video'), empty = $('#mp-empty');
  const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; video.hidden = true; $('#mp-shot').hidden = true; $('#mp-cam').hidden = false; };
  const set = data => { $('#mp-data').value = data; $('#mp-remove').value = ''; img.src = data; img.hidden = false; empty.hidden = true; $('#mp-del').hidden = false; };
  const shrink = (source, w, h) => { const scale = Math.min(1, 480 / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale); c.getContext('2d').drawImage(source, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85); };
  $('#mp-cam').onclick = async () => {
    try { stream = await navigator.mediaDevices.getUserMedia({video: {width: {ideal: 640}, height: {ideal: 480}}, audio: false}); }
    catch { return toast('Câmera não encontrada ou sem permissão. Conecte a webcam da recepção ou use Enviar arquivo.'); }
    video.srcObject = stream; video.hidden = false; img.hidden = true; empty.hidden = true; $('#mp-shot').hidden = false; $('#mp-cam').hidden = true;
  };
  $('#mp-shot').onclick = () => { if (!video.videoWidth) return; set(shrink(video, video.videoWidth, video.videoHeight)); stop(); };
  $('#mp-pick').onclick = () => $('#mp-file').click();
  $('#mp-file').onchange = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) return toast('Use uma foto JPG ou PNG.');
    if (f.size > 15 * 1024 * 1024) return toast('Arquivo muito grande.');
    const url = URL.createObjectURL(f), pic = new Image();
    pic.onload = () => { set(shrink(pic, pic.naturalWidth, pic.naturalHeight)); URL.revokeObjectURL(url); };
    pic.onerror = () => { toast('Não foi possível abrir a imagem.'); URL.revokeObjectURL(url); };
    pic.src = url;
  };
  $('#mp-del').onclick = () => { stop(); $('#mp-data').value = ''; $('#mp-remove').value = m.photo ? 'true' : ''; img.hidden = true; img.removeAttribute('src'); empty.hidden = false; $('#mp-del').hidden = true; };
  $('#modal').addEventListener('close', stop, {once: true});
}
