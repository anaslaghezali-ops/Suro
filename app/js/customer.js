/* SURO — Espace Client
 * Parle directement à Supabase (Auth + REST, RLS = chaque client ne voit que ses données).
 * Fonctionne en hébergement statique (GitHub Pages).
 */

const LOGIN_PAGE = '../customer-login.html';

// ⚠️ À personnaliser par l'équipe SURO : numéros officiels du support
const SUPPORT_PHONE = '+212600000000';
const SUPPORT_WHATSAPP = '212600000000'; // format international sans +

const Kyc = () => window.SuroKyc;

function toast(msg, type = 'ok') {
  if (window.SuroToast) window.SuroToast.show(msg, type);
  else alert(msg);
}

async function confirmAction(message, opts = {}) {
  if (window.SuroToast && window.SuroToast.confirm) {
    return window.SuroToast.confirm(message, opts);
  }
  return confirm(message);
}

let _modalFocusReturn = null;
let _modalFocusTrapHandler = null;

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function _modalEscHandler(e) {
  if (e.key === 'Escape') closeModal();
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  _modalFocusReturn = document.activeElement;
  modal.classList.add('open');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const title = modal.querySelector('h2');
  if (title) {
    if (!title.id) title.id = `${id}-title`;
    modal.setAttribute('aria-labelledby', title.id);
  }
  const content = modal.querySelector('.modal-content') || modal;
  const focusable = getFocusableElements(content);
  (focusable[0] || modal.querySelector('.modal-close')).focus();

  document.addEventListener('keydown', _modalEscHandler);
  _modalFocusTrapHandler = (e) => {
    if (e.key !== 'Tab') return;
    const items = getFocusableElements(content);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', _modalFocusTrapHandler);
}

class CustomerDashboard {
  constructor() {
    this.api = window.SURO_API;
    this.session = this.api.getSession();
    this.currentPage = 'dashboard';
    this.policies = null; // cache
    this.payments = null;
    this.documents = null;
    this._documentsPolicyId = null;
    this._nextRenewalPolicyId = null;
    this._profileSnapshot = null;
    this._profileFormBound = false;
    this.init();
  }

  init() {
    if (!this.session || !this.session.access_token) {
      window.location.href = LOGIN_PAGE;
      return;
    }

    if (window.SuroNotifications) {
      window.SuroNotifications.mount({ audience: 'customer', container: document.getElementById('notif-mount') });
    }

    this.setupNavigation();
    this.setupFilters();
    this.setupSupportLinks();
    this.loadProfileHeader();
    const pendingAppId = sessionStorage.getItem('suroPendingDocsAppId');
    if (pendingAppId) {
      sessionStorage.removeItem('suroPendingDocsAppId');
      this._documentsPolicyId = pendingAppId;
      this.navigateTo('documents');
    } else {
      const hashPage = (location.hash || '').replace(/^#/, '').split('?')[0];
      if (hashPage && document.getElementById(`${hashPage}-page`)) {
        this.navigateTo(hashPage);
      } else {
        this.loadDashboard();
      }
    }
    const kycInput = document.getElementById('kyc-file-input');
    if (kycInput) kycInput.addEventListener('change', (e) => this.onKycFileSelected(e));
  }

  setupFilters() {
    const policyFilter = document.getElementById('filter-policy-status');
    if (policyFilter) {
      policyFilter.addEventListener('change', () => this.loadPolicies());
    }
    const claimFilter = document.getElementById('filter-claim-status');
    if (claimFilter) {
      claimFilter.addEventListener('change', () => this.loadClaims());
    }
    const paymentFilter = document.getElementById('filter-payment-kind');
    if (paymentFilter) {
      paymentFilter.addEventListener('change', () => this.loadPayments());
    }
  }

  emptyStateHTML(colspan, { title, desc, ctaLabel, ctaOnclick }) {
    return `<tr><td colspan="${colspan}" class="table-empty-cell">
      <div class="table-empty">
        <p class="table-empty-title">${title}</p>
        ${desc ? `<p class="table-empty-desc">${desc}</p>` : ''}
        ${ctaLabel ? `<button type="button" class="btn btn-primary btn-sm" onclick="${ctaOnclick}">${ctaLabel}</button>` : ''}
      </div>
    </td></tr>`;
  }

  errorStateHTML(colspan, retryFn) {
    return `<tr><td colspan="${colspan}" class="table-empty-cell">
      <div class="table-empty table-empty--error">
        <p class="table-empty-title">Impossible de charger</p>
        <p class="table-empty-desc">Vérifie ta connexion et réessaie.</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="${retryFn}">Réessayer</button>
      </div>
    </td></tr>`;
  }

  skeletonRowsHTML(colspan, rows = 3) {
    const cells = Array.from({ length: colspan }, (_, i) =>
      `<td><span class="skeleton skeleton-text" style="width:${55 + (i * 11) % 30}%"></span></td>`
    ).join('');
    return Array.from({ length: rows }, () => `<tr class="skeleton-row">${cells}</tr>`).join('');
  }

  setPolicyListSkeleton(listId, rows = 3) {
    const el = document.getElementById(listId);
    if (el) {
      el.innerHTML = Array.from({ length: rows }, () => '<div class="policy-card-skeleton" aria-hidden="true"></div>').join('');
    }
  }

  policyListEmptyHTML({ title, desc, ctaLabel, ctaOnclick }) {
    return `<div class="policy-list-empty">
      <p class="table-empty-title">${title}</p>
      ${desc ? `<p class="table-empty-desc">${desc}</p>` : ''}
      ${ctaLabel ? `<button type="button" class="btn btn-primary btn-sm" onclick="${ctaOnclick}">${ctaLabel}</button>` : ''}
    </div>`;
  }

  policyListErrorHTML(retryFn) {
    return `<div class="policy-list-empty policy-list-empty--error">
      <p class="table-empty-title">Impossible de charger</p>
      <p class="table-empty-desc">Vérifie ta connexion et réessaie.</p>
      <button type="button" class="btn btn-secondary btn-sm" onclick="${retryFn}">Réessayer</button>
    </div>`;
  }

  vehicleTitle(p) {
    const parts = [p.marque, p.modele].filter(Boolean).join(' ');
    return parts || (p.coverage_type ? this.coverageShortLabel(p.coverage_type) : 'Contrat auto');
  }

  coverageShortLabel(type) {
    if (type === 'complete') return 'Complète';
    if (type === 'minimal') return 'Minimale';
    return type || '—';
  }

  vehicleIcon(p) {
    const icons = {
      voiture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14M6 16l-1-4.5 1.2-3.2A2 2 0 0 1 8.1 7h7.8a2 2 0 0 1 1.9 1.3L19 11.5 18 16"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/><path d="M8 11h8"/></svg>',
      moto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M9 17.5h5.5M6.5 15 9 11h4l2-2h3l1 3h-3"/><path d="M11 11 13.5 7H16"/></svg>',
    };
    return icons[p.vehicle_type === 'moto' ? 'moto' : 'voiture'];
  }

  vehicleTypeLabel(p) {
    return p.vehicle_type === 'moto' ? 'Moto' : 'Voiture';
  }

  expiryLabel(p) {
    if (!p.expires_at) return '—';
    return new Date(p.expires_at).toLocaleDateString('fr-FR');
  }

  policyNumber(p) {
    return `SR-${String(p.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  renderPolicyDetailDocs(docs) {
    const official = (docs || []).filter((d) => !d.document_type);
    if (!official.length) {
      return `<p class="policy-detail-docs-empty">
        Tes documents officiels apparaîtront ici. L'attestation est téléchargeable en PDF ;
        ta carte verte physique est expédiée à l'adresse indiquée lors de la souscription.
      </p>`;
    }
    return `<ul class="policy-detail-docs-list">
      ${official.map((d) => `
        <li class="policy-detail-doc">
          <div class="policy-detail-doc-info">
            <span class="policy-detail-doc-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg>
            </span>
            <span class="policy-detail-doc-name">${this.escape(d.name)}</span>
          </div>
          <button type="button" class="btn btn-ghost btn-sm"
            onclick="dashboard.downloadDoc('${this.escape(d.storage_path)}', '${this.escape(d.name).replace(/'/g, "\\'")}')">
            Télécharger
          </button>
        </li>`).join('')}
    </ul>`;
  }

  renderPolicyDetailHTML(p, docs) {
    const powerLabel = p.vehicle_type === 'moto' ? 'Cylindrée' : 'Puissance';
    const powerUnit = p.vehicle_type === 'moto' ? 'cm³' : 'CV';
    const expired = this.isExpired(p);
    const expiryHtml = p.expires_at
      ? `${new Date(p.expires_at).toLocaleDateString('fr-FR')}${expired ? ' <span class="policy-detail-expired">(expiré)</span>' : ''}`
      : '—';

    const actionBtn = this.renderPolicyPrimaryAction(p, this.summarizeKycForPolicy(p.id, docs), { size: 'lg' });

    return `
      <div class="policy-detail">
        <div class="policy-detail-hero">
          <div class="policy-detail-hero-main">
            <div class="policy-card__icon policy-detail-icon" aria-hidden="true">${this.vehicleIcon(p)}</div>
            <div class="policy-detail-hero-text">
              <p class="page-eyebrow">Contrat d'assurance</p>
              <h2 class="policy-detail-title">${this.escape(this.vehicleTitle(p))}</h2>
              <p class="policy-detail-ref">${this.policyNumber(p)}</p>
            </div>
          </div>
          <span class="status-badge status-${p.status}">${this.formatStatus(p.status)}</span>
        </div>

        <div class="policy-detail-chips">
          <span class="policy-chip policy-chip--plate">${this.escape(p.immatriculation || '—')}</span>
          ${p.annee ? `<span class="policy-chip">${p.annee}</span>` : ''}
          <span class="policy-chip">${this.escape(this.vehicleTypeLabel(p))}</span>
        </div>

        <p class="policy-detail-premium">${this.escape(this.premiumLabel(p))}</p>
        <p class="policy-detail-premium-hint">${this.escape(this.coverageLabel(p.coverage_type))}</p>

        <dl class="policy-detail-grid">
          <div class="policy-detail-row">
            <dt>Immatriculation</dt>
            <dd>${this.escape(p.immatriculation || '—')}</dd>
          </div>
          <div class="policy-detail-row">
            <dt>${powerLabel}</dt>
            <dd>${p.puissance ? `${p.puissance} ${powerUnit}` : '—'}</dd>
          </div>
          <div class="policy-detail-row">
            <dt>Couverture</dt>
            <dd>${this.escape(this.coverageShortLabel(p.coverage_type))}</dd>
          </div>
          <div class="policy-detail-row">
            <dt>Échéance</dt>
            <dd>${expiryHtml}</dd>
          </div>
          <div class="policy-detail-row">
            <dt>Souscrit le</dt>
            <dd>${new Date(p.created_at).toLocaleDateString('fr-FR')}</dd>
          </div>
          <div class="policy-detail-row policy-detail-row--full">
            <dt>Adresse de livraison</dt>
            <dd>${this.escape(p.address || '—')}</dd>
          </div>
        </dl>

        <section class="policy-detail-docs" aria-labelledby="policy-detail-docs-title">
          <h3 class="policy-detail-docs-title" id="policy-detail-docs-title">Documents</h3>
          ${this.renderPolicyDetailDocs(docs)}
        </section>

        <div class="policy-detail-actions">
          ${actionBtn}
        </div>
      </div>
    `;
  }

  renderPolicyPrimaryAction(p, kyc = null, { size = 'sm' } = {}) {
    const btnClass = size === 'lg' ? 'btn btn-primary' : 'btn btn-primary btn-sm';
    if (p.status === 'nouvelle') {
      const label = size === 'lg' ? 'Payer et activer mon contrat' : 'Payer';
      return `<button type="button" class="${btnClass}" onclick="dashboard.payPolicy('${p.id}')">${label}</button>`;
    }
    if (this.policyRequiresKyc(p) && kyc && !kyc.complete) {
      const label = size === 'lg' ? 'Compléter mon dossier' : 'Compléter le dossier';
      return `<button type="button" class="${btnClass}" onclick="dashboard.openDocumentsForPolicy('${p.id}')">${label}</button>`;
    }
    const label = size === 'lg' ? 'Renouveler ce contrat' : 'Renouveler';
    return `<button type="button" class="${btnClass}" onclick="dashboard.renewPolicy('${p.id}')">${label}</button>`;
  }

  policyActionButtons(p, kyc = null) {
    const detailBtn = `<button type="button" class="btn btn-ghost btn-sm" onclick="dashboard.viewPolicyDetail('${p.id}')">Détails</button>`;
    return `${detailBtn}${this.renderPolicyPrimaryAction(p, kyc)}`;
  }

  renderPolicyCard(p, { compact = false, kyc = null } = {}) {
    const status = p.status;
    const statusClass = this.getPolicyStatusClass(p, kyc);
    const statusLabel = this.getPolicyStatusLabel(p, kyc);
    const badge = `<span class="status-badge status-${statusClass}">${statusLabel}</span>`;
    const plate = this.escape(p.immatriculation || '—');
    const year = p.annee ? `<span class="policy-chip">${p.annee}</span>` : '';
    const title = this.escape(this.vehicleTitle(p));
    const coverage = this.escape(this.coverageShortLabel(p.coverage_type));
    const premium = this.escape(this.premiumLabel(p));
    const expiry = this.escape(this.expiryLabel(p));
    const typeLabel = this.escape(this.vehicleTypeLabel(p));
    const icon = this.vehicleIcon(p);

    const stat = (area, label, value, extraClass = '') => `
      <div class="policy-card__stat policy-card__stat--${area}">
        <span class="policy-card__stat-label">${label}</span>
        <span class="policy-card__stat-value${extraClass ? ` ${extraClass}` : ''}">${value}</span>
      </div>`;

    return `
      <article class="policy-card${compact ? ' policy-card--compact' : ''}" data-policy-id="${p.id}">
        <div class="policy-card__status-mobile">${badge}</div>
        <div class="policy-card__vehicle">
          <div class="policy-card__icon" aria-hidden="true">${icon}</div>
          <div>
            <div class="policy-card__name" title="${this.escape(this.vehicleLabel(p))}">${title}</div>
            <div class="policy-card__meta">
              <span class="policy-chip policy-chip--plate">${plate}</span>
              ${year}
            </div>
          </div>
        </div>
        ${compact ? '' : stat('coverage', 'Couverture', coverage, 'policy-card__stat-value--muted')}
        ${stat('price', 'Prime', premium, 'policy-card__stat-value--price')}
        ${compact ? '' : stat('expiry', 'Échéance', expiry)}
        ${compact ? '' : stat('mobile-only', 'Type', typeLabel)}
        <span class="policy-card__status">${badge}</span>
        <div class="policy-card__actions">${this.policyActionButtons(p, kyc)}</div>
      </article>
    `;
  }

  setTableSkeleton(tbodyId, colspan, rows = 3) {
    const tbody = document.getElementById(tbodyId);
    if (tbody) tbody.innerHTML = this.skeletonRowsHTML(colspan, rows);
  }

  async setupSupportLinks() {
    let phoneNumber = SUPPORT_PHONE;
    let waNumber = SUPPORT_WHATSAPP;

    // Contacts configurés par l'équipe dans l'admin (Paramètres → Contacts support)
    try {
      const settings = await this.api.getSettings() || [];
      const by = {};
      settings.forEach(s => { by[s.key] = s.value; });
      if (by.support_phone) phoneNumber = by.support_phone;
      if (by.support_whatsapp) waNumber = by.support_whatsapp;
    } catch (e) {
      /* fallback sur les constantes */
    }

    const phone = document.getElementById('sos-phone');
    const wa = document.getElementById('sos-whatsapp');
    const profileSupport = document.getElementById('profile-support-link');
    const profileWhatsapp = document.getElementById('profile-support-whatsapp');
    const paymentsSupport = document.getElementById('payments-support-link');
    if (phone) phone.href = 'tel:' + phoneNumber;
    if (wa) wa.href = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent('Bonjour SURO, j\'ai une urgence sinistre.');
    const supportHref = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent('Bonjour SURO, j\'ai une question sur mon compte.');
    if (profileSupport) {
      profileSupport.href = supportHref;
      profileSupport.target = '_blank';
      profileSupport.rel = 'noopener';
    }
    if (profileWhatsapp) {
      profileWhatsapp.href = supportHref;
    }
    if (paymentsSupport) {
      paymentsSupport.href = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent('Bonjour SURO, j\'ai une question sur un paiement.');
      paymentsSupport.target = '_blank';
      paymentsSupport.rel = 'noopener';
    }
    const policiesSupport = document.getElementById('policies-support-link');
    if (policiesSupport) {
      policiesSupport.href = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent('Bonjour SURO, j\'ai une question sur mon contrat.');
      policiesSupport.target = '_blank';
      policiesSupport.rel = 'noopener';
    }
  }

  // Redirige vers la connexion si le token a expiré
  handleAuthError(error) {
    if (/JWT|expired|401|invalid token/i.test(error.message || '')) {
      this.api.logout();
      window.location.href = LOGIN_PAGE;
      return true;
    }
    return false;
  }

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo(item.dataset.page);
      });
    });

    window.addEventListener('hashchange', () => {
      const page = (location.hash || '').replace(/^#/, '');
      if (page && document.getElementById(`${page}-page`)) {
        this.navigateTo(page);
      }
    });

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      const page = (link.getAttribute('href') || '').replace(/^#/, '');
      if (!page || !document.getElementById(`${page}-page`)) return;
      if (link.classList.contains('nav-item')) return;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo(page);
      });
    });
  }

  setDashboardStatsLoading(loading) {
    const grid = document.getElementById('dashboard-stats');
    if (grid) grid.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; });

    const pageEl = document.getElementById(`${page}-page`);
    if (pageEl) pageEl.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    // Ferme le menu mobile après la navigation
    closeSidebar();

    this.currentPage = page;
    if (page) {
      history.replaceState(null, '', `#${page}`);
    }

    switch (page) {
      case 'dashboard': this.loadDashboard(); break;
      case 'policies': this.loadPolicies(); break;
      case 'claims': this.loadClaims(); break;
      case 'payments': this.loadPayments(); break;
      case 'documents': this.loadDocumentsPage(); break;
      case 'subscribe': this.initSubscribeTunnel(); break;
      case 'profile': this.loadProfilePage(); break;
    }
  }

  async fetchPolicies(force = false) {
    if (!this.policies || force) {
      this.policies = await this.api.getMyPolicies() || [];
    }
    return this.policies;
  }

  async loadProfileHeader() {
    try {
      const user = await this.api.getUser();
      const meta = user.user_metadata || {};
      const prenom = meta.prenom
        || (meta.name && meta.name.trim().split(/\s+/)[0])
        || (user.email ? user.email.split('@')[0] : 'Client');
      const displayName = (meta.prenom && meta.nom)
        ? `${meta.prenom} ${meta.nom}`
        : (meta.name || user.email);
      const welcome = document.getElementById('welcome-name');
      const userName = document.getElementById('user-name');
      const avatar = document.getElementById('user-avatar');
      if (welcome) welcome.textContent = prenom;
      if (userName) userName.textContent = displayName;
      if (avatar) avatar.textContent = (prenom[0] || 'C').toUpperCase();
    } catch (error) {
      if (this.handleAuthError(error)) return;
    }
  }

  async loadDashboard() {
    this.setDashboardStatsLoading(true);
    this.setPolicyListSkeleton('active-policies-list', 3);
    try {
      const [policies, allDocs] = await Promise.all([
        this.fetchPolicies(true),
        this.fetchDocuments(true),
      ]);
      this.renderPendingPaymentBanner(policies, 'pending-payment-banner-dashboard');
      this.renderPendingDocsBanner(policies, allDocs, 'pending-docs-banner-dashboard');
      this.updateDocumentsNavBadge(policies, allDocs);
      const claims = await this.api.getMyClaims() || [];
      // Nombre réel de paiements (initial + renouvellements), pas de contrats
      const payments = await this.api.getMyPayments().catch(() => []);

      document.getElementById('stat-active-policies').textContent =
        policies.filter(p => p.status === 'active').length;
      document.getElementById('stat-claims').textContent = claims.length;
      document.getElementById('stat-payments').textContent = (payments || []).length;

      // Prochaine échéance = la plus proche parmi les contrats actifs
      const expiries = policies
        .filter(p => p.status === 'active' && p.expires_at)
        .map(p => new Date(p.expires_at))
        .sort((a, b) => a - b);
      document.getElementById('stat-next-renewal').textContent =
        expiries.length ? expiries[0].toLocaleDateString('fr-FR') : '—';

      const list = document.getElementById('active-policies-list');
      const rows = policies.slice(0, 5);
      list.innerHTML = rows.length ? rows.map((p) => this.renderPolicyCard(p, {
        compact: true,
        kyc: this.summarizeKycForPolicy(p.id, allDocs),
      })).join('') : this.policyListEmptyHTML({
        title: 'Aucun contrat actif',
        desc: 'Souscris une assurance en quelques minutes.',
        ctaLabel: 'Nouvelle assurance',
        ctaOnclick: 'dashboard.newSubscription()',
      });
      this.setDashboardStatsLoading(false);
    } catch (error) {
      this.setDashboardStatsLoading(false);
      if (this.handleAuthError(error)) return;
      const list = document.getElementById('active-policies-list');
      if (list) list.innerHTML = this.policyListErrorHTML('dashboard.loadDashboard()');
    }
  }

  async loadPolicies() {
    this.setPolicyListSkeleton('policies-list', 4);
    try {
      const [policies, allDocs] = await Promise.all([
        this.fetchPolicies(true),
        this.fetchDocuments(true),
      ]);
      this.renderPendingPaymentBanner(policies);
      this.renderPendingDocsBanner(policies, allDocs, 'pending-docs-banner');
      this.updateDocumentsNavBadge(policies, allDocs);
      await this.renderRenewalAside(policies, 'policies');
      const statusFilter = document.getElementById('filter-policy-status')?.value || '';
      const filtered = statusFilter ? policies.filter(p => p.status === statusFilter) : policies;
      const list = document.getElementById('policies-list');

      list.innerHTML = filtered.length ? filtered.map((p) => this.renderPolicyCard(p, {
        kyc: this.summarizeKycForPolicy(p.id, allDocs),
      })).join('') : this.policyListEmptyHTML({
        title: statusFilter ? 'Aucun contrat pour ce filtre' : 'Aucun contrat',
        desc: statusFilter ? 'Essaie un autre statut ou souscris une nouvelle assurance.' : 'Commence par souscrire ton assurance auto.',
        ctaLabel: 'Nouvelle assurance',
        ctaOnclick: 'dashboard.newSubscription()',
      });
    } catch (error) {
      if (this.handleAuthError(error)) return;
      const list = document.getElementById('policies-list');
      if (list) list.innerHTML = this.policyListErrorHTML('dashboard.loadPolicies()');
    }
  }

  async loadClaims() {
    this.setTableSkeleton('claims-tbody', 5, 3);
    try {
      const claims = await this.api.getMyClaims() || [];
      this.claims = claims;
      const statusFilter = document.getElementById('filter-claim-status')?.value || '';
      const filtered = statusFilter ? claims.filter(c => c.status === statusFilter) : claims;
      const tbody = document.getElementById('claims-tbody');

      tbody.innerHTML = filtered.length ? filtered.map(c => `
        <tr>
          <td data-label="Type">${this.escape(c.claim_type || 'N/A')}</td>
          <td data-label="Description">${this.escape((c.description || '').slice(0, 60))}${(c.description || '').length > 60 ? '…' : ''}</td>
          <td data-label="Date">${c.claim_date ? new Date(c.claim_date).toLocaleDateString('fr-FR') : '—'}</td>
          <td data-label="Statut"><span class="status-badge status-${c.status}">${this.formatStatus(c.status)}</span></td>
          <td data-label=""><button class="btn btn-primary btn-sm" onclick="dashboard.viewClaimDetail('${c.id}')">Suivre</button></td>
        </tr>
      `).join('') : this.emptyStateHTML(5, {
        title: statusFilter ? 'Aucun sinistre pour ce filtre' : 'Aucun sinistre déclaré',
        desc: 'En cas d\'incident, déclare-le ici pour un suivi rapide.',
        ctaLabel: 'Déclarer un sinistre',
        ctaOnclick: 'openNewClaimModal()',
      });

      await this.loadPoliciesForClaimForm();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      const tbody = document.getElementById('claims-tbody');
      if (tbody) tbody.innerHTML = this.errorStateHTML(5, 'dashboard.loadClaims()');
    }
  }

  async loadPoliciesForClaimForm() {
    try {
      const policies = await this.fetchPolicies();
      const select = document.getElementById('claim-policy');
      if (!select) return;

      const options = policies
        .filter(p => p.status === 'active')
        .map(p => `<option value="${this.escape(p.id)}">${this.escape(this.vehicleLabel(p))} — ${this.escape(p.immatriculation || '')}</option>`)
        .join('');

      select.innerHTML = '<option value="">-- Choisir un contrat --</option>' + options;
    } catch (error) {
      console.error('Error loading claim form policies:', error);
    }
  }

  async downloadDoc(path, name) {
    try {
      await this.api.downloadDocument(path, name);
    } catch (error) {
      toast('Document momentanément inaccessible', 'err');
    }
  }

  async fetchPayments(force = false) {
    if (!this.payments || force) {
      this.payments = await this.api.getMyPayments().catch(() => []);
    }
    return this.payments;
  }

  setPaymentsLoading(loading) {
    const hero = document.getElementById('payments-hero');
    const skeleton = document.getElementById('payments-hero-skeleton');
    const content = document.getElementById('payments-hero-content');
    if (!hero) return;
    hero.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (skeleton) skeleton.hidden = !loading;
    if (content) content.hidden = loading;
  }

  paymentKindLabel(kind) {
    return kind === 'renewal' ? 'Renouvellement' : 'Souscription';
  }

  paymentKindClass(kind) {
    return kind === 'renewal' ? 'payment-kind-badge--renewal' : 'payment-kind-badge--initial';
  }

  paymentStatusLabel(status) {
    const labels = {
      succeeded: 'Payé',
      pending: 'En attente',
      failed: 'Échoué',
    };
    return labels[status] || 'Payé';
  }

  paymentStatusClass(status) {
    if (status === 'pending') return 'pending';
    if (status === 'failed') return 'failed';
    return 'succeeded';
  }

  paymentMethodLabel(method) {
    const labels = {
      card: 'Carte bancaire',
      cmi: 'Paiement en ligne',
      transfer: 'Virement',
    };
    return labels[method] || (method ? method : 'Paiement en ligne');
  }

  renderPaymentsHero(payments) {
    const succeeded = (payments || []).filter(p => (p.status || 'succeeded') === 'succeeded');
    const total = succeeded.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const lastPayment = (payments || [])[0];

    const totalEl = document.getElementById('payment-total');
    const countEl = document.getElementById('payment-count');
    const lastEl = document.getElementById('payment-last-date');

    if (totalEl) {
      totalEl.textContent = succeeded.length
        ? `${total.toLocaleString('fr-FR')} DH`
        : '0 DH';
    }
    if (countEl) countEl.textContent = String((payments || []).length);
    if (lastEl) {
      lastEl.textContent = lastPayment?.paid_at
        ? new Date(lastPayment.paid_at).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        : '—';
    }
  }

  async renderRenewalAside(policies, prefix = 'payments') {
    const dateEl = document.getElementById(`${prefix}-next-renewal`);
    const hintEl = document.getElementById(`${prefix}-renewal-hint`);
    const renewBtn = document.getElementById(`${prefix}-renew-btn`);
    if (!dateEl || !hintEl) return;

    const active = (policies || []).filter(p => p.status === 'active' && p.expires_at);
    const sorted = active
      .map(p => ({ policy: p, expiry: new Date(p.expires_at) }))
      .sort((a, b) => a.expiry - b.expiry);

    if (!sorted.length) {
      if (prefix === 'payments') this._nextRenewalPolicyId = null;
      dateEl.textContent = '—';
      hintEl.textContent = 'Aucun renouvellement à prévoir pour le moment.';
      if (renewBtn) renewBtn.hidden = true;
      return;
    }

    const next = sorted[0];
    if (prefix === 'payments' || prefix === 'policies') {
      this._nextRenewalPolicyId = next.policy.id;
    }
    const daysLeft = Math.ceil((next.expiry - Date.now()) / (1000 * 60 * 60 * 24));
    dateEl.textContent = next.expiry.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const vehicle = this.vehicleLabel(next.policy);
    if (daysLeft <= 0) {
      hintEl.textContent = `${vehicle} — contrat expiré, pense à le renouveler.`;
    } else if (daysLeft <= 30) {
      hintEl.textContent = `${vehicle} — échéance dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.`;
    } else {
      hintEl.textContent = `${vehicle} — tu peux renouveler à tout moment.`;
    }

    if (renewBtn) renewBtn.hidden = false;
  }

  async renderPaymentsAside(policies) {
    await this.renderRenewalAside(policies, 'payments');
  }

  renewFromPaymentsAside() {
    if (this._nextRenewalPolicyId) {
      this.renewPolicy(this._nextRenewalPolicyId);
    }
  }

  renewFromPoliciesAside() {
    this.renewFromPaymentsAside();
  }

  async loadPayments() {
    this.setPaymentsLoading(true);
    this.setTableSkeleton('payments-tbody', 6, 4);
    try {
      const [payments, policies] = await Promise.all([
        this.fetchPayments(true),
        this.fetchPolicies(),
      ]);

      this.renderPaymentsHero(payments);
      await this.renderPaymentsAside(policies);
      this.setPaymentsLoading(false);

      const kindFilter = document.getElementById('filter-payment-kind')?.value || '';
      const filtered = kindFilter
        ? (payments || []).filter(p => (p.kind || 'initial') === kindFilter)
        : (payments || []);

      const byId = {};
      (policies || []).forEach(p => { byId[p.id] = p; });

      const tbody = document.getElementById('payments-tbody');
      tbody.innerHTML = filtered.length ? filtered.map(pay => {
        const policy = byId[pay.application_id];
        const contractLabel = policy ? this.vehicleLabel(policy) : 'Contrat auto';
        const status = pay.status || 'succeeded';
        const kind = pay.kind || 'initial';
        return `
        <tr>
          <td data-label="Montant"><span class="payment-amount">${pay.amount != null ? `${Number(pay.amount).toLocaleString('fr-FR')} DH` : '—'}</span></td>
          <td data-label="Contrat">${this.escape(contractLabel)}</td>
          <td data-label="Type"><span class="payment-kind-badge ${this.paymentKindClass(kind)}">${this.paymentKindLabel(kind)}</span></td>
          <td data-label="Date">${pay.paid_at ? new Date(pay.paid_at).toLocaleDateString('fr-FR') : '—'}</td>
          <td data-label="Statut"><span class="status-badge status-${this.paymentStatusClass(status)}">${this.paymentStatusLabel(status)}</span></td>
          <td data-label=""><button type="button" class="btn btn-ghost btn-sm" onclick="dashboard.viewPaymentDetail('${pay.id}')">Détails</button></td>
        </tr>`;
      }).join('') : this.emptyStateHTML(6, {
        title: kindFilter ? 'Aucun paiement pour ce filtre' : 'Aucun paiement',
        desc: kindFilter
          ? 'Essaie un autre type ou souscris une nouvelle assurance.'
          : 'Tes paiements apparaîtront ici après ta souscription.',
        ctaLabel: 'Souscrire une assurance',
        ctaOnclick: 'dashboard.newSubscription()',
      });
    } catch (error) {
      this.setPaymentsLoading(false);
      if (this.handleAuthError(error)) return;
      const tbody = document.getElementById('payments-tbody');
      if (tbody) tbody.innerHTML = this.errorStateHTML(6, 'dashboard.loadPayments()');
    }
  }

  async viewPaymentDetail(paymentId) {
    try {
      const payments = await this.fetchPayments();
      const pay = (payments || []).find(p => String(p.id) === String(paymentId));
      if (!pay) return;

      const policies = await this.fetchPolicies();
      const policy = (policies || []).find(p => p.id === pay.application_id);
      const body = document.getElementById('modal-body');
      const status = pay.status || 'succeeded';
      const kind = pay.kind || 'initial';

      body.innerHTML = `
        <p class="page-eyebrow" style="margin-bottom: 8px;">Reçu de paiement</p>
        <h2>${pay.amount != null ? `${Number(pay.amount).toLocaleString('fr-FR')} DH` : 'Paiement'}</h2>
        <p class="payment-detail-amount">${this.paymentStatusLabel(status)}</p>

        <dl class="payment-detail-grid">
          <div class="payment-detail-row">
            <dt>Contrat</dt>
            <dd>${this.escape(policy ? this.vehicleLabel(policy) : 'Contrat auto')}</dd>
          </div>
          <div class="payment-detail-row">
            <dt>Immatriculation</dt>
            <dd>${this.escape(policy?.immatriculation || '—')}</dd>
          </div>
          <div class="payment-detail-row">
            <dt>Type</dt>
            <dd><span class="payment-kind-badge ${this.paymentKindClass(kind)}">${this.paymentKindLabel(kind)}</span></dd>
          </div>
          <div class="payment-detail-row">
            <dt>Date</dt>
            <dd>${pay.paid_at ? new Date(pay.paid_at).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
            }) : '—'}</dd>
          </div>
          <div class="payment-detail-row">
            <dt>Méthode</dt>
            <dd>${this.escape(this.paymentMethodLabel(pay.method))}</dd>
          </div>
          <div class="payment-detail-row">
            <dt>Référence</dt>
            <dd>PAY-${String(pay.id).replace(/-/g, '').slice(0, 8).toUpperCase()}</dd>
          </div>
        </dl>

        ${policy ? `
          <div style="margin-top: 24px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="dashboard.viewPolicyDetail('${policy.id}')">Voir le contrat</button>
            ${kind === 'renewal' || policy.status === 'active' ? `<button type="button" class="btn btn-secondary btn-sm" onclick="dashboard.renewPolicy('${policy.id}')">Renouveler</button>` : ''}
          </div>
        ` : ''}
      `;

      openModal('detail-modal');
    } catch (error) {
      toast('Impossible d\'afficher ce paiement', 'err');
    }
  }

  formatProfileDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatProfileMemberDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const month = d.toLocaleDateString('fr-FR', { month: 'short' }).replace(/\.$/, '');
    return `${month} ${d.getFullYear()}`;
  }

  getProfileInitials(name, email) {
    const source = (name || email || 'C').trim();
    if (!source) return 'C';
    if (source.includes('@')) return source[0].toUpperCase();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return source[0].toUpperCase();
  }

  setProfileLoading(loading) {
    const hero = document.getElementById('profile-hero');
    const skeleton = document.getElementById('profile-hero-skeleton');
    const content = document.getElementById('profile-hero-content');
    const form = document.getElementById('profile-form');
    if (hero) hero.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (skeleton) skeleton.hidden = !loading;
    if (content) content.hidden = loading;
    if (form) {
      form.querySelectorAll('input, button').forEach((el) => {
        el.disabled = loading;
      });
    }
  }

  renderProfileHero(user) {
    const meta = user.user_metadata || {};
    const displayName = meta.name || user.email || 'Client';
    const email = user.email || '—';
    const createdLabel = user.created_at
      ? `Membre depuis ${this.formatProfileMemberDate(user.created_at)}`
      : 'Membre SURO';

    const nameEl = document.getElementById('profile-display-name');
    const emailEl = document.getElementById('profile-display-email');
    const badgeEl = document.getElementById('profile-member-badge');
    const avatarEl = document.getElementById('profile-avatar-lg');
    const detailEmail = document.getElementById('profile-detail-email');
    const detailCreated = document.getElementById('profile-detail-created');

    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = email;
    if (badgeEl) badgeEl.textContent = createdLabel;
    if (avatarEl) avatarEl.textContent = this.getProfileInitials(meta.name, user.email);
    if (detailEmail) detailEmail.textContent = email;
    if (detailCreated) {
      detailCreated.textContent = user.created_at
        ? this.formatProfileDate(user.created_at)
        : '—';
    }
  }

  setProfileFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (!input) return false;
    if (message) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
      return false;
    }
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
    return true;
  }

  validateProfileField(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return true;
    const value = input.value.trim();
    if (fieldId === 'profile-name') {
      if (!value) return this.setProfileFieldError(fieldId, 'Le nom est requis');
      if (value.length < 2) return this.setProfileFieldError(fieldId, 'Nom trop court');
      return this.setProfileFieldError(fieldId, '');
    }
    if (fieldId === 'profile-phone') {
      if (!value) return this.setProfileFieldError(fieldId, '');
      if (!/^[+]?[\d\s\-()]{10,}$/.test(value.replace(/\s/g, ''))) {
        return this.setProfileFieldError(fieldId, 'Numéro invalide (ex: +212 6 XX XX XX XX)');
      }
      return this.setProfileFieldError(fieldId, '');
    }
    return true;
  }

  validateProfileForm() {
    const nameOk = this.validateProfileField('profile-name');
    const phoneOk = this.validateProfileField('profile-phone');
    return nameOk && phoneOk;
  }

  isProfileDirty() {
    if (!this._profileSnapshot) return false;
    const name = document.getElementById('profile-name')?.value.trim() || '';
    const phone = document.getElementById('profile-phone')?.value.trim() || '';
    return name !== this._profileSnapshot.name || phone !== this._profileSnapshot.phone;
  }

  updateProfileDirtyState() {
    const footer = document.getElementById('profile-form-footer');
    const saveBtn = document.getElementById('profile-save-btn');
    const dirty = this.isProfileDirty();
    if (footer) footer.hidden = !dirty;
    if (saveBtn) saveBtn.disabled = !dirty;
  }

  resetProfileForm() {
    if (!this._profileSnapshot) return;
    document.getElementById('profile-name').value = this._profileSnapshot.name;
    document.getElementById('profile-phone').value = this._profileSnapshot.phone;
    this.validateProfileField('profile-name');
    this.validateProfileField('profile-phone');
    this.updateProfileDirtyState();
  }

  async loadProfileStats() {
    try {
      const [policies, payments] = await Promise.all([
        this.fetchPolicies(),
        this.api.getMyPayments().catch(() => []),
      ]);
      const activeCount = (policies || []).filter((p) => p.status === 'active').length;
      const paymentCount = (payments || []).length;
      const policiesEl = document.getElementById('profile-stat-policies');
      const paymentsEl = document.getElementById('profile-stat-payments');
      if (policiesEl) policiesEl.textContent = activeCount;
      if (paymentsEl) paymentsEl.textContent = paymentCount;
    } catch (error) {
      if (this.handleAuthError(error)) return;
    }
  }

  bindProfileForm() {
    if (this._profileFormBound) return;
    const form = document.getElementById('profile-form');
    const resetBtn = document.getElementById('profile-reset-btn');
    const discardBtn = document.getElementById('profile-discard-link');
    if (!form) return;

    form.addEventListener('input', () => this.updateProfileDirtyState());
    form.addEventListener('submit', (e) => this.updateProfile(e));

    ['profile-name', 'profile-phone'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener('blur', () => this.validateProfileField(id));
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetProfileForm());
    }

    if (discardBtn) {
      discardBtn.addEventListener('click', () => this.resetProfileForm());
    }

    this._profileFormBound = true;
  }

  async loadProfilePage() {
    this.setProfileLoading(true);
    this.bindProfileForm();

    try {
      const user = await this.api.getUser();
      const meta = user.user_metadata || {};
      const name = meta.name || '';
      const phone = meta.phone || '';

      this._profileSnapshot = { name, phone };
      document.getElementById('profile-name').value = name;
      document.getElementById('profile-phone').value = phone;

      this.renderProfileHero(user);
      this.validateProfileField('profile-name');
      this.validateProfileField('profile-phone');
      this.updateProfileDirtyState();
      await this.loadProfileStats();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading profile:', error);
      toast('Impossible de charger ton profil', 'err');
    } finally {
      this.setProfileLoading(false);
    }
  }

  async updateProfile(e) {
    e.preventDefault();
    if (!this.validateProfileForm()) {
      toast('Corrige les champs en erreur avant d\'enregistrer', 'err');
      return;
    }

    const name = document.getElementById('profile-name').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    const saveBtn = document.getElementById('profile-save-btn');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Enregistrement…';
    }

    try {
      await this.api.updateUser({ data: { name, phone } });
      this._profileSnapshot = { name, phone };
      this.updateProfileDirtyState();

      const user = await this.api.getUser();
      const displayName = name || user.email || this.session.email;
      document.getElementById('user-name').textContent = displayName;
      const firstName = displayName.includes('@') ? displayName.split('@')[0] : displayName.split(' ')[0];
      const welcome = document.getElementById('welcome-name');
      const avatar = document.getElementById('user-avatar');
      if (welcome) welcome.textContent = firstName;
      if (avatar) avatar.textContent = (firstName[0] || 'C').toUpperCase();

      this.renderProfileHero(user);
      toast('Profil mis à jour');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      toast('Erreur lors de la mise à jour du profil', 'err');
    } finally {
      if (saveBtn) {
        saveBtn.textContent = 'Enregistrer';
        this.updateProfileDirtyState();
      }
    }
  }

  async viewPolicyDetail(policyId) {
    try {
      const policies = await this.fetchPolicies();
      const p = policies.find(x => x.id === policyId);
      if (!p) return;

      const modal = document.getElementById('detail-modal');
      const body = document.getElementById('modal-body');

      // Documents rattachés à cette police (RLS = seulement les siens)
      let docs = [];
      try {
        docs = await this.api.getDocumentsForPolicy(policyId) || [];
      } catch (e) {
        docs = [];
      }

      body.innerHTML = this.renderPolicyDetailHTML(p, docs);

      openModal('detail-modal');
    } catch (error) {
      toast('Impossible d\'afficher ce contrat', 'err');
    }
  }

  escape(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Souscrire un nouveau contrat : tunnel dans l'espace client (client déjà connecté)
  newSubscription() {
    localStorage.removeItem('suroTunnelPrefill');
    localStorage.removeItem('suro-state');
    this.navigateTo('subscribe');
  }

  initSubscribeTunnel() {
    if (!window.SURO_OnboardingForm) return;

    if (!window.SURO_FORM) {
      window.SURO_FORM = new window.SURO_OnboardingForm();
      return;
    }

    window.SURO_FORM.store.reset();
    window.SURO_FORM.quoteError = false;
    window.SURO_FORM.currentStep = 0;
    window.SURO_FORM.secrets = {};
    window.SURO_FORM.fields = window.SURO_FORM.getFields();
    window.SURO_FORM.render();
  }

  async fetchDocuments(force = false) {
    if (!this.documents || force) {
      this.documents = await this.api.getMyDocuments() || [];
    }
    return this.documents;
  }

  summarizeKycForPolicy(applicationId, allDocs) {
    return Kyc().summarizeKycForPolicy(applicationId, allDocs);
  }

  policyRequiresKyc(p) {
    return p && p.status === 'active' && !!p.paid_at;
  }

  getPoliciesAwaitingDocs(policies, allDocs) {
    return (policies || []).filter((p) => {
      if (!this.policyRequiresKyc(p)) return false;
      return !this.summarizeKycForPolicy(p.id, allDocs).complete;
    });
  }

  getPolicyStatusLabel(p, kycSummary) {
    if (p.status === 'active' && kycSummary && !kycSummary.complete) {
      return 'En attente de pièces';
    }
    return this.formatStatus(p.status);
  }

  getPolicyStatusClass(p, kycSummary) {
    if (p.status === 'active' && kycSummary && !kycSummary.complete) {
      return 'pending-docs';
    }
    return p.status;
  }

  formatKycDocMeta(doc) {
    if (!doc) return '';
    const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    if (doc.status === 'approved' && doc.reviewed_at) {
      return `${this.escape(doc.name)} · Validé le ${new Date(doc.reviewed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (doc.status === 'rejected') return `${this.escape(doc.name)} · Refusé${date ? ` le ${date}` : ''}`;
    if (doc.status === 'pending') return `${this.escape(doc.name)} · Envoyé${date ? ` le ${date}` : ''}`;
    return this.escape(doc.name);
  }

  kycDocStatusLabel(doc) {
    if (!doc) return { label: 'À envoyer', tone: 'todo' };
    if (doc.status === 'approved') return { label: 'Validé', tone: 'ok' };
    if (doc.status === 'pending') return { label: 'En vérification', tone: 'review' };
    if (doc.status === 'rejected') return { label: 'À renvoyer', tone: 'ko' };
    return { label: 'À envoyer', tone: 'todo' };
  }

  renderKycProgressRing(received, total) {
    const slots = total || Kyc().KYC_SLOT_COUNT;
    const pct = Math.round((received / slots) * 100);
    return `<div class="docs-progress-ring" style="background:conic-gradient(var(--color-primary) ${pct}%, #fde68a 0)"><span>${received}/${slots}</span></div>`;
  }

  renderPendingDocsBanner(policies, allDocs, elId = 'pending-docs-banner-dashboard') {
    const el = document.getElementById(elId);
    if (!el) return;
    const awaiting = this.getPoliciesAwaitingDocs(policies, allDocs);
    if (!awaiting.length) { el.innerHTML = ''; return; }

    if (awaiting.length === 1) {
      const p = awaiting[0];
      const kyc = this.summarizeKycForPolicy(p.id, allDocs);
      el.innerHTML = `
        <div class="pending-banner pending-banner--docs" role="status">
          <div class="pending-banner-copy">
            <div class="pending-banner-title">Complète ton dossier — 3 pièces (recto + verso)</div>
            <p class="pending-banner-desc">CIN, permis et carte grise pour ${this.escape(this.vehicleLabel(p))}. ${kyc.received}/${kyc.totalSlots} faces reçues.</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="dashboard.openDocumentsForPolicy('${p.id}')">Compléter mon dossier</button>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="pending-banner pending-banner--docs" role="status">
          <div class="pending-banner-copy">
            <div class="pending-banner-title">${awaiting.length} dossiers à compléter</div>
            <p class="pending-banner-desc">Envoie ta CIN, ton permis et ta carte grise pour chaque contrat payé.</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="dashboard.navigateTo('documents')">Voir mes documents</button>
        </div>`;
    }
  }

  updateDocumentsNavBadge(policies, allDocs) {
    const badge = document.getElementById('nav-documents-badge');
    if (!badge) return;
    const count = this.getPoliciesAwaitingDocs(policies, allDocs).length;
    if (count > 0) {
      badge.textContent = String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  openDocumentsForPolicy(policyId) {
    this._documentsPolicyId = policyId;
    this.navigateTo('documents');
  }

  async loadDocumentsPage() {
    const container = document.getElementById('documents-content');
    if (!container) return;
    container.innerHTML = '<p class="policy-list-loading">Chargement…</p>';

    try {
      const [policies, allDocs] = await Promise.all([
        this.fetchPolicies(true),
        this.fetchDocuments(true),
      ]);
      this.updateDocumentsNavBadge(policies, allDocs);

      const eligible = policies.filter((p) => this.policyRequiresKyc(p));
      if (!eligible.length) {
        container.innerHTML = `<div class="docs-empty section-card">
          <p class="table-empty-title">Aucun dossier à compléter</p>
          <p class="table-empty-desc">Les pièces (CIN, permis, carte grise) sont demandées après le paiement d'un contrat.</p>
        </div>`;
        return;
      }

      let policyId = this._documentsPolicyId;
      if (!policyId || !eligible.some((p) => p.id === policyId)) {
        policyId = eligible.find((p) => !this.summarizeKycForPolicy(p.id, allDocs).complete)?.id || eligible[0].id;
      }
      this._documentsPolicyId = policyId;
      const policy = eligible.find((p) => p.id === policyId);
      const kyc = this.summarizeKycForPolicy(policyId, allDocs);

      const selector = eligible.length > 1 ? `
        <div class="filter-bar docs-policy-select">
          <label for="docs-policy-select" class="visually-hidden">Contrat</label>
          <select id="docs-policy-select" class="filter-select" onchange="dashboard.onDocumentsPolicyChange(this.value)">
            ${eligible.map((p) => `<option value="${p.id}" ${p.id === policyId ? 'selected' : ''}>${this.escape(this.vehicleLabel(p))}</option>`).join('')}
          </select>
        </div>` : '';

      const missingTypes = Kyc().KYC_DOC_TYPE_IDS.filter(
        (t) => Kyc().typeAggregateStatus(kyc.byType[t]) === 'missing'
          || Kyc().typeAggregateStatus(kyc.byType[t]) === 'rejected'
          || Kyc().typeAggregateStatus(kyc.byType[t]) === 'partial'
      );
      const bannerTitle = kyc.complete
        ? 'Dossier complet'
        : missingTypes.length === 1
          ? `${Kyc().KYC_DOC_TYPES.find((d) => d.id === missingTypes[0])?.label || 'Pièce'} incomplète`
          : 'Dernière étape avant activation';

      const bannerDesc = kyc.complete
        ? 'Tes 3 pièces (recto + verso) sont validées. Ton contrat est activé.'
        : 'Paiement reçu ✓ — Envoie le recto et le verso de chaque pièce. Validation sous 48 h ouvrées.';

      const chips = Kyc().KYC_DOC_TYPES.map((def) => {
        const agg = Kyc().typeAggregateStatus(kyc.byType[def.id]);
        let cls = 'doc-chip doc-chip--todo';
        let text = def.short;
        if (agg === 'approved') { cls = 'doc-chip doc-chip--done'; text = `${def.short} ✓`; }
        else if (agg === 'pending') text = `${def.short} · en vérification`;
        else if (agg === 'partial') text = `${def.short} · recto/verso incomplet`;
        else if (agg === 'rejected') text = `${def.short} · à corriger`;
        else text = `${def.short} · à envoyer`;
        return `<span class="${cls}">${text}</span>`;
      }).join('');

      container.innerHTML = `
        ${selector}
        <div class="docs-banner">
          <div class="docs-banner-copy">
            <strong>${bannerTitle}</strong>
            <p>${bannerDesc}</p>
            ${!kyc.complete ? `<div class="doc-checklist">${chips}</div>` : ''}
          </div>
          <div class="docs-progress">
            ${this.renderKycProgressRing(kyc.received, kyc.totalSlots)}
            <small>faces reçues · ${kyc.piecesComplete}/${kyc.totalPieces} pièces complètes</small>
          </div>
        </div>
        <div class="doc-list">
          ${Kyc().KYC_DOC_TYPES.map((def) => this.renderKycDocCard(policy, def, kyc.byType[def.id])).join('')}
        </div>
        <div class="docs-note">
          <strong>Conseil :</strong> une photo par face (recto et verso), en lumière naturelle et sans reflet. Les 3 pièces doivent correspondre au nom du titulaire du contrat.
        </div>`;
    } catch (error) {
      if (this.handleAuthError(error)) return;
      container.innerHTML = `<div class="table-empty table-empty--error">
        <p class="table-empty-title">Impossible de charger</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="dashboard.loadDocumentsPage()">Réessayer</button>
      </div>`;
    }
  }

  renderKycDocCard(policy, def, typeEntry) {
    const agg = Kyc().typeAggregateStatus(typeEntry);
    const cardClass = agg === 'approved' ? 'doc-card--done'
      : agg === 'pending' ? 'doc-card--pending-review'
        : agg === 'rejected' ? 'doc-card--rejected'
          : 'doc-card--missing';

    const hint = def.id === 'carte_grise' && policy.immatriculation
      ? `${def.hint} (${this.escape(policy.immatriculation)}).`
      : def.hint;

    const st = agg === 'approved' ? { label: 'Validé', tone: 'ok' }
      : agg === 'pending' ? { label: 'En vérification', tone: 'review' }
        : agg === 'rejected' ? { label: 'À renvoyer', tone: 'ko' }
          : agg === 'partial' ? { label: 'Incomplet', tone: 'todo' }
            : { label: 'À envoyer', tone: 'todo' };

    return `
      <article class="doc-card ${cardClass}">
        <div class="doc-icon${st.tone === 'ko' ? ' doc-icon--error' : ''}">${def.short}</div>
        <div class="doc-copy">
          <h3>${def.label}</h3>
          <p>${hint}</p>
          <div class="doc-sides">
            ${Kyc().KYC_SIDES.map((side) => this.renderKycSideSlot(policy, def, side, typeEntry[side])).join('')}
          </div>
        </div>
        <div class="doc-actions">
          <span class="doc-status doc-status--${st.tone}">${st.label}</span>
        </div>
      </article>`;
  }

  renderKycSideSlot(policy, def, side, doc) {
    const sideLabel = Kyc().KYC_SIDE_LABELS[side];
    const st = this.kycDocStatusLabel(doc);
    const rejectHtml = doc?.status === 'rejected' && doc.reject_reason
      ? `<div class="doc-reject"><strong>Refusé :</strong> ${this.escape(doc.reject_reason)}</div>`
      : '';

    const needsUpload = !doc || doc.status === 'rejected';
    const uploadZone = needsUpload ? `
      <div class="upload-zone upload-zone--compact">
        <strong>${sideLabel}</strong>
        JPG, PNG ou PDF · max. 5 Mo
      </div>` : `<div class="doc-meta">${this.formatKycDocMeta(doc)}</div>`;

    const actions = doc?.status === 'approved'
      ? `<button type="button" class="btn btn-ghost btn-sm" onclick="dashboard.downloadDoc('${this.escape(doc.storage_path)}', '${this.escape(doc.name).replace(/'/g, "\\'")}')">Voir</button>`
      : doc?.status === 'pending'
        ? `<button type="button" class="btn btn-ghost btn-sm" onclick="dashboard.triggerKycUpload('${policy.id}', '${def.id}', '${side}')">Remplacer</button>`
        : `<button type="button" class="btn btn-primary btn-sm" onclick="dashboard.triggerKycUpload('${policy.id}', '${def.id}', '${side}')">${doc?.status === 'rejected' ? 'Renvoyer' : 'Ajouter'}</button>`;

    return `
      <div class="doc-side-slot doc-side-slot--${st.tone}">
        <div class="doc-side-head">
          <span class="doc-side-label">${sideLabel}</span>
          <span class="doc-status doc-status--${st.tone}">${st.label}</span>
        </div>
        ${uploadZone}
        ${rejectHtml}
        <div class="doc-side-actions">${actions}</div>
      </div>`;
  }

  triggerKycUpload(applicationId, documentType, documentSide) {
    const input = document.getElementById('kyc-file-input');
    if (!input) return;
    input.dataset.applicationId = applicationId;
    input.dataset.documentType = documentType;
    input.dataset.documentSide = documentSide;
    input.value = '';
    input.click();
  }

  async onKycFileSelected(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    const applicationId = input.dataset.applicationId;
    const documentType = input.dataset.documentType;
    const documentSide = input.dataset.documentSide;
    if (!file || !applicationId || !documentType || !documentSide) return;

    try {
      await this.api.uploadPolicyDocument(applicationId, this.session.email, documentType, documentSide, file);
      toast('Document envoyé — en cours de vérification');
      await this.fetchDocuments(true);
      if (this.currentPage === 'documents') this.loadDocumentsPage();
      if (this.currentPage === 'dashboard') this.loadDashboard();
      if (this.currentPage === 'policies') this.loadPolicies();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      toast(error.message || 'Échec de l\'envoi', 'err');
    }
  }

  onDocumentsPolicyChange(policyId) {
    this._documentsPolicyId = policyId;
    this.loadDocumentsPage();
  }

  // Renouveler : PROLONGE le contrat existant d'un an (même contrat)
  // Bandeau « devis en attente de paiement » (accueil + « Mes contrats »)
  renderPendingPaymentBanner(policies, elId = 'pending-payment-banner') {
    const el = document.getElementById(elId);
    if (!el) return;
    const pending = (policies || []).filter(p => p.status === 'nouvelle');
    if (!pending.length) { el.innerHTML = ''; return; }

    if (pending.length === 1) {
      const p = pending[0];
      const amount = p.annual_premium ? `${Number(p.annual_premium).toLocaleString('fr-FR')} DH/an` : '';
      el.innerHTML = `
        <div class="pending-banner" role="status">
          <div class="pending-banner-copy">
            <div class="pending-banner-title">Devis en attente de paiement</div>
            <p class="pending-banner-desc">${this.escape(this.vehicleLabel(p))}${amount ? ` — ${amount}` : ''}. Ton contrat n'est pas actif tant que le paiement n'est pas effectué.</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="dashboard.payPolicy('${p.id}')">Payer maintenant</button>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="pending-banner" role="status">
          <div class="pending-banner-copy">
            <div class="pending-banner-title">${pending.length} devis en attente de paiement</div>
            <p class="pending-banner-desc">Règle-les depuis la liste ci-dessous (bouton « Payer ») pour activer tes contrats.</p>
          </div>
        </div>`;
    }
  }

  // Payer un devis en attente (statut 'nouvelle') → active le contrat
  async payPolicy(policyId) {
    try {
      const policies = await this.fetchPolicies();
      const p = policies.find(x => x.id === policyId);
      if (!p) return;

      const premium = p.annual_premium
        ? `${Number(p.annual_premium).toLocaleString('fr-FR')} DH`
        : 'le montant de ta prime';
      if (!await confirmAction(`Payer ${premium} pour activer ton contrat ?\nTon attestation sera préparée dès le paiement confirmé.`, {
        title: 'Payer mon contrat',
        okLabel: 'Payer maintenant',
        requireLegalConsent: true,
        legalBase: '../',
      })) {
        return;
      }

      await this.api.submitPayment(policyId, { method: 'card', amount: p.annual_premium || null, currency: 'MAD' });
      toast('Paiement confirmé — envoie tes pièces pour finaliser le dossier');

      closeModal();
      await this.fetchPolicies(true);
      sessionStorage.setItem('suroPendingDocsAppId', policyId);
      this.navigateTo('documents');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      toast('Erreur lors du paiement : ' + (error.message || ''), 'err');
    }
  }

  async renewPolicy(policyId) {
    try {
      const policies = await this.fetchPolicies();
      const p = policies.find(x => x.id === policyId);
      if (!p) return;

      const premium = p.annual_premium
        ? `${Number(p.annual_premium).toLocaleString('fr-FR')} DH`
        : 'le montant de ta prime';
      if (!await confirmAction(`Renouveler ce contrat pour un an (${premium}) ?\nTon contrat sera prolongé, tu gardes le même numéro.`, {
        title: 'Renouveler',
        okLabel: 'Renouveler',
        requireLegalConsent: true,
        legalBase: '../',
      })) {
        return;
      }

      const result = await this.api.renewPolicy(policyId);
      const newExpiry = Array.isArray(result) ? result[0] : result;
      const dateStr = newExpiry ? new Date(newExpiry).toLocaleDateString('fr-FR') : null;

      toast(dateStr
        ? `Contrat renouvelé — nouvelle échéance : ${dateStr}`
        : 'Contrat renouvelé');

      closeModal();
      await this.fetchPolicies(true);
      this.loadDashboard();
      if (this.currentPage === 'policies') this.loadPolicies();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      toast('Erreur lors du renouvellement : ' + (error.message || ''), 'err');
    }
  }

  vehicleLabel(p) {
    const parts = [p.marque, p.modele].filter(Boolean).join(' ');
    return parts ? `${parts}${p.annee ? ` (${p.annee})` : ''}` : (p.coverage_type ? this.coverageLabel(p.coverage_type) : 'Contrat auto');
  }

  coverageLabel(type) {
    return type === 'complete' ? 'Couverture complète' : type === 'minimal' ? 'Couverture minimale' : (type || '—');
  }

  premiumLabel(p) {
    return p.annual_premium ? `${Number(p.annual_premium).toLocaleString('fr-FR')} DH/an` : '—';
  }

  isExpired(p) {
    return p.expires_at && new Date(p.expires_at) < new Date();
  }

  // ===== SINISTRES V2 : suivi détaillé =====

  claimTimelineHTML(claim) {
    const s = claim.status;
    const decisionLabel = s === 'rejected' ? 'Rejeté' : s === 'approved' || s === 'paid' ? 'Approuvé' : 'Décision';
    const steps = [
      { label: 'Déclaré', date: claim.created_at, state: 'done' },
      { label: 'En examen', state: s === 'pending' ? 'current' : 'done' },
      { label: decisionLabel, state: s === 'pending' ? 'todo' : s === 'rejected' ? 'rejected' : 'done' },
      { label: s === 'paid' ? 'Indemnisé' : 'Indemnisation', state: s === 'paid' ? 'done' : s === 'approved' ? 'current' : 'todo' },
    ];
    // Un sinistre rejeté s'arrête à la décision
    const visible = s === 'rejected' ? steps.slice(0, 3) : steps;

    return `<div class="claim-timeline">` + visible.map(st => `
      <div class="tl-step tl-${st.state}">
        <span class="tl-dot"></span>
        <span class="tl-label">${st.label}</span>
        ${st.date ? `<span class="tl-date">${new Date(st.date).toLocaleDateString('fr-FR')}</span>` : ''}
      </div>`).join('') + `</div>`;
  }

  renderClaimMessages(messages) {
    if (!messages || !messages.length) {
      return '<p style="font-size:13px;color:#9CA3AF;">Pas encore de message. Une question sur ton dossier ? Écris-nous ici.</p>';
    }
    return messages.map(m => `
      <div class="msg msg-${m.sender === 'admin' ? 'admin' : 'customer'}">
        <div class="msg-meta">${m.sender === 'admin' ? 'SURO' : 'Toi'} — ${new Date(m.created_at).toLocaleDateString('fr-FR')} ${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="msg-body">${this.escape(m.body)}</div>
      </div>`).join('');
  }

  async viewClaimDetail(claimId) {
    try {
      const claims = this.claims || await this.api.getMyClaims() || [];
      const c = claims.find(x => x.id === claimId);
      if (!c) return;

      const [files, messages] = await Promise.all([
        this.api.getClaimFiles(claimId).catch(() => []),
        this.api.getClaimMessages(claimId).catch(() => []),
      ]);

      const filesHtml = (files || []).length
        ? (files || []).map(f => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #F3F4F6;">
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(f.content_type || '').startsWith('video') ? '🎬' : '📷'} ${this.escape(f.name)}</span>
              <button class="btn btn-ghost btn-sm" onclick="dashboard.downloadClaimMedia('${encodeURIComponent(f.storage_path)}', '${this.escape(f.name).replace(/'/g, "\\'")}')">Voir</button>
            </div>`).join('')
        : '<p style="font-size:13px;color:#9CA3AF;margin:0;">Aucune pièce jointe.</p>';

      const modal = document.getElementById('detail-modal');
      const body = document.getElementById('modal-body');

      body.innerHTML = `
        <h2>Sinistre — ${this.escape(c.claim_type || '')}</h2>
        <p style="color:#6B7280;font-size:14px;margin-top:4px;">Survenu le ${c.claim_date ? new Date(c.claim_date).toLocaleDateString('fr-FR') : '—'}</p>

        ${this.claimTimelineHTML(c)}

        <div style="margin-top:16px;padding:12px;background:#F9FAFB;border-radius:8px;font-size:14px;">
          ${this.escape(c.description || '')}
        </div>

        <div style="margin-top:20px;">
          <h3 style="font-size:15px;margin-bottom:8px;">📎 Pièces jointes</h3>
          ${filesHtml}
          <div style="margin-top:10px;">
            <input type="file" id="claim-extra-files" multiple accept="image/*,video/*" style="font-size:13px;">
            <button class="btn btn-secondary btn-sm" id="claim-extra-upload" onclick="dashboard.addClaimFiles('${claimId}')" style="margin-top:6px;">Ajouter des photos/vidéos</button>
          </div>
        </div>

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E5E7EB;">
          <h3 style="font-size:15px;margin-bottom:8px;">💬 Messages avec ton gestionnaire</h3>
          <div id="claim-messages">${this.renderClaimMessages(messages)}</div>
          <form id="claim-msg-form" style="display:flex;gap:8px;margin-top:12px;">
            <input type="text" id="claim-msg-input" placeholder="Écris ton message…" style="flex:1;padding:10px 12px;border:1px solid #E5E7EB;border-radius:8px;font-size:14px;" autocomplete="off">
            <button type="submit" class="btn btn-primary btn-sm">Envoyer</button>
          </form>
        </div>
      `;

      document.getElementById('claim-msg-form').onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('claim-msg-input');
        const text = input.value.trim();
        if (!text) return;
        try {
          await this.api.sendClaimMessage(claimId, text, 'customer');
          input.value = '';
          const msgs = await this.api.getClaimMessages(claimId).catch(() => []);
          document.getElementById('claim-messages').innerHTML = this.renderClaimMessages(msgs);
        } catch (err) {
          toast('Message non envoyé, réessaie.', 'err');
        }
      };

      openModal('detail-modal');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading claim detail:', error);
    }
  }

  async downloadClaimMedia(encodedPath, name) {
    try {
      await this.api.downloadClaimFile(decodeURIComponent(encodedPath), name);
    } catch (e) {
      toast('Fichier momentanément inaccessible', 'err');
    }
  }

  async addClaimFiles(claimId) {
    const input = document.getElementById('claim-extra-files');
    const btn = document.getElementById('claim-extra-upload');
    if (!input || !input.files.length) {
      toast('Choisis d\'abord un ou plusieurs fichiers', 'info');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Envoi…';
    try {
      for (const file of input.files) {
        await this.api.uploadClaimFile(claimId, this.session.email, file);
      }
      this.viewClaimDetail(claimId); // rafraîchit
    } catch (e) {
      toast('Erreur lors de l\'envoi : ' + (e.message || ''), 'err');
      btn.disabled = false;
      btn.textContent = 'Ajouter des photos/vidéos';
    }
  }

  formatStatus(status) {
    const labels = {
      'nouvelle': 'À payer',
      'active': 'Active',
      'expired': 'Expirée',
      'cancelled': 'Annulée',
      'pending': 'En attente',
      'approved': 'Approuvé',
      'rejected': 'Rejeté',
      'paid': 'Payé',
      'succeeded': 'Payé',
      'failed': 'Échoué',
    };
    return labels[status] || status;
  }
}

// Initialize dashboard
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new CustomerDashboard();
});

// Global functions
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggle = document.querySelector('.sidebar-toggle');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
  if (toggle && sidebar) {
    const open = sidebar.classList.contains('open');
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  }
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

async function logout() {
  if (await confirmAction('Tu veux te déconnecter ?', { title: 'Déconnexion', okLabel: 'Se déconnecter' })) {
    window.SURO_API.logout();
    window.location.href = LOGIN_PAGE;
  }
}

function closeModal() {
  document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
  document.removeEventListener('keydown', _modalEscHandler);
  if (_modalFocusTrapHandler) {
    document.removeEventListener('keydown', _modalFocusTrapHandler);
    _modalFocusTrapHandler = null;
  }
  if (_modalFocusReturn) {
    _modalFocusReturn.focus();
    _modalFocusReturn = null;
  }
}

function openNewClaimModal() {
  openModal('claim-modal');

  const form = document.getElementById('claim-form');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const policyId = document.getElementById('claim-policy').value;
    const claimType = document.getElementById('claim-type').value;
    const claimDate = document.getElementById('claim-date').value;
    const description = document.getElementById('claim-description').value;

    if (!policyId) {
      toast('Choisis un contrat', 'info');
      return;
    }

    const submitBtn = document.getElementById('claim-submit-btn');
    const filesInput = document.getElementById('claim-files');

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours…';

      // id généré côté client pour pouvoir rattacher les fichiers juste après
      const claimId = window.SURO_API.uuid();
      await window.SURO_API.declareClaim({
        id: claimId,
        application_id: policyId,
        claim_type: claimType,
        claim_date: claimDate || new Date().toISOString(),
        description,
      });

      // Upload des photos/vidéos
      let uploaded = 0;
      if (filesInput && filesInput.files.length) {
        submitBtn.textContent = 'Envoi des fichiers…';
        for (const file of filesInput.files) {
          try {
            await window.SURO_API.uploadClaimFile(claimId, dashboard.session.email, file);
            uploaded++;
          } catch (e) {
            console.error('Upload failed for', file.name, e);
          }
        }
      }

      window.SURO_API.track('claim_declared', null, { type: claimType, files: uploaded });
      toast('Sinistre déclaré' + (uploaded ? ` — ${uploaded} fichier(s) envoyé(s)` : '') + '. Nos équipes te recontactent rapidement.');
      closeModal();
      form.reset();
      dashboard.loadClaims();
    } catch (error) {
      toast('Erreur lors de la déclaration du sinistre', 'err');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Déclarer le sinistre';
    }
  };
}

function openChangePasswordModal() {
  openModal('password-modal');

  const form = document.getElementById('password-form');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword.length < 8) {
      toast('Minimum 8 caractères', 'info');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Les mots de passe ne correspondent pas', 'info');
      return;
    }

    try {
      await window.SURO_API.updateUser({ password: newPassword });
      toast('Mot de passe mis à jour');
      closeModal();
      form.reset();
    } catch (error) {
      toast('Erreur lors du changement de mot de passe', 'err');
    }
  };
}
