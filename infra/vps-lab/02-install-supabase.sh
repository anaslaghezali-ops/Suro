#!/usr/bin/env bash
# Installe Supabase self-hosted (officiel) dans /opt/supabase
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Lance en root ou sudo."
  exit 1
fi

SUPABASE_DIR=/opt/supabase

if [[ -d "$SUPABASE_DIR/docker" ]]; then
  echo "Supabase déjà cloné dans $SUPABASE_DIR"
else
  echo "==> Clone Supabase"
  git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_DIR"
fi

cd "$SUPABASE_DIR/docker"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "==> Génère les secrets (à conserver précieusement)"
  if [[ -x ./utils/generate-keys.sh ]]; then
    ./utils/generate-keys.sh .env || true
  fi
  echo ""
  echo "IMPORTANT : édite $SUPABASE_DIR/docker/.env"
  echo "  - POSTGRES_PASSWORD"
  echo "  - JWT_SECRET"
  echo "  - ANON_KEY / SERVICE_ROLE_KEY (si générés)"
  echo "  - SITE_URL / API_EXTERNAL_URL (ton domaine ou http://IP)"
  echo ""
  echo "Puis relance : docker compose pull && docker compose up -d"
  exit 0
fi

echo "==> Pull images"
docker compose pull

echo "==> Démarrage Supabase (peut prendre 2–5 min)"
docker compose up -d

echo "==> Statut"
docker compose ps

echo ""
echo "Studio : http://VOTRE_IP:8000 (ou via Kong — voir docs Supabase)"
echo "API    : http://VOTRE_IP:8000/rest/v1/"
echo "Prochaine étape : importer migrations SURO + 03-deploy-suro.sh"
