#!/usr/bin/env bash
# Backup local SURO (lab) — Postgres + Storage + .env
# Destination : /var/backups/suro/ (même serveur, récupération rapide)
#
# Usage manuel : bash infra/vps-lab/07-backup-local.sh
# Cron (quotidien 3h) : 0 3 * * * /root/Suro/infra/vps-lab/07-backup-local.sh >> /var/log/suro-backup.log 2>&1
set -euo pipefail

BACKUP_ROOT=/var/backups/suro
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="${BACKUP_ROOT}/${STAMP}"
COMPOSE_DIR=/opt/supabase/docker
RETENTION_DAYS=7
PG_DUMP=/usr/lib/postgresql/17/bin/pg_dump

mkdir -p "$DEST"
chmod 700 "$BACKUP_ROOT"

log() { echo "[$(date -Iseconds)] $*"; }

if [[ ! -x "$PG_DUMP" ]]; then
  log "ERREUR: pg_dump 17 introuvable ($PG_DUMP)"
  exit 1
fi

log "==> Backup Postgres"
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db \
  pg_dump -U postgres -d postgres -F c --no-owner --no-acl \
  > "${DEST}/postgres.dump"

log "==> Backup Storage (fichiers)"
STORAGE_DIR="$COMPOSE_DIR/volumes/storage"
if [[ -d "$STORAGE_DIR" ]]; then
  tar -czf "${DEST}/storage.tar.gz" -C "$STORAGE_DIR" .
else
  log "WARN: $STORAGE_DIR introuvable, skip"
fi

log "==> Backup .env Supabase"
if [[ -f "$COMPOSE_DIR/.env" ]]; then
  cp "$COMPOSE_DIR/.env" "${DEST}/supabase.env"
  chmod 600 "${DEST}/supabase.env"
fi

log "==> Manifest"
cat > "${DEST}/manifest.txt" << EOF
date=${STAMP}
host=$(hostname)
postgres_bytes=$(stat -c%s "${DEST}/postgres.dump")
storage_bytes=$(stat -c%s "${DEST}/storage.tar.gz" 2>/dev/null || echo 0)
EOF

log "==> Rotation (> ${RETENTION_DAYS} jours)"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true

log "==> Terminé : ${DEST}"
ls -lh "${DEST}"
