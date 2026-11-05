#!/bin/bash
# GameZoney — instala (ou ATUALIZA) o site gamezoney.com no VPS Ubuntu 22.04 (Oracle, ARM aarch64).
# Uso (dentro da pasta "site" descompactada no VPS):  sudo bash deploy/instalar-vps.sh
# Pode rodar de novo a cada atualização: mantém o banco, a configuração, a chave das licenças e os downloads.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Rode com sudo: sudo bash deploy/instalar-vps.sh"; exit 1; }
SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP=/opt/gamezoney-site; DATA=/var/lib/gamezoney-site; ENVF=/etc/gamezoney-site.env
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l

echo "== 1/7 Pacotes básicos"
apt-get update -y
apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https rsync nano unzip iptables-persistent netfilter-persistent

echo "== 2/7 Node.js 24"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
node --version

echo "== 3/7 Caddy (HTTPS automático)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "== 4/7 Usuário, pastas e arquivos do site"
id gamezoney >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin gamezoney
mkdir -p "$APP" "$DATA/downloads" "$DATA/backups" /var/log/caddy
rsync -a --delete --exclude node_modules --exclude data --exclude downloads --exclude '*.pem' --exclude .env "$SRC/" "$APP/"
cd "$APP" && npm ci --omit=dev --no-audit --no-fund
# instaladores colocados em site/downloads (opcional) vão para a pasta de downloads do site
find "$SRC/downloads" -maxdepth 1 -type f \( -iname '*.exe' -o -iname '*.zip' -o -iname '*.pdf' \) -exec cp -f {} "$DATA/downloads/" \; 2>/dev/null || true
# chave que assina as licenças (license-private.pem): procurada na pasta do site e na pasta do usuário ubuntu
for K in "$SRC/license-private.pem" "$SRC/../license-private.pem" /home/ubuntu/license-private.pem; do
  if [ -f "$K" ] && [ ! -f "$DATA/license-private.pem" ]; then cp "$K" "$DATA/license-private.pem"; echo "Chave das licenças instalada."; fi
done
chown -R gamezoney:gamezoney "$DATA"; chmod 700 "$DATA"; [ -f "$DATA/license-private.pem" ] && chmod 600 "$DATA/license-private.pem"
[ -f "$ENVF" ] || { cp "$APP/deploy/gamezoney-site.env.exemplo" "$ENVF"; echo "Criado $ENVF — preencha ADMIN_EMAILS, Mercado Pago, Google e SMTP."; }
chown root:gamezoney "$ENVF"; chmod 640 "$ENVF"

echo "== 5/7 Serviço do site (systemd) e backup diário"
cp "$APP/deploy/gamezoney-site.service" /etc/systemd/system/gamezoney-site.service
install -m 755 "$APP/deploy/backup-site.sh" /etc/cron.daily/gamezoney-site-backup
systemctl daemon-reload && systemctl enable gamezoney-site && systemctl restart gamezoney-site

echo "== 6/7 Caddy (gamezoney.com e www)"
cp "$APP/deploy/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
# o "caddy validate" (como root) cria o arquivo de log; o serviço roda como usuário caddy e precisa ser o dono
chown -R caddy:caddy /var/log/caddy
systemctl enable caddy && systemctl restart caddy
sleep 2; systemctl is-active --quiet caddy || { echo "ATENÇÃO: o Caddy não iniciou. Veja: sudo journalctl -u caddy -n 30"; }

echo "== 7/7 Firewall do Ubuntu (portas 80 e 443)"
iptables -C INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -j ACCEPT
netfilter-persistent save

sleep 2
if curl -fsS http://127.0.0.1:8080/api/config >/dev/null; then echo "OK: site rodando (porta interna 8080)."; else echo "ATENÇÃO: o site não respondeu. Veja: sudo journalctl -u gamezoney-site -n 50"; fi
[ -f "$DATA/license-private.pem" ] || echo "ATENÇÃO: falta a chave das licenças. Envie license-private.pem para /home/ubuntu e rode este script de novo."
echo "Pronto. Com o DNS apontando para este VPS, abra https://gamezoney.com"
