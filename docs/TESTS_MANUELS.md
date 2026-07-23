# SURO — Tests manuels à faire au navigateur

> Ces tests ne peuvent pas être exécutés depuis l'environnement de dev (réseau bridé,
> pas d'accès navigateur à supabase.co). À faire **toi-même** dans un vrai navigateur,
> connecté à `Cursor` déployé. Document **en cours** — complété à la fin de l'audit sécu.
>
> Légende : ✅ attendu OK · ❌ attendu bloqué/refusé

---

## A. Fonctionnalités

### A1. Tunnel — assurance **moto**
1. Aller sur la landing → tunnel → choisir **Moto**.
2. Remplir : immatriculation, marque (ex. Honda), modèle, année, **cylindrée** (ex. 125).
3. → Le devis s'affiche (prix moto, pas voiture).
- **Attendu** : étape « type » présente, champ **Cylindrée (cm³)** (pas CV), prix cohérents avec la grille moto.

### A2. Tunnel — **payer plus tard**
1. Aller au bout du tunnel (voiture ou moto) → écran final **« Payer maintenant / Payer plus tard »**.
2. Choisir **Payer plus tard** → confirmation « Devis enregistré ».
3. Aller dans l'espace client.
- **Attendu** : ✅ le contrat apparaît en **« À payer »** + bandeau + bouton **Payer** (accueil ET Mes contrats).

### A3. Espace client — **payer un devis en attente**
1. Depuis l'espace client, sur un devis « À payer », cliquer **Payer maintenant**.
2. Confirmer.
- **Attendu** : ✅ paiement confirmé, le contrat passe **Actif**, l'attestation devient attendue.

### A4. **KYC** — dépôt des pièces (client → ops)
1. Sur un contrat **payé/actif**, ouvrir « Compléter mon dossier » (/app/#documents).
2. Déposer **CIN recto** (fichier jpg/png/pdf).
- **Attendu client** : ✅ upload OK, la face passe en « en vérification » (status `pending`).
3. Ouvrir le portail **Ops → Pièces KYC**.
- **Attendu ops** : ✅ le dossier apparaît, `document_type='cin'`, `document_side='recto'`, aperçu visible, boutons Valider/Refuser.
4. Dans l'ops, **Refuser** avec motif → côté client la face repasse « à envoyer » + notification.
- **Attendu** : ✅ statut et notification cohérents.

### A5. **Funnel** (ops, super admin)
1. Générer un peu de trafic (faire 1-2 tunnels).
2. Ops → **Funnel**.
- **Attendu** : ✅ entonnoir avec les étapes, KPIs, décrochage principal, split « payer maintenant / plus tard ». Visible **seulement** en super admin.

---

## B. Sécurité (vérifier que les correctifs tiennent en conditions réelles)

### B1. **Casse de l'email** (contrats visibles)
1. Créer un compte via le tunnel avec un email contenant une **majuscule** (ex. `Test@Gmail.Com`).
2. Payer/enregistrer un devis, puis aller dans l'espace client.
- **Attendu** : ✅ le contrat **apparaît bien** (plus de « contrat invisible »).

### B2. **Paiement — propriété** (Jour 1)
1. Parcours normal : payer **ton propre** devis.
- **Attendu** : ✅ marche normalement.
2. (Avancé, optionnel) Un compte B ne doit pas pouvoir activer le devis d'un compte A.
- **Attendu** : ❌ refusé (déjà prouvé en base ; à confirmer via l'UI si tu veux).

### B3. **KYC — isolation** (Jour /migration KYC)
1. Connecté en client A, tu ne dois voir/déposer que **tes** pièces.
- **Attendu** : ❌ impossible d'agir sur le contrat d'un autre (prouvé en base).

### B4. **XSS** (Jour 5) — optionnel
1. À l'inscription/tunnel, mettre dans un champ (ex. marque) : `"><img src=x onerror=alert(1)>`.
2. Regarder le dossier côté **ops** et **backoffice**.
- **Attendu** : ✅ le texte s'affiche **littéralement**, **aucune alerte** ne s'exécute.

---

## C. À compléter (audit sécu en cours)
- [ ] Jour 4 (Auth) : après activation « leaked password protection » → un mot de passe compromis connu est **refusé** à l'inscription.
- [ ] Jour 7 (Storage) : upload d'un fichier **trop gros** ou **mauvais type** → refusé.
- [ ] Jour 10-12 (VPS) : tests serveur (ports, TLS, restauration backup) au moment de la migration.
- *(d'autres s'ajouteront au fil de l'audit)*
