#!/usr/bin/env bash
# Durcissement VPS labo SURO — SSH, pare-feu, Postgres/Supabase en localhost.
# Prérequis : accès SSH par clé (suro_lab) testé AVANT de lancer.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Lance en root."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Mises à jour système"
apt-get update -y
apt-get upgrade -y

echo "==> SSH : clés uniquement (mot de passe désactivé)"
SSHD=/etc/ssh/sshd_config
cp -a "$SSHD" "${SSHD}.bak.$(date +%Y%m%d)"

# Bloc durcissement idempotent
MARKER="# --- SURO hardening ---"
if ! grep -q "$MARKER" "$SSHD"; then
  cat >> "$SSHD" << 'EOF'

# --- SURO hardening ---
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
fi

sshd -t
systemctl reload ssh

echo "==> Supabase : ports Docker en localhost uniquement"
COMPOSE=/opt/supabase/docker/docker-compose.yml
if [[ -f "$COMPOSE" ]]; then
  cp -a "$COMPOSE" "${COMPOSE}.bak.$(date +%Y%m%d)"
  sed -i \
    -e 's|- ${KONG_HTTP_PORT}:8000/tcp|- 127.0.0.1:8000:8000/tcp|' \
    -e 's|- ${KONG_HTTPS_PORT}:8443/tcp|- 127.0.0.1:8443:8443/tcp|' \
    -e 's|- ${POSTGRES_PORT}:5432|- 127.0.0.1:5432:5432|' \
    -e 's|- ${POOLER_PROXY_PORT_TRANSACTION}:6543|- 127.0.0.1:6543:6543|' \
    "$COMPOSE"
  cd /opt/supabase/docker
  docker compose up -d
fi

echo "==> Pare-feu UFW"
ufw delete allow 8000/tcp 2>/dev/null || true
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> fail2ban"
systemctl enable fail2ban
systemctl restart fail2ban

echo "==> Vérifications"
echo "--- Ports publics (seuls 22/80/443 attendus) ---"
ss -tlnp | awk 'NR==1 || /0.0.0.0:|\\[::\\]:/' | grep -v ':53 ' || true

echo "--- SSH ---"
sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication'

echo "--- API via nginx ---"
curl -s -o /dev/null -w "rest=%{http_code}\n" \
  -H "apikey: $(grep '^ANON_KEY=' /opt/supabase/docker/.env | cut -d= -f2-)" \
  "http://127.0.0.1/rest/v1/insurance_products?select=id&limit=1"

echo ""
echo "==> Durcissement terminé"
echo "Postgres/Studio : tunnel SSH uniquement (ssh -L 5432:localhost:5432 suro-lab)"
echo "Site + API : http://$(curl -fsSL -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')/"
