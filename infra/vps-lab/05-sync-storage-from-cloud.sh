#!/usr/bin/env bash
# Copie les fichiers Storage Supabase Cloud → self-hosted (lab).
# pg_dump importe les métadonnées (storage.objects) mais pas les blobs.
#
# Prérequis : /root/.suro-sync.env
#   CLOUD_URL=https://eprtmdugiusidtbwzozj.supabase.co
#   CLOUD_SERVICE_ROLE_KEY=eyJ...   (Dashboard → Settings → API → service_role)
#   LOCAL_URL=http://127.0.0.1
#   LOCAL_SERVICE_ROLE_KEY=...      (grep SERVICE_ROLE_KEY /opt/supabase/docker/.env)
#
# Usage : bash infra/vps-lab/05-sync-storage-from-cloud.sh

set -euo pipefail

ENV_FILE="${1:-/root/.suro-sync.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Créer $ENV_FILE avec CLOUD_URL, CLOUD_SERVICE_ROLE_KEY, LOCAL_URL, LOCAL_SERVICE_ROLE_KEY"
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${CLOUD_URL:?}"
: "${CLOUD_SERVICE_ROLE_KEY:?}"
: "${LOCAL_URL:?}"
: "${LOCAL_SERVICE_ROLE_KEY:?}"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "==> Liste des objets storage (DB locale)"
OBJECTS=$(docker compose -f /opt/supabase/docker/docker-compose.yml exec -T db psql -U postgres -d postgres -At -c \
  "SELECT bucket_id || '|' || name FROM storage.objects ORDER BY bucket_id, name")

TOTAL=$(echo "$OBJECTS" | grep -c . || true)
OK=0
FAIL=0
N=0

while IFS='|' read -r bucket object_path; do
  [[ -z "$bucket" ]] && continue
  N=$((N + 1))
  dest_file="$TMP_DIR/$(basename "$object_path")"
  echo "[$N/$TOTAL] $bucket/$object_path"

  if ! curl -fsSL \
    -H "apikey: ${CLOUD_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${CLOUD_SERVICE_ROLE_KEY}" \
    "${CLOUD_URL}/storage/v1/object/${bucket}/${object_path}" \
    -o "$dest_file"; then
    echo "  WARN: téléchargement cloud échoué"
    FAIL=$((FAIL + 1))
    continue
  fi

  mime=$(file -b --mime-type "$dest_file" 2>/dev/null || echo application/octet-stream)

  if curl -fsSL -X POST \
    -H "apikey: ${LOCAL_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${LOCAL_SERVICE_ROLE_KEY}" \
    -H "Content-Type: ${mime}" \
    -H "x-upsert: true" \
    --data-binary "@${dest_file}" \
    "${LOCAL_URL}/storage/v1/object/${bucket}/${object_path}" >/dev/null; then
    OK=$((OK + 1))
  else
    echo "  WARN: upload local échoué"
    FAIL=$((FAIL + 1))
  fi
done <<< "$OBJECTS"

echo ""
echo "==> Terminé : $OK OK, $FAIL échecs sur $TOTAL fichiers"
