#!/bin/sh
# Gera os programas portáteis na raiz do projeto (ao lado do index.html).
set -e
cd "$(dirname "$0")"
export CGO_ENABLED=0
# cópia interna do aplicativo (embutida no executável)
rm -rf app && mkdir app && cp -r ../index.html ../css ../js ../vendor ../icons ../manifest.webmanifest app/
trap 'rm -rf app' EXIT
# ícone, versão e manifesto do .exe (winres/ → rsrc_windows_amd64.syso, já versionado)
command -v go-winres >/dev/null 2>&1 && go-winres make --in winres/winres.json --arch amd64 --out rsrc || true
# sem -s -w no Windows: binários "despidos" e sem metadados disparam falso positivo no antivírus
GOOS=windows GOARCH=amd64 go build -trimpath -buildvcs=false -ldflags "-H windowsgui" -o ../VidaOS-Windows.exe .
GOOS=darwin  GOARCH=arm64 go build -trimpath -ldflags "-s -w" -o ../VidaOS-Mac .
GOOS=darwin  GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o ../VidaOS-Mac-Intel .
GOOS=linux   GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o ../VidaOS-Linux .
chmod +x ../VidaOS-Mac ../VidaOS-Mac-Intel ../VidaOS-Linux
ls -la ../VidaOS-*
