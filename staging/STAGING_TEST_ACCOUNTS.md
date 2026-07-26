# Comptes de test — isolation inter-tenant (staging)

> Prod cloud `eprtmdugiusidtbwzozj` : **ne pas utiliser** pour ces tests.  
> Exécuter `staging/scripts/verify-prod-untouched.sql` sur prod → **0 ligne attendue**.

## PROJECT REF staging Supabase Cloud

```
PROJECT_REF = (à créer — dashboard Supabase → projet suro-staging)
URL         = https://[PROJECT_REF].supabase.co
```

Procédure complète : `staging/STAGING_CLOUD_SETUP.md`

**Ordre migrations** (après `00_base_schema_pre_cabinet.sql`) :

1. `20260725_cabinet_module.sql`
2. `20260725_cabinet_rls_hardening.sql`
3. `20260726_cabinet_rls_perf.sql`
4. `20260726_operating_mode.sql`
5. `20260727_cabinet_fixes.sql`
6. `20260727_cabinet_staff_admin.sql`

```bash
./staging/scripts/apply-migrations.sh
./staging/scripts/seed-cabinets.sh
```

---

## Comptes inter-tenant (2 cabinets)

| Email | Mot de passe | Cabinet | Rôle |
|-------|--------------|---------|------|
| `gestionnaire.agma@suro.ma` | `StagingCabinet2026!` | AGMA | gestionnaire |
| `gestionnaire.atlas@suro.ma` | `StagingCabinet2026!` | Atlas | gestionnaire |
| `admin.agma@suro.ma` | `StagingCabinet2026!` | AGMA | admin_cabinet |
| `admin.atlas@suro.ma` | `StagingCabinet2026!` | Atlas | admin_cabinet |

> Mot de passe = `STAGING_SEED_PASSWORD` dans `staging/.env`

### VPS self-hosted (disponible)

- URL : `http://185.98.136.100`
- Portail cabinet : `/cabinet-login.html`
- Ops : `/ops/`

---

## Procédure test isolation

1. Migrations + seed appliqués
2. Créer un contrat test, KYC complet → tâche assignée (round-robin)
3. `gestionnaire.agma@suro.ma` → voit uniquement dossiers AGMA
4. `gestionnaire.atlas@suro.ma` → zéro dossier AGMA
5. `admin.agma@suro.ma` → gestion équipe AGMA uniquement

## Vérification prod intacte

```bash
psql "$PROD_DATABASE_URL" -f staging/scripts/verify-prod-untouched.sql
# Résultat : aucune ligne
```
