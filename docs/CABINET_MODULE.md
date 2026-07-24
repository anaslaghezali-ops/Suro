# Module Cabinet Partenaire — Note d'architecture (revue CTO)

> Branche : `cursor/cabinet-portal-module-adca`  
> Prod cloud : `eprtmdugiusidtbwzozj` — **module cabinet non déployé**  
> Staging cloud : projet `suro-staging` (à créer — voir `staging/STAGING_CLOUD_SETUP.md`)

---

## 1. Modèle métier

### Deux modes d'exploitation (une plateforme)

| Mode | Clé `suro_settings` | Comportement post-KYC |
|------|---------------------|------------------------|
| **SURO-intermédiaire** | `operating_mode = intermediaire` (défaut) | Round-robin cabinets → `suro_broker_tasks` |
| **SURO-courtier** | `operating_mode = courtier` | File Ops interne → notification admin, traitement via écrans Documents / Souscriptions |

Fonctions : `suro_get_operating_mode()`, `suro_courtier_enqueue_kyc_review()`, `suro_switch_operating_mode()`.  
Migrations : `20260726_operating_mode.sql`, `20260727_cabinet_fixes.sql`.  
Bascule : Ops → Paramètres → Mode d'exploitation via RPC `suro_switch_operating_mode` (garde-fous intégrés).

Le portail `/cabinet/` et l'écran Ops « Cabinets » sont masqués en mode courtier.

### Bascule de mode (`suro_switch_operating_mode`)

**Réservé** `super_admin` / `admin`. Utiliser la RPC — pas de PATCH direct sur `suro_settings.operating_mode`.

| Bascule vers | Bloquée si |
|--------------|------------|
| **courtier** | Dossiers `suro_broker_tasks` ouverts (≠ `police_emise`/`refuse`/`cloture`) OU sinistres `suro_claim_cabinet` non clôturés |
| **intermediaire** | Notifications Ops `kyc_ready_for_ops` / `claim_ready_for_ops` encore en attente |

**Runbook** : (1) lire les compteurs RPC → (2) clôturer le travail en cours → (3) `suro_switch_operating_mode('…')` → (4) test KYC/sinistre.

**Messages client (M3)** : texte libre cabinet → `suro_task_events` / `suro_claim_status_events` uniquement ; le client reçoit des **templates SURO fixes**.

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

## 2. Chaîne assurantielle et conformité ACAPS

### « Suro Assurance » est-elle agréée ACAPS ?

**Non — pas dans le périmètre actuel du module.**

| Entité | Statut réglementaire (v1) | Rôle |
|--------|---------------------------|------|
| **SURO** (plateforme / marque client) | **Intermédiaire technologique** — pas d’agrément courtage ni assurance | UX, relation client, orchestration des workflows |
| **Cabinet partenaire** (AGMA, Atlas…) | **Courtier / intermédiaire** — agrément ACAPS **à confirmer par convention** (chaque cabinet est responsable de son statut) | Traitement opérationnel des dossiers assignés |
| **Assureur agréé ACAPS** (tiers conventionné) | **Seul porteur de risque habilité** | Émission de l’attestation / police, souscription, encaissement de la prime |

**« Suro Assurance »** est la **marque commerciale** visible par le client. Ce n’est **pas** le nom d’une entreprise d’assurance agréée ACAPS tant qu’un agrément distinct n’est pas obtenu et documenté.

**Assureur porteur de risque (v1)** : compagnie d’assurance **agréée ACAPS** partenaire de distribution, désignée dans la convention tripartite (assureur ↔ cabinet/SURO ↔ client). Le nom exact de l’assureur agréé doit figurer sur l’attestation émise et dans les CGV — **à renseigner contractuellement** (placeholder doc : *« Assureur agréé ACAPS — voir convention de distribution »*).

### Qui émet l’attestation et qui encaisse la prime ?

| Acteur | Émission attestation / police | Encaissement prime |
|--------|------------------------------|-------------------|
| SURO (tech) | **Non** | **Non** — commission de distribution uniquement |
| Cabinet partenaire | **Non** — saisit le `policy_number` et le PDF **déjà émis par l’assureur** via RPC `emettre_police` | **Non** |
| **Assureur agréé ACAPS** | **Oui** — seul émetteur légal de la police / attestation | **Oui** — via circuit CMI / compte assureur |

