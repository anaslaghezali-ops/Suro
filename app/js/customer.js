/* SURO — Espace Client
 * Parle directement à Supabase (Auth + REST, RLS = chaque client ne voit que ses données).
 * Fonctionne en hébergement statique (GitHub Pages).
 */

const LOGIN_PAGE = '../customer-login.html';

// ⚠️ À personnaliser par l'équipe SURO : numéros officiels du support
const SUPPORT_PHONE = '+212600000000';
const SUPPORT_WHATSAPP = '212600000000'; // format international sans +

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
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) closeBtn.focus();
  document.addEventListener('keydown', _modalEscHandler);
}

class CustomerDashboard {
  constructor() {
    this.api = window.SURO_API;
    this.session = this.api.getSession();
    this.currentPage = 'dashboard';
    this.policies = null; // cache
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
    this.loadDashboard();
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
    if (phone) phone.href = 'tel:' + phoneNumber;
    if (wa) wa.href = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent('Bonjour SURO, j\'ai une urgence sinistre.');
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

    switch (page) {
      case 'dashboard': this.loadDashboard(); break;
      case 'policies': this.loadPolicies(); break;
      case 'claims': this.loadClaims(); break;
      case 'payments': this.loadPayments(); break;
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
      const name = (user.user_metadata && user.user_metadata.name) || user.email;
      const firstName = name.includes('@') ? name.split('@')[0] : name.split(' ')[0];
      const welcome = document.getElementById('welcome-name');
      const userName = document.getElementById('user-name');
      const avatar = document.getElementById('user-avatar');
      if (welcome) welcome.textContent = firstName;
      if (userName) userName.textContent = name;
      if (avatar) avatar.textContent = (firstName[0] || 'C').toUpperCase();
    } catch (error) {
      if (this.handleAuthError(error)) return;
    }
  }

  async loadDashboard() {
    try {
      const policies = await this.fetchPolicies(true);
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

      const tbody = document.getElementById('active-policies-tbody');
      const rows = policies.slice(0, 5);
      tbody.innerHTML = rows.length ? rows.map(p => `
        <tr>
          <td data-label="Véhicule">${this.vehicleLabel(p)}</td>
          <td data-label="Prime">${this.premiumLabel(p)}</td>
          <td data-label="Statut"><span class="status-badge status-${p.status}">${this.formatStatus(p.status)}</span></td>
          <td data-label=""><button class="btn btn-ghost btn-sm" onclick="dashboard.viewPolicyDetail('${p.id}')">Détails</button></td>
        </tr>
      `).join('') : this.emptyStateHTML(4, {
        title: 'Aucun contrat actif',
        desc: 'Souscris une assurance en quelques minutes.',
        ctaLabel: 'Nouvelle assurance',
        ctaOnclick: 'dashboard.newSubscription()',
      });
    } catch (error) {
      if (this.handleAuthError(error)) return;
      const tbody = document.getElementById('active-policies-tbody');
      if (tbody) tbody.innerHTML = this.errorStateHTML(4, 'dashboard.loadDashboard()');
    }
  }

