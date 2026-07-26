#!/usr/bin/env bash
# Sauvegarde complète de la base Suro (Supabase Cloud).
#
# Prérequis : pg_dump (postgresql-client) + mot de passe base Supabase.
#
# Usage :
#   export DATABASE_URL='postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres'
#   ./scripts/backup-suro-db.sh
#
# Récupérer DATABASE_URL :
#   Supabase Dashboard → Project Settings → Database → Connection string (Session pooler, port 5432)
#
# Projet Suro prod : eprtmdugiusidtbwzozj
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups/suro-$STAMP}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erreur : définir DATABASE_URL (voir en-tête du script)." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Erreur : pg_dump introuvable. Installer postgresql-client." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "==> Backup Suro → $OUT_DIR"
echo "    Date UTC : $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Format custom (PGDMP) — compatible pg_restore, comme les backups VPS
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --file="$OUT_DIR/postgres.dump"

# Métadonnées
{
  echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "project_ref=eprtmdugiusidtbwzozj"
  echo "format=pg_dump_custom"
  ls -lh "$OUT_DIR/postgres.dump"
} > "$OUT_DIR/manifest.txt"

echo "==> Terminé."
echo "    Fichier : $OUT_DIR/postgres.dump"
echo "    Taille  : $(du -h "$OUT_DIR/postgres.dump" | cut -f1)"
echo ""
echo "Restauration : ./scripts/restore-suro-db.sh $OUT_DIR/postgres.dump"