Le RPC `suro_cabinet_task_action('emettre_police')` **enregistre** dans le référentiel SURO une police **déjà émise par l'assureur agréé** (`policy_number` + PDF attestant). Ce n'est **pas** une émission d'assurance par SURO ni par le cabinet.

> **En attente de confirmation juridique** : identité exacte de l'assureur agréé ACAPS porteur de risque (dénomination sociale, agrément, convention de distribution). Tant que non tranché, utiliser le placeholder contractuel ci-dessus sur les attestations et CGV.

### Schéma réglementaire cible

```
Client
  │
  ▼
SURO (marque, UX, relation client)          ← intermédiaire technologique
  │
  ▼
Cabinet partenaire (traitement dossier)     ← courtier / mandataire (si agréé)
  │
  ▼
Assureur agréé ACAPS                        ← porte le risque, émet, encaisse
```

| Question | Réponse |
|----------|---------|
| Le cabinet est mandaté par qui ? | **SURO** (convention de distribution / partenariat technologique) |
| Qui porte le risque ? | **L’assureur agréé ACAPS** — jamais SURO tech, jamais le cabinet seul |
| Qui émet l’attestation ? | **L’assureur agréé** ; le cabinet **enregistre** `policy_number` + PDF via RPC |
| Qui encaisse la prime ? | **L’assureur agréé** (circuit CMI → compte assureur) ; SURO = commission |
| Le client contacte le cabinet ? | **Non** — relation exclusivement via la marque **SURO** |

### Évolution selon agrément ACAPS (roadmap)

| Phase | SURO | Cabinet | Assureur agréé |
|-------|------|---------|----------------|
| **v1 (module actuel)** | Tech + marque | Traitement mandaté | Porteur de risque + émission + encaissement |
| **BP Y3** | + courtier agréé possible | Courtier détenteur portefeuille | Partenaire ou co-émission selon structure |
| **BP Y5+** | Assureur / MGA si agrément obtenu | Distribution | Émission directe possible |

