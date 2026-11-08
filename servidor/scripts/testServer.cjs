'use strict';
// Runs fixtures under the workspace so atomic rename is not affected by the
// desktop sandbox's virtual TEMP directory. Does not start an installed client.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const server = path.join(root, 'server');
const temporary = path.join(root, 'tests', 'temp');
const client = path.join(root, '..', 'cliente', 'windows-client-1.0.5');
const executable = path.join(client, 'GameZoneyCliente.exe');
fs.mkdirSync(temporary, {recursive: true});
if (process.platform !== 'win32') throw Error('Esta suíte contém testes nativos Windows. Execute no Windows.');
// 3.0.66: o teste nativo compila o cliente de referência que vai junto no código do servidor (pasta ../cliente/windows-client-1.0.5 do repositório GameZoney).
if (!fs.existsSync(path.join(client, 'Client.cs'))) throw Error('Pasta do cliente de referência não encontrada: ' + client + '. Extraia o código do servidor completo (com a pasta windows-client-2.0.49 ao lado de server) e rode de novo.');
const compiler = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const sources = ['Client.cs', 'ClientTheme.cs', 'RemoteControl.cs', 'PasswordRegistration.cs', 'SessionCleanup.cs', 'SessionSecurity.cs', 'SystemMessage.cs', 'PrintControl.cs', 'SelfService.cs'];  // mesma lista do build.ps1 do Cliente (1.0.7: PrintControl, 1.0.8: SelfService)
const build = cp.spawnSync(compiler, ['/nologo', '/target:winexe', '/out:GameZoneyCliente.exe', '/win32icon:gamezoney.ico',
  '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Security.dll',
  '/reference:System.Web.Extensions.dll', ...sources], {cwd: client, stdio: 'inherit', windowsHide: true});
if (build.error) throw build.error;
if (build.status !== 0) throw Error('Falha ao compilar o cliente para o teste /probe.');
fs.mkdirSync(path.join(client, 'runtime'), {recursive: true});
fs.copyFileSync(process.execPath, path.join(client, 'runtime', 'node.exe'));
const requested = process.argv.slice(2);
const files = requested.length ? requested.map(name => {
  if (!/^[a-z0-9.-]+\.test\.js$/i.test(name)) throw Error('Nome de teste inválido.');
  return path.join('test', name);
}) : fs.readdirSync(path.join(server, 'test')).filter(name => name.endsWith('.test.js')).map(name => path.join('test', name));
// 1.0.7: os testes rodam com o ambiente limpo, como o GameZoney.exe abre o servidor: variáveis NODE_*/UV_* deste PC
// (ex.: NODE_OPTIONS=--require ... do VS Code ou de um proxy) ativariam a proteção contra alteração e reprovariam os testes.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(NODE_|UV_)/i.test(k)));
const dropped = Object.keys(process.env).filter(k => /^(NODE_|UV_)/i.test(k));
if (dropped.length) console.log('Testes sem as variáveis deste PC: ' + dropped.join(', ') + ' (o GameZoney instalado também não usa).');
const child = cp.spawn(process.execPath, ['--test', '--test-concurrency=1', ...files], {
  cwd: server,
  env: {...cleanEnv, TEMP: temporary, TMP: temporary, GZ_CLIENT_TEST_EXE: executable},
  stdio: 'inherit', windowsHide: true
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
