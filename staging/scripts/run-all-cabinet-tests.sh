#!/usr/bin/env bash
# Orchestrateur — preuves Go/No-Go cabinet (checklist #5, #8, #9, round-robin)
# Usage : ./staging/scripts/run-all-cabinet-tests.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS="$ROOT/staging/scripts"
DB_NAME="${TEST_DB_NAME:-suro_cabinet_tests_$(date +%s)}"
PSQL="sudo -u postgres psql -d $DB_NAME -v ON_ERROR_STOP=1"
REPORT_DIR="${REPORT_DIR:-/tmp/cabinet-test-outputs}"
mkdir -p "$REPORT_DIR"

exec 3>&1
log_section() {
  local name="$1" file="$2"
  echo ""
  echo "########## $name ##########" | tee -a "$REPORT_DIR/full.log"
  if [[ -f "$file" ]]; then
    cat "$file" | tee -a "$REPORT_DIR/full.log"
  fi
}

echo "=== RUN ALL CABINET TESTS ===" | tee "$REPORT_DIR/full.log"
echo "DB: $DB_NAME" | tee -a "$REPORT_DIR/full.log"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$REPORT_DIR/full.log"

# 1. Base + migrations
sudo -u postgres dropdb --if-exists "$DB_NAME" 2>/dev/null || true
sudo -u postgres createdb "$DB_NAME"
USE_TEST_HARNESS=1 "$ROOT/staging/scripts/apply-migrations.sh" \
  --psql "sudo -u postgres psql -d $DB_NAME -v ON_ERROR_STOP=1" \
  > "$REPORT_DIR/01-apply-migrations.log" 2>&1
log_section "APPLY MIGRATIONS" "$REPORT_DIR/01-apply-migrations.log"

# 2. Isolation
(cd "$SCRIPTS" && eval "$PSQL" -f test-tenant-isolation.sql) \
  > "$REPORT_DIR/02-isolation.log" 2>&1
log_section "ISOLATION (#5)" "$REPORT_DIR/02-isolation.log"

# 3. Round-robin
(cd "$SCRIPTS" && eval "$PSQL" -f test-round-robin.sql) \
  > "$REPORT_DIR/03-round-robin.log" 2>&1
log_section "ROUND-ROBIN" "$REPORT_DIR/03-round-robin.log"

# 4. Migration cycle (separate DB)
TEST_DB_NAME="${DB_NAME}_cycle" KEEP_TEST_DB=0 "$SCRIPTS/test-migrations-cycle.sh" \
  > "$REPORT_DIR/04-migrations-cycle.log" 2>&1
log_section "ROLLBACK/IDEMPOTENCE (#9)" "$REPORT_DIR/04-migrations-cycle.log"

# 5. Prod verify (read-only if PROD_DATABASE_URL set)
if [[ -n "${PROD_DATABASE_URL:-}" ]]; then
  psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPTS/verify-prod-untouched.sql" \
    > "$REPORT_DIR/05-prod-untouched.log" 2>&1 || true
else
  "$SCRIPTS/verify-prod-untouched-rest.sh" \
    > "$REPORT_DIR/05-prod-untouched.log" 2>&1 || true
fi
log_section "PROD UNTOUCHED (#8)" "$REPORT_DIR/05-prod-untouched.log"

# 6. JS tests
(cd "$ROOT" && npm run check:js && npm test) \
  > "$REPORT_DIR/06-npm-tests.log" 2>&1
log_section "NON-RÉGRESSION npm" "$REPORT_DIR/06-npm-tests.log"

sudo -u postgres dropdb --if-exists "$DB_NAME" 2>/dev/null || true

echo ""
echo "=== ALL TESTS PASS ==="
echo "Outputs: $REPORT_DIR/"
