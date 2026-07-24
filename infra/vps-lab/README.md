# Labo VPS EU — Supabase self-hosted + SURO

Guide pour installer Supabase (Docker) et servir le site SURO sur un VPS de test.
**Ne pas utiliser de vraies données clients marocaines sur ce labo EU.**

## Prérequis

- VPS Ubuntu 22.04 ou 24.04 (8 Go RAM recommandé)
- Accès SSH root ou sudo
- Nom de domaine optionnel (IP suffit pour les premiers tests)

## Installation en une commande (recommandé)

Sur le VPS en root :

```bash
curl -fsSL https://raw.githubusercontent.com/anaslaghezali-ops/Suro/cursor/repo-improvements-adca/infra/vps-lab/00-install-all.sh | bash
```

Installe Docker, Supabase, nginx, le site SURO et applique les migrations SQL.

## Étapes manuelles (alternative)

### 1. Préparation serveur

```bash
curl -fsSL https://raw.githubusercontent.com/anaslaghezali-ops/Suro/cursor/repo-improvements-adca/infra/vps-lab/01-server-bootstrap.sh | bash
```

## 2. Supabase self-hosted

```bash
curl -fsSL https://raw.githubusercontent.com/anaslaghezali-ops/Suro/cursor/repo-improvements-adca/infra/vps-lab/02-install-supabase.sh | bash
```

Puis éditer `/opt/supabase/docker/.env` (mots de passe, JWT, domaine).

## 3. Site SURO (nginx)

```bash
curl -fsSL https://raw.githubusercontent.com/anaslaghezali-ops/Suro/cursor/repo-improvements-adca/infra/vps-lab/03-deploy-suro.sh | bash
```

## 4. Migrations SURO

Importer les fichiers SQL dans l'ordre (voir `docs/migrations/MIGRATION_ORDER.md`).

## 5. Backups locaux (même serveur)

Sauvegarde quotidienne Postgres + Storage + `.env` dans `/var/backups/suro/` (rétention 7 jours).

```bash
# Manuel
bash infra/vps-lab/07-backup-local.sh

# Restaurer avant une modif ratée
bash infra/vps-lab/08-restore-local.sh /var/backups/suro/YYYYMMDD-HHMMSS
```

Cron installé : tous les jours à 3h (`/var/log/suro-backup.log`).

## 6. Durcissement

```bash
bash infra/vps-lab/06-harden-vps.sh
```

## Ports ouverts

| Port | Service |
|------|---------|
| 22 | SSH |
| 80 | nginx (site) |
| 443 | HTTPS |
| 8000 | Kong API Supabase (interne / tests) |
