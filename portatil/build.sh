#!/bin/sh
# Gera os programas portáteis na raiz do projeto (ao lado do index.html).
set -e
cd "$(dirname "$0")"
export CGO_ENABLED=0
# cópia interna do aplicativo (embutida no executável)
rm -rf app && mkdir app && cp -r ../index.html ../css ../js ../vendor ../icons ../manifest.webmanifest app/
trap 'rm -rf app' EXIT
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H windowsgui" -o ../VidaOS-Windows.exe .
GOOS=darwin  GOARCH=arm64 go build -trimpath -ldflags "-s -w" -o ../VidaOS-Mac .
GOOS=darwin  GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o ../VidaOS-Mac-Intel .
GOOS=linux   GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o ../VidaOS-Linux .
chmod +x ../VidaOS-Mac ../VidaOS-Mac-Intel ../VidaOS-Linux
ls -la ../VidaOS-*
