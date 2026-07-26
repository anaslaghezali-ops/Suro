#!/usr/bin/env bash
# Restaure un backup postgres.dump (format custom PGDMP) vers Supabase ou Postgres local.
#
# Usage :
#   export DATABASE_URL='postgresql://postgres.[PROJECT_REF]:[PASSWORD]@...'
#   ./scripts/restore-suro-db.sh backups/suro-YYYYMMDD-HHMMSS/postgres.dump
#
# ATTENTION : écrase le schéma + données existants sur la cible.
# Toujours faire un backup AVANT de restaurer.
set -euo pipefail

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Usage : DATABASE_URL=... $0 <chemin/postgres.dump>" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erreur : définir DATABASE_URL." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "Erreur : pg_restore introuvable. Installer postgresql-client." >&2
  exit 1
fi

echo "!!! ATTENTION : restauration vers $DATABASE_URL"
echo "    Fichier : $DUMP"
echo "    Tapez 'oui' pour confirmer :"
read -r confirm
if [[ "$confirm" != "oui" ]]; then
  echo "Annulé."
  exit 1
fi

echo "==> Restauration en cours..."
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --verbose \
  "$DUMP"

echo "==> Restauration terminée."
