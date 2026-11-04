# GameZoney — troca de marca a partir do código da PRIME ARENA (usada uma vez para criar o GameZoney 1.0.1;
# fica no repositório para refazer/conferir). Uso: python3 ferramentas/trocar-marca.py <raiz do repositório>
# Troca por tabela (a ordem importa: nomes mais longos primeiro). Nomes internos do código que o usuário não vê
# (funções PrimeFw*/PrimeTheme*, cabeçalhos X-Prime-*, variáveis PRIME_*, cookies prime_*) ficam como estão.
import os, sys

TROCAS = [
    ('GUIA-PRIME-ARENA', 'GUIA-GAMEZONEY'),
    ('PRIME-ARENA-Servidor-', 'GameZoney-Servidor-'),
    ('PRIME-ARENA-Cliente-', 'GameZoney-Cliente-'),
    ('PRIME-ARENA-Instalador-', 'GameZoney-Instalador-'),
    ('PRIME-ARENA-Instalador', 'GameZoney-Instalador'),
    ('PRIME-ARENA-', 'GameZoney-'),
    ('PRIME ARENA', 'GameZoney'),
    ('Prime Arena', 'GameZoney'),
    ('PrimeArenaServerPanel_', 'GameZoneyPanel_'),
    ('PrimeArenaServer2_', 'GameZoneyServer_'),
    ('PrimeArenaServer', 'GameZoneyServidor'),
    ('PrimeArenaClient', 'GameZoneyCliente'),
    ('PrimeArenaMonitor', 'GameZoneyMonitor'),
    ('PrimeArenaHTTPS', 'GameZoneyHTTPS'),
    ('PrimeArena', 'GameZoney'),
    ('MonitorPA', 'MonitorGZ'),
    ('prime-arena.sqlite', 'gamezoney.sqlite'),
    ('prime-arena-server', 'gamezoney-server'),
    ('prime-arena-discover', 'gamezoney-discover'),
    ('bkp prime arena', 'bkp gamezoney'),
    ('SEJA PRIME', 'SEJA GAMEZONEY'),
    ('Lenda PRIME', 'Lenda GameZoney'),
]
TEXTO = {'.js', '.cjs', '.cs', '.iss', '.ps1', '.cmd', '.html', '.css', '.md', '.txt', '.json', '.config', '.webmanifest', '.py'}
PULAR = {'node_modules', '.git', 'marca'}

raiz = sys.argv[1]
total = {}
for pasta, dirs, arquivos in os.walk(raiz):
    dirs[:] = [d for d in dirs if d not in PULAR]
    for nome in arquivos:
        if os.path.splitext(nome)[1].lower() not in TEXTO or nome == 'trocar-marca.py':
            continue
        p = os.path.join(pasta, nome)
        dados = open(p, 'rb').read()
        bom = dados.startswith(b'\xef\xbb\xbf')
        try:
            texto = dados.decode('utf-8-sig')
        except UnicodeDecodeError:
            texto = dados.decode('cp1252')
        novo = texto
        for velho, troca in TROCAS:
            n = novo.count(velho)
            if n:
                total[velho] = total.get(velho, 0) + n
                novo = novo.replace(velho, troca)
        if novo != texto:
            open(p, 'wb').write((b'\xef\xbb\xbf' if bom else b'') + novo.encode('utf-8'))
for velho, troca in TROCAS:
    print(f'{total.get(velho, 0):5}  {velho}  ->  {troca}')
