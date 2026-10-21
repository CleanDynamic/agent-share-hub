#!/usr/bin/env bash
# CA-09 stand-in: the built site on https://127.0.0.1:4443 and a fake Supabase on https://127.0.0.1:54321, both
# HTTP/2 over TLS with a self-signed certificate (browsers are launched with --ignore-certificate-errors).
# See docs/audits/ca-09/standin.md.
#   docs/audits/ca-09/scripts/standin.sh build   # build the site pointed at the fake (does not touch .env or client.ts)
#   docs/audits/ca-09/scripts/standin.sh start   # start both servers (pids in /var/tmp/ca09-*.pid)
#   docs/audits/ca-09/scripts/standin.sh stop
# Options: CA09_DIST (default /var/tmp/ca09-dist), CA09_NOMINIFY=1 (keep component names, for render counts),
#          CA09_SOURCEMAP=1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
DIST=${CA09_DIST:-/var/tmp/ca09-dist}
TLS=${CA09_TLS_DIR:-/var/tmp/ca09-tls}
cd "$ROOT"
case "${1:-}" in
  build)
    # Environment variables beat .env in Vite, so the build reads these and the committed .env is left alone.
    VITE_SUPABASE_URL=https://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=ca09-publishable-placeholder VITE_SUPABASE_PROJECT_ID=ca09 \
      npx vite build --outDir "$DIST" --emptyOutDir ${CA09_SOURCEMAP:+--sourcemap} ${CA09_NOMINIFY:+--minify false}
    ;;
  start)
    if [ ! -f "$TLS/cert.pem" ]; then
      mkdir -p "$TLS"
      openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TLS/key.pem" -out "$TLS/cert.pem" -days 30 -subj "/CN=127.0.0.1" -addext "subjectAltName=IP:127.0.0.1" 2>/dev/null
    fi
    [ -f /var/tmp/ca09-picture.jpg ] || node docs/audits/ca-09/scripts/make-picture.mjs /var/tmp/ca09-picture.jpg
    CA09_TLS_DIR="$TLS" CA09_IMAGE=/var/tmp/ca09-picture.jpg nohup node src/lib/build/__audit__/ca09/server.mjs > /var/tmp/ca09-server.log 2>&1 &
    echo $! > /var/tmp/ca09-server.pid
    CA09_TLS_DIR="$TLS" nohup node docs/audits/ca-09/scripts/static.mjs "$DIST" 4443 > /var/tmp/ca09-static.log 2>&1 &
    echo $! > /var/tmp/ca09-static.pid
    for i in $(seq 1 30); do curl -skf -o /dev/null https://127.0.0.1:4443/ && curl -skf -o /dev/null https://127.0.0.1:54321/__audit/config && break; sleep 1; done
    echo "site https://127.0.0.1:4443  fake supabase https://127.0.0.1:54321"
    ;;
  stop)
    for f in /var/tmp/ca09-server.pid /var/tmp/ca09-static.pid /var/tmp/ca09-preview.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
    ;;
  *) echo "usage: $0 build|start|stop"; exit 2 ;;
esac
