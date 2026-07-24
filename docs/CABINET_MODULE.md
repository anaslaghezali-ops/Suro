# Module Cabinet Partenaire — Note d'architecture (revue CTO)

> Branche : `cursor/cabinet-portal-module-adca`  
> Prod cloud : `eprtmdugiusidtbwzozj` — **module cabinet non déployé**  
> Staging cloud : projet `suro-staging` (à créer — voir `staging/STAGING_CLOUD_SETUP.md`)

---

## 1. Modèle métier

### SURO est-il une plateforme SaaS multi-tenant ?

**Oui.** SURO est une **plateforme technologique multi-tenant** qui orchestre la relation client et les workflows opérationnels. Chaque **cabinet partenaire** (tenant) dispose de :

- Ses propres **utilisateurs** (`suro_cabinet_users`)
- Ses propres **dossiers assignés** (`suro_broker_tasks`, `suro_claim_cabinet`)
- Ses propres **notifications** (`suro_cabinet_notifications`)

### Chaque cabinet gère-t-il SES clients/contrats ?

**Partiellement — par assignation, pas par propriété des données client.**

| Donnée | Propriétaire | Visibilité cabinet |
|--------|--------------|-------------------|
| Compte client (`auth.users`) | SURO / client | Non (le client ne voit jamais le cabinet) |
| Contrat (`insurance_applications`) | Plateforme SURO | Oui, **uniquement si** une tâche `suro_broker_tasks` lie le contrat à ce `cabinet_id` |
| Documents KYC | Plateforme SURO | Via la tâche / RPC (pas de SELECT direct cross-tenant) |
| Sinistre (`insurance_claims`) | Plateforme SURO | Via `suro_claim_cabinet.cabinet_id` |

Le cabinet **traite** les dossiers qui lui sont **assignés** ; il ne possède pas le parc client global SURO.

### Positionnement actuel vs BP

| Phase | Rôle SURO | Rôle cabinet |
|-------|-----------|--------------|
| **Aujourd'hui** | Partenaire technologique | Cabinet mandaté pour traitement opérationnel |
| **BP Y3** | + Courtier agréé (certains cabinets ou SURO) | Courtier détenteur du portefeuille |
| **BP Y5+** | Assureur / MGA | Émission directe |

---

## 2. Chaîne assurantielle

```
Client ──► SURO (marque, UX, relation) ──► Cabinet partenaire (traitement)
                                              │
                                              ▼
                                    Assureur agréé (Suro Assurance)
                                    • Porte le risque
                                    • Émet l'attestation / police
                                    • Encaisse la prime (aujourd'hui)
```

| Question | Réponse |
|----------|---------|
| Le cabinet est mandaté par qui ? | **SURO** (convention de distribution / partenariat technologique) |
| Qui porte le risque ? | **L'assureur agréé** (Suro Assurance) — pas SURO tech, pas le cabinet en phase 1 |
| Qui émet l'attestation ? | **L'assureur** ; le cabinet saisit `policy_number` + PDF via RPC `suro_cabinet_task_action('emettre_police')` |
| Qui encaisse la prime ? | **L'assureur / circuit CMI** au paiement client ; SURO perçoit une **commission** (partenaire techno) |

Le client ne contacte **jamais** le cabinet directement. Tous les messages passent par la marque **SURO**.

---

## 3. Rôles & permissions

### Matrice

| Capacité | super_admin SURO | admin SURO | operations SURO | admin_cabinet | responsable | gestionnaire |
|----------|------------------|------------|-----------------|---------------|-------------|--------------|
| Voir tous les cabinets (Ops) | ✓ | ✓ | ✓ | — | — | — |
| Superviser anomalies | ✓ | ✓ | ✓ | — | — | — |
| Créer cabinet | ✓ | ✓ | — | — | — | — |
| Gérer équipe cabinet | ✓ | ✓ | — | ✓ | ✓ | — |
| Traiter dossiers assignés | — | — | — | ✓ | ✓ | ✓ |
| Réassigner dossier | — | — | — | ✓ | ✓ | — |
| Actions sinistre (statut) | ✓ (Ops) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Voir dossiers autre cabinet | **Non** | **Non** | **Non** | **Non** | **Non** | **Non** |

