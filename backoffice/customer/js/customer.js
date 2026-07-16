/* SURO — Espace Client
 * Parle directement à Supabase (Auth + REST, RLS = chaque client ne voit que ses données).
 * Fonctionne en hébergement statique (GitHub Pages).
 */

const LOGIN_PAGE = '../../customer-login.html';

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

    this.setupNavigation();
    this.loadProfileHeader();
    this.loadDashboard();
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
      document.getElementById('user-name').textContent = name;
    } catch (error) {
      if (this.handleAuthError(error)) return;
    }
  }

  async loadDashboard() {
    try {
      const policies = await this.fetchPolicies(true);
      const claims = await this.api.getMyClaims() || [];
      const paid = policies.filter(p => p.paid_at);

      document.getElementById('stat-active-policies').textContent =
        policies.filter(p => p.status === 'active').length;
      document.getElementById('stat-claims').textContent = claims.length;
      document.getElementById('stat-payments').textContent = paid.length;

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
          <td>${this.vehicleLabel(p)}</td>
          <td>${this.premiumLabel(p)}</td>
          <td><span class="status-badge status-${p.status}">${this.formatStatus(p.status)}</span></td>
          <td><button class="btn btn-ghost btn-sm" onclick="dashboard.viewPolicyDetail('${p.id}')">Détails</button></td>
        </tr>
      `).join('') : '<tr><td colspan="4" class="text-center">Aucun contrat pour le moment</td></tr>';
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading dashboard:', error);
    }
  }

  async loadPolicies() {
    try {
      const policies = await this.fetchPolicies(true);
      const tbody = document.getElementById('policies-tbody');

      tbody.innerHTML = policies.length ? policies.map(p => `
        <tr>
          <td>${p.immatriculation || '—'}</td>
          <td>${this.vehicleLabel(p)}</td>
          <td>${this.coverageLabel(p.coverage_type)}</td>
          <td>${this.premiumLabel(p)}</td>
          <td><span class="status-badge status-${p.status}">${this.formatStatus(p.status)}</span></td>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-sm" onclick="dashboard.viewPolicyDetail('${p.id}')">Détails</button>
            <button class="btn btn-ghost btn-sm" onclick="dashboard.renewPolicy('${p.id}')">Renouveler</button>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="6" class="text-center">Aucun contrat trouvé</td></tr>';
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading policies:', error);
    }
  }

  async loadClaims() {
    try {
      const claims = await this.api.getMyClaims() || [];
      const tbody = document.getElementById('claims-tbody');

      tbody.innerHTML = claims.length ? claims.map(c => `
        <tr>
          <td>${(c.claim_type || 'N/A')}</td>
          <td>${(c.description || '').slice(0, 60)}${(c.description || '').length > 60 ? '…' : ''}</td>
          <td>${c.claim_date ? new Date(c.claim_date).toLocaleDateString('fr-FR') : '—'}</td>
          <td><span class="status-badge status-${c.status}">${this.formatStatus(c.status)}</span></td>
          <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
        </tr>
      `).join('') : '<tr><td colspan="5" class="text-center">Aucun sinistre déclaré</td></tr>';

      await this.loadPoliciesForClaimForm();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading claims:', error);
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
      alert('Document momentanément inaccessible');
    }
  }

  async loadPayments() {
    try {
      const policies = await this.fetchPolicies();
      const paid = policies.filter(p => p.paid_at);
      const total = paid.reduce((sum, p) => sum + (Number(p.annual_premium) || 0), 0);

      document.getElementById('payment-total').textContent = `${total.toLocaleString('fr-FR')} DH`;
      document.getElementById('payment-count').textContent = paid.length;

      const tbody = document.getElementById('payments-tbody');
      tbody.innerHTML = paid.length ? paid.map(p => `
        <tr>
          <td>${this.premiumLabel(p)}</td>
          <td>${this.vehicleLabel(p)}</td>
          <td>${new Date(p.paid_at).toLocaleDateString('fr-FR')}</td>
          <td><span class="status-badge status-active">Payé</span></td>
        </tr>
      `).join('') : '<tr><td colspan="4" class="text-center">Aucun paiement effectué</td></tr>';
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading payments:', error);
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
      document.getElementById('user-name').textContent = name || this.session.email;
      alert('Profil mis à jour ✓');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      alert('Erreur lors de la mise à jour du profil');
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

      modal.classList.add('open');
    } catch (error) {
      console.error('Error loading policy detail:', error);
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
    window.location.href = '../../index.html#souscrire';
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
      if (!confirm(`Renouveler ce contrat pour un an (${premium}) ?\nTon contrat sera prolongé, tu gardes le même numéro.`)) {
        return;
      }

      const result = await this.api.renewPolicy(policyId);
      const newExpiry = Array.isArray(result) ? result[0] : result;
      const dateStr = newExpiry ? new Date(newExpiry).toLocaleDateString('fr-FR') : null;

      alert(dateStr
        ? `Contrat renouvelé ✓ Nouvelle échéance : ${dateStr}`
        : 'Contrat renouvelé ✓');

      closeModal();
      await this.fetchPolicies(true); // recharge le cache
      this.loadDashboard();
      if (this.currentPage === 'policies') this.loadPolicies();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error renewing policy:', error);
      alert('Erreur lors du renouvellement : ' + (error.message || ''));
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
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

function logout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter?')) {
    window.SURO_API.logout();
    window.location.href = LOGIN_PAGE;
  }
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
}

function openNewClaimModal() {
  document.getElementById('claim-modal').classList.add('open');

  const form = document.getElementById('claim-form');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const policyId = document.getElementById('claim-policy').value;
    const claimType = document.getElementById('claim-type').value;
    const claimDate = document.getElementById('claim-date').value;
    const description = document.getElementById('claim-description').value;

    if (!policyId) {
      alert('Choisis un contrat');
      return;
    }

    try {
      await window.SURO_API.declareClaim({
        application_id: policyId,
        claim_type: claimType,
        claim_date: claimDate || new Date().toISOString(),
        description,
      });

      alert('Sinistre déclaré ✓ Nos équipes te recontactent rapidement.');
      closeModal();
      form.reset();
      dashboard.loadClaims();
    } catch (error) {
      console.error('Error submitting claim:', error);
      alert('Erreur lors de la déclaration du sinistre');
    }
  };
}

function openChangePasswordModal() {
  document.getElementById('password-modal').classList.add('open');

  const form = document.getElementById('password-form');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword.length < 8) {
      alert('Minimum 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      await window.SURO_API.updateUser({ password: newPassword });
      alert('Mot de passe mis à jour ✓');
      closeModal();
      form.reset();
    } catch (error) {
      alert('Erreur lors du changement de mot de passe');
    }
  };
}
