# SURO — Proposition d'architecture : Operations Portal

> Document de conception. **Aucune ligne de code produit n'est modifiée par ce document.**
> Rôles endossés : *Lead Product Designer · Senior Front-End Engineer · CTO*.
> Périmètre **exclu et gelé** : moteur de tarification (calcul des primes, règles, tables `insurance_pricing*`, RPC `suro_get_quote`, écrans de config tarifaire). Voir §11 « Améliorations futures ».

---

## 1. Résumé exécutif

Aujourd'hui l'admin et le client partagent **le même châssis** (`backoffice/css/dashboard.css`, même structure de sidebar, même moteur de rendu). L'admin n'est qu'un « client avec plus d'onglets ». Ce n'est pas un outil d'opérations.

Je propose de **séparer physiquement deux applications** — *Customer Portal* et *Operations Portal* — avec des layouts, des routes et une navigation distincts, tout en **conservant intacts** : la base Supabase, la couche `api.js`, les design tokens, et le portail client (qui fonctionne).

Le cœur de la proposition :

1. **Séparation stricte** des deux portails (§4).
2. **Un vrai modèle de rôles** (Super Admin / Admin / Opérations / Support) porté par la base et RLS, pas seulement par le masquage de menus (§5).
3. **Des compléments de schéma minimes et non-tarifaires** pour rendre possibles Documents (validation), Paiements (statuts) et Journal d'activité (§6).
4. **Un socle de composants** réutilisables (DataTable, SlideOver, Command Palette…) pour un outil orienté productivité façon Linear/Stripe (§7, §8).
5. **Une livraison par phases** pour dérisquer (§10).

Trois décisions structurantes vous sont demandées à la fin (§12) — je recommande une option pour chacune.

---

## 2. État des lieux (analyse de l'existant)

### 2.1 Stack & hébergement
| Élément | Constat |
|---|---|
| Hébergement | Statique (GitHub Pages). **Aucun build**, pas de `package.json` racine. |
| Données | Le front appelle **Supabase directement** (REST/Auth/Storage), protégé par **RLS**. |
| Rendu | **Vanilla JS**, classes (`AdminDashboard`, `CustomerDashboard`), **`innerHTML` par template strings**. |
| Routing | Navigation par hash (`navigateTo`) qui masque/affiche des `<div class="page">`. |
| `backend/` (Express) | **Non référencé** par le front. Code mort/legacy. |

### 2.2 Sécurité (rappel de l'audit précédent)
- Clé `anon` Supabase en dur dans `api.js` (publique par design, mais à faire tourner).
- Token JWT en `localStorage` (exposé en cas de XSS).
- Rendu `innerHTML` avec échappement `esc()` **non systématique** → surface XSS. Un outil interne qui manipule **toute la PII clients** relève la criticité.

### 2.3 Modèle de données actuel (public schema)
| Table | Rôle | Manque pour la mission |
|---|---|---|
| `insurance_applications` | Souscription **et** contrat (même ligne). `status`: nouvelle/active/expired/cancelled. | Pas de n° de police lisible, pas d'`assigned_to`. |
| `insurance_documents` | Docs client. | **Pas de `status`** (validation/refus impossible). |
| `suro_payments` *(ajoutée récemment)* | 1 ligne / paiement (initial + renouvellements). | **Pas de `status`** (réussi/en attente/échoué). |
| `insurance_claims` (+ `_files`, `_messages`) | Sinistres, PJ, messagerie. | OK. |
| `suro_admins(user_id)` | Accès admin **binaire**. | **Pas de rôles**. |
| `suro_events` + `suro_recent_events()` | Analytics **parcours client** (funnel). | Ce **n'est pas** un audit log d'actions staff. |
| `suro_notifications` | Cloche notifs (client/admin). | OK. |
| `suro_settings` | Contacts support (clé/valeur). | À étendre (§ Paramètres). |
| `insurance_pricing*`, `suro_get_quote` | **TARIFICATION — GELÉ.** | — |

