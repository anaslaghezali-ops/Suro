# SURO Backend API

API REST pour la plateforme d'assurance automobile SURO, construite avec Node.js/Express et Supabase.

## 🚀 Mise en Place

### 1. Installation des dépendances

```bash
cd backend
npm install
```

### 2. Configuration des variables d'environnement

Copie `.env.example` vers `.env` et complète les valeurs :

```bash
cp .env.example .env
```

**Variables requises :**

- `SUPABASE_URL` - URL du projet Supabase (déjà configurée)
- `SUPABASE_KEY` - Clé API anon Supabase (déjà configurée)
- `SUPABASE_SERVICE_KEY` - Clé de service pour les opérations admin
- `JWT_SECRET` - Secret pour signer les JWT (change en production)

**Services optionnels :**

- `SENDGRID_API_KEY` - Pour l'envoi d'emails
- `STRIPE_SECRET_KEY` - Pour les paiements
- `STRIPE_WEBHOOK_SECRET` - Pour les webhooks Stripe

### 3. Lancer le serveur

**Développement :**
```bash
npm run dev
```

**Production :**
```bash
npm start
```

Le serveur démarrera sur `http://localhost:3000`

## 📚 Endpoints API

### Authentification

#### Inscription
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+33612345678"
}

Response (201):
{
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

#### Connexion
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (200):
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### Contrats

#### Lister les contrats de l'utilisateur
```http
GET /api/contracts/:userId
Authorization: Bearer {token}

Response (200):
{
  "contracts": [
    {
      "id": "uuid",
      "contract_number": "SRO-1720382794815",
      "status": "active",
      "premium_amount": 49.99,
      "start_date": "2026-07-07",
      "plans": {
        "id": "uuid",
        "name": "Tiers+",
        "monthly_price": 49.99
      }
    }
  ]
}
```

#### Créer un nouveau contrat
```http
POST /api/contracts
Authorization: Bearer {token}
Content-Type: application/json

{
  "plan_id": "uuid",
  "vehicle_id": "uuid",
  "start_date": "2026-07-07",
  "premium_amount": 49.99
}

Response (201):
{
  "message": "Contract created successfully",
  "contract": {
    "id": "uuid",
    "contract_number": "SRO-1720382794815",
    "status": "active",
    "premium_amount": 49.99
  }
}
```

### Sinistres

#### Lister les sinistres de l'utilisateur
```http
GET /api/claims/:userId
Authorization: Bearer {token}

Response (200):
{
  "claims": [
    {
      "id": "uuid",
      "claim_number": "CLM-1720382794815",
      "status": "submitted",
      "amount_claimed": 5000,
      "incident_date": "2026-07-05",
      "description": "Accident de la circulation"
    }
  ]
}
```

#### Créer un nouveau sinistre
```http
POST /api/claims
Authorization: Bearer {token}
Content-Type: application/json

{
  "contract_id": "uuid",
  "incident_date": "2026-07-05",
  "incident_location": "Paris, France",
  "description": "Accident de la circulation",
  "amount_claimed": 5000
}

Response (201):
{
  "message": "Claim submitted successfully",
  "claim": {
    "id": "uuid",
    "claim_number": "CLM-1720382794815",
    "status": "submitted"
  }
}
```

### Contact

#### Envoyer un message
```http
POST /api/contact
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question sur les offres",
  "message": "J'aimerais plus d'informations sur...",
  "user_id": "uuid" (optionnel)
}

Response (201):
{
  "message": "Message sent successfully",
  "data": {
    "id": "uuid",
    "status": "new",
    "created_at": "2026-07-07T..."
  }
}
```

## 🔐 Authentification

Tous les endpoints protégés nécessitent un header `Authorization` :

```http
Authorization: Bearer {JWT_TOKEN}
```

Les tokens JWT expirent après 7 jours.

## 🗄️ Base de Données

La base de données Supabase contient les tables suivantes :

- `users` - Clients/Utilisateurs
- `insurance_plans` - Plans d'assurance
- `vehicle_info` - Informations véhicules
- `contracts` - Contrats/Souscriptions
- `claims` - Sinistres
- `contact_messages` - Messages de contact

### Accès Supabase

- **URL** : https://app.supabase.com/projects/yfrqiqlyvlllhttfrzhs
- **Région** : eu-west-1

## 🧪 Tests

```bash
# Lancer les tests
npm test

# Avec couverture
npm test -- --coverage
```

## 📦 Structure du Projet

```
backend/
├── config/
│   └── supabase.js          # Configuration Supabase
├── middleware/
│   └── auth.js              # Authentification JWT
├── routes/
│   ├── auth.js              # Routes d'authentification
│   ├── contracts.js         # Routes des contrats
│   ├── claims.js            # Routes des sinistres
│   └── contact.js           # Routes de contact
├── server.js                # Point d'entrée
├── package.json
├── .env.example
└── README.md
```

## 🚨 Erreurs Courantes

### CORS Error
Si vous avez des erreurs CORS, vérifiez que :
- Le frontend appelle sur le bon port
- Les headers CORS sont configurés correctement

### JWT Expired
- Demandez un nouveau token avec `/api/auth/login`
- Les tokens expirent après 7 jours

### Supabase Connection Error
- Vérifiez `SUPABASE_URL` et `SUPABASE_KEY` dans `.env`
- Vérifiez que le projet Supabase est actif

## 🔗 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Express.js](https://expressjs.com/)
- [JWT](https://jwt.io/)
- [bcryptjs](https://www.npmjs.com/package/bcryptjs)

## 📝 License

MIT
