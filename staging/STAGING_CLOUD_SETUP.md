# Mise en place — Supabase Cloud « suro-staging »

> **Prod interdite** : `eprtmdugiusidtbwzozj` — ne jamais y appliquer les migrations cabinet.

## 1. Créer le projet Cloud (dashboard)

Je ne peux pas créer le projet via MCP depuis l’agent cloud (auth Cursor desktop requise).
Le Lead Architect avec MCP Supabase peut le faire, ou toi manuellement :

1. [https://supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. **Name** : `suro-staging`
3. **Database password** : générer et sauvegarder dans un gestionnaire de mots de passe
4. **Region** : même région que la prod (ex. `eu-west-3`) pour latence comparable
5. Attendre le provisionnement (~2 min)
6. Noter le **Project ref** (ex. `abcdefghijklmnop`) dans Settings → General

## 2. Récupérer les clés (staging uniquement)

Settings → API :

| Variable | Usage |
|----------|--------|
| Project URL | `SUPABASE_URL` |
| `anon` / publishable key | Front staging (`config.staging.local.js`) |
| `service_role` | Scripts seed **uniquement** — jamais dans le repo |

## 3. Appliquer le schéma (ordre strict)

### Option A — Supabase MCP (Lead Architect)

1. S’authentifier sur le MCP Supabase (projet **suro-staging** uniquement)
2. Exécuter dans l’ordre :
   - `staging/sql/00_base_schema_pre_cabinet.sql`
   - Tous les fichiers `docs/migrations/[0-9]*.sql` triés par nom (exclure `*_down.sql`)
3. Vérifier : `select count(*) from suro_cabinets;` → 2

### Option B — CLI / psql

```bash
export DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres"

# Depuis la racine du repo
chmod +x staging/scripts/apply-migrations.sh
./staging/scripts/apply-migrations.sh
```

### Option C — Self-hosted Docker (reproductible local)

```bash
cd staging
cp .env.example .env
# Renseigner .env
./scripts/init-docker.sh
./scripts/bootstrap.sh
```

## 4. Seed comptes inter-tenant

```bash
cd staging
export SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."   # depuis dashboard staging
export STAGING_SEED_PASSWORD="..."       # mot de passe test
./scripts/seed-cabinets.sh
```

Comptes créés :

| Email | Cabinet | Rôle |
|-------|---------|------|
| `gestionnaire.agma@suro.ma` | AGMA | gestionnaire |
| `gestionnaire.atlas@suro.ma` | Atlas | gestionnaire |

## 5. Config front staging (sans secret en dur)

```bash
cp js/services/config.staging.example.js js/services/config.staging.local.js
# Renseigner SUPABASE_URL et SUPABASE_KEY (anon)
```

Charger sur le portail cabinet :

```html
<script src="../js/services/config.staging.local.js"></script>
<script src="../js/services/config-env.js"></script>
```

Ou `?env=staging` si `config.staging.local.js` est servi comme `config.staging.js` (non commité).

## 6. Vérifier que la prod n’est pas touchée

Sur **eprtmdugiusidtbwzozj** uniquement (lecture) :

```bash
psql "$PROD_DATABASE_URL" -f staging/scripts/verify-prod-untouched.sql
```

Résultat attendu : **aucune ligne** retournée.

Via MCP : exécuter le contenu de `verify-prod-untouched.sql` — si 0 résultat, prod intacte.

## 7. Rollback staging

```bash
psql "$STAGING_DATABASE_URL" -f docs/migrations/20260725_cabinet_module_down.sql
```

---

**PROJECT REF staging** : à renseigner ici après création → `________________`

Voir aussi **`staging/STAGING_TEST_ACCOUNTS.md`** pour les comptes AGMA / Atlas et la procédure test isolation.
