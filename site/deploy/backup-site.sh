#!/bin/bash
# GameZoney — cópia diária do banco do site (guarda 30 dias). Instalado em /etc/cron.daily/gamezoney-site-backup
set -e
DIR=/var/lib/gamezoney-site/backups; mkdir -p "$DIR"
FILE="$DIR/site-$(date +%Y%m%d-%H%M%S).sqlite"
cd /opt/gamezoney-site && sudo -u gamezoney /usr/bin/node --disable-warning=ExperimentalWarning -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/var/lib/gamezoney-site/site.sqlite');db.exec(\"VACUUM INTO '$FILE'\");db.close()"
find "$DIR" -name 'site-*.sqlite' -mtime +30 -delete
