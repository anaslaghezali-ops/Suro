# CABINET — Rapport de tests Go/No-Go

> **Branche** : `cursor/cabinet-portal-module-adca`  
> **Date** : 2026-07-24 (UTC)  
> **Environnement d'exécution** : PostgreSQL 16 local + harness `staging/sql/test_harness_minimal.sql`  
> **Prod cloud** : `eprtmdugiusidtbwzozj` — **lecture seule uniquement** (item #8)

---

## Références staging

| Élément | Valeur |
|---------|--------|
| **PROJECT REF staging cloud** | *(à créer — dashboard Supabase → projet `suro-staging`)* |
| **VPS self-hosted** | `http://185.98.136.100` |
| **Portail cabinet** | `/cabinet-login.html` |
| **Ops** | `/ops/` |

### Comptes de test inter-tenant

| Email | Mot de passe | Cabinet | Rôle | UUID test harness |
|-------|--------------|---------|------|-------------------|
| `gestionnaire.agma@suro.ma` | `StagingCabinet2026!` | AGMA | gestionnaire | `a1111111-1111-1111-1111-111111111101` |
| `gestionnaire.atlas@suro.ma` | `StagingCabinet2026!` | Atlas | gestionnaire | `a1111111-1111-1111-1111-111111111102` |
| `gestionnaire2.agma@suro.ma` | *(harness uniquement)* | AGMA | gestionnaire | `a1111111-1111-1111-1111-111111111103` |
| `admin.agma@suro.ma` | `StagingCabinet2026!` | AGMA | admin_cabinet | — |
| `admin.atlas@suro.ma` | `StagingCabinet2026!` | Atlas | admin_cabinet | — |

> Mot de passe staging = variable `STAGING_SEED_PASSWORD` (non commitée). Voir `staging/STAGING_TEST_ACCOUNTS.md`.

### Rejouer tous les tests

```bash
# Local (PG16 + harness)
./staging/scripts/run-all-cabinet-tests.sh

# Ou individuellement sur staging :
export DATABASE_URL="postgresql://..."   # staging uniquement
USE_TEST_HARNESS=1 ./staging/scripts/apply-migrations.sh
./staging/scripts/seed-cabinets.sh
cd staging/scripts && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f test-tenant-isolation.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f test-round-robin.sql
./staging/scripts/test-migrations-cycle.sh

# Prod (lecture seule)
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -f staging/scripts/verify-prod-untouched.sql
```

---

## § isolation — Checklist #5 (multi-tenant)

**Script** : `staging/scripts/test-tenant-isolation.sql`  
**Statut** : **PASS**

Impersonation JWT via `test.set_auth(uuid)` → `SET LOCAL ROLE authenticated` + `request.jwt.claim.sub`.

### Assertions (gestionnaire.agma)

| Assertion | Résultat |
|-----------|----------|
| `suro_cabinet_list_tasks` — 0 dossier Atlas | OK |
| `SELECT count(*) FROM suro_broker_tasks WHERE cabinet_id = Atlas` — 0 (RLS) | OK |
| `suro_cabinet_task_action(task_atlas, 'valider')` → `Accès refusé` | OK |
| `suro_cabinet_claim_set_status(claim_atlas, 'cloture')` → `Accès refusé` | OK |

### Assertions miroir (gestionnaire.atlas)

| Assertion | Résultat |
|-----------|----------|
| `suro_cabinet_list_tasks` — 0 dossier AGMA | OK |
| `SELECT count(*) FROM suro_broker_tasks WHERE cabinet_id = AGMA` — 0 (RLS) | OK |
| `suro_cabinet_task_action(task_agma, 'valider')` → `Accès refusé` | OK |
| `suro_cabinet_claim_set_status(claim_agma, 'cloture')` → `Accès refusé` | OK |

### Sortie d'exécution

```
=== TEST ISOLATION MULTI-TENANT ===
...
NOTICE:  OK gestionnaire.agma — 0 fuite Atlas (list_tasks, RLS, task_action, claim_set_status)
DO
NOTICE:  OK gestionnaire.atlas — 0 fuite AGMA (list_tasks, RLS, task_action, claim_set_status)
DO
=== ISOLATION MULTI-TENANT : PASS ===
```

---

## § rollback — Checklist #9 (rollback + idempotence)

**Script** : `staging/scripts/test-migrations-cycle.sh`  
**Statut** : **PASS**

Cycle sur base jetable :
1. Apply toutes les migrations (`apply-migrations.sh` + harness)
2. `_down.sql` ordre inverse : `staff_admin` → `fixes` → `operating_mode` → `rls_perf` → `cabinet_module`
3. `verify-prod-untouched.sql` → 0 ligne
4. Re-apply migrations cabinet (6 fichiers)
5. Smoke : `suro_cabinets` = 2, `suro_get_operating_mode` présent

### Extrait log (phases 3–5)

```
--- Phase 3 : verify cabinet absent ---
OK — 0 objet cabinet (verify-prod-untouched)

--- Phase 4 : re-apply migrations cabinet (idempotence) ---
==> 20260725_cabinet_module.sql
==> 20260725_cabinet_rls_hardening.sql
==> 20260726_cabinet_rls_perf.sql
==> 20260726_operating_mode.sql
==> 20260727_cabinet_fixes.sql
==> 20260727_cabinet_staff_admin.sql

--- Phase 5 : smoke check post re-apply ---
 cabinets
----------
        2

         proname
-------------------------
 suro_get_operating_mode

=== CYCLE MIGRATIONS : PASS ===
```

Log complet régénérable : `/tmp/cabinet-migrations-cycle.log` (via `test-migrations-cycle.sh`).

---

## § prod-untouched — Checklist #8

**Script** : `staging/scripts/verify-prod-untouched.sql`  
**Cible** : `eprtmdugiusidtbwzozj`  
**Statut** : **EN ATTENTE — exécution Lead Architect**

L'agent cloud n'a pas accès à `PROD_DATABASE_URL` (MCP Supabase non authentifié).  
**Aucune écriture prod** n'a été effectuée depuis cet environnement.

### Commande à exécuter (lecture seule)

```bash
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -f staging/scripts/verify-prod-untouched.sql
```

**Résultat attendu** : 0 ligne (7 tables + 5 fonctions cabinet absentes).

### Objets vérifiés

**Tables** : `suro_cabinets`, `suro_cabinet_users`, `suro_broker_tasks`, `suro_task_events`, `suro_claim_cabinet`, `suro_claim_status_events`, `suro_cabinet_notifications`

**Fonctions** : `suro_cabinet_context`, `suro_cabinet_try_create_task`, `user_cabinet_ids`, `suro_get_operating_mode`, `suro_switch_operating_mode`

### Sortie agent (2026-07-24)

```
SKIP: PROD_DATABASE_URL non défini — exécution prod à faire par le Lead Architect
```

---

## § non-régression — Flux existants + tests automatisés

**Statut** : **PASS** (automatisé) / **checklist manuelle staging** (à valider sur VPS)

### Tests automatisés (`npm run check:js && npm test`)

```
47/47 fichiers sans erreur de syntaxe

5/5 passed   (privileges.matrix)
50/50 passed (api.assembly)
```

### Checklist manuelle — mode `intermediaire` (staging VPS)

| Flux | Procédure | Attendu |
|------|-----------|---------|
| Tunnel client (devis) | Créer devis → paiement → KYC 6 pièces | Dossier actif, tâche cabinet créée (round-robin) |
| `/app` espace client | Contrats, documents, paiements, sinistres | Données filtrées par email client |
| Ops — documents | Review approve/reject | Notification client, audit log |
| Ops — souscriptions | Liste, filtres, édition | Pas de régression RLS staff |
| Ops — paiements | Liste paginée | Filtres `status`, `customer_email` OK |
| Ops — sinistres | CRUD + messages | Flux existant intact |
| Ops — Cabinets | Nav visible, overview | Données cabinet uniquement |

### Checklist manuelle — mode `courtier`

| Flux | Procédure | Attendu |
|------|-----------|---------|
| Bascule mode | Ops → Paramètres → `courtier` | `suro_switch_operating_mode('courtier')` |
| KYC complet | 6 pièces déposées | Notif Ops `kyc_ready_for_ops`, **pas** de tâche cabinet |
| Nav Cabinets | Ops sidebar | Masquée en mode courtier |
| Sinistre | Nouveau sinistre client | Notif Ops `claim_ready_for_ops`, pas `suro_claim_cabinet` |
| Tunnel + `/app` | Idem intermediaire | Inchangé |

---

## § round-robin — Edge cases

**Script** : `staging/scripts/test-round-robin.sql`  
**Statut** : **PASS**

| Scénario | Vérification | Résultat |
|----------|--------------|----------|
| **Inter-cabinets** | 2 dossiers KYC complets → 2 `cabinet_id` différents | OK (round-robin `last_task_at`) |
| **Intra-cabinet** | 2 dossiers même cabinet AGMA → 2 `assigned_to` différents | OK (`…1101` + `…1103`) |
| **0 gestionnaire** | Cabinet Atlas sans gestionnaire actif → `assigned_to IS NULL`, pas d'erreur | OK |
| **0 cabinet actif (C1)** | KYC complet, tous cabinets inactifs → pas de tâche, notif `cabinet_unassigned` | OK |

### Sortie d'exécution

```
NOTICE:  OK inter-cabinets — app1→cabinet <uuid-A>, app2→cabinet <uuid-B>
NOTICE:  OK intra-cabinet AGMA — gest1=a1111111-1111-1111-1111-111111111103, gest2=a1111111-1111-1111-1111-111111111101
NOTICE:  OK 0 gestionnaire — tâche créée sans erreur, assigned_to=null si applicable
NOTICE:  OK C1 — 0 cabinet actif: pas de tâche, notif Ops cabinet_unassigned créée
=== ROUND-ROBIN : PASS ===
```

---

## Synthèse Go/No-Go

| Item checklist | Statut | Preuve |
|----------------|--------|--------|
| #5 Isolation multi-tenant | **PASS** | `test-tenant-isolation.sql` |
| #8 Prod non touchée | **PENDING** | `verify-prod-untouched.sql` — exécution Lead Architect |
| #9 Rollback + idempotence | **PASS** | `test-migrations-cycle.sh` |
| Non-régression | **PASS** (auto) | `npm run check:js && npm test` |
| Round-robin edge cases | **PASS** | `test-round-robin.sql` |

**Go conditionnel** : valider item #8 sur prod (`eprtmdugiusidtbwzozj`) + checklist manuelle staging VPS avant merge prod.
