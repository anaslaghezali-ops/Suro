#!/usr/bin/env bash
# Restaure un backup local SURO (lab).
# Usage : bash infra/vps-lab/08-restore-local.sh /var/backups/suro/20260723-233452
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /var/backups/suro/<timestamp>"
  exit 1
fi

SRC="$1"
COMPOSE_DIR=/opt/supabase/docker
PG_RESTORE=/usr/lib/postgresql/17/bin/pg_restore

if [[ ! -f "$SRC/postgres.dump" ]]; then
  echo "Backup invalide : $SRC/postgres.dump manquant"
  exit 1
fi

echo "ATTENTION : restauration depuis $SRC"
echo "Appuyez Entrée pour continuer ou Ctrl+C pour annuler"
read -r _

cd "$COMPOSE_DIR"

echo "==> Postgres"
docker compose stop auth rest storage realtime functions kong studio 2>/dev/null || true
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists --no-owner --no-acl < "$SRC/postgres.dump"

if [[ -f "$SRC/storage.tar.gz" ]]; then
  echo "==> Storage"
  rm -rf "$COMPOSE_DIR/volumes/storage"/*
  tar -xzf "$SRC/storage.tar.gz" -C "$COMPOSE_DIR/volumes/storage"
fi

echo "==> Redémarrage Supabase"
docker compose up -d

echo "==> Grants PostgREST"
docker compose exec -T db psql -U postgres -d postgres << 'SQL'
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
SQL

echo "==> Restauration terminée"