### 2.4 Ce qui est réellement réutilisable
✅ **On garde** : Supabase + RLS, `api.js` (couche d'accès), `css/tokens.css` (palette teal, échelle typo/spacing), patterns UI (badges de statut, modale, timeline sinistre, fil de messages, cloche notifs), le **Customer Portal** tel quel.
♻️ **On refond** : la couche de rendu (`innerHTML` → composants), la navigation, le layout admin.
🗑️ **On archive** : `backend/` (Express legacy), `frontend/` et `backoffice/pages/` (vides).

---

## 3. Principes directeurs

1. **RLS-first** : toute permission est appliquée **côté base** (RLS + `SECURITY DEFINER`). Le masquage de menu est du confort, jamais une barrière de sécurité.
2. **Un seul écran par dossier** : le traitement d'une souscription ne doit pas faire naviguer entre 5 pages → **slide-over/drawer** avec onglets.
3. **Clavier d'abord** : Command Palette (Cmd/Ctrl-K), navigation `j/k`, raccourcis d'action.
4. **Moins de clics** : actions rapides inline, changement de statut sans quitter la liste, actions groupées.
5. **Zéro duplication de données** : *Souscription* et *Contrat* sont **la même entité** vue sous deux angles (filtres), pas deux stores.
6. **Design system unique** : les deux portails héritent des **mêmes tokens** ; seuls les layouts diffèrent.
7. **Évolutif par découplage** : `api/` (accès données) ↔ `stores/` (état) ↔ `components/` (UI) ↔ `routes/` (écrans). Chaque module d'écran est autonome.

---

## 4. Architecture cible — séparation des deux portails

### 4.1 Le problème du ncommage actuel
Le portail client vit sous `backoffice/customer/`. « Le client est dans le back-office » est un contresens qui va coûter cher en compréhension et en routing.

### 4.2 Séparation proposée
```
/                     → Site public + tunnel de souscription   (inchangé)
/app/        (NOUVEAU emplacement du Customer Portal)          → Espace CLIENT
/ops/        (NOUVEAU)                                         → OPERATIONS PORTAL
```
- **Customer Portal** : déplacé de `backoffice/customer/` → `/app/` (alias/redirect conservés pour ne pas casser les liens existants). **Non réécrit** dans cette mission.
- **Operations Portal** : nouveau, sous `/ops/`. Layout, navigation, routes **100 % distincts**.
- **Auth partagée** (Supabase) mais **gardes différentes** : `/app` exige une session ; `/ops` exige `is_suro_staff()` (voir §5) et redirige sinon vers `admin-login.html`.

> **Recommandation CTO** : garder l'URL historique `/backoffice/` en **redirection 301 → `/ops/`** le temps de la migration, puis la retirer.

---

## 5. Modèle de rôles & permissions (RBAC)

### 5.1 Constat
`suro_admins` est **binaire**. Les 4 rôles demandés (Super Admin, Admin, Opérations, Support) imposent un vrai modèle.

### 5.2 Schéma proposé (non destructif)
```sql
-- Enum de rôles
create type suro_role as enum ('super_admin','admin','operations','support');

-- On enrichit la table existante (pas de nouvelle table, migration douce)
alter table public.suro_admins
  add column role suro_role not null default 'admin';

-- Helpers RLS
create function public.suro_has_role(roles suro_role[]) returns boolean ...   -- membre ET rôle ∈ roles
create function public.is_suro_staff() returns boolean ...                     -- membre (tout rôle)
-- is_suro_admin() conservé = super_admin|admin (compat ascendante)
```

### 5.3 Matrice de permissions (proposition — à valider)
| Module / Action | Super Admin | Admin | Opérations | Support |
|---|:--:|:--:|:--:|:--:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Souscriptions — voir | ✅ | ✅ | ✅ | ✅ |
| Souscriptions — éditer / changer statut | ✅ | ✅ | ✅ | ❌ |
| Contrats — voir / télécharger | ✅ | ✅ | ✅ | ✅ |
| Documents — voir | ✅ | ✅ | ✅ | ✅ |
| Documents — valider / refuser | ✅ | ✅ | ✅ | ❌ |
| Paiements — voir | ✅ | ✅ | ✅ | ✅ (lecture) |
| Paiements — action (rembours./relance) | ✅ | ✅ | ❌ | ❌ |
| Sinistres — traiter / répondre | ✅ | ✅ | ✅ | ✅ |
| Clients — fiche 360 | ✅ | ✅ | ✅ | ✅ |
| Utilisateurs (staff) | ✅ | ❌ | ❌ | ❌ |
| Paramètres plateforme | ✅ | ✅ | ❌ | ❌ |
| **Tarification** *(gelé)* | 🔒 | 🔒 | ❌ | ❌ |
| Journal d'activité | ✅ | ✅ | lecture | ❌ |

> Le menu latéral est **généré depuis cette matrice** : chaque rôle ne voit que ses modules. Mais **chaque écran revérifie** via RLS.

---

## 6. Compléments de schéma (minimes, non-tarifaires)

Tous additifs, tous rétro-compatibles, **aucun** ne touche la tarification.

1. **Documents — validation**
   ```sql
   alter table insurance_documents
     add column status text not null default 'pending',   -- pending|approved|rejected
     add column reviewed_by uuid, add column reviewed_at timestamptz,
     add column reject_reason text;
   ```
2. **Paiements — statut** (le montant reste calculé comme aujourd'hui, hors périmètre)
   ```sql
   alter table suro_payments
     add column status text not null default 'succeeded', -- succeeded|pending|failed
     add column method text;
   ```
3. **Audit log staff** (distinct de `suro_events`)
   ```sql
   create table suro_audit_log(
     id uuid pk, actor_id uuid, actor_email text, action text,   -- login|create|update|validate|delete...
     entity text, entity_id uuid, changes jsonb, ip text, created_at timestamptz default now());
   ```
   Écrit par **triggers** sur les tables sensibles + appels explicites côté RPC de mutation.
4. **Workflow opérations** (optionnel mais fortement recommandé)
   ```sql
   alter table insurance_applications
     add column assigned_to uuid,            -- opérateur en charge du dossier
     add column policy_number text unique;   -- n° de police lisible (SURO-2026-000123)
   ```

---

## 7. Nouvelle navigation & description des écrans

Sidebar Operations (ordre proposé) : **Dashboard · Souscriptions · Clients · Contrats · Documents · Paiements · Sinistres · Utilisateurs · Paramètres · Journal**. (Sinistres n'était pas listé dans le brief mais existe déjà en base — je l'intègre, c'est une opération quotidienne.)

### 7.1 Dashboard (poste de pilotage)
- **KPIs** (cartes) : Souscriptions du jour / du mois · Contrats actifs · Paiements reçus (mois) · **Paiements en attente** · **Documents à vérifier** · Sinistres ouverts.
- **File « À traiter »** (le cœur) : dossiers nécessitant une action, triés par priorité — docs en attente, paiements en attente, sinistres non assignés. Chaque ligne = action en 1 clic + assignation.
- **Activité récente** : flux temps réel depuis l'audit log.
- *Objectif* : en 5 secondes, savoir **quoi traiter maintenant**.

### 7.2 Souscriptions (module principal)
- **Liste performante** : recherche instantanée (email, tél, immat, n° police), filtres (statut, couverture, période, opérateur assigné, « docs manquants »), tri multi-colonnes, pagination serveur (`Range`/`count=exact`), **actions rapides** inline (changer statut, assigner), **multi-sélection** + actions groupées.
- **Vues sauvegardées** : « Nouvelles », « En attente de paiement », « Mes dossiers », « Docs à vérifier ».
- **Fiche dossier = SlideOver à onglets** (sans quitter la liste) :
  `Client` · `Véhicule` · `Documents` · `Paiement` · `Contrat` · `Historique/Audit`.
  Tout le dossier consultable et actionnable depuis un seul écran.

### 7.3 Clients (fiche 360)
- Liste (recherche/tri) → **profil client** unifié : informations perso, **véhicules** (dérivés des souscriptions), souscriptions, contrats, paiements, documents, sinistres, historique. Retrouver un client en quelques secondes.

### 7.4 Contrats
- Vue = souscriptions **actives/expirées** (même entité, filtre `status`). Recherche, filtres (échéance, couverture), **téléchargement** du contrat, historique des renouvellements. *(Génération PDF du contrat = phase ultérieure.)*

### 7.5 Documents (bibliothèque)
- Tous les documents clients : **aperçu** (image/PDF inline), **téléchargement**, **valider / refuser** (avec motif), filtres (statut, type, client), recherche. File dédiée « à vérifier ».

### 7.6 Paiements
- Onglets **Réussis / En attente / Échoués**, filtres (période, type initial/renouvellement, méthode), recherche client. Actions (relance, remboursement) selon rôle. *(Le montant et le calcul restent inchangés — hors périmètre.)*

### 7.7 Sinistres
- Réutilise l'existant (timeline, PJ, messagerie) dans le nouveau châssis : liste + drawer de traitement, changement de statut, réponse au client.

### 7.8 Utilisateurs (staff)
- **Super Admin uniquement.** Lister/inviter/retirer des collaborateurs, **assigner un rôle**. Le menu de chacun s'adapte automatiquement (§5).

### 7.9 Paramètres
- Informations plateforme, **emails & modèles de communication**, préférences de notifications, contacts support (existant), paramètres généraux. *(La config tarifaire reste où elle est, inchangée.)*

### 7.10 Journal d'activité (Audit Log)
- Traçabilité complète : connexions, créations, modifications, validations, suppressions. Filtres (acteur, entité, action, période), recherche, export.

---

## 8. Socle de composants (design system)

| Composant | Statut | Usage |
|---|---|---|
| `DataTable` (search/sort/filter/paginate/multi-select) | **Nouveau** | Tous les modules liste |
| `SlideOver` / `Drawer` à onglets | **Nouveau** | Fiches dossier/client |
| `CommandPalette` (Cmd-K) | **Nouveau** | Recherche & actions globales |
| `StatCard`, `AttentionQueue` | **Nouveau** | Dashboard |
| `StatusBadge` | ♻️ Généralisé | Partout |
| `Timeline`, `MessageThread` | ♻️ Existants (sinistres) | Dossier, sinistres |
| `FilePreview` / `FileList` / `Uploader` | ♻️ Étendus | Documents |
| `Modal`, `Toast`, `SearchInput`, `FilterBar`, `Avatar` | Mix | Transverse |
| `RoleGuard` / `usePermissions` | **Nouveau** | Menus & écrans selon rôle |
| `NotificationBell` | ♻️ Existant | Header |

Principe : **aucun composant n'injecte de données via `innerHTML` non échappé** (corrige la dette XSS de l'audit).

---

## 9. Choix technique (recommandation CTO) — *à décider*

Le rendu `innerHTML`/vanilla ne passera pas à l'échelle d'un outil aussi riche (Command Palette, drawers, tables filtrables, RBAC, vues sauvegardées) et reste exposé au XSS. Trois voies :

| Option | Description | Pour | Contre | Verdict |
|---|---|---|---|---|
| **A — Vite + Svelte (ou Preact) + TypeScript** | SPA buildée, déployée **statique** (GitHub Pages inchangé). Router client, composants typés. | Scalable, maintenable, DX moderne, sûr (pas d'`innerHTML`) | Introduit un **build step** (nouveau dans ce repo) | ✅ **Recommandé** pour le Ops Portal |
| **B — Preact + htm via ESM (no-build)** | Composants sans bundler (import maps). | Pas de build, composants réutilisables | Écosystème/typage limité, perfs moyennes à grande échelle | Repli acceptable |
| **C — Vanilla refactoré + DOM builder sûr** | On garde vanilla mais on isole un mini-framework maison (router + composants + échappement). | Zéro nouvelle dépendance | On réinvente une roue ; plafond de complexité vite atteint | Déconseillé pour la cible visée |

**Ma recommandation** : **Option A** (Vite + Svelte + TS) **pour le seul Operations Portal**. Le Customer Portal reste tel quel (ne pas réécrire ce qui marche). Les deux partagent un paquet CSS de tokens. GitHub Pages continue de servir du statique — le build produit `/ops/` compilé.

> Si vous refusez tout build : **Option B**, avec la même arborescence conceptuelle.

---

## 10. Arborescence cible (Option A) & plan de livraison

### 10.1 Structure de dossiers
```
/ops/                         # Operations Portal (Vite app, build → statique)
  src/
    main.ts
    router.ts                 # routes /ops/dashboard, /souscriptions, ...
    lib/
      api/                    # réutilise/étend la logique de js/services/api.js (typée)
      auth/                   # gardes, session, is_suro_staff
      permissions.ts          # matrice rôles → capacités
    components/               # DataTable, SlideOver, CommandPalette, StatusBadge...
    stores/                   # état (souscriptions, filtres, vues sauvegardées)
    routes/                   # 1 dossier par écran (dashboard, subscriptions, clients...)
    styles/tokens.css         # importé depuis le design system partagé
/app/                         # Customer Portal (déplacé, inchangé)
/css/tokens.css               # source de vérité du design system (partagée)
```

### 10.2 Phases (incrémental, chaque phase livrable seule)
- **Phase 0 — Fondations** : RBAC en base (§5) + audit log + statuts documents/paiements (§6). Archivage `backend/`. *(Back-end d'abord : débloque tout le reste, testable sans UI.)*
- **Phase 1 — Socle Ops** : app `/ops/`, layout, navigation par rôle, garde `is_suro_staff`, `DataTable`, `SlideOver`, Command Palette.
- **Phase 2 — Souscriptions** : liste performante + fiche dossier mono-écran (le module qui crée le plus de valeur).
- **Phase 3 — Clients 360** + **Documents** (validation).
- **Phase 4 — Paiements** (statuts) + **Contrats** (+ téléchargement).
- **Phase 5 — Utilisateurs (RBAC UI)** + **Paramètres** + **Journal d'activité**.
- **Phase 6 — Sinistres** portés dans le nouveau châssis + polish (raccourcis, vues sauvegardées, bulk).

---

## 11. Améliorations futures (documentées, **non implémentées**)

### 11.1 Tarification (gelé — à traiter avec le courtier)
- Versionner la grille tarifaire (historiser les changements de prix, date d'effet).
- Séparer « devis » (quote) et « prime contractuelle » en entités distinctes avec traçabilité.
- Journaliser chaque calcul de prime (audit prix) pour litiges.
- Règles tarifaires en table éditable + simulateur admin.
> *Aucune de ces pistes n'est mise en œuvre ici. Le système actuel reste strictement identique.*

### 11.2 Hors tarification, opportunités
- Paiement réel (CMI/Stripe) → remplacer la simulation `suro_mark_application_paid`.
- Génération PDF des contrats + envoi email automatique.
- Rotation de la clé Supabase, passage du token en cookie httpOnly, CSP (cf. audit sécurité).
- Notifications email/SMS (modèles gérés dans Paramètres).

---

## 12. Décisions requises avant tout développement

1. **Stack Ops** : Option A (Vite+Svelte/Preact+TS, *recommandé*) / B (no-build) / C (vanilla refactoré) ?
2. **Séparation & routing** : déplacer le Customer Portal vers `/app` et placer l'Ops sur `/ops` (*recommandé*), ou conserver `/backoffice` ?
3. **RBAC** : valider les 4 rôles + la matrice §5.3 (ajustements possibles) ?
4. **Périmètre Phase 1** : démarre-t-on par Phase 0 (fondations base) puis Phase 2 (Souscriptions) comme premier module visible ?

Dès validation, je fournis le détail d'implémentation de la Phase 0 (migrations SQL RBAC/audit/statuts) puis j'attaque le socle Ops.

---

## 13. Décisions actées & avancement

### 13.1 Décisions validées (2026-07-20)
| Décision | Choix retenu |
|---|---|
| **Stack Ops** | **No-build** imposé (« je ne peux rien installer en local »). Best practice dans cette contrainte = **composants Preact + `htm`**, **vendored** (fichiers statiques dans le repo), chargés en **ESM + import maps**. Zéro build, zéro install, zéro dépendance CDN au runtime, vrais composants, fin du `innerHTML`/XSS. → *L'option A (Vite) est écartée car elle exige Node en local.* |
| **Routing** | Client → `/app`, Operations → `/ops`. Redirections conservées depuis les anciennes URL. |
| **RBAC** | 4 rôles (super_admin / admin / operations / support) + matrice §5.3. |
| **Ordre de build** | Phase 0 (fondations base) → puis module **Souscriptions**. |

### 13.2 Phase 0 — ✅ FAIT (base de données)
Migration `20260720_ops_phase0_foundations.sql` appliquée (voir `docs/migrations/`) :
- **RBAC** : enum `suro_role`, colonne `role` sur `suro_admins`, propriétaire promu `super_admin` ; helpers `is_suro_staff()`, `suro_current_role()`, `suro_has_role()` (et `is_suro_admin()` conservé = membre, non redéfini → aucune régression RLS).
- **Audit log** : table `suro_audit_log` + RLS (lecture super_admin/admin/operations, insert direct interdit), RPC `suro_log_action()` et `suro_audit_recent()` (réservées `authenticated`, garde interne staff).
- **Documents** : colonnes `status` / `reviewed_by` / `reviewed_at` / `reject_reason`.
- **Paiements** : colonnes `status` / `method`.
- **Souscriptions** : colonnes `assigned_to`, `policy_number` (unique si présent).
- **Advisors sécurité** vérifiés : pas de régression ; les warnings `security_definer_function_executable` suivent le pattern déjà présent sur tous les RPC du projet et chaque fonction est protégée par un garde interne.

### 13.3 Phase 1 — ✅ FAIT (socle Ops + séparation des portails)
- **No-build** : Preact + hooks + htm **vendorisés** (`ops/vendor/preact-htm-standalone.module.js`, 13 KB) + `importmap`.
- **Socle** : layout `/ops`, router hash, garde `is_suro_staff`, menu piloté par `suro_current_role()`, composants `DataTable` / `SlideOver` / `Badge` / `Toast`, hook `useAsync`.
- **Écrans** : Dashboard (KPIs + file « à traiter » + activité), **Souscriptions** (liste + fiche dossier slide-over éditable), Clients / Contrats / Paiements / Sinistres / Journal (fonctionnels), Documents / Utilisateurs / Paramètres (stubs Phases 3/5).
- **Séparation** : portail client déplacé `backoffice/customer/` → **`/app/`** (autonome, CSS copié), redirection depuis l'ancienne URL. `admin-login` vérifie désormais `is_suro_staff` et redirige vers **`/ops/`**. Tunnel/login/signup repointés vers `/app/`.
- **Tarification préservée** : lien vers l'admin legacy (`/backoffice/#settings`) depuis le stub Paramètres ; aucun écran tarifaire touché.
- **Vérifié au navigateur** (Chromium headless, API mockée) : `/ops` 8/8, `/app` 5/5, 0 erreur (hors avatar externe bloqué par le bac à sable).

### 13.4bis Phase 3 — ✅ FAIT (Documents)
- RPC `suro_review_document(id, status, reason)` (SECURITY DEFINER) : contrôle de rôle (super_admin/admin/operations), maj `status`/`reviewed_by`/`reviewed_at`/`reject_reason`, **audit** + **notification client** automatiques.
- API : `getDocumentBlobUrl()` (aperçu inline via blob authentifié) côté couche partagée ; `allDocuments`/`reviewDocument`/`documentBlobUrl`/`downloadDocument` côté Ops.
- Écran **Documents** : bibliothèque (recherche/filtre par statut), slide-over avec **aperçu image/PDF**, téléchargement, **Valider / Refuser** (motif obligatoire au refus).
- Vérifié au navigateur : 11/11, 0 erreur.

### 13.4ter Phase 5 (Utilisateurs) — ✅ FAIT
- RPC `suro_list_staff()` / `suro_set_staff(email, role)` / `suro_remove_staff(email)` (SECURITY DEFINER, réservés super_admin), **audit** + **garde anti-verrouillage** (impossible de retirer/rétrograder le dernier super_admin). Anciennes fonctions admin conservées pour le legacy.
- Écran **Utilisateurs** (super_admin uniquement) : ajout/mise à jour d'un collaborateur (email + rôle), liste staff avec changement de rôle inline et retrait. Vérifié navigateur : 14/14.

### 13.4quater Paramètres — ✅ FAIT
- Écran **Paramètres** : infos plateforme, **contacts support éditables** (réutilise `suro_settings` via `getSettings`/`adminUpdateSetting`, audit à l'enregistrement), placeholder modèles de communication, lien vers la config tarifaire legacy (préservée). Édition gated `settings.edit` (super_admin/admin). Vérifié navigateur : 17/17.
- **Tous les modules de navigation sont désormais fonctionnels** (plus aucun stub).

### 13.5 Prochaines étapes proposées
- **Polish** : Command Palette (Cmd-K), vues sauvegardées, actions groupées.
- **Sinistres v2** : porter timeline + messagerie + PJ dans le châssis `/ops` (actuellement liste seule).
- **Durcissement RLS** : restreindre l'écriture `suro_settings` aux rôles super_admin/admin en base (aujourd'hui la policy s'appuie sur `is_suro_admin()` = tout membre) — cohérence avec la matrice.
- **Cache-busting modules** : ajouter un stamp de version aux imports ESM `/ops` (ou en-têtes) pour éviter le hard-refresh lors des mises à jour.
- **Polish** : Command Palette (Cmd-K), vues sauvegardées, actions groupées.
- **Cleanup** : retirer l'admin legacy `/backoffice` une fois la config tarifaire reprise (avec le courtier).
