#!/bin/sh
# Monta VidaOS-pendrive-Windows.zip: .exe + versão para navegador (pasta "sistema") + LEIA-ME.
set -e
cd "$(dirname "$0")/.."
V=$(sed -n "s/.*App.VERSION = '\([^']*\)'.*/\1/p" js/core.js)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/VidaOS/sistema"
cp VidaOS-Windows.exe "$T/VidaOS/"
cp -r index.html css js vendor icons manifest.webmanifest "$T/VidaOS/sistema/"
cp "portatil/pacote/Abrir Vida OS no navegador.html" "$T/VidaOS/"
sed "s/@VERSAO@/$V/" portatil/pacote/LEIA-ME.txt | sed 's/$/\r/' > "$T/VidaOS/LEIA-ME.txt"
rm -f VidaOS-pendrive-Windows.zip
(cd "$T" && python3 -c "import shutil;shutil.make_archive('pacote','zip','.','VidaOS')") && mv "$T/pacote.zip" VidaOS-pendrive-Windows.zip
echo "VidaOS-pendrive-Windows.zip ($V)"
