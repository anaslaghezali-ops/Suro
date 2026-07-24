#!/usr/bin/env bash
# Applique les migrations SURO sur Postgres Supabase self-hosted
set -euo pipefail

MIGRATIONS_DIR="${1:-/var/www/suro/docs/migrations}"
SUPABASE_DIR=/opt/supabase/docker

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Dossier migrations introuvable : $MIGRATIONS_DIR"
  exit 1
fi

cd "$SUPABASE_DIR"

ORDER=(
  20260720_ops_phase0_foundations.sql
  20260720_ops_phase3_document_review.sql
  20260720_ops_phase5_staff_management.sql
  20260720_ops_phase6_rls_hardening.sql
  20260720_ops_staff_account_creation.sql
  20260720_ops_privileges_system.sql
  20260721_fix_customer_email_case_insensitive.sql
  20260721_ops_moto_insurance.sql
  20260722_sec_day1_lock_payment_ownership.sql
  20260722_sec_day2_revoke_anon_execute_definer_fns.sql
  20260722_sec_day3_bound_anon_inserts.sql
  20260723_kyc_documents_combined.sql
  20260723_align_privileges_rls.sql
)

echo "==> Migrations SURO"
for f in "${ORDER[@]}"; do
  path="$MIGRATIONS_DIR/$f"
  if [[ ! -f "$path" ]]; then
    echo "SKIP (absent) : $f"
    continue
  fi
  echo "  -> $f"
  docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$path"
done

echo "==> Migrations OK"
