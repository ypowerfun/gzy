#!/bin/bash
# GameZoney — cópia diária do site. Instalado em /etc/cron.daily/gamezoney-site-backup
# 2.27 (pedido do dono: o site não pode passar de 10–20 GB em 2 anos ou mais):
#  - banco: 1 cópia por dia COMPACTADA (gzip), guardada 14 dias, + a cópia do dia 1 de cada mês, guardada 12 meses;
#  - imagens (avaliações, chamados, design): 1 "foto" por dia com rsync --link-dest — arquivo que não mudou não ocupa
#    espaço de novo (hard link); guardadas 14 dias. Antes (até a 2.26) era um .tgz completo por dia por 30 dias;
#  - teto: se a pasta de backups passar de MAX_GB, apaga os mais antigos (sempre ficam os 3 mais novos de cada tipo).
set -euo pipefail
DATA=${GZ_DATA:-/var/lib/gamezoney-site}; APP=${GZ_APP:-/opt/gamezoney-site}; RUN_AS=${GZ_RUN_AS-gamezoney}
DIR=$DATA/backups; MAX_GB=${GZ_BACKUP_MAX_GB:-6}
STAMP=$(date +%Y%m%d-%H%M%S); TODAY=$(date +%Y%m%d)
mkdir -p "$DIR" "$DIR/media"; [ -n "$RUN_AS" ] && chown "$RUN_AS:$RUN_AS" "$DIR"
AS=(); [ -n "$RUN_AS" ] && AS=(sudo -u "$RUN_AS")

# 1) banco (VACUUM INTO = cópia consistente mesmo com o site rodando) + gzip
TMP="$DIR/site-$STAMP.sqlite"
cd "$APP" && "${AS[@]}" "$(command -v node)" --disable-warning=ExperimentalWarning -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('$DATA/site.sqlite');db.exec(\"VACUUM INTO '$TMP'\");db.close()"
gzip -6 -f "$TMP"
# cópias antigas sem compactar (até a 2.26): compacta as que ainda estão no prazo
find "$DIR" -maxdepth 1 -name 'site-*.sqlite' -mtime -14 -exec gzip -6 -f {} \; 2>/dev/null || true
find "$DIR" -maxdepth 1 -name 'site-*.sqlite' -mtime +14 -delete
# guarda 14 dias + o dia 1 de cada mês por 12 meses
find "$DIR" -maxdepth 1 -name 'site-*.sqlite.gz' -mtime +14 ! -name 'site-??????01-*' -delete
find "$DIR" -maxdepth 1 -name 'site-??????01-*.sqlite.gz' -mtime +366 -delete

# 2) imagens: foto do dia com hard links para o que não mudou
if [ -d "$DATA/media" ]; then
  LAST=$({ ls -1d "$DIR"/media/[0-9]* 2>/dev/null || true; } | sort | tail -1)
  if [ "${LAST##*/}" != "$TODAY" ]; then
    if [ -n "$LAST" ]; then rsync -a --delete --link-dest="$LAST" "$DATA/media/" "$DIR/media/$TODAY/"; else rsync -a "$DATA/media/" "$DIR/media/$TODAY/"; fi
  fi
  # fotos com mais de 14 dias saem (as que ficam continuam completas)
  { ls -1d "$DIR"/media/[0-9]* 2>/dev/null || true; } | sort | head -n -14 | xargs -r rm -rf
  # os .tgz completos antigos (um por dia) só ocupavam espaço: saem depois que a foto do dia deu certo
  [ -d "$DIR/media/$TODAY" ] && find "$DIR" -maxdepth 1 -name 'media-*.tgz' -delete
fi

# 3) teto da pasta de backups
used() { du -s --block-size=1M "$DIR" | cut -f1; }
while [ "$(used)" -gt $((MAX_GB * 1024)) ]; do
  OLD=$({ ls -1t "$DIR"/site-*.sqlite.gz 2>/dev/null || true; } | tail -n +4 | tail -1)
  SNAP=$({ ls -1d "$DIR"/media/[0-9]* 2>/dev/null || true; } | sort | head -n -3 | head -1)
  if [ -n "$SNAP" ]; then rm -rf "$SNAP"; elif [ -n "$OLD" ]; then rm -f "$OLD"; else break; fi
done
echo "Backup do site: $(du -sh "$DIR" | cut -f1) na pasta de backups."
