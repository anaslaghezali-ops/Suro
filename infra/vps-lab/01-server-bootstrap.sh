#!/usr/bin/env bash
# Préparation VPS labo SURO — Ubuntu 22.04/24.04
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Lance ce script en root ou avec sudo."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Mise à jour système"
apt-get update -y
apt-get upgrade -y

echo "==> Paquets de base"
apt-get install -y \
  ca-certificates curl git gnupg ufw fail2ban \
  htop unzip jq

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

systemctl enable docker
systemctl start docker

echo "==> Firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Swap 2 Go (utile si 4–8 Go RAM)"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> OK"
docker --version
docker compose version
free -h
echo "Prochaine étape : 02-install-supabase.sh"
