#!/usr/bin/env bash
# Clone SURO et configure nginx pour servir le site statique
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Lance en root ou sudo."
  exit 1
fi

WEB_ROOT=/var/www/suro
REPO=https://github.com/anaslaghezali-ops/Suro.git
BRANCH=cursor/repo-improvements-adca

apt-get install -y nginx

if [[ ! -d "$WEB_ROOT/.git" ]]; then
  git clone --branch "$BRANCH" --depth 1 "$REPO" "$WEB_ROOT"
else
  cd "$WEB_ROOT" && git pull origin "$BRANCH"
fi

cat > /etc/nginx/sites-available/suro <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/suro;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /app/ {
        try_files $uri $uri/ /app/index.html;
    }

    location /ops/ {
        try_files $uri $uri/ /ops/index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/suro /etc/nginx/sites-enabled/suro
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Site disponible sur http://VOTRE_IP/"
echo "Étape suivante : pointer js/services/config.js vers ton Supabase self-hosted"
