# Rollback module cabinet — code et base de données

> **Objectif** : revenir à la version **sans cabinet** rapidement si les tests ou le déploiement échouent.

## Références figées (pre-cabinet)

| Élément | Valeur |
|---------|--------|
| **Tag Git** | `pre-cabinet-2026-07-26` |
| **Branche** | `main` (avant merge cabinet) |
| **Commit** | `87fc9cd` |
| **Backup prod** | `suro-manual.dump` (26 juil. 2026, ~382K, **sans cabinet**) |
| **Supabase prod** | `eprtmdugiusidtbwzozj` |

Gardez le fichier `suro-manual.dump` sur votre PC — c’est le filet de sécurité **base**.

---

## Méthode 1 — Rollback SQL (recommandé, ~30 secondes)

Enlève **uniquement** le module cabinet. Le reste de la base (contrats, KYC, paiements) reste intact.

```bash
export DATABASE_URL='postgresql://postgres.eprtmdugiusidtbwzozj:[MDP]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'

./staging/scripts/rollback-cabinet-db.sh
```

Vérification (doit afficher **0 ligne**) :

```bash
psql "$DATABASE_URL" -f staging/scripts/verify-prod-untouched.sql
```

**Ordre des fichiers `*_down.sql` :**

1. `20260727_cabinet_staff_admin_down.sql`
2. `20260727_operating_mode_guard_down.sql`
3. `20260727_cabinet_fixes_down.sql`
4. `20260726_operating_mode_down.sql`
5. `20260726_cabinet_rls_perf_down.sql`
6. `20260725_cabinet_module_down.sql`

---

## Méthode 2 — Restauration backup complet (plan B)

Si les `*_down.sql` échouent ou la base est incohérente.

```bash
export DATABASE_URL='postgresql://...'
./scripts/restore-suro-db.sh /chemin/vers/suro-manual.dump
```

⚠️ Écrase **toute** la base avec l’état du 26/07/2026. Perte des données créées après cette date.

**Prérequis** : `postgresql-client-17` (`pg_restore` version 17).

---

## Rollback code (front)

Redéploie Ops (et retire les fichiers cabinet) depuis la version **pre-cabinet**.

### Sur le VPS

```bash
cd /chemin/vers/Suro
git fetch origin
PRE_CABINET_REF=pre-cabinet-2026-07-26 ./staging/scripts/rollback-cabinet-code.sh --local
```

### Depuis votre machine (SSH)

```bash
PRE_CABINET_REF=pre-cabinet-2026-07-26 ./staging/scripts/rollback-cabinet-code.sh
```

**Fichiers retirés du web root :**

- `js/services/cabinet-portal.js`
- `cabinet-login.html`
- `cabinet/` (portail cabinet)

**Ops** est restauré depuis `main` / tag pre-cabinet (sans routes Cabinets ni mode d’exploitation cabinet).

---

## Rollback complet (base + code)

```bash
export DATABASE_URL='postgresql://...'

# VPS local
./staging/scripts/rollback-cabinet-full.sh --local

# Ou SQL seulement
./staging/scripts/rollback-cabinet-full.sh --db-only
```

---

## Par environnement

| Environnement | Rollback base | Rollback code |
|---------------|---------------|---------------|
| **Supabase prod** | `rollback-cabinet-db.sh` ou `restore-suro-db.sh` | Redéployer le site prod depuis `main` / tag pre-cabinet |
| **VPS staging** | Idem (DATABASE_URL = Postgres VPS) | `rollback-cabinet-code.sh --local` |

---

## Avant d’appliquer le cabinet (checklist)

- [ ] Backup `suro-manual.dump` téléchargé sur le PC
- [ ] Tag `pre-cabinet-2026-07-26` présent sur le repo
- [ ] Tester migrations sur **VPS** avant Supabase prod
- [ ] Savoir lancer `rollback-cabinet-db.sh` en urgence

---

## Créer un nouveau backup (prod actuelle)

```bash
export PGPASSWORD='...'
export DATABASE_URL='postgresql://postgres.eprtmdugiusidtbwzozj@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'

./scripts/backup-suro-db.sh
```

Région : **eu-central-1** (pas eu-west-3). Client : **pg_dump 17**.

---

## Voir aussi

- `docs/CABINET_MODULE.md` §6 — migrations et rollback
- `staging/scripts/test-migrations-cycle.sh` — preuve rollback testé (checklist #9)
