// Uso (com Playwright instalado): node marketing/gerar-logos.js — logotipos quadrado e horizontal para anúncios.
const {chromium} = require('playwright'), fs = require('fs'), path = require('path');
const OUT = '/home/user/gzy/marketing/anuncios';
const logo = 'data:image/png;base64,' + fs.readFileSync('/home/user/gzy/site/public/logo-gamezoney.png').toString('base64');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  // quadrado: só o emblema GZ (a área 0–226 px do logotipo de 960x253), centralizado
  const s = 820 / 253, ew = Math.round(226 * s);
  await p.setViewportSize({width: 1200, height: 1200});
  await p.setContent(`<body style="margin:0;width:1200px;height:1200px;background:radial-gradient(circle at 50% 45%,#1d1708,#07090d 70%)"><div style="position:absolute;left:${(1200 - ew) / 2}px;top:${(1200 - 820) / 2}px;width:${ew}px;height:820px;overflow:hidden"><img src="${logo}" style="height:820px;display:block"></div></body>`);
  await p.waitForTimeout(200); await p.screenshot({path: path.join(OUT, 'gamezoney-logo-quadrado-1200x1200.png')});
  // horizontal 4:1: logotipo inteiro
  await p.setViewportSize({width: 1200, height: 300});
  await p.setContent(`<body style="margin:0;width:1200px;height:300px;background:#07090d;display:flex;align-items:center;justify-content:center"><img src="${logo}" style="width:1020px;display:block"></body>`);
  await p.waitForTimeout(200); await p.screenshot({path: path.join(OUT, 'gamezoney-logo-horizontal-1200x300.png')});
  await b.close(); console.log('ok');
})();
