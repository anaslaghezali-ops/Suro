# Comptes de test — isolation inter-tenant (staging)

> Prod cloud `eprtmdugiusidtbwzozj` : **ne pas utiliser** pour ces tests.

## Environnements staging

| Environnement | URL / accès | Statut |
|---------------|-------------|--------|
| **VPS self-hosted** | `http://185.98.136.100` | Module cabinet déployé, migrations appliquées |
| **Supabase Cloud `suro-staging`** | `https://[PROJECT_REF].supabase.co` | **À créer** — voir `STAGING_CLOUD_SETUP.md` |

### PROJECT REF staging cloud

```
PROJECT_REF = (non créé — à renseigner après provisioning dashboard)
```

Une fois le projet créé, noter le ref dans `staging/STAGING_CLOUD_SETUP.md` section 7.

---

## Comptes inter-tenant (2 cabinets)

Créés par `staging/scripts/seed-cabinets.sh` :

| Email | Mot de passe | Cabinet | Rôle | Portail |
|-------|--------------|---------|------|---------|
| `gestionnaire.agma@suro.ma` | `StagingCabinet2026!` | Cabinet AGMA (`slug: agma`) | gestionnaire | `/cabinet/` |
| `gestionnaire.atlas@suro.ma` | `StagingCabinet2026!` | Cabinet Atlas Assurances (`slug: atlas`) | gestionnaire | `/cabinet/` |

> Le mot de passe correspond à `STAGING_SEED_PASSWORD` dans `staging/.env`. Sur VPS, la valeur utilisée est `StagingCabinet2026!`.

### Création / réinitialisation

```bash
cd staging
export SUPABASE_URL="https://[PROJECT_REF].supabase.co"   # ou http://185.98.136.100:8000
export SUPABASE_SERVICE_ROLE_KEY="..."                    # dashboard staging uniquement
export STAGING_SEED_PASSWORD="StagingCabinet2026!"
./scripts/seed-cabinets.sh
```

---

## Procédure test isolation inter-tenant

1. Appliquer toutes les migrations (`apply-migrations.sh`) dont `20260726_cabinet_rls_perf.sql`
2. Exécuter `seed-cabinets.sh`
3. Créer un contrat test, compléter KYC (6 pièces) → tâche assignée à **AGMA** ou **Atlas** (round-robin)
4. Se connecter en `gestionnaire.agma@suro.ma` → voir uniquement les tâches `cabinet_id` AGMA
5. Se connecter en `gestionnaire.atlas@suro.ma` → **zéro** dossier AGMA
6. Vérifier RLS : `SELECT * FROM suro_broker_tasks` en Atlas ne retourne pas les lignes AGMA

### Vérification SQL (staff ou psql direct)

```sql
-- Doit retourner 2 cabinets
select slug, name from suro_cabinets order by slug;

-- Doit retourner 2 utilisateurs sur 2 cabinets distincts
select c.slug, u.user_id, cu.role
from suro_cabinet_users cu
join suro_cabinets c on c.id = cu.cabinet_id
join auth.users u on u.id = cu.user_id
where cu.is_active
order by c.slug;
```

---

## Login cabinet

URL : `http://185.98.136.100/cabinet-login.html` (VPS) ou équivalent staging cloud.
