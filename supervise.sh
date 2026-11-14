#!/usr/bin/env bash
# Keep the Agent Games endpoint alive: node server on 8791 + cloudflared quick tunnel.
# Writes the current public URL to url.txt. Idempotent; safe to run from cron.
set -u
DIR="/home/ubuntu/agentgames/agent"
URLF="$DIR/url.txt"
LOG="$DIR/supervise.log"
PORT=8791

say() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >>"$LOG"; }

# --- agent server ---
if ! curl -sf -m 3 "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
  say "server down, starting"
  ( cd "$DIR" && PORT=$PORT setsid nohup node server.mjs >>"$DIR/server.log" 2>&1 & )
  sleep 2
fi

# --- tunnel ---
if ! pgrep -f "cloudflared tunnel --url http://127.0.0.1:$PORT" >/dev/null 2>&1; then
  say "tunnel down, starting"
  ( cd "$DIR" && setsid nohup cloudflared tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate >>"$DIR/tunnel.log" 2>&1 & )
  sleep 10
fi

CUR=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$DIR/tunnel.log" 2>/dev/null | tail -1)
if [ -n "${CUR:-}" ]; then
  OLD=$(cat "$URLF" 2>/dev/null || true)
  printf '%s\n' "$CUR" >"$URLF"
  if [ "$CUR" != "$OLD" ]; then
    say "URL $CUR"
    echo "URL CHANGED: $CUR"
  fi
fi

# --- health ---
if [ -n "${CUR:-}" ]; then
  CODE=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$CUR/" 2>/dev/null || echo 000)
  say "health $CODE"
  [ "$CODE" = "200" ] || echo "HEALTH FAIL $CODE"
fi
