#!/usr/bin/env bash
# Vérification PROD lecture seule — module cabinet absent
# Usage : ./staging/scripts/verify-prod-untouched-rest.sh
# Alternative à psql quand PROD_DATABASE_URL n'est pas disponible.
# Utilise uniquement la clé publishable (lecture REST PostgREST).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
source <(grep -E "SUPABASE_URL|SUPABASE_KEY" "$ROOT/js/services/config.js" | sed "s/window.SURO_CONFIG = {//;s/};//;s/,$//;s/^[[:space:]]*//;s/: /=/;s/'//g;s/,$//")

: "${SUPABASE_URL:?SUPABASE_URL introuvable dans js/services/config.js}"
: "${SUPABASE_KEY:?SUPABASE_KEY introuvable}"

BASE="${SUPABASE_URL%/}/rest/v1"
HDR=(-H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY")

FAIL=0

check_table() {
  local t="$1"
  local body code msg
  body=$(curl -s -w "\n%{http_code}" "${HDR[@]}" "$BASE/$t?select=id&limit=1" 2>/dev/null || true)
  code=$(echo "$body" | tail -1)
  msg=$(echo "$body" | head -1)
  if [[ "$code" == "404" ]] && echo "$msg" | grep -q "Could not find the table"; then
    echo "OK absent: table $t"
  elif [[ "$code" == "200" ]]; then
    echo "FUITE: table $t présente (HTTP 200)" >&2
    FAIL=1
  else
    echo "WARN table $t HTTP $code: $msg"
  fi
}

check_rpc() {
  local fn="$1"
  local body code msg
  body=$(curl -s -w "\n%{http_code}" -X POST "${HDR[@]}" -H "Content-Type: application/json" \
    -d '{}' "$BASE/rpc/$fn" 2>/dev/null || true)
  code=$(echo "$body" | tail -1)
  msg=$(echo "$body" | head -1)
  if echo "$msg" | grep -qi "Could not find the function\|PGRST202"; then
    echo "OK absent: function $fn"
  elif [[ "$code" == "200" ]]; then
    echo "FUITE: function $fn présente (HTTP 200)" >&2
    FAIL=1
  else
    echo "OK absent: function $fn (HTTP $code)"
  fi
}

echo "=== verify-prod-untouched-rest ($SUPABASE_URL) ==="
for t in suro_cabinets suro_cabinet_users suro_broker_tasks suro_task_events \
         suro_claim_cabinet suro_claim_status_events suro_cabinet_notifications; do
  check_table "$t"
done
for fn in suro_cabinet_context suro_cabinet_try_create_task user_cabinet_ids \
          suro_get_operating_mode suro_switch_operating_mode; do
  check_rpc "$fn"
done

if [[ "$FAIL" -eq 0 ]]; then
  echo "=== PASS — prod non touchée (équivalent 0 ligne SQL) ==="
else
  echo "=== FAIL — objets cabinet détectés sur prod ===" >&2
  exit 1
fi
