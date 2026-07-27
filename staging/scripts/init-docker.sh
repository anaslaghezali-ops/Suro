#!/usr/bin/env bash
# Télécharge le docker-compose officiel Supabase (self-hosted) si absent.
set -euo pipefail
STAGING_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$STAGING_DIR/supabase-docker"

if [[ -d "$TARGET" && -f "$TARGET/docker-compose.yml" ]]; then
  echo "supabase-docker déjà présent."
  exit 0
fi

echo "==> Clone Supabase Docker (officiel)..."
TMP=$(mktemp -d)
git clone --depth 1 https://github.com/supabase/supabase "$TMP"
mv "$TMP/docker" "$TARGET"
rm -rf "$TMP"
echo "==> OK : $TARGET"
