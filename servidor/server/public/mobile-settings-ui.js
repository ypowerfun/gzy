'use strict';
// Configurações → Apps (painel da recepção). 3.0.70: só o app do cliente (o app SV foi retirado).
const renderSettingsBeforeMobile = renderSettings;
renderSettings = function () {
  renderSettingsBeforeMobile();
  if (isAdmin()) renderMobileSettings().catch(error => toast(error.message));
};
async function renderMobileSettings() {
  const config = await api('/mobile-settings');
  if (view !== 'settings') return;
  let section = document.getElementById('mobile-settings-section');
  if (!section) {
    section = document.createElement('section');
    section.id = 'mobile-settings-section';
    section.className = 'panel';
    document.getElementById('view').append(section);
  }
  section.innerHTML = `<h2>App GameZoney (cliente)</h2>
    <p>O cliente consulta saldo, fidelidade, medalhas e disponibilidade. A administração é feita somente por este painel (o app GameZoney SV foi retirado na 3.0.70).</p>
    <form id="mobile-settings-form">
      <label><input type="checkbox" name="enabled" ${config.enabled ? 'checked' : ''}> Permitir acesso pelos apps</label>
      <label><input type="checkbox" name="lanClient" ${config.lanClient ? 'checked' : ''}> Permitir o app do cliente pela rede local da arena (Wi-Fi, sem HTTPS)</label>
      <label><input type="checkbox" name="webClient" ${config.webClient ? 'checked' : ''}> Permitir o app do cliente pelo navegador (página web e apps antigos 1.0.x)</label>
      <p class="hint">3.0.69: desmarcado (padrão), o cliente usa somente o app GameZoney nativo 2.0. Marque só se algum cliente ainda não tiver o app (ex.: iPhone até a versão nativa sair na App Store).</p>
      <label>Endereço HTTPS público (opcional para uso apenas na rede local)
        <input name="publicUrl" type="url" placeholder="https://arena.seudominio.com.br" value="${esc(config.publicUrl)}">
      </label>
      <label>Endereço dos torneios do site (JSON)
        <input name="tournamentsUrl" type="url" placeholder="${esc(config.tournamentsDefault)}" value="${esc(config.tournamentsUrl)}">
      </label>
      <p class="hint">Aba Torneios do app: o servidor busca este endereço do site no máximo a cada 5 minutos. Vazio = ${esc(config.tournamentsDefault)}. Situação: ${config.tournamentsStatus.ok ? 'recebido às ' + esc(new Date(config.tournamentsStatus.fetchedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})) : esc(config.tournamentsStatus.error || 'ainda não buscado (busca quando um cliente abre a aba Torneios)')}.</p>
      <label>Endereço dos rankings do site (JSON)
        <input name="rankingsUrl" type="url" placeholder="${esc(config.rankingsDefault)}" value="${esc(config.rankingsUrl)}">
      </label>
      <p class="hint">Aba Ranking do app: o servidor busca este endereço do site no máximo a cada 5 minutos. Vazio = ${esc(config.rankingsDefault)}. Situação: ${config.rankingsStatus.ok ? 'recebido às ' + esc(new Date(config.rankingsStatus.fetchedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})) : esc(config.rankingsStatus.error || 'ainda não buscado (busca quando um cliente abre a aba Ranking)')}.</p>
      <p class="hint">Pela rede local, apenas o app do cliente, se a opção acima estiver marcada; desmarque quando o endereço HTTPS também funcionar dentro da arena. Salvar este campo não publica o servidor.</p>
      <button class="primary">Salvar acesso dos apps</button>
      <p id="mobile-settings-result" role="status"></p>
    </form>`;
  document.getElementById('mobile-settings-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.target, button = form.querySelector('button');
    button.disabled = true;
    try {
      await api('/mobile-settings', {enabled: form.elements.enabled.checked, lanClient: form.elements.lanClient.checked, webClient: form.elements.webClient.checked, publicUrl: form.elements.publicUrl.value.trim(), tournamentsUrl: form.elements.tournamentsUrl.value.trim(), rankingsUrl: form.elements.rankingsUrl.value.trim()});
      document.getElementById('mobile-settings-result').textContent = 'Configuração salva.';
      toast('Acesso dos apps atualizado.');
    } catch (error) {
      document.getElementById('mobile-settings-result').textContent = error.message;
    } finally { button.disabled = false; }
  };
}
