#!/bin/sh
# SÓ PARA TESTE NO LINUX (não vai para o Git): imita o CertTool.exe do Windows com o openssl
set -e; t=$(mktemp -d)
openssl req -x509 -newkey rsa:2048 -nodes -keyout $t/k.pem -out $t/c.pem -days 1825 -subj "/CN=GameZoney" 2>/dev/null
openssl pkcs12 -export -inkey $t/k.pem -in $t/c.pem -out "$1" -passout pass: 2>/dev/null
openssl x509 -in $t/c.pem -outform DER -out "$1.cer"; rm -rf $t
