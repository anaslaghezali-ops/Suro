#!/usr/bin/env bash
# Déploie le front Ops + services cabinet sur le VPS staging.
# Usage (depuis votre machine avec accès SSH) :
#   VPS_HOST=185.98.136.100 VPS_USER=root ./staging/scripts/deploy-ops-to-vps.sh
#
# Ou depuis le VPS après git pull :
#   cd /chemin/vers/Suro && ./staging/scripts/deploy-ops-to-vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-185.98.136.100}"
VPS_USER="${VPS_USER:-root}"
WEB_ROOT="${WEB_ROOT:-/var/www/suro}"

if [[ "${1:-}" == "--local" ]]; then
  echo "==> Copie locale vers ${WEB_ROOT}"
  sudo mkdir -p "${WEB_ROOT}/ops" "${WEB_ROOT}/js/services"
  sudo cp -r "${ROOT}/ops/"* "${WEB_ROOT}/ops/"
  sudo cp "${ROOT}/js/services/cabinet-portal.js" "${WEB_ROOT}/js/services/"
  echo "==> Déployé. Ouvrez http://${VPS_HOST}/ops/#/cabinets et faites Ctrl+Shift+R"
  exit 0
fi

echo "==> Sync vers ${VPS_USER}@${VPS_HOST}:${WEB_ROOT}"
rsync -avz --delete \
  "${ROOT}/ops/" "${VPS_USER}@${VPS_HOST}:${WEB_ROOT}/ops/"
rsync -avz \
  "${ROOT}/js/services/cabinet-portal.js" \
  "${VPS_USER}@${VPS_HOST}:${WEB_ROOT}/js/services/"

echo "==> Déployé. Dans le navigateur :"
echo "    http://${VPS_HOST}/ops/#/cabinets   → créer cabinet + mode"
echo "    http://${VPS_HOST}/ops/#/settings   → mode d'exploitation"
echo "    Ctrl+Shift+R pour vider le cache"
echo ""
echo "==> Base de données (obligatoire avant utilisation Cabinets / mode) :"
echo "    psql \"\$DATABASE_URL\" -f staging/scripts/verify-cabinet-rpcs.sql"
echo "    ./staging/scripts/apply-migrations.sh"
echo "    ./staging/scripts/seed-cabinets.sh"
