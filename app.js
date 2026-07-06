/**
 * SURO App - Main Application Router
 * Handles page navigation, dynamic loading, and event management
 */

class SuroApp {
    constructor() {
        this.currentPage = 'home';
        this.pages = {
            home: null,
            offers: null,
            faq: null,
            contact: null,
            subscribe: null,
            auth: null,
            dashboard: null,
            claim: null
        };
        this.user = localStorage.getItem('user');
        this.init();
    }

    /**
     * Initialize the app
     */
    async init() {
        console.log('[SURO] Initializing application...');
        
        // Load external pages
        await this.loadPages();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Show home page
        this.showPage('home');
        
        console.log('[SURO] Application initialized successfully ✓');
    }

    /**
     * Load external HTML pages dynamically
     */
    async loadPages() {
        const pageFiles = ['subscribe', 'auth', 'dashboard', 'claim'];
        
        for (const page of pageFiles) {
            try {
                const response = await fetch(`${page}.html`);
                if (!response.ok) {
                    console.warn(`[SURO] Page ${page}.html not found`);
                    continue;
                }
                const html = await response.text();
                this.pages[page] = html;
                console.log(`[SURO] Loaded ${page}.html ✓`);
            } catch (error) {
                console.error(`[SURO] Error loading ${page}.html:`, error);
            }
        }
    }

    /**
     * Show a specific page
     */
    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('section[id="home"], section[id="offers"], section[id="faq"], section[id="contact"], section[id="subscribe"], section[id="auth"], section[id="dashboard"], section[id="claim"]').forEach(page => {
            page.style.display = 'none';
        });

        // Load external page if needed
        if (this.pages[pageId] && !document.getElementById(pageId)) {
            const temp = document.createElement('div');
            temp.innerHTML = this.pages[pageId];
            document.querySelector('main').appendChild(temp.firstElementChild);
        }

        // Show selected page
        const page = document.getElementById(pageId);
        if (page) {
            page.style.display = 'block';
            
            // Special handlers
            if (pageId === 'dashboard') this.loadDashboard();
            
            window.scrollTo(0, 0);
            this.currentPage = pageId;
            console.log(`[SURO] Navigated to ${pageId}`);
        } else {
            console.warn(`[SURO] Page ${pageId} not found`);
        }
    }

    /**
     * Setup all event listeners for buttons
     */
    setupEventListeners() {
        console.log('[SURO] Setting up event listeners...');
        
        // Get all buttons
        const buttons = document.querySelectorAll('button');
        
        buttons.forEach(btn => {
            const text = btn.textContent.trim();
            
            // Souscrire button
            if (text === 'Souscrire') {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!this.user) {
                        this.showPage('auth');
                    } else {
                        this.showPage('subscribe');
                    }
                });
            }
            
            // Voir offres button
            if (text === 'Voir offres') {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const offersSection = document.getElementById('offers');
                    if (offersSection) {
                        offersSection.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            }
            
            // Espace Client button
            if (text === 'Espace Client') {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (this.user) {
                        this.showPage('dashboard');
                    } else {
                        this.showPage('auth');
                    }
                });
            }
            
            // Choisir buttons (Offres)
            if (text === 'Choisir') {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!this.user) {
                        this.showPage('auth');
                    } else {
                        this.showPage('subscribe');
                    }
                });
            }
        });
        
        console.log('[SURO] Event listeners setup complete ✓');
    }

    /**
     * Load dashboard data
     */
    loadDashboard() {
        if (!this.user) {
            this.showPage('auth');
            return;
        }
        console.log('[SURO] Loading dashboard for user:', this.user);
        // TODO: Load contracts and claims from backend
    }

    /**
     * Handle login
     */
    async login(email, password) {
        try {
            console.log('[SURO] Login attempt for:', email);
            // TODO: Call backend API
            this.user = JSON.stringify({ email, name: email.split('@')[0] });
            localStorage.setItem('user', this.user);
            this.showPage('dashboard');
        } catch (error) {
            console.error('[SURO] Login error:', error);
        }
    }

    /**
     * Handle logout
     */
    logout() {
        console.log('[SURO] Logout');
        localStorage.removeItem('user');
        this.user = null;
        this.showPage('home');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SuroApp();
});
