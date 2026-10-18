#!/bin/sh
set -e
PORT="${PORT:-8080}"
node server.js &
PID=$!
trap 'kill $PID 2>/dev/null' EXIT
i=0
while [ $i -lt 30 ]; do
  if wget -qO- "http://127.0.0.1:${PORT}/health" 2>/dev/null | grep -q ok; then
    echo "SMOKE_OK"
    exit 0
  fi
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "http://127.0.0.1:${PORT}/health" 2>/dev/null | grep -q ok; then
      echo "SMOKE_OK"
      exit 0
    fi
  fi
  i=$((i+1))
  sleep 1
done
echo "SMOKE_FAIL"
exit 1
