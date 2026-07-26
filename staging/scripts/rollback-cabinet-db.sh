#!/usr/bin/env bash
# Rollback SQL du module cabinet (ordre inverse des migrations).
# Usage : DATABASE_URL="postgresql://..." ./staging/scripts/rollback-cabinet-db.sh
#    ou : ./staging/scripts/rollback-cabinet-db.sh --psql "docker exec -i supabase-db psql -U postgres -d postgres"
#
# Résultat attendu : staging/scripts/verify-prod-untouched.sql → 0 ligne
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
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

DOWN_MIGRATIONS=(
  20260727_cabinet_staff_admin_down.sql
  20260727_operating_mode_guard_down.sql
  20260727_cabinet_fixes_down.sql
  20260726_operating_mode_down.sql
  20260726_cabinet_rls_perf_down.sql
  20260725_cabinet_module_down.sql
)

echo "=== ROLLBACK MODULE CABINET (SQL) ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

for name in "${DOWN_MIGRATIONS[@]}"; do
  f="$ROOT/docs/migrations/$name"
  [[ -f "$f" ]] || { echo "Fichier manquant : $f" >&2; exit 1; }
  run_sql "$f"
done

echo
echo "=== Vérification (0 ligne attendue) ==="
if [[ "$PSQL_CMD" == "psql" ]]; then
  OUT="$(mktemp)"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -f "$ROOT/staging/scripts/verify-prod-untouched.sql" > "$OUT"
  if grep -q . "$OUT"; then
    cat "$OUT"
    echo "ERREUR : objets cabinet encore présents." >&2
    exit 1
  fi
  echo "OK — module cabinet absent"
else
  echo "(Vérif manuelle : staging/scripts/verify-prod-untouched.sql)"
fi

echo "=== Rollback SQL terminé ==="
