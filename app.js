/**
 * SURO App - Application Principale
 * Gère la navigation, l'authentification et le routing
 */

class SuroApp {
    constructor() {
        this.currentPage = 'home';
        this.user = this.getUser();
        this.apiUrl = 'http://localhost:3000/api';
        this.init();
    }

    /**
     * Initialiser l'application
     */
    async init() {
        console.log('[SURO] Initialisation...');
        this.setupEventListeners();
        this.showPage('home');
        this.updateNavigation();
        console.log('[SURO] Prêt ✓');
    }

    /**
     * Configuration des event listeners
     */
    setupEventListeners() {
        // Boutons de navigation
        document.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const page = btn.getAttribute('data-page');
                this.showPage(page);
            });
        });

        // Boutons dynamiques
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const text = target.textContent.trim();

            // Souscrire
            if (text.includes('Souscrire') || text.includes('Choisir')) {
                e.preventDefault();
                if (!this.user) {
                    this.showPage('auth');
                } else {
                    this.showPage('subscribe');
                }
            }

            // Voir offres
            if (text.includes('Voir offres')) {
                e.preventDefault();
                this.showPage('offers');
            }

            // Espace Client
            if (text.includes('Espace Client')) {
                e.preventDefault();
                if (this.user) {
                    this.showPage('dashboard');
                } else {
                    this.showPage('auth');
                }
            }
        });
    }

    /**
     * Afficher une page
     */
    showPage(pageId) {
        // Masquer toutes les sections
        document.querySelectorAll('section').forEach(section => {
            section.classList.remove('active');
        });

        // Afficher la section demandée
        const page = document.getElementById(pageId);
        if (page) {
            page.classList.add('active');
            this.currentPage = pageId;
            window.scrollTo(0, 0);
            console.log(`[SURO] Page: ${pageId}`);

            // Actions spéciales par page
            if (pageId === 'dashboard') {
                this.loadDashboard();
            }
            if (pageId === 'auth') {
                this.setupAuthForms();
            }
            if (pageId === 'subscribe') {
                this.setupSubscribeForm();
            }
        } else {
            console.warn(`[SURO] Page non trouvée: ${pageId}`);
        }
    }

    /**
     * Authentification - Connexion
     */
    async handleLogin(email, password) {
        try {
            if (!email || !password) {
                this.showError('Email et mot de passe requis');
                return;
            }

            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                this.showError(data.error || 'Erreur de connexion');
                return;
            }

            this.setUser(data.user, data.token);
            this.updateNavigation();
            this.showPage('dashboard');
            this.showSuccess('Connecté avec succès !');
        } catch (error) {
            this.showError('Erreur de connexion: ' + error.message);
        }
    }

    /**
     * Authentification - Inscription
     */
    async handleSignup(formData) {
        try {
            const { email, password, first_name, last_name, phone } = formData;

            if (!email || !password || !first_name || !last_name) {
                this.showError('Tous les champs sont requis');
                return;
            }

            const response = await fetch(`${this.apiUrl}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                this.showError(data.error || 'Erreur d\'inscription');
                return;
            }

            this.setUser(data.user, data.token);
            this.updateNavigation();
            this.showPage('dashboard');
            this.showSuccess('Inscrit avec succès !');
        } catch (error) {
            this.showError('Erreur d\'inscription: ' + error.message);
        }
    }

    /**
     * Souscrire à une assurance
     */
    async handleSubscribe(formData) {
        try {
            if (!this.user) {
                this.showPage('auth');
                return;
            }

            const response = await fetch(`${this.apiUrl}/contracts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                this.showError(data.error || 'Erreur de souscription');
                return;
            }

            this.showSuccess('Souscription réussie !');
            setTimeout(() => this.showPage('dashboard'), 1500);
        } catch (error) {
            this.showError('Erreur: ' + error.message);
        }
    }

    /**
     * Charger le dashboard
     */
    async loadDashboard() {
        if (!this.user) {
            this.showPage('auth');
            return;
        }

        try {
            // Charger les contrats
            const contractsResponse = await fetch(
                `${this.apiUrl}/contracts/${this.user.id}`,
                { headers: { 'Authorization': `Bearer ${this.getToken()}` } }
            );

            const contracts = contractsResponse.ok
                ? await contractsResponse.json()
                : { contracts: [] };

            // Charger les sinistres
            const claimsResponse = await fetch(
                `${this.apiUrl}/claims/${this.user.id}`,
                { headers: { 'Authorization': `Bearer ${this.getToken()}` } }
            );

            const claims = claimsResponse.ok
                ? await claimsResponse.json()
                : { claims: [] };

            // Afficher les données
            this.updateDashboard(contracts.contracts, claims.claims);
        } catch (error) {
            console.error('Erreur chargement dashboard:', error);
        }
    }

    /**
     * Mettre à jour le dashboard avec les données
     */
    updateDashboard(contracts, claims) {
        const contractsDiv = document.querySelector('[data-section="contracts"]');
        const claimsDiv = document.querySelector('[data-section="claims"]');

        if (contractsDiv) {
            if (contracts.length === 0) {
                contractsDiv.innerHTML = '<p class="text-muted">Aucun contrat pour le moment</p>';
            } else {
                contractsDiv.innerHTML = contracts.map(c => `
                    <div class="contract-item">
                        <strong>${c.contract_number}</strong><br>
                        Status: ${c.status}<br>
                        Prime: ${c.premium_amount}€
                    </div>
                `).join('');
            }
        }

        if (claimsDiv) {
            if (claims.length === 0) {
                claimsDiv.innerHTML = '<p class="text-muted">Aucun sinistre déclaré</p>';
            } else {
                claimsDiv.innerHTML = claims.map(cl => `
                    <div class="claim-item">
                        <strong>${cl.claim_number}</strong><br>
                        Status: ${cl.status}<br>
                        Montant: ${cl.amount_claimed}€
                    </div>
                `).join('');
            }
        }
    }

    /**
     * Configurer les formulaires d'authentification
     */
    setupAuthForms() {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');

        if (loginForm) {
            loginForm.onsubmit = (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail')?.value;
                const password = document.getElementById('loginPassword')?.value;
                this.handleLogin(email, password);
            };
        }

        if (signupForm) {
            signupForm.onsubmit = (e) => {
                e.preventDefault();
                const formData = new FormData(signupForm);
                this.handleSignup(Object.fromEntries(formData));
            };
        }
    }

    /**
     * Configurer le formulaire de souscription
     */
    setupSubscribeForm() {
        const form = document.getElementById('subscribeForm');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                this.handleSubscribe(Object.fromEntries(formData));
            };
        }
    }

    /**
     * Déconnexion
     */
    logout() {
        localStorage.removeItem('suroUser');
        localStorage.removeItem('suroToken');
        this.user = null;
        this.updateNavigation();
        this.showPage('home');
        this.showSuccess('Déconnecté');
    }

    /**
     * Gestion utilisateur
     */
    setUser(user, token) {
        localStorage.setItem('suroUser', JSON.stringify(user));
        localStorage.setItem('suroToken', token);
        this.user = user;
    }

    getUser() {
        const user = localStorage.getItem('suroUser');
        return user ? JSON.parse(user) : null;
    }

    getToken() {
        return localStorage.getItem('suroToken');
    }

    /**
     * Mettre à jour la navigation
     */
    updateNavigation() {
        const clientBtn = document.querySelector('button:contains("Espace Client")') ||
                          Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Espace Client'));

        if (this.user && clientBtn) {
            clientBtn.textContent = `👤 ${this.user.first_name || this.user.email}`;
        }
    }

    /**
     * Messages d'erreur et succès
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 8px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Style pour les animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialiser l'app au chargement
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SuroApp();
});
