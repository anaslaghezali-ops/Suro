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

### Jour 5 — 🔴 Audit XSS (données utilisateur → HTML)
Le legacy (`app/js/customer.js` ~17, `backoffice/js/dashboard.js` ~20,
`js/features/onboarding/tunnel.js` ~12 `innerHTML`) construit du HTML avec des données
saisies (nom, email, marque véhicule, adresse…). Une valeur comme `<img onerror=...>`
dans un champ pourrait s'exécuter chez le **staff** qui regarde le dossier (XSS stockée).
- [ ] 🔴 Repérer chaque `innerHTML` avec une variable utilisateur non passée par `escape()`.
- [ ] 🔴 Corriger : passer **toutes** les données dynamiques par `escape()` (ou équivalent) avant injection.
- [ ] ⚪ L'ops (`ops/src/**`, Preact + htm) échappe par défaut : confirmer qu'aucun `dangerouslySetInnerHTML` n'y traîne.
- **Vérif** : injecter `"><img src=x onerror=alert(1)>` dans un nom/marque puis l'afficher côté ops/backoffice → pas d'exécution.

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

## Suivi
- On coche au fur et à mesure. Chaque correctif base → migration dans `docs/migrations/`,
  chaque correctif code → commit sur `Cursor`.
- On relance les **advisors Supabase** après chaque phase base pour mesurer les progrès.
- Ordre conseillé si peu de temps : **Jour 1 (paiement) → Jour 5 (XSS) → Jour 2 (fonctions) → Jour 4 (auth)**,
  le reste ensuite.