  async loadPolicies() {
    try {
      const policies = await this.fetchPolicies(true);
      const statusFilter = document.getElementById('filter-policy-status')?.value || '';
      const filtered = statusFilter ? policies.filter(p => p.status === statusFilter) : policies;
      const tbody = document.getElementById('policies-tbody');

      tbody.innerHTML = filtered.length ? filtered.map(p => `
        <tr>
          <td data-label="Immatriculation">${p.immatriculation || '—'}</td>
          <td data-label="Véhicule">${this.vehicleLabel(p)}</td>
          <td data-label="Couverture">${this.coverageLabel(p.coverage_type)}</td>
          <td data-label="Prime">${this.premiumLabel(p)}</td>
          <td data-label="Statut"><span class="status-badge status-${p.status}">${this.formatStatus(p.status)}</span></td>
          <td data-label="" style="white-space:nowrap;">
            <button class="btn btn-ghost btn-sm" onclick="dashboard.viewPolicyDetail('${p.id}')">Détails</button>
            <button class="btn btn-ghost btn-sm" onclick="dashboard.renewPolicy('${p.id}')">Renouveler</button>
          </td>
        </tr>
      `).join('') : this.emptyStateHTML(6, {
        title: statusFilter ? 'Aucun contrat pour ce filtre' : 'Aucun contrat',
        desc: statusFilter ? 'Essaie un autre statut ou souscris une nouvelle assurance.' : 'Commence par souscrire ton assurance auto.',
        ctaLabel: 'Nouvelle assurance',
        ctaOnclick: 'dashboard.newSubscription()',
      });
    } catch (error) {
      if (this.handleAuthError(error)) return;
      const tbody = document.getElementById('policies-tbody');
      if (tbody) tbody.innerHTML = this.errorStateHTML(6, 'dashboard.loadPolicies()');
    }
  }