**Réservé Super Admin SURO (non déléguable)** : suppression client, gestion staff SURO, privilèges Ops.

**Écriture** : aucun rôle n'écrit directement en SQL sur les tables cabinet — uniquement via RPC `SECURITY DEFINER`.

---

## 4. Round-robin — logique exacte

### Niveau 1 — Choix du cabinet (inter-tenant)

Fonction : `suro_cabinet_pick_cabinet()`

1. Sélectionner les cabinets `is_active = true`
2. Trier par `last_task_at NULLS FIRST`, puis `created_at`
3. Prendre le premier → mettre à jour `last_task_at = now()`

→ Distribution équitable entre AGMA, Atlas, etc.

### Niveau 2 — Choix du gestionnaire (intra-tenant)

Fonction : `suro_cabinet_pick_next(cabinet_id)`

1. Utilisateurs actifs du cabinet (`is_active = true`)
2. Rôles éligibles : `gestionnaire`, `responsable`, `admin_cabinet`
3. Trier par `last_assigned_at NULLS FIRST`, puis `created_at`
4. Prendre le premier → `last_assigned_at = now()`

→ Si **1 seul gestionnaire** dans le cabinet, il reçoit **100 %** des dossiers.

### Déclenchement

Trigger `suro_trg_kyc_task` sur `insurance_documents` INSERT :

1. Auto-check (`suro_cabinet_auto_check`) : 6 pièces KYC présentes, `storage_path` non vide
2. Si OK → `suro_cabinet_try_create_task(application_id)`
3. Création `suro_broker_tasks` + assignation cabinet + gestionnaire
4. Notification client SURO + notification gestionnaire(s)

---

## 5. Isolation multi-tenant (audit)

### 5.1 Tables tenant-scoped — présence de `cabinet_id`

| Table | `cabinet_id` | Notes |
|-------|--------------|-------|
| `suro_cabinets` | — (est le tenant) | PK `id` |
| `suro_cabinet_users` | **✓** | Mapping user → tenant |
| `suro_broker_tasks` | **✓** | Dossier souscription |
| `suro_task_events` | indirect via `task_id` → `suro_broker_tasks.cabinet_id` | |
| `suro_claim_cabinet` | **✓** | Sinistre assigné |
| `suro_claim_status_events` | indirect via `claim_id` → `suro_claim_cabinet` | |
| `suro_cabinet_notifications` | **✓** | + `user_id` |

Tables **hors périmètre tenant** (partagées plateforme) : `insurance_applications`, `insurance_claims`, `insurance_documents`, `suro_admins`, `suro_notifications` (client).

### 5.2 Résolution `suro_cabinet_context()`

```sql
SELECT cu.cabinet_id, cu.role, c.name
FROM suro_cabinet_users cu
JOIN suro_cabinets c ON c.id = cu.cabinet_id
WHERE cu.user_id = auth.uid()   -- JWT Supabase Auth, PAS user_metadata
  AND cu.is_active AND c.is_active
LIMIT 1;
```

- **Source d'identité** : `auth.uid()` du JWT
- **Mapping** : table `suro_cabinet_users` (jamais `user_metadata` — interdit pour autorisation)
- **Limite actuelle** : 1 cabinet actif par user (LIMIT 1) — suffisant pour v1

### 5.3 Policies RLS par table

Principe : **RLS activé + deny-by-default** ; SELECT uniquement via policies explicites ; écriture **interdite** (RPC `SECURITY DEFINER` uniquement).

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `suro_cabinets` | Staff OU membre du cabinet (`id IN (...)`) | ✗ | ✗ | ✗ |
| `suro_cabinet_users` | Staff OU même `cabinet_id` OU `user_id = self` | ✗ | ✗ | ✗ |
| `suro_broker_tasks` | Staff OU `cabinet_id` = cabinet appelant | ✗ | ✗ | ✗ |
| `suro_task_events` | Staff OU tâche appartient au cabinet appelant | ✗ | ✗ | ✗ |
| `suro_claim_cabinet` | Staff OU `cabinet_id` = cabinet appelant | ✗ | ✗ | ✗ |
| `suro_claim_status_events` | Staff OU sinistre du cabinet appelant | ✗ | ✗ | ✗ |
| `suro_cabinet_notifications` | `user_id = auth.uid()` OU staff | ✗ | ✗ | ✗ |