Le flag `operating_mode` (`intermediaire` / `courtier`) permet de basculer le **canal de traitement** sans changer la règle : **l’émission et l’encaissement restent rattachés à l’assureur agréé** tant que SURO n’est pas lui-même agréé assureur.

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
2. Si OK → selon `suro_get_operating_mode()` :
   - **intermediaire** : `suro_cabinet_try_create_task(application_id)` → tâche cabinet + round-robin (si 0 cabinet actif → notif Ops `cabinet_unassigned`, pas d'exception)
   - **courtier** : `suro_courtier_enqueue_kyc_review(application_id)` → notification Ops (`kyc_ready_for_ops`) + client
3. Trigger encapsulé : erreur cabinet **n'annule jamais** l'INSERT `insurance_documents`

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

### 5.2 Résolution `suro_cabinet_context()` — décision multi-cabinet

**Décision v1 : un seul cabinet actif par utilisateur** (contrainte d’unicité partielle).

```sql
CREATE UNIQUE INDEX suro_cabinet_users_one_active_per_user_idx
  ON suro_cabinet_users (user_id) WHERE is_active = true;
```

| Option évaluée | Choix | Motif |
|----------------|-------|-------|
| Paramètre `p_cabinet_id` dans `suro_cabinet_context()` | **Non retenu** | Complexifie le front, risque de sélection cross-tenant |
| **1 cabinet actif / user** (index unique partiel) | **Retenu** | Aligné RLS, pas d’ambiguïté tenant, suffisant v1 |

```sql
SELECT cu.cabinet_id, cu.role, c.name
FROM suro_cabinet_users cu
JOIN suro_cabinets c ON c.id = cu.cabinet_id
WHERE cu.user_id = (select auth.uid())   -- JWT Supabase Auth, PAS user_metadata
  AND cu.is_active AND c.is_active
LIMIT 1;
```

- **Source d'identité** : `(select auth.uid())` du JWT
- **Mapping** : table `suro_cabinet_users` (jamais `user_metadata`)
- **Changement de cabinet** : `suro_cabinet_add_user` désactive les autres affiliations actives avant d’activer la nouvelle
- **Helper RLS** : `user_cabinet_ids()` — `SECURITY DEFINER`, retourne les `cabinet_id` actifs de l’appelant (v1 : 0 ou 1)

Migration : `20260726_cabinet_rls_perf.sql`

### 5.3 Policies RLS par table

Principe : **RLS activé + deny-by-default** ; SELECT uniquement via policies explicites ; écriture **interdite** (RPC `SECURITY DEFINER` uniquement).

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `suro_cabinets` | Staff OU `id IN (SELECT user_cabinet_ids())` | ✗ | ✗ | ✗ |
| `suro_cabinet_users` | Staff OU `cabinet_id IN user_cabinet_ids()` OU `user_id = self` | ✗ | ✗ | ✗ |
| `suro_broker_tasks` | Staff OU `cabinet_id IN user_cabinet_ids()` | ✗ | ✗ | ✗ |
| `suro_task_events` | Staff OU tâche `cabinet_id IN user_cabinet_ids()` | ✗ | ✗ | ✗ |
| `suro_claim_cabinet` | Staff OU `cabinet_id IN user_cabinet_ids()` | ✗ | ✗ | ✗ |
| `suro_claim_status_events` | Staff OU sinistre du cabinet via `user_cabinet_ids()` | ✗ | ✗ | ✗ |
| `suro_cabinet_notifications` | `user_id = (select auth.uid())` OU staff | ✗ | ✗ | ✗ |

Fichiers : `20260725_cabinet_module.sql` + `20260725_cabinet_rls_hardening.sql` + `20260726_cabinet_rls_perf.sql`

**Perf RLS** : toutes les policies cabinet utilisent `(select auth.uid())` et `user_cabinet_ids()` au lieu de sous-selects inline sur `suro_cabinet_users`.

### 5.4 Comptes test inter-tenant

Créés par `staging/scripts/seed-cabinets.sh` — détails et mots de passe : `staging/STAGING_TEST_ACCOUNTS.md`

| Email | Cabinet | Rôle | Test |
|-------|---------|------|------|
| `gestionnaire.agma@suro.ma` | AGMA | gestionnaire | Ne doit voir **que** les tâches AGMA |
| `gestionnaire.atlas@suro.ma` | Atlas | gestionnaire | Zéro dossier AGMA |
| `admin.agma@suro.ma` | AGMA | admin_cabinet | Gestion équipe AGMA |
| `admin.atlas@suro.ma` | Atlas | admin_cabinet | Gestion équipe Atlas |

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
| `docs/migrations/20260726_operating_mode.sql` | Flag intermediaire / courtier + trigger branché |
| `docs/migrations/20260726_operating_mode_down.sql` | Rollback mode d'exploitation |
| `docs/migrations/20260726_cabinet_rls_perf.sql` | RLS perf + `user_cabinet_ids()` + unicité 1 cabinet/user |
| `docs/migrations/20260726_cabinet_rls_perf_down.sql` | Rollback RLS perf |
| `docs/migrations/20260727_cabinet_fixes.sql` | C1/M1/M2/M3 — audit CTO |
| `docs/migrations/20260727_cabinet_fixes_down.sql` | Rollback correctifs audit |
| `docs/migrations/20260727_cabinet_staff_admin.sql` | RPC activation cabinet (Ops UI) |
| `docs/migrations/20260727_cabinet_staff_admin_down.sql` | Rollback staff admin |

Ordre d'application : voir `staging/scripts/apply-migrations.sh`

Ordre de rollback (staging) :

1. `20260727_cabinet_staff_admin_down.sql` (si appliqué)
2. `20260727_cabinet_fixes_down.sql`
3. `20260726_operating_mode_down.sql`
4. `20260726_cabinet_rls_perf_down.sql`
5. `20260725_cabinet_module_down.sql`

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

## 9. Périmètre de la branche

Le diff `cursor/cabinet-portal-module-adca` vs `Cursor` ne contient **que** le module cabinet (SQL, portail `/cabinet/`, supervision Ops, staging, config).

**Hors périmètre** (présents sur `Cursor` mais non modifiés par cette branche) : pitch-deck, `vehicle_brands`, mockups, changements tunnel client.

---

## 10. Références

- Setup staging cloud : `staging/STAGING_CLOUD_SETUP.md`
- Rebuild Docker : `cd staging && ./scripts/init-docker.sh && ./scripts/bootstrap.sh`
