#!/usr/bin/env bash
# Applique les migrations KYC sur Supabase via psql.
# Usage : DATABASE_URL='postgresql://postgres.[ref]:[password]@...' ./scripts/apply-kyc-migrations.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="${ROOT}/docs/migrations/20260723_kyc_documents_combined.sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erreur : définis DATABASE_URL (Supabase → Project Settings → Database → Connection string URI)."
  echo "Exemple : export DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Erreur : psql introuvable. Installe le client PostgreSQL."
  exit 1
fi

echo "Application de ${SQL} ..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "OK — migrations KYC appliquées."
