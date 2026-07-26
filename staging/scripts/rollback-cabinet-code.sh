#!/usr/bin/env bash
# Redéploie le front SANS module cabinet (version pre-cabinet depuis Git).
#
# Usage local (sur le VPS) :
#   cd /chemin/vers/Suro && ./staging/scripts/rollback-cabinet-code.sh --local
#
# Usage depuis ta machine (SSH) :
#   VPS_HOST=185.98.136.100 VPS_USER=root ./staging/scripts/rollback-cabinet-code.sh
#
# Variable optionnelle :
#   PRE_CABINET_REF=origin/main   (commit / branche / tag sans cabinet)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-185.98.136.100}"
VPS_USER="${VPS_USER:-root}"
WEB_ROOT="${WEB_ROOT:-/var/www/suro}"
PRE_CABINET_REF="${PRE_CABINET_REF:-origin/main}"
STAGING_DIR="$(mktemp -d)"

cleanup() { rm -rf "$STAGING_DIR"; }
trap cleanup EXIT

echo "=== ROLLBACK CODE (sans cabinet) ==="
echo "Référence Git : $PRE_CABINET_REF"
echo "WEB_ROOT      : $WEB_ROOT"
echo

if ! git -C "$ROOT" rev-parse --verify "$PRE_CABINET_REF" >/dev/null 2>&1; then
  echo "Erreur : ref Git introuvable : $PRE_CABINET_REF" >&2
  echo "Utilisez PRE_CABINET_REF=pre-cabinet-2026-07-26 ou un SHA de main." >&2
  exit 1
fi

echo "==> Extraction ops/ depuis $PRE_CABINET_REF"
git -C "$ROOT" archive "$PRE_CABINET_REF" ops | tar -x -C "$STAGING_DIR"

deploy_local() {
  local target="$1"
  echo "==> Déploiement local vers $target"
  sudo mkdir -p "$target/ops" "$target/js/services"
  sudo rsync -a --delete "$STAGING_DIR/ops/" "$target/ops/"
  # Retirer les fichiers cabinet ajoutés après pre-cabinet
  sudo rm -f "$target/js/services/cabinet-portal.js"
  sudo rm -f "$target/cabinet-login.html"
  sudo rm -rf "$target/cabinet"
  echo "==> Fichiers cabinet retirés de $target"
}

if [[ "${1:-}" == "--local" ]]; then
  deploy_local "$WEB_ROOT"
  echo "==> Terminé. Ctrl+Shift+R dans le navigateur."
  exit 0
fi

echo "==> Sync vers ${VPS_USER}@${VPS_HOST}:${WEB_ROOT}"
rsync -avz --delete "$STAGING_DIR/ops/" "${VPS_USER}@${VPS_HOST}:${WEB_ROOT}/ops/"
ssh "${VPS_USER}@${VPS_HOST}" "rm -f ${WEB_ROOT}/js/services/cabinet-portal.js ${WEB_ROOT}/cabinet-login.html && rm -rf ${WEB_ROOT}/cabinet"
echo "==> Terminé. Vérifier http://${VPS_HOST}/ops/ (pas de menu Cabinets)."
