#!/bin/bash
# deploy.sh — déploiement Fusion sur VPS
# Usage : bash /opt/fusion/repo/deploy.sh

set -e

REPO_DIR="/opt/fusion/repo"
COMPOSE_FILE="$REPO_DIR/docker-compose.vps.yml"

echo "=== Fusion Deploy ==="

cd "$REPO_DIR"

# 1. Pull
echo "→ git pull..."
git pull origin main

# 2. Build
echo "→ docker build..."
docker compose -f "$COMPOSE_FILE" build fusion

# 3. Redémarrage
echo "→ docker up..."
docker compose -f "$COMPOSE_FILE" up -d fusion

# 4. Reconnexion réseau postgres (app_default)
echo "→ connexion réseau postgres..."
docker network connect app_default repo-fusion-1 2>/dev/null || true

# 5. Vérification
sleep 2
echo ""
echo "=== Logs ==="
docker logs repo-fusion-1 --tail 8

echo ""
echo "✅ Deploy terminé."
