# SURO — Programme de durcissement sécurité (avant migration VPS)

But : passer en revue **tous les bugs et faiblesses de sécurité** possibles, un peu
chaque jour, pour aborder la migration VPS sereinement. Chaque étape est concrète,
vérifiable, et cochable. On avance **une case à la fois** — pas besoin de tout faire d'un coup.

- **Méthode** : pour chaque item → on comprend, on corrige (migration SQL ou patch code),
  on **vérifie**, on coche. Toute correction base = un fichier dans `docs/migrations/`.
- **Rappel d'or** : ne jamais désactiver la vérif TLS, ne jamais committer de clé
  `service_role`, toujours tester en base avant/après.
- **Légende** : 🔴 critique · 🟠 important · 🟡 hygiène · ⚪ info/vérif

État de départ (audit du 2026-07-22) : 78 alertes Supabase (73 = fonctions
SECURITY DEFINER exécutables par anon, 4 policies « always true », 1 auth), secrets
propres, XSS legacy à auditer.

---

## Décisions à trancher (bientôt)
- [ ] 🟡 **Sort du dossier `backend/` (Express)** — à décider demain avec le reste.
  Constat (audit SQLi du 2026-07-22) : il pointe par défaut vers un **autre** projet Supabase
  (`yfrqiqlyvlllhttfrzhs`, pas `eprtmdugiusidtbwzozj`) et le site actuel est **statique + Supabase**
  (il ne l'utilise pas). Trois options :
  1. **Le supprimer** (code mort → moins de surface, moins de confusion) — recommandé si confirmé inutilisé ;
  2. **Le garder** tel quel (au cas où) — mais alors le durcir (Jour 12 : CORS, helmet, validation, `npm audit`) ;
  3. **Le migrer/rebrancher** sur le bon projet s'il doit servir sur le VPS.
  → Décision requise **avant le Jour 12** ; l'action concrète (suppression ou durcissement) s'y fait.

---

## Jour 0 — Base de référence & filet de sécurité — ✅ FAIT (2026-07-22)
- [ ] ⚪ **Backups** : vérifier que les sauvegardes auto Supabase sont actives (Database → Backups),
  sinon export SQL manuel avant chaque phase risquée. *(action côté dashboard — voir baseline § 5)*
- [x] ⚪ **Baseline figée** : RLS par table + toutes les policies + droits d'exécution des fonctions
  `SECURITY DEFINER` + résumé des advisors → `docs/security-baseline-2026-07-22.md`.
- [x] ⚪ Branche `Cursor` propre, migrations versionnées dans `docs/migrations/`, 1 correctif = 1 commit + 1 migration.
- **Vérif** : ✅ on a une référence figée pour diff/rollback ; il reste à confirmer les backups côté dashboard.

---

## PHASE A — Base de données & RLS

### Jour 1 — 🔴 Verrouiller le paiement (le trou n°1) — ✅ FAIT (2026-07-22)
Aujourd'hui `suro_mark_application_paid(app_id)` passe **n'importe quel** devis `nouvelle`
à `active`, **sans vérifier le propriétaire ni un vrai paiement**. N'importe qui connaissant
un `id` peut activer un contrat sans payer.
- [x] 🔴 Modèle retenu : paiement **simulé + vérif propriétaire** ; vrai prestataire (webhook) plus tard.
- [x] 🔴 **Vérif propriétaire** ajoutée (l'app doit appartenir à l'appelant, email JWT casse-insensible) + idempotence + `submitPayment` envoie le JWT (`asUser:true`).
- [x] 🟠 `execute` retiré à `anon`/`public` ; réservé à `authenticated`.
- **Vérif** : ✅ testé en base — attaquant bloqué, propriétaire OK, idempotent, anon bloqué.
  Migration : `docs/migrations/20260722_sec_day1_lock_payment_ownership.sql`.

### Jour 2 — 🟠 Réduire la surface des fonctions SECURITY DEFINER — ✅ FAIT (2026-07-22)
73 fonctions étaient exécutables par anon/authenticated (via le grant PUBLIC par défaut).
Gardes internes présentes, mais on **retire l'exécution à qui n'en a pas besoin**.
- [x] 🟠 Classées : `suro_get_quote` (public tunnel) · triggers + internes (`compute_premium`,
  `notify`, `set_premium`, `trg_*`) en definer-only · tout le reste réservé à `authenticated`.
- [x] 🟠 `revoke execute from public, anon` partout sauf `suro_get_quote` ; `grant to authenticated`
  sur les RPC staff/clients + helpers RLS (via boucle dynamique, gère les surcharges).
- [x] ⚪ Gardes internes conservées (défense en profondeur).
- **Vérif** : ✅ **seul `suro_get_quote` reste exécutable par anon** (36 → 1). Testé en base :
  anon perd les fonctions staff (42501), authenticated les garde (garde interne), devis anon OK.
  Migration : `docs/migrations/20260722_sec_day2_revoke_anon_execute_definer_fns.sql`.

### Jour 3 — 🟠 Policies « always true » & insert anon — ✅ FAIT (2026-07-22)
- [x] 🟠 `suro_events` INSERT anon : `with_check` borné (event `^[a-z][a-z0-9_]{0,63}$`, tailles
  step/session/meta limitées) → plus de payload énorme ni de contenu piégé. Testé (event légitime OK, piégé/énorme rejetés).
- [x] 🟠 `insurance_application_answers` INSERT anon : `with_check` borné (application_id requis + tailles).
  Constat : n'est inséré que par le backend en `service_role` (contourne RLS) — front non impacté.
- [x] 🟡 `suro_settings` SELECT public : ne contient que `support_phone` / `support_whatsapp` (contacts publics) — **rien de sensible** ✓.
- [x] ⚪ `insurance_pricing_factors` / `insurance_pricing` / `insurance_products` SELECT public : tarifs publics — OK.
- [x] ⚪ `suro_admins` / `suro_role_privileges` RLS sans policy : **deny-all volontaire** confirmé (accès via fonctions).
- **Vérif** : ✅ ne restent en « always true » que 2 SELECT publics **non sensibles** (justifiés).
  Migration : `docs/migrations/20260722_sec_day3_bound_anon_inserts.sql`. **→ Phase A terminée.**

### Audit Injection SQL (SQLi) — ✅ FAIT (2026-07-22), rien à corriger
Vérification ciblée du seul vecteur SQLi possible dans cette archi (SQL dynamique).
- [x] ⚪ **Fonctions Postgres** : aucune (0/37) n'utilise `EXECUTE`/`format()` dynamique → pas de SQL construit depuis une saisie.
- [x] ⚪ **PostgREST (REST + RPC)** : requêtes **paramétrées** par design.
- [x] ⚪ **Backend Express** (`backend/`) : uniquement le query-builder Supabase (`.from().select()`), aucun client `pg` brut ni template SQL.
- **Conclusion** : l'injection SQL **n'est pas un vecteur exploitable** sur SURO (vérifié en base + dans le code).
- **Note annexe** : `backend/config/supabase.js` pointe par défaut vers un **autre** projet Supabase
  (`yfrqiqlyvlllhttfrzhs`, ancien) — le `backend/` semble legacy/inutilisé par le déploiement statique actuel.
  À clarifier au Jour 12 (migration VPS) : ce backend sert-il encore ?

---

## PHASE B — Authentification & accès

### Jour 4 — 🟠 Durcir Supabase Auth
- [ ] 🟠 Activer **Leaked Password Protection** (Auth → Policies) — signalé désactivé.
- [ ] 🟠 Politique de mot de passe : longueur mini, complexité (côté Auth settings).
- [ ] 🟠 Confirmer l'état de la **confirmation d'email** (on l'a supposée active) et le comportement voulu.
- [ ] 🟡 Vérifier l'expiration des JWT + rotation des refresh tokens (défauts Supabase raisonnables, à confirmer).
- [ ] 🟡 Rate-limiting Auth (login/signup/recover) — limites Supabase par défaut, à connaître.
- [ ] 🔴 **Plan de rotation des clés** avant prod : publishable OK public ; s'assurer que la `service_role`
  n'a jamais fuité (repo, logs, edge functions) et prévoir sa rotation le jour du go-live.
- **Vérif** : un mot de passe connu compromis est refusé à l'inscription.

---

## PHASE C — Frontend (le code servi au navigateur)

### Jour 5 — 🔴 Audit XSS (données utilisateur → HTML) — ✅ FAIT (2026-07-22)
Audit des 3 fichiers legacy + de l'ops. **Modèle de menace clé** = XSS *stockée* :
donnée saisie par un client → exécutée dans le navigateur d'un **staff**.
- [x] 🔴 **Chemin à haut risque (client → staff) : déjà sûr.**
  - `backoffice/js/dashboard.js` : toutes les données client passent par `this.escape()`
    (y compris `vehicleLabel`, le helper `field()` échappe l'attribut `value`, messages, descriptions, field_value…).
  - `ops/src/**` : Preact/htm auto-échappe ; **aucun** `innerHTML`/`dangerouslySetInnerHTML`.
- [x] 🔴 **customer.js : 1 seul spot non échappé corrigé** (self-XSS dans le `<option>` du choix de contrat,
  ligne 600 : `vehicleLabel` + `immatriculation` désormais `escape()`). Le reste du refactor échappe déjà au point d'injection.
- [x] ⚪ **tunnel.js** : les valeurs interpolées (`choice.value`, `choice.description`) sont **définies par le code**, pas des saisies → pas de vecteur.
- [x] ⚪ **notifications.js** (cloche) : `title`/`body` échappés (`esc()`).
- **Vérif** : ✅ `escape()` couvre `& < > " '` (contexte texte + attribut). La seule surface exploitable
  (client → staff) était déjà couverte ; correctif défense-en-profondeur appliqué côté client.
  Fichier : `app/js/customer.js` (v50).

### Jour 6 — 🟡 Secrets, en-têtes & config frontend
- [ ] ⚪ Confirmer (déjà vérifié) : **aucune clé `service_role`** dans le repo ni dans le JS déployé.
- [ ] 🟡 `.gitignore` couvre bien `.env*` (OK) ; s'assurer qu'aucun `.env` réel n'est tracké.
- [ ] 🟠 Prévoir les **en-têtes de sécurité HTTP** (à poser au niveau hébergeur/reverse-proxy, cf. Jour 11) :
  `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS.
- [ ] 🟡 Vérifier les liens externes `target="_blank"` → `rel="noopener"` (déjà en place à plusieurs endroits).
- **Vérif** : revue rapide + note des en-têtes à activer à la migration.

---

## PHASE D — Stockage de fichiers

### Jour 7 — 🟠 Sécuriser les buckets (documents & sinistres)
- [ ] 🟠 Confirmer que `suro-documents` et `suro-claims` ne sont **pas publics** (accès via RLS / URLs signées uniquement).
- [ ] 🟠 Revoir les policies storage (lecture = propriétaire par email — déjà rendu casse-insensible ; écriture = staff/propriétaire selon le cas).
- [ ] 🟠 **Validation upload** : limiter type MIME + taille des fichiers (attestation, pièces sinistre) côté client ET, si possible, côté serveur.
- [ ] 🟡 Vérifier qu'un client ne peut pas lire les documents d'un autre (test avec 2 comptes).
- **Vérif** : URL directe d'un fichier sans droit → refus ; upload d'un fichier trop gros / mauvais type → refus.

---

## PHASE E — Abus & robustesse

### Jour 8 — 🟠 Anti-abus / rate-limiting applicatif
- [ ] 🟠 `insurance_applications` INSERT anon (tunnel invité) : ouvert par design, mais **limiter l'abus**
  (ex: throttle par IP/session au niveau reverse-proxy, ou captcha léger sur le tunnel).
- [ ] 🟠 `suro_events` : idem, éviter le flood analytics.
- [ ] 🟡 Endpoints Auth (login/signup) : s'appuyer sur les limites Supabase + reverse-proxy.
- [ ] 🟡 Prévoir la journalisation des abus (déjà : `suro_audit_log` pour le staff).
- **Vérif** : un script qui spamme la création de devis est freiné (une fois le reverse-proxy en place).

---

## PHASE F — Données & conformité

### Jour 9 — 🟡 Hygiène des données & RGPD
- [ ] 🟡 **Comptes fantômes** : politique de purge/anonymisation des comptes sans contrat payé après X jours
  (voir discussion dédiée — à coupler aux relances de devis).
- [ ] 🟡 Vérifier qu'aucune donnée perso sensible n'est exposée par une policy publique (recoupe Jour 3).
- [ ] 🟡 Cohérence des correspondances email/texte : après le fix casse (`20260721_fix_customer_email_case_insensitive`),
  auditer s'il reste des comparaisons `=` sensibles à la casse ailleurs.
- [ ] ⚪ Mentions légales / politique de confidentialité alignées avec la rétention réelle.
- **Vérif** : un compte de test non payé de +X jours est bien purgé/anonymisé par le job.

---

## PHASE G — Migration VPS : durcissement serveur

> À faire au moment de préparer le VPS. Suppose Supabase **reste hébergé** (recommandé) ;
> si tu self-héberges Supabase, prévoir un durcissement dédié en plus.

### Jour 10 — 🔴 Base du serveur
- [ ] 🔴 Accès SSH **par clés uniquement** (désactiver login par mot de passe + root).
- [ ] 🔴 **Pare-feu** (ufw/nftables) : n'ouvrir que 22 (ou port SSH custom), 80, 443.
- [ ] 🟠 `fail2ban` (anti-bruteforce SSH), mises à jour auto de sécurité (`unattended-upgrades`).
- [ ] 🟡 Utilisateur non-root dédié à l'app ; permissions minimales.
- **Vérif** : `nmap` ne voit que les ports voulus ; login SSH par mot de passe refusé.

### Jour 11 — 🔴 TLS, reverse-proxy & en-têtes
- [ ] 🔴 **HTTPS** via Let's Encrypt (certbot), renouvellement auto.
- [ ] 🟠 Reverse-proxy (nginx/Caddy) avec les **en-têtes de sécurité** du Jour 6
  (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- [ ] 🟡 Rediriger HTTP→HTTPS ; désactiver les vieux protocoles/ciphers TLS.
- **Vérif** : test SSL Labs (note A), en-têtes présents (securityheaders.com).

### Jour 12 — 🟠 Secrets, backend, backups & supervision
- [ ] 🔴 Secrets (clés Supabase, etc.) en **variables d'environnement** sur le VPS, jamais dans le repo.
- [ ] 🟠 Auditer le dossier `backend/` (Express ?) s'il tourne sur le VPS : CORS restreint, `helmet`,
  validation des entrées, rate-limit, pas de secret en dur, dépendances à jour (`npm audit`).
- [ ] 🟠 **Backups** automatiques : base (Supabase backups / export) + stockage ; tester une **restauration**.
- [ ] 🟡 Logs & supervision (erreurs, tentatives d'accès) ; alerte basique.
- [ ] 🟡 `npm audit` / mise à jour des dépendances (front + backend).
- **Vérif** : une restauration de backup fonctionne ; `npm audit` sans vulnérabilité critique.

---

## PHASE H — Scalabilité & maintenabilité (vraie montée en charge)

> À traiter **après / en parallèle** de l'audit sécu, un peu chaque jour comme le reste.
> Contexte (audit code du 2026-07-23, croisé avec l'analyse Cursor) : le **socle data
> (Supabase + RLS + RBAC + audit) tient 10 000 clients**. Le goulot n'est pas Postgres,
> c'est le **portail ops** et **l'organisation du code**. Plafond estimé sans ces refactors :
> **~2 000–5 000 contrats actifs côté staff**. L'espace client (isolé par RLS) tient, lui.
> **Déjà fait** : portail ops modularisé (`ops/src/routes` + `lib` + `components`) — ne pas re-faire.

### Priorité 1 — Avant ~1 000 clients actifs

#### Jour 13 — 🔴 CI minimale (le meilleur rapport effort/protection) — ✅ FAIT (2026-07-23)
- [x] 🔴 Check **syntaxe** sur chaque PR/push (`.github/workflows/ci.yml` → `npm run check:js`).
  Le script `scripts/check-syntax.mjs` analyse `ops/src` **en tant que modules ES** (un simple
  `node --check *.js` parse en CommonJS et **rate** l'erreur qui a causé l'écran blanc).
- [x] 🟡 Tests lancés en CI (`npm test`) : `privileges.matrix.test.mjs` + `api.assembly.test.mjs`.
- **Vérif** : ✅ prouvé — bug ESM réinjecté dans `documents.js` → `check:js` **exit 1** (pointe la ligne) ; code propre → 41/41 OK, 15/15 tests.

#### Jour 14 — 🔴 Pagination serveur du portail ops (le vrai goulot) — 🟠 EN COURS (2026-07-23)
Fondation posée + 1ʳᵉ tranche prouvée. Aucune migration DB (PostgREST natif, `limit/offset` + `Content-Range`).
- [x] 🔴 **Fondation** : `SURO_HTTP.sbList(path)` → `{ rows, total }` (total lu via `Prefer: count=exact` / `Content-Range`),
  et **mode serveur** du `DataTable` (recherche débouncée + tri + pagination délégués au backend, rétro-compatible avec le mode client).
- [x] 🔴 **Paiements**, **Contrats**, **Sinistres** convertis bout-en-bout (`adminListPayments/Applications/Claims`)
  → filtre/tri/recherche côté serveur. Recherche multi-colonnes via un seul `or=(col.ilike…)` ; jamais deux `or=`.
- [x] 🟠 **Sinistres** : les vues par statut deviennent des filtres serveur ; compteurs par vue via requêtes `count`
  **bornées** (`adminClaimCounts`, `limit=1` + `Content-Range`) — ne scalent pas avec le volume.
- [x] ⚪ Requêtes PostgREST **couvertes par tests unitaires** (`api.assembly.test.mjs`).
- [ ] 🟡 **Journal d'audit** : passe par une RPC (`suro_audit_recent`) sans offset ; laissé tel quel (déjà borné à 200)
  — une vraie pagination nécessiterait une migration DB.
- [x] 🟠 **Souscriptions** converties (écran principal) : chaque vue = un filtre serveur — statuts, « expire <30j »
  (`status=active` + `expires_at` entre aujourd'hui et +30j), « docs à vérifier » (pré-requête **bornée** des
  `application_id` en attente puis `id=in.(…)`). Compteurs par vue via `count` bornés ; deep-link `#/subscriptions/<id>`
  via fetch par id. **Aucune migration DB.**
- [ ] 🟡 Restent **Clients** (RPC `suro_list_customers`) et **Pièces KYC** (agrégation recto/verso par dossier) :
  une vraie pagination y **exige une migration DB** (RPC paginée ou vue) — à faire quand l'accès base sera dispo.
- **Vérif navigateur** : sur **Paiements / Contrats / Sinistres / Souscriptions**, pagination/recherche/tri/vues
  interrogent le serveur (onglet Réseau : `limit/offset`, réponse bornée) ; totaux via `Content-Range`. ✅ syntaxe + 48 tests au vert.

#### Jour 15 — 🟠 Index DB sur les colonnes filtrées
- [ ] 🟠 Index sur `customer_email`, `status`, `created_at` pour `insurance_applications`, `suro_payments`, `insurance_claims`
  (les migrations indexent surtout `insurance_documents`/KYC). Attention aux policies RLS sur `lower(customer_email)` → index fonctionnel.
- **Vérif** : `EXPLAIN ANALYZE` montre un *index scan* (pas de *seq scan*) sur les requêtes ops principales.

#### Jour 16 — 🟡 Nettoyage de la dette legacy — 🟠 EN PARTIE (2026-07-23)
- [x] 🟡 `backend/` **archivé** dans `_archive/backend/` ; `js/customer.js` (doublon mort) **supprimé**.
- [ ] 🟡 Reste à traiter : `backoffice/` (remplacé par `ops/`) et `index2.html` (landing alternative).
- **Vérif** : ✅ aucun lien mort après archivage/suppression (contrôlé) ; les surfaces sont toujours servies.

### Priorité 2 — Avant ~5 000 clients

#### Jour 17 — 🟠 Rafraîchissement de session automatique — ⚡ AMORCÉ (2026-07-23)
- [x] 🟠 Briques ajoutées par le refactor : `refreshSession` / `ensureValidSession` (`js/services/session.js`).
- [ ] 🟠 Reste à **câbler** : appeler `ensureValidSession` avant les requêtes authentifiées (ou avant expiration) sur toutes les surfaces.
- **Constat** : JWT en `localStorage` — le refresh existe maintenant mais n'est pas encore branché partout.
- **Vérif** : une session reste active au-delà de l'expiration du JWT sans re-login manuel.

#### Jour 18 — 🟡 Rétention / purge de `suro_events`
- [ ] 🟡 Job de purge (ou partition par date) : la table analytics grossit sans limite (insert à chaque interaction).
- **Vérif** : la table est bornée dans le temps ; le Funnel reste rapide.

#### Jour 19 — 🟡 Notifications : sortir du polling 30 s
- [ ] 🟡 Remplacer le `setInterval(refreshBadge, 30000)` (`notifications.js:76`) par **Supabase Realtime** ou un intervalle adaptatif.
- **Vérif** : plus de requête inutile quand rien ne change ; charge stable avec beaucoup d'utilisateurs connectés.

#### Jour 20 — 🟠 Découper `api.js` (809 lignes, une seule classe) — ✅ FAIT (2026-07-23)
- [x] 🟠 Éclaté en 9 services (`config, session, http, analytics, onboarding, auth, customer-portal, admin, api-notifications`)
  assemblés dans `window.SURO_API` ; test d'assemblage `api.assembly.test.mjs` en CI.
- **Vérif** : ✅ 15/15 tests ; les 9 pages HTML chargent la chaîne complète dans le bon ordre (contrôlé).

#### Jour 21 — 🔴 Vrai flux de paiement (bloquant produit, indépendant du scale)
- [ ] 🔴 Brancher un **prestataire réel** (CMI/banque) via **webhook + Edge Function** ; l'activation du contrat vient du prestataire, pas du client.
- **Constat** : `tunnel.js` appelle `suro_mark_application_paid` côté client (sécurisé par RLS, mais **simulé**). Inacceptable pour une assurance en prod.
- **Vérif** : un contrat ne passe `active` que sur confirmation serveur du paiement.

### Priorité 3 — Startup mature

- [ ] 🟡 **Jour 22** — Découper les monolithes client : `customer.js` (1901 l.), `tunnel.js` (1308 l.).
- [ ] 🟡 **Jour 23** — Tests **E2E** des parcours critiques (tunnel → paiement → espace client → KYC → validation ops).
- [ ] ⚪ **Jour 24** — TypeScript progressif (`ops/` puis `app/`), observabilité (logs/alertes Supabase), packages npm si l'équipe dépasse 5 devs.

**En une phrase** : bonne fondation produit, plafond de scalabilité **opérationnelle** (côté staff) vers 2–5k contrats sans ces refactors — rattrapable **par incréments, sans réécriture**.

---

## Suivi
- On coche au fur et à mesure. Chaque correctif base → migration dans `docs/migrations/`,
  chaque correctif code → commit sur `Cursor`.
- On relance les **advisors Supabase** après chaque phase base pour mesurer les progrès.
- Ordre conseillé si peu de temps : **Jour 1 (paiement) → Jour 5 (XSS) → Jour 2 (fonctions) → Jour 4 (auth)**,
  le reste ensuite.
