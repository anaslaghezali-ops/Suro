#!/usr/bin/env bash
# Sauvegarde complète de la base Suro (Supabase Cloud).
#
# Prérequis : pg_dump **17+** (Supabase = PG 17) + mot de passe base Supabase.
#   sudo apt install postgresql-client-17
#   # ou utiliser /usr/lib/postgresql/17/bin/pg_dump explicitement
#
# Usage :
#   export DATABASE_URL='...'   # copier EXACTEMENT depuis le dashboard (voir ci-dessous)
#   ./scripts/backup-suro-db.sh
#
# Récupérer DATABASE_URL (ne pas deviner la région) :
#   Supabase Dashboard → bouton **Connect** (en haut) → **Session pooler** (port 5432)
#   Coller la chaîne telle quelle, remplacer [YOUR-PASSWORD].
#
# Alternative directe (pg_dump recommandé par Supabase) :
#   postgresql://postgres:[PASSWORD]@db.eprtmdugiusidtbwzozj.supabase.co:5432/postgres
#   (user = postgres, pas postgres.PROJECT_REF — nécessite IPv6 ou add-on IPv4)
#
# Projet Suro prod : eprtmdugiusidtbwzozj
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups/suro-$STAMP}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erreur : définir DATABASE_URL (voir en-tête du script)." >&2
  exit 1
fi

# Préférer pg_dump 17 (Supabase tourne en PG 17 — pg_dump 16 échoue)
PG_DUMP="${PG_DUMP:-}"
if [[ -z "$PG_DUMP" ]]; then
  if [[ -x /usr/lib/postgresql/17/bin/pg_dump ]]; then
    PG_DUMP=/usr/lib/postgresql/17/bin/pg_dump
  elif command -v pg_dump >/dev/null 2>&1; then
    PG_DUMP=pg_dump
  else
    echo "Erreur : pg_dump introuvable. Installer postgresql-client-17." >&2
    exit 1
  fi
fi

echo "    pg_dump : $($PG_DUMP --version)"

mkdir -p "$OUT_DIR"

echo "==> Backup Suro → $OUT_DIR"
echo "    Date UTC : $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Format custom (PGDMP) — compatible pg_restore, comme les backups VPS
$PG_DUMP "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --file="$OUT_DIR/postgres.dump"

# Métadonnées
{
  echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "project_ref=eprtmdugiusidtbwzozj"
  echo "format=pg_dump_custom"
  ls -lh "$OUT_DIR/postgres.dump"
} > "$OUT_DIR/manifest.txt"

echo "==> Terminé."
echo "    Fichier : $OUT_DIR/postgres.dump"
echo "    Taille  : $(du -h "$OUT_DIR/postgres.dump" | cut -f1)"
echo ""
echo "Restauration : ./scripts/restore-suro-db.sh $OUT_DIR/postgres.dump"