  async loadClaims() {
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
        .map(p => `<option value="${p.id}">${this.vehicleLabel(p)} — ${p.immatriculation || ''}</option>`)
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

  async loadPayments() {
    try {
      // Historique réel : une ligne par paiement (initial ET chaque renouvellement)
      const [payments, policies] = await Promise.all([
        this.api.getMyPayments().catch(() => []),
        this.fetchPolicies(),
      ]);

      // Associer chaque paiement à son contrat (pour afficher le véhicule)
      const byId = {};
      (policies || []).forEach(p => { byId[p.id] = p; });

      const total = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      document.getElementById('payment-total').textContent = `${total.toLocaleString('fr-FR')} DH`;
      document.getElementById('payment-count').textContent = (payments || []).length;

      const tbody = document.getElementById('payments-tbody');
      tbody.innerHTML = (payments || []).length ? payments.map(pay => {
        const policy = byId[pay.application_id];
        const contractLabel = policy ? this.vehicleLabel(policy) : 'Contrat auto';
        const kindLabel = pay.kind === 'renewal' ? 'Renouvellement' : 'Souscription';
        return `
        <tr>
          <td data-label="Montant">${pay.amount != null ? `${Number(pay.amount).toLocaleString('fr-FR')} DH` : '—'}</td>
          <td data-label="Contrat">${this.escape(contractLabel)} <span style="color:#9CA3AF;font-size:12px;">(${kindLabel})</span></td>
          <td data-label="Date">${new Date(pay.paid_at).toLocaleDateString('fr-FR')}</td>
          <td data-label="Statut"><span class="status-badge status-active">Payé</span></td>
        </tr>`;
      }).join('') : this.emptyStateHTML(4, {
        title: 'Aucun paiement',
        desc: 'Tes paiements apparaîtront ici après ta souscription.',
        ctaLabel: 'Souscrire une assurance',
        ctaOnclick: 'dashboard.newSubscription()',
      });
    } catch (error) {
      if (this.handleAuthError(error)) return;
      const tbody = document.getElementById('payments-tbody');
      if (tbody) tbody.innerHTML = this.errorStateHTML(4, 'dashboard.loadPayments()');
    }
  }

  async loadProfilePage() {
    try {
      const user = await this.api.getUser();
      const meta = user.user_metadata || {};

      document.getElementById('profile-email').value = user.email || '';
      document.getElementById('profile-name').value = meta.name || '';
      document.getElementById('profile-phone').value = meta.phone || '';
      document.getElementById('profile-created').value =
        user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '';

      document.getElementById('profile-form').onsubmit = (e) => this.updateProfile(e);
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading profile:', error);
    }
  }

  async updateProfile(e) {
    e.preventDefault();
    const name = document.getElementById('profile-name').value;
    const phone = document.getElementById('profile-phone').value;

    try {
      await this.api.updateUser({ data: { name, phone } });
      const displayName = name || this.session.email;
      document.getElementById('user-name').textContent = displayName;
      const firstName = displayName.includes('@') ? displayName.split('@')[0] : displayName.split(' ')[0];
      const welcome = document.getElementById('welcome-name');
      const avatar = document.getElementById('user-avatar');
      if (welcome) welcome.textContent = firstName;
      if (avatar) avatar.textContent = (firstName[0] || 'C').toUpperCase();
      toast('Profil mis à jour');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      toast('Erreur lors de la mise à jour du profil', 'err');
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

      const docsHtml = docs.length
        ? docs.map(d => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid #F3F4F6;">
              <span>📄 ${this.escape(d.name)}</span>
              <button class="btn btn-primary btn-sm" onclick="dashboard.downloadDoc('${this.escape(d.storage_path)}', '${this.escape(d.name).replace(/'/g, "\\'")}')">Télécharger</button>
            </div>`).join('')
        : `<p style="font-size:13px;color:#9CA3AF;margin:0;">
             Tes documents officiels (carte verte, attestation) apparaîtront ici dès que nos équipes les auront préparés.
             Un exemplaire te sera aussi envoyé à ton adresse.
           </p>`;

      body.innerHTML = `
        <h2>${this.vehicleLabel(p)}</h2>
        <div style="margin-top: 20px;">
          <p><strong>N° de contrat:</strong> SR-${String(p.id).replace(/-/g, '').slice(0, 8).toUpperCase()}</p>
          <p><strong>Immatriculation:</strong> ${this.escape(p.immatriculation || '—')}</p>
          <p><strong>Année:</strong> ${p.annee || '—'} — <strong>Puissance:</strong> ${p.puissance || '—'} CV</p>
          <p><strong>Couverture:</strong> ${this.coverageLabel(p.coverage_type)}</p>
          <p><strong>Prime annuelle:</strong> ${this.premiumLabel(p)}</p>
          <p><strong>Adresse de livraison:</strong> ${this.escape(p.address || '—')}</p>
          <p><strong>Statut:</strong> <span class="status-badge status-${p.status}">${this.formatStatus(p.status)}</span></p>
          <p><strong>Souscrit le:</strong> ${new Date(p.created_at).toLocaleDateString('fr-FR')}</p>
          ${p.expires_at ? `<p><strong>Échéance:</strong> ${new Date(p.expires_at).toLocaleDateString('fr-FR')}${this.isExpired(p) ? ' <span style="color:#EF4444;font-weight:600;">(expiré)</span>' : ''}</p>` : ''}
        </div>

        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
          <h3 style="font-size:15px;margin-bottom:12px;">📄 Documents de ce contrat</h3>
          ${docsHtml}
        </div>

        <div style="margin-top: 24px;">
          <button class="btn btn-primary" onclick="dashboard.renewPolicy('${p.id}')">🔄 Renouveler ce contrat</button>
        </div>
      `;

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

  // Souscrire un nouveau contrat : tunnel vierge (client déjà connecté)
  newSubscription() {
    localStorage.removeItem('suroTunnelPrefill');
    localStorage.removeItem('suro-state'); // repart d'un tunnel propre
    window.location.href = '../index.html#souscrire';
  }

  // Renouveler : PROLONGE le contrat existant d'un an (même contrat)
  async renewPolicy(policyId) {
    try {
      const policies = await this.fetchPolicies();
      const p = policies.find(x => x.id === policyId);
      if (!p) return;

      const premium = p.annual_premium
        ? `${Number(p.annual_premium).toLocaleString('fr-FR')} DH`
        : 'le montant de ta prime';
      if (!await confirmAction(`Renouveler ce contrat pour un an (${premium}) ?\nTon contrat sera prolongé, tu gardes le même numéro.`, { title: 'Renouveler', okLabel: 'Renouveler' })) {
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
      'nouvelle': 'En attente de paiement',
      'active': 'Active',
      'expired': 'Expirée',
      'cancelled': 'Annulée',
      'pending': 'En attente',
      'approved': 'Approuvé',
      'rejected': 'Rejeté',
      'paid': 'Payé',
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
