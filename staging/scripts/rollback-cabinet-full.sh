#!/usr/bin/env bash
# Rollback complet module cabinet : base (SQL) + front (pre-cabinet).
#
# Usage :
#   export DATABASE_URL='postgresql://...'
#   ./staging/scripts/rollback-cabinet-full.sh --local          # VPS : code seulement
#   ./staging/scripts/rollback-cabinet-full.sh --db-only        # SQL seulement
#   ./staging/scripts/rollback-cabinet-full.sh                  # VPS distant : code + SQL si DATABASE_URL
#
# Plan B base (restauration complète) :
#   ./scripts/restore-suro-db.sh backups/suro-manual.dump
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MODE="${1:-}"

echo "=============================================="
echo " ROLLBACK COMPLET — module cabinet"
echo "=============================================="
echo

run_db() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL non défini — rollback SQL ignoré."
    return 0
  fi
  "$ROOT/staging/scripts/rollback-cabinet-db.sh"
}

run_code() {
  if [[ "$MODE" == "--local" ]]; then
    "$ROOT/staging/scripts/rollback-cabinet-code.sh" --local
  else
    "$ROOT/staging/scripts/rollback-cabinet-code.sh"
  fi
}

case "$MODE" in
  --db-only)
    run_db
    ;;
  --code-only|--local)
    run_code
    ;;
  *)
    run_db
    run_code
    ;;
esac

echo
echo "Rollback terminé. Voir docs/ROLLBACK_CABINET.md pour vérifications."
