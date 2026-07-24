#!/usr/bin/env bash
# Applique toutes les migrations docs/migrations/*.sql dans l'ordre chronologique.
# Usage : DATABASE_URL="postgresql://..." ./staging/scripts/apply-migrations.sh
#    ou : ./staging/scripts/apply-migrations.sh --psql "docker exec -i supabase-db psql -U postgres -d postgres"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATIONS="$ROOT/docs/migrations"
PSQL_CMD="${PSQL_CMD:-psql}"

if [[ "${1:-}" == "--psql" ]]; then
  PSQL_CMD="$2"
  shift 2 || true
fi

if [[ -z "${DATABASE_URL:-}" && "$PSQL_CMD" == "psql" ]]; then
  echo "Erreur : définir DATABASE_URL ou utiliser --psql \"<commande>\"" >&2
  exit 1
fi

run_sql() {
  local file="$1"
  echo "==> $(basename "$file")"
  if [[ "$PSQL_CMD" == "psql" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  else
    eval "$PSQL_CMD" < "$file"
  fi
}

# 1. Schéma de base (pré-requis : tables insurance_*, suro_admins, etc.)
if [[ -f "$ROOT/staging/sql/00_base_schema_pre_cabinet.sql" ]]; then
  run_sql "$ROOT/staging/sql/00_base_schema_pre_cabinet.sql"
fi

# 2. Migrations incrémentales (tri alphabétique = ordre chronologique)
for f in $(ls "$MIGRATIONS"/[0-9]*.sql 2>/dev/null | sort); do
  base=$(basename "$f")
  [[ "$base" == *"_down.sql" ]] && continue
  run_sql "$f"
done

echo "==> Migrations terminées."
