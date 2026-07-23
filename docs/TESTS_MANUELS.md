# SURO — Guide de test complet (à faire au navigateur)

> Ces tests ne peuvent pas être lancés depuis l'environnement de dev (réseau bridé,
> pas d'accès à `supabase.co`). À faire **toi-même** dans un vrai navigateur, sur `Cursor` déployé.
> Conçu pour être parcouru **de haut en bas, en une passe**.
>
> Légende : ✅ = attendu OK · ❌ = attendu bloqué/refusé · 🔎 = ouvre l'onglet **Réseau** (DevTools)

---

## 0. Préparation (à faire en premier)

- [ ] **Rechargement forcé** sur chaque page testée : **Ctrl/Cmd + Shift + R** (beaucoup de fichiers ont changé de version — sans ça tu testes du cache).
- [ ] Avoir sous la main :
  - 1 compte **super_admin** (équipe).
  - Idéalement 1 compte **admin**, 1 **opérations**, 1 **support** (pour tester les privilèges par rôle).
  - 2 comptes **clients** distincts (A et B) pour les tests d'isolation.

---

## 1. Connexion équipe → le portail s'affiche (bug « écran blanc »)

- [ ] **1.1** Va sur `admin-login.html`, connecte-toi (super_admin).
  - ✅ tu arrives sur le **portail ops** (Dashboard), **pas** un écran blanc.
- [ ] **1.2** Clique chaque entrée du menu : Dashboard, Souscriptions, Clients, Contrats, Pièces KYC, Paiements, Sinistres, Funnel, Utilisateurs, Privilèges, Paramètres, Journal.
  - ✅ chaque écran s'affiche (aucune page blanche).
- [ ] **1.3** (mobile) le **bouton menu** ☰ en haut à gauche ouvre/ferme la barre latérale.

---

## 2. Non-régression du découpage `api.js` (toutes les pages)

> `api.js` a été éclaté en 9 services chargés par chaque page — on vérifie que tout s'assemble encore.

