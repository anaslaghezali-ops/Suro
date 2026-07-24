#!/usr/bin/env bash
# Checklist #9 — Rollback + idempotence migrations cabinet
# Usage : ./staging/scripts/test-migrations-cycle.sh
# Crée une base jetable, applique toutes les migrations, rollback inverse,
# vérifie absence module cabinet, puis ré-applique (idempotence).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_NAME="${TEST_DB_NAME:-suro_cabinet_cycle_$(date +%s)}"
LOG="${TEST_CYCLE_LOG:-/tmp/cabinet-migrations-cycle.log}"

psql_run() {
  sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

exec > >(tee "$LOG") 2>&1

echo "=== CYCLE MIGRATIONS CABINET ==="
echo "DB: $DB_NAME"
echo "LOG: $LOG"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

run_sql() {
  local file="$1"
  echo "==> $(basename "$file")"
  psql_run -f "$file"
}

sudo -u postgres dropdb --if-exists "$DB_NAME" 2>/dev/null || true
sudo -u postgres createdb "$DB_NAME"

echo "--- Phase 1 : apply all migrations ---"
USE_TEST_HARNESS=1 "$ROOT/staging/scripts/apply-migrations.sh" \
  --psql "sudo -u postgres psql -d $DB_NAME -v ON_ERROR_STOP=1"

echo
echo "--- Phase 2 : rollback (ordre inverse) ---"
run_sql "$ROOT/docs/migrations/20260727_cabinet_staff_admin_down.sql"
run_sql "$ROOT/docs/migrations/20260727_cabinet_fixes_down.sql"
run_sql "$ROOT/docs/migrations/20260726_operating_mode_down.sql"
run_sql "$ROOT/docs/migrations/20260726_cabinet_rls_perf_down.sql"
run_sql "$ROOT/docs/migrations/20260725_cabinet_module_down.sql"

echo
echo "--- Phase 3 : verify cabinet absent ---"
VERIFY_OUT="$(mktemp)"
psql_run -t -A -f "$ROOT/staging/scripts/verify-prod-untouched.sql" > "$VERIFY_OUT"
cat "$VERIFY_OUT"
if grep -q . "$VERIFY_OUT"; then
  echo "ERREUR: objets cabinet encore présents après rollback" >&2
  exit 1
fi
echo "OK — 0 objet cabinet (verify-prod-untouched)"

echo
echo "--- Phase 4 : re-apply migrations cabinet (idempotence) ---"
CABINET_MIGRATIONS=(
  20260725_cabinet_module.sql
  20260725_cabinet_rls_hardening.sql
  20260726_cabinet_rls_perf.sql
  20260726_operating_mode.sql
  20260727_cabinet_fixes.sql
  20260727_cabinet_staff_admin.sql
)
for f in "${CABINET_MIGRATIONS[@]}"; do
  run_sql "$ROOT/docs/migrations/$f"
done

echo
echo "--- Phase 5 : smoke check post re-apply ---"
psql_run -c "select count(*) as cabinets from public.suro_cabinets;"
psql_run -c "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='suro_get_operating_mode';"

echo
echo "=== CYCLE MIGRATIONS : PASS ==="
echo "Log complet : $LOG"

if [[ "${KEEP_TEST_DB:-}" != "1" ]]; then
  sudo -u postgres dropdb --if-exists "$DB_NAME"
fi
