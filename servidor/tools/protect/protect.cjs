'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Proteção do Servidor na hora de gerar o instalador (roda na pasta TEMPORÁRIA do gerador; o repositório não muda):
//  1. Embaralha (ofusca) cada arquivo .js do servidor: nomes trocados, textos codificados, fluxo da licença embaralhado
//     e autodefesa (o código para de funcionar se for reformatado para leitura). Dificulta ler, copiar e alterar.
//  2. Calcula o SHA-256 de tudo que o Node carrega (os .js embaralhados, node_modules, painel e o node.exe) e gera o
//     GzIntegrity.cs, compilado dentro do GameZoney.exe: se qualquer arquivo for alterado, o GameZoney não abre.
// Uso: node protect.cjs <pasta-temporária>
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const JavaScriptObfuscator = require('javascript-obfuscator');

const stage = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(path.join(stage, 'server.js')) || !fs.existsSync(path.join(stage, 'Launcher.cs'))) { console.error('Pasta temporária do gerador inválida: ' + stage); process.exit(1); }

const BASE = {compact: true, target: 'node', selfDefending: true, simplify: true, renameGlobals: false, identifierNamesGenerator: 'hexadecimal',
  stringArray: true, stringArrayEncoding: ['base64'], stringArrayThreshold: 0.8, stringArrayRotate: true, stringArrayShuffle: true,
  stringArrayWrappersCount: 2, stringArrayWrappersType: 'function', splitStrings: false, numbersToExpressions: true,
  controlFlowFlattening: false, deadCodeInjection: false, unicodeEscapeSequence: false, log: false, seed: 0};
// licença, atualização e conferências: embaralhamento mais forte (custa um pouco de velocidade, só aqui)
const STRONG = new Set(['license.js', 'updater.js', 'server.js', 'network-guard.js', 'panel-sessions.js']);
const HEAVY = {controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.6, deadCodeInjection: true, deadCodeInjectionThreshold: 0.3};

let n = 0;
for (const f of fs.readdirSync(stage).filter(f => f.endsWith('.js')).sort()) {
  const file = path.join(stage, f), src = fs.readFileSync(file, 'utf8');
  const out = JavaScriptObfuscator.obfuscate(src.replace(/^#!.*\n/, ''), {...BASE, ...(STRONG.has(f) ? HEAVY : {})}).getObfuscatedCode();
  fs.writeFileSync(file, out); n++;
}
console.log(`Código embaralhado: ${n} arquivo(s) .js`);

// ---------- lista de integridade ----------
const list = [];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const add = rel => { const full = path.join(stage, rel); if (fs.statSync(full).isFile()) list.push([rel.split(path.sep).join('\\'), sha(full)]); };
const walk = rel => { for (const e of fs.readdirSync(path.join(stage, rel), {withFileTypes: true})) { const r = path.join(rel, e.name); if (e.isDirectory()) walk(r); else add(r); } };
// só os arquivos da raiz que o instalador realmente leva (linhas Source: "x.js" do installer.iss)
const iss = fs.existsSync(path.join(stage, 'installer.iss')) ? fs.readFileSync(path.join(stage, 'installer.iss'), 'utf8') : '';
const shipped = new Set([...iss.matchAll(/^Source:\s*"([^"\\*?]+\.(?:js|json|ps1))"/gmi)].map(m => m[1].toLowerCase()));
for (const f of fs.readdirSync(stage).sort()) if (/\.(js|json|ps1)$/i.test(f) && shipped.has(f.toLowerCase())) add(f);
if (!shipped.has('server.js') || !shipped.has('license.js')) { console.error('installer.iss sem server.js/license.js: lista de integridade não gerada.'); process.exit(1); }
for (const d of ['node_modules', 'public']) if (fs.existsSync(path.join(stage, d))) walk(d);
if (fs.existsSync(path.join(stage, 'runtime', 'node.exe'))) add(path.join('runtime', 'node.exe'));
else if (process.platform === 'win32') { console.error('runtime\\node.exe não encontrado na pasta temporária.'); process.exit(1); }
list.sort((a, b) => a[0].localeCompare(b[0]));
const cs = `// Gerado por tools/protect/protect.cjs na hora de montar o instalador. Não editar.
static class GzIntegrity {
    public static readonly string[] Files = new string[] {
${list.map(([r, h]) => `        ${JSON.stringify(r)}, "${h}",`).join('\n')}
    };
}
`;
fs.writeFileSync(path.join(stage, 'GzIntegrity.cs'), cs);
console.log(`Lista de integridade: ${list.length} arquivo(s)`);