Fichiers : `20260725_cabinet_module.sql` + `20260725_cabinet_rls_hardening.sql`

### 5.4 Comptes test inter-tenant

Créés par `staging/scripts/seed-cabinets.sh` :

| Email | Cabinet | Test |
|-------|---------|------|
| `gestionnaire.agma@suro.ma` | AGMA | Ne doit voir **que** les tâches `cabinet_id` AGMA |
| `gestionnaire.atlas@suro.ma` | Atlas | Idem Atlas — **zéro** dossier AGMA |

**Procédure test fuite** :

1. Créer 1 tâche assignée à AGMA (via KYC complet sur contrat test)
2. Se connecter en Atlas → `suro_cabinet_list_tasks` doit retourner `[]`
3. Tentative SELECT direct `suro_broker_tasks` → RLS bloque les lignes AGMA

---

## 6. Migrations & rollback

| Fichier | Rôle |
|---------|------|
| `docs/migrations/20260725_cabinet_module.sql` | Schéma + RPC + RLS base |
| `docs/migrations/20260725_cabinet_rls_hardening.sql` | Durcissement audit CTO |
| `docs/migrations/20260725_cabinet_module_down.sql` | **Rollback complet** |

Ordre d'application : voir `staging/scripts/apply-migrations.sh`

---

## 7. Inputs revue CTO

### Branche

`cursor/cabinet-portal-module-adca`

### Fichiers ajoutés

```
docs/CABINET_MODULE.md
docs/migrations/20260725_cabinet_module.sql
docs/migrations/20260725_cabinet_rls_hardening.sql
docs/migrations/20260725_cabinet_module_down.sql
staging/STAGING_CLOUD_SETUP.md
staging/docker-compose.yml
staging/.env.example
staging/sql/00_base_schema_pre_cabinet.sql
staging/sql/seed_cabinets.sql
staging/scripts/apply-migrations.sh
staging/scripts/bootstrap.sh
staging/scripts/init-docker.sh
staging/scripts/seed-cabinets.sh
staging/scripts/verify-prod-untouched.sql
cabinet/                          (portail Preact)
cabinet-login.html
js/services/cabinet-portal.js
js/services/config-env.js
js/services/config.staging.js
js/services/config.staging.example.js
ops/src/routes/cabinets.js        (supervision Ops)
```

### Fichiers modifiés (additifs)

```
js/services/api.js                (+ SURO_CABINET)
ops/index.html                    (+ script cabinet-portal)
ops/src/router.js                 (+ route cabinets)
ops/src/lib/permissions.js        (+ nav Cabinets)
.gitignore                        (+ secrets staging)
```

### Résumé du diff

- **~1 500 lignes SQL** : 7 tables cabinet, 15+ RPC, triggers KYC/sinistre, RLS deny-by-default
- **Portail `/cabinet/`** : 4 écrans (dashboard, souscriptions, sinistres, équipe)
- **Ops** : écran supervision cabinets + anomalies
- **Aucune modification** du tunnel client, de `app/`, ni des migrations prod existantes
- **Rollback** : `20260725_cabinet_module_down.sql`

### Confirmation prod non touchée

Exécuter sur `eprtmdugiusidtbwzozj` :

```sql
-- staging/scripts/verify-prod-untouched.sql
```

Résultat attendu : **0 ligne** (tables `suro_cabinets`, `suro_broker_tasks`, `suro_cabinet_users` absentes).

---

## 8. Références

- Setup staging cloud : `staging/STAGING_CLOUD_SETUP.md`
- Rebuild Docker : `cd staging && ./scripts/init-docker.sh && ./scripts/bootstrap.sh`
