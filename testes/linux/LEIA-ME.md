# Testes do Servidor no Linux (ambiente da nuvem)

Sem estes ajudantes, 7 testes do Servidor só rodam no Windows. Com eles, só fica de fora o de backup (BackupTool.exe).

1. CertTool (certificado da conexão dos PCs) imitado com openssl — **nunca** deixar na pasta do servidor depois do teste:
   `cp testes/linux/CertTool-linux.sh servidor/server/CertTool.exe && chmod +x servidor/server/CertTool.exe`
   (no fim: `rm servidor/server/CertTool.exe`; `*.exe` já está no .gitignore)
2. Cliente real pelo Mono (teste `/probe` do pc.test.js), numa pasta temporária `X`:
   `mcs -langversion:5 -target:winexe -out:X/GameZoneyCliente.exe -r:System.Windows.Forms.dll -r:System.Drawing.dll -r:System.Web.Extensions.dll -r:System.Security.dll` + os .cs do build.ps1;
   copiar `transport.js` e `discover.js` para `X`, `ln -s $(which node) X/runtime/node.exe`, e um `X/run.sh` com `exec mono X/GameZoneyCliente.exe "$@"`;
   rodar com `GZ_CLIENT_TEST_EXE=X/run.sh node --test test/*.test.js`.

3. Sub-redes (roteador virtual): `sudo bash testes/linux/subredes/rodar.sh` (precisa de iproute2; o passo 1 antes).
