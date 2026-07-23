#!/usr/bin/env bash
# Installation complète labo SURO sur VPS — une seule commande
# Usage : curl -fsSL .../00-install-all.sh | bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Lance en root : curl -fsSL ... | bash"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_IP="$(curl -fsSL -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

echo "============================================"
echo " SURO lab — installation automatique"
echo " IP détectée : $SERVER_IP"
echo "============================================"

bash "$SCRIPT_DIR/01-server-bootstrap.sh"

# Supabase : clone + .env auto si absent
SUPABASE_DIR=/opt/supabase
if [[ ! -d "$SUPABASE_DIR/docker" ]]; then
  git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_DIR"
fi

cd "$SUPABASE_DIR/docker"
if [[ ! -f .env ]]; then
  cp .env.example .env
  if [[ -x ./utils/generate-keys.sh ]]; then
    ./utils/generate-keys.sh .env || true
  fi
  sed -i "s|^SITE_URL=.*|SITE_URL=http://${SERVER_IP}|" .env
  sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=http://${SERVER_IP}:8000|" .env
  sed -i "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=http://${SERVER_IP}:8000|" .env
  echo "Secrets générés dans $SUPABASE_DIR/docker/.env"
fi

echo "==> Démarrage Supabase (2–5 min)..."
docker compose pull
docker compose up -d

echo "==> Attente Postgres..."
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

bash "$SCRIPT_DIR/03-deploy-suro.sh"

# Migrations SURO si le repo est cloné
if [[ -d /var/www/suro/docs/migrations ]]; then
  bash "$SCRIPT_DIR/04-apply-migrations.sh" || echo "WARN: migrations partielles — voir logs"
fi

echo ""
echo "============================================"
echo " TERMINÉ"
echo " Site    : http://${SERVER_IP}/"
echo " API     : http://${SERVER_IP}:8000"
echo " Studio  : http://${SERVER_IP}:8000 (Kong)"
echo " .env    : ${SUPABASE_DIR}/docker/.env"
echo "============================================"
