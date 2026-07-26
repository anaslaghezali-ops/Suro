#!/usr/bin/env bash
# Crée 2 comptes gestionnaires (AGMA + Atlas) et les lie aux cabinets.
# Requiert : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAGING_SEED_PASSWORD
#            + DATABASE_URL ou Docker staging pour lier user→cabinet
set -euo pipefail

STAGING_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$STAGING_DIR/.env" ]]; then
  # shellcheck source=/dev/null
  source "$STAGING_DIR/.env"
fi

: "${SUPABASE_URL:?SUPABASE_URL requis}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY requis}"
: "${STAGING_SEED_PASSWORD:?STAGING_SEED_PASSWORD requis}"

API="$SUPABASE_URL"
AUTH_HDR=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json")

create_user() {
  local email="$1" name="$2"
  curl -sf -X POST "$API/auth/v1/admin/users" "${AUTH_HDR[@]}" \
    -d "{\"email\":\"$email\",\"password\":\"$STAGING_SEED_PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"$name\"}}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])"
}

run_psql() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
  elif docker compose -f "$STAGING_DIR/docker-compose.yml" ps db >/dev/null 2>&1; then
    docker compose -f "$STAGING_DIR/docker-compose.yml" exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
  else
    echo "Erreur : DATABASE_URL ou docker staging requis pour lier les utilisateurs" >&2
    exit 1
  fi
}

link_user() {
  local cabinet_slug="$1" user_id="$2" role="$3" display="$4"
  run_psql <<SQL
insert into public.suro_cabinet_users (cabinet_id, user_id, role, display_name)
select c.id, '$user_id'::uuid, '$role'::public.suro_cabinet_role, '$display'
from public.suro_cabinets c where c.slug = '$cabinet_slug'
on conflict (cabinet_id, user_id) do update
  set role = excluded.role, display_name = excluded.display_name, is_active = true;
SQL
}

run_psql < "$STAGING_DIR/sql/seed_cabinets.sql"

AGMA_GEST_ID=$(create_user "gestionnaire.agma@suro.ma" "Ahmed AGMA")
ATLAS_GEST_ID=$(create_user "gestionnaire.atlas@suro.ma" "Fatima Atlas")
AGMA_ADMIN_ID=$(create_user "admin.agma@suro.ma" "Karim AGMA Admin")
ATLAS_ADMIN_ID=$(create_user "admin.atlas@suro.ma" "Sara Atlas Admin")

link_user "agma" "$AGMA_GEST_ID" "gestionnaire" "Ahmed AGMA"
link_user "atlas" "$ATLAS_GEST_ID" "gestionnaire" "Fatima Atlas"
link_user "agma" "$AGMA_ADMIN_ID" "admin_cabinet" "Karim AGMA Admin"
link_user "atlas" "$ATLAS_ADMIN_ID" "admin_cabinet" "Sara Atlas Admin"

cat <<EOF

Comptes de test inter-tenant créés :
  gestionnaire.agma@suro.ma   → Cabinet AGMA (gestionnaire)
  gestionnaire.atlas@suro.ma  → Cabinet Atlas (gestionnaire)
  admin.agma@suro.ma          → Cabinet AGMA (admin_cabinet)
  admin.atlas@suro.ma         → Cabinet Atlas (admin_cabinet)
  Mot de passe : (valeur STAGING_SEED_PASSWORD)

Test fuite : connecter chaque compte au portail /cabinet/ — aucun ne doit voir les dossiers de l'autre.
EOF
