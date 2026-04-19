#!/bin/sh
set -eu

API_URL="${VITE_API_URL:-}"
API_URL="${API_URL%/}"

cat > /app/dist/runtime-config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  VITE_API_URL: "${API_URL}"
};
EOF

exec serve -s /app/dist -l "${PORT:-3000}"