- [ ] **2.1** Landing `index.html` : le **tunnel de devis** fonctionne (un prix s'affiche à la fin).
- [ ] **2.2** `customer-login.html` : connexion client → **espace client** se charge (contrats visibles).
- [ ] **2.3** `customer-signup.html` : création d'un compte client fonctionne.
- [ ] **2.4** `reset-password.html` : l'envoi d'email de réinitialisation fonctionne.
- [ ] **2.5** Console navigateur (F12) : **aucune erreur rouge** du type `SURO_API is not defined` / `undefined is not a function`.

---

## 3. Privilèges (matrice + application réelle par rôle)

### 3.1 La matrice reflète l'état (bug « rien ne se coche »)
- [ ] Ops → **Privilèges** (super_admin). Tu dois voir ce motif **pré-coché** par défaut :

| Capacité | Admin | Opérations | Support |
|---|:--:|:--:|:--:|
| Modifier les contrats | ☑ | ☐ | ☐ |
| Modifier les clients | ☑ | ☐ | ☐ |
| Valider/refuser documents | ☑ | ☑ | ☐ |
| Déposer des documents | ☑ | ☑ | ☐ |
| Traiter sinistres & messages | ☑ | ☑ | ☑ |
| Modifier les paramètres | ☑ | ☐ | ☐ |

- [ ] **3.2** Coche une capacité décochée → toast « Capacité activée » **et la case reste cochée**. Recharge la page → l'état est **conservé**.
- [ ] **3.3** Décoche-la → toast « Capacité désactivée », case décochée, conservée après rechargement.

### 3.4 L'autorisation/refus agit vraiment (par rôle)
> Fais chaque test avec le compte du rôle concerné (déconnexion/reconnexion après un changement de privilège).
- [ ] **Support** sans `claim.handle` → dans un sinistre, **pas** de bouton de réponse/statut ; une tentative directe est **❌ refusée**.
- [ ] **Opérations** sans `document.review` → boutons Valider/Refuser **absents/inopérants** sur les pièces KYC.
- [ ] Accorde `contract.edit` à **Opérations** → la modification d'un contrat **✅ passe** (sinon « Non autorisé »).

---

## 4. Pagination serveur du portail ops 🔎

> Ouvre l'onglet **Réseau** : chaque action doit déclencher une requête bornée (`limit=…&offset=…`), pas un chargement massif.

- [ ] **4.1 Paiements** : recherche client, filtre de statut, tri de colonne, page suivante/précédente.
  - ✅ 🔎 requêtes `suro_payments?...limit=12&offset=...` ; le compteur de résultats vient du serveur.
- [ ] **4.2 Contrats** : recherche (client / immat / marque), tri, pagination.
  - ✅ 🔎 requêtes `insurance_applications?...status=in.(active,expired)...limit/offset`.
- [ ] **4.3 Sinistres** : change de **vue** (Tous / En attente / Approuvés / Rejetés / Payés), recherche, tri, pagination.
  - ✅ les **compteurs de vues** s'affichent ; 🔎 la vue active filtre côté serveur.
  - [ ] Change le statut d'un sinistre → à la fermeture, **la liste et les compteurs se mettent à jour**.
- [ ] **4.4 Souscriptions** (le plus important) :
  - [ ] Vue **« Expire < 30j »** → n'affiche que des contrats actifs expirant sous 30 jours.
  - [ ] Vue **« Docs à vérifier »** → n'affiche que les dossiers ayant une pièce en attente.
  - [ ] Recherche / tri / pagination → 🔎 bornés côté serveur.
  - [ ] Ouvre un dossier, modifie-le, enregistre → **la liste se rafraîchit** après fermeture.
  - [ ] Deep-link : ouvre une URL `#/subscriptions/<id d'un dossier>` → le dossier s'ouvre directement.

---

## 5. Fonctionnalités métier

- [ ] **5.1 Tunnel moto** : landing → tunnel → **Moto** → immatriculation, marque, modèle, année, **Cylindrée (cm³)** (pas CV) → un devis moto s'affiche.
- [ ] **5.2 Payer plus tard** : au bout du tunnel, écran **« Payer maintenant / Payer plus tard »** → **Payer plus tard** → « Devis enregistré » → dans l'espace client, le contrat apparaît en **« À payer »** (accueil **et** Mes contrats) avec bouton **Payer**.
- [ ] **5.3 Payer un devis en attente** : espace client → sur un devis « À payer » → **Payer maintenant** → ✅ le contrat passe **Actif**.
- [ ] **5.4 KYC — dépôt client** : sur un contrat payé/actif → « Compléter mon dossier » (`/app/#documents`) → déposer **CIN recto** (jpg/png/pdf) → ✅ la face passe « en vérification ».
- [ ] **5.5 KYC — validation ops** : Ops → **Pièces KYC** → le dossier apparaît (`cin` / `recto`, aperçu visible) → **Refuser** avec motif → côté client la face repasse « à envoyer » + **notification** reçue.
- [ ] **5.6 Funnel** : fais 1–2 tunnels, puis Ops → **Funnel** → entonnoir + KPIs + split « payer maintenant / plus tard ». Visible **uniquement** en super_admin.

---

## 6. Sécurité (les correctifs tiennent en conditions réelles)

- [ ] **6.1 Casse de l'email** : crée un compte via le tunnel avec une **majuscule** (ex. `Test@Gmail.Com`), enregistre un devis → dans l'espace client, le contrat **✅ apparaît** (plus de « contrat invisible »).
- [ ] **6.2 Paiement — propriété** : payer ton **propre** devis ✅. (Avancé) un compte B ne peut pas activer le devis d'un compte A → **❌**.
- [ ] **6.3 KYC — isolation** : connecté en client A, tu ne vois/déposes **que tes** pièces ; agir sur le contrat d'un autre → **❌**.
- [ ] **6.4 XSS** : dans un champ (ex. marque) saisis `"><img src=x onerror=alert(1)>` → côté **ops** et **backoffice**, le texte s'affiche **littéralement**, **aucune alerte** ne s'exécute.

---

## 7. Vérification base — SQL **lecture seule** (optionnel mais recommandé)

> À coller dans **Supabase → SQL Editor**. Aucune écriture. Confirme que les refus de privilèges
> agissent vraiment côté serveur (et pas seulement en masquant des boutons).

```sql
select schemaname||'.'||tablename as tbl, policyname, cmd,
       coalesce(qual,'') as using_expr, coalesce(with_check,'') as check_expr
from pg_policies
where (schemaname='public' and tablename in
        ('insurance_applications','insurance_claims','insurance_claim_messages',
         'insurance_documents','suro_settings'))
   or (schemaname='storage' and tablename='objects')
order by tbl, cmd, policyname;
```
- [ ] **7.1** Tu dois voir `suro_can('contract.edit')`, `suro_can('claim.handle')`, `suro_can('document.upload')`, `suro_can('settings.edit')` dans les policies.
  - ✅ si oui → l'enforcement par privilège est bien câblé. ❌ si tu vois `suro_has_role`/`is_suro_admin`/`true` → dis-le-moi, une migration manque.

```sql
select pg_get_functiondef('public.suro_review_document(uuid,text,text)'::regprocedure);
```
- [ ] **7.2** Le corps doit contenir `suro_can('document.review')`.

---

## 8. Réglages Auth (dashboard Supabase) — Jour 4 (à activer)

- [ ] **8.1** Auth → Policies : activer **Leaked Password Protection** → un mot de passe compromis connu est **refusé** à l'inscription.
- [ ] **8.2** Politique de mot de passe : longueur mini / complexité.
- [ ] **8.3** Confirmer le comportement de **confirmation d'email** voulu.

---

## Encore à venir (hors de cette passe)
- [ ] Jour 7 (Storage) : upload d'un fichier **trop gros** / **mauvais type** → refusé.
- [ ] Pagination serveur **Clients / KYC / Journal** : nécessite une migration DB (accès base requis).
- [ ] Jour 10-12 (VPS) : ports, TLS, restauration backup au moment de la migration.
