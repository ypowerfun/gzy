# GameZoney — gera as imagens da marca usadas pelo Servidor, pelo Cliente e pelos instaladores, a partir das artes
# oficiais em marca/ (logo GZ e banner). Uso: python3 ferramentas/gerar-imagens-marca.py <raiz do repositório>
import io, os, struct, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

raiz = sys.argv[1]
M = os.path.join(raiz, 'marca')
icone = Image.open(os.path.join(M, 'gz-icone-original.webp')).convert('RGBA')
banner = Image.open(os.path.join(M, 'gamezoney-banner-original.webp')).convert('RGB')

# ícone sem as bordas transparentes
icone = icone.crop(icone.getbbox())

def quadrado(img, lado, margem=0.04):
    """Centraliza a imagem num quadrado transparente."""
    tela = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    m = round(lado * margem); caixa = lado - 2 * m
    w, h = img.size; esc = min(caixa / w, caixa / h)
    pequena = img.resize((max(1, round(w * esc)), max(1, round(h * esc))), Image.LANCZOS)
    tela.alpha_composite(pequena, ((lado - pequena.width) // 2, (lado - pequena.height) // 2))
    return tela

def sem_fundo_preto(img):
    """Banner sobre preto -> PNG transparente (o brilho vira opacidade; ouro e branco ficam inteiros)."""
    rgb = img.convert('RGB')
    luz = rgb.convert('L').point(lambda v: 0 if v < 28 else min(255, int((v - 28) * 255 / 70)))
    out = rgb.convert('RGBA'); out.putalpha(luz)
    return out.crop(out.getbbox())

def ico(imagens, destino):
    """ICO com PNG em 256 e BMP 32 bits nos menores (compatível com o csc /win32icon e o .NET)."""
    blobs = []
    for im in imagens:
        if im.width == 256:
            b = io.BytesIO(); im.save(b, 'PNG'); blobs.append(b.getvalue())
        else:
            w, h = im.size; px = im.tobytes('raw', 'BGRA')
            linhas = [px[y * w * 4:(y + 1) * w * 4] for y in range(h)][::-1]
            mascara = ((w + 31) // 32) * 4
            cab = struct.pack('<IiiHHIIiiII', 40, w, h * 2, 1, 32, 0, len(px) + mascara * h, 0, 0, 0, 0)
            blobs.append(cab + b''.join(linhas) + b'\x00' * (mascara * h))
    dados = struct.pack('<HHH', 0, 1, len(imagens)); pos = 6 + 16 * len(imagens)
    for im, b in zip(imagens, blobs):
        s = im.width
        dados += struct.pack('<BBBBHHII', 0 if s == 256 else s, 0 if s == 256 else s, 0, 0, 1, 32, len(b), pos); pos += len(b)
    open(destino, 'wb').write(dados + b''.join(blobs))

tamanhos = [256, 128, 64, 48, 40, 32, 24, 20, 16]
quadros = [quadrado(icone, s, 0.02 if s <= 32 else 0.04) for s in tamanhos]
logo_full = sem_fundo_preto(banner)          # GZ + GameZoney + GESTÃO GAMER, fundo transparente

S = os.path.join(raiz, 'servidor', 'server'); C = os.path.join(raiz, 'cliente', 'windows-client-1.0.2'); U = os.path.join(raiz, 'unico')
for destino in [os.path.join(S, 'gamezoney.ico'), os.path.join(C, 'gamezoney.ico'), os.path.join(U, 'gamezoney.ico')]:
    ico(quadros, destino)
# Painel (servidor): logo da lateral e da tela de acesso, ícones e favicon
def largura(img, w):
    return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
largura(logo_full, 960).save(os.path.join(S, 'public', 'logo-gamezoney.png'), optimize=True)
quadrado(icone, 192, 0.06).save(os.path.join(S, 'public', 'icon-192.png'), optimize=True)
quadrado(icone, 512, 0.06).save(os.path.join(S, 'public', 'icon-512.png'), optimize=True)
quadrado(icone, 64, 0.03).save(os.path.join(S, 'public', 'favicon.ico'), sizes=[(64, 64), (32, 32), (16, 16)])
# Tela da TV (cliente.html) e cliente: logo quadrado em fundo escuro
def em_fundo(img, lado, cor=(8, 8, 10)):
    fundo = Image.new('RGBA', (lado, lado), cor + (255,)); fundo.alpha_composite(quadrado(img, lado, 0.12)); return fundo.convert('RGB')
em_fundo(icone, 969).save(os.path.join(S, 'public', 'logo.jpg'), quality=92)
em_fundo(icone, 969).save(os.path.join(C, 'logo.jpg'), quality=92)
# Cliente: marca pequena (barra/topo) e logo completo (tela de login)
quadrado(icone, 160, 0.02).crop(quadrado(icone, 160, 0.02).getbbox()).save(os.path.join(C, 'logo-marca.png'), optimize=True)
largura(logo_full, 960).save(os.path.join(C, 'logo-gamezoney.png'), optimize=True)

# Papel de parede padrão do login do cliente (1920x1080): preto, grade de hexágonos dourada discreta, faixa vermelha e o banner
W, H = 1920, 1080
fundo = Image.new('RGB', (W, H), (6, 6, 8))
g = ImageDraw.Draw(fundo)
for y in range(H):  # luz suave no centro
    pass
luz = Image.new('L', (W, H), 0); dl = ImageDraw.Draw(luz)
dl.ellipse((W * 0.18, H * 0.05, W * 0.82, H * 0.95), fill=70)
luz = luz.filter(ImageFilter.GaussianBlur(220))
fundo = Image.composite(Image.new('RGB', (W, H), (34, 28, 12)), fundo, luz)
grade = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dg = ImageDraw.Draw(grade)
import math
r = 46; dx = r * math.sqrt(3); dy = r * 1.5
for linha in range(-1, int(H / dy) + 2):
    for col in range(-1, int(W / dx) + 2):
        cx = col * dx + (dx / 2 if linha % 2 else 0); cy = linha * dy
        pts = [(cx + r * math.cos(math.radians(60 * k + 30)), cy + r * math.sin(math.radians(60 * k + 30))) for k in range(6)]
        dg.polygon(pts, outline=(212, 160, 23, 22))
fundo = Image.alpha_composite(fundo.convert('RGBA'), grade)
faixa = Image.new('RGBA', (W, H), (0, 0, 0, 0)); df = ImageDraw.Draw(faixa)
df.polygon([(W * 0.62, H), (W, H * 0.70), (W, H * 0.735), (W * 0.665, H)], fill=(225, 22, 32, 230))
df.polygon([(0, H * 0.18), (W * 0.30, 0), (W * 0.322, 0), (0, H * 0.205)], fill=(212, 160, 23, 120))
fundo = Image.alpha_composite(fundo, faixa.filter(ImageFilter.GaussianBlur(1.2)))
# o logo completo é desenhado pelo próprio Cliente na tela de login (não repetir no papel de parede)

fundo.convert('RGB').save(os.path.join(C, 'wallpaper-padrao.jpg'), quality=90)
print('ok', logo_full.size)
