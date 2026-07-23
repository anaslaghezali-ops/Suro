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

    # Supabase API (Kong) — la plupart des hébergeurs bloquent le port 8000 en externe
    location /auth/ {
        proxy_pass http://127.0.0.1:8000/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /rest/ {
        proxy_pass http://127.0.0.1:8000/rest/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /storage/ {
        proxy_pass http://127.0.0.1:8000/storage/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20m;
    }

    location /realtime/ {
        proxy_pass http://127.0.0.1:8000/realtime/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /functions/ {
        proxy_pass http://127.0.0.1:8000/functions/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /app/ {
        try_files $uri $uri/ /app/index.html;
    }

    location /ops/ {
        try_files $uri $uri/ /ops/index.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/suro /etc/nginx/sites-enabled/suro
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Site disponible sur http://VOTRE_IP/"
echo "Étape suivante : pointer js/services/config.js vers ton Supabase self-hosted"
