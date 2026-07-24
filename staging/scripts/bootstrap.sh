#!/usr/bin/env bash
# Bootstrap staging complet : Docker Supabase + migrations + seed
# Usage : cd staging && cp .env.example .env && ./scripts/bootstrap.sh
set -euo pipefail

STAGING_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$STAGING_DIR"

if [[ ! -f .env ]]; then
  echo "Copier .env.example vers .env et renseigner les variables." >&2
  exit 1
fi
# shellcheck source=/dev/null
source .env

echo "==> Démarrage Supabase Docker..."
docker compose up -d

echo "==> Attente Postgres..."
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Application des migrations..."
export PSQL_CMD="docker compose exec -T db psql -U postgres -d postgres"
bash "$STAGING_DIR/scripts/apply-migrations.sh" --psql "$PSQL_CMD"

echo "==> Seed cabinets + utilisateurs..."
bash "$STAGING_DIR/scripts/seed-cabinets.sh"

echo "==> Staging prêt."
echo "    Studio : http://localhost:54323 (si configuré)"
echo "    API    : voir SUPABASE_PUBLIC_URL dans .env"
