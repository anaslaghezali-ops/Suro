#!/usr/bin/env bash
# Met à jour le site SURO sur le VPS depuis GitHub.
# Préserve config.js (Supabase local) et déploie les Edge Functions.
#
# Usage :
#   BRANCH=Cursor bash infra/vps-lab/09-update-site-from-github.sh
set -euo pipefail

WEB_ROOT=/var/www/suro
BRANCH="${BRANCH:-Cursor}"
COMPOSE_DIR=/opt/supabase/docker
CONFIG_BACKUP=$(mktemp)

if [[ $EUID -ne 0 ]]; then
  echo "Lance en root."
  exit 1
fi

echo "==> Backup config.js local"
cp "$WEB_ROOT/js/services/config.js" "$CONFIG_BACKUP"

echo "==> Backup BDD (sécurité)"
if [[ -x /root/Suro/infra/vps-lab/07-backup-local.sh ]]; then
  /root/Suro/infra/vps-lab/07-backup-local.sh || true
fi

echo "==> Git fetch origin/$BRANCH"
cd "$WEB_ROOT"
git fetch origin "$BRANCH"

CURRENT=$(git branch --show-current)
git fetch origin "$BRANCH"
if ! git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git fetch origin "$BRANCH:refs/remotes/origin/$BRANCH"
fi

# Fast-forward infra branch puis cherry-pick des commits Cursor applicatifs
git pull origin cursor/repo-improvements-adca 2>/dev/null || true
BEHIND=$(git rev-list --count HEAD..origin/"$BRANCH" 2>/dev/null || echo 0)
if [[ "$BEHIND" -gt 0 ]]; then
  for c in $(git rev-list --reverse HEAD..origin/"$BRANCH"); do
    git cherry-pick "$c" || git cherry-pick --abort
  done
fi

echo "==> Restaure config.js (Supabase VPS)"
LOCAL_ANON=$(grep '^ANON_KEY=' "$COMPOSE_DIR/.env" | cut -d= -f2-)
cat > "$WEB_ROOT/js/services/config.js" << EOF
/* Configuration Supabase — lab VPS self-hosted (API via nginx:80) */
window.SURO_CONFIG = {
  SUPABASE_URL: 'http://185.98.136.100',
  SUPABASE_KEY: '${LOCAL_ANON}',
  API_VERSION: 44,
};
EOF

echo "==> Edge Functions → Supabase self-hosted"
if [[ -d "$WEB_ROOT/supabase/functions" ]]; then
  for fn in "$WEB_ROOT"/supabase/functions/*/; do
    name=$(basename "$fn")
    [[ "$name" == "_*" ]] && continue
    mkdir -p "$COMPOSE_DIR/volumes/functions/$name"
    cp "$fn/index.ts" "$COMPOSE_DIR/volumes/functions/$name/index.ts"
    echo "  -> $name"
  done
  cd "$COMPOSE_DIR"
  docker compose restart functions
fi

echo "==> nginx reload"
nginx -t && systemctl reload nginx

echo "==> Terminé"
echo "Site : http://$(curl -fsSL -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')/"
git log --oneline -3
