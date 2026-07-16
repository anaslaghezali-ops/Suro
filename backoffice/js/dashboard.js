/* SURO — Admin Dashboard (Supabase, static-hosting compatible)
 * Auth via Supabase; RLS + suro_admins enforce admin privileges.
 */

const ADMIN_LOGIN_PAGE = '../admin-login.html';

class AdminDashboard {
  constructor() {
    this.api = window.SURO_API;
    this.currentPage = 'dashboard';
    this.applications = null; // cache
    this.init();
  }

  async init() {
    const session = this.api.getSession();
    if (!session || !session.access_token) {
      window.location.href = ADMIN_LOGIN_PAGE;
      return;
    }

    // Vérifie les droits admin
    const isAdmin = await this.api.isAdmin();
    if (!isAdmin) {
      this.api.logout();
      window.location.href = ADMIN_LOGIN_PAGE;
      return;
    }

    const nameEl = document.querySelector('.user-name');
    if (nameEl) nameEl.textContent = session.email || 'Admin SURO';

    this.setupNavigation();
    this.loadDashboard();
  }

  handleAuthError(error) {
    if (/JWT|expired|401|invalid token/i.test(error.message || '')) {
      this.api.logout();
      window.location.href = ADMIN_LOGIN_PAGE;
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

    closeSidebar();
    this.currentPage = page;

    switch (page) {
      case 'dashboard': this.loadDashboard(); break;
      case 'applications': this.loadApplications(); break;
      case 'claims': this.loadClaims(); break;
      case 'payments': this.loadPayments(); break;
      case 'customers': this.loadCustomers(); break;
      case 'settings': break;
    }
  }

  async fetchApplications(force = false) {
    if (!this.applications || force) {
      this.applications = await this.api.adminGetApplications() || [];
    }
    return this.applications;
  }

  async loadDashboard() {
    try {
      const apps = await this.fetchApplications(true);
      const active = apps.filter(a => a.status === 'active');
      const pending = apps.filter(a => a.status === 'nouvelle');
      const revenue = active.reduce((sum, a) => sum + (Number(a.annual_premium) || 0), 0);
      const conversion = apps.length ? Math.round((active.length / apps.length) * 100) : 0;

      this.setText('stat-total-apps', apps.length);
      this.setText('stat-active', active.length);
      this.setText('stat-pending', pending.length);
      this.setText('stat-conversion', conversion);
      this.setText('stat-revenue', `${revenue.toLocaleString('fr-FR')} DH`);
      this.setText('stat-apps-change', pending.length);

      const tbody = document.getElementById('recent-apps-tbody');
      if (tbody) {
        const rows = apps.slice(0, 5);
        tbody.innerHTML = rows.length ? rows.map(a => `
          <tr>
            <td>${this.escape(a.customer_email)}</td>
            <td>${this.escape(a.customer_email)}</td>
            <td>${this.coverageLabel(a.coverage_type)}</td>
            <td><span class="status-badge status-${a.status}">${this.formatStatus(a.status)}</span></td>
            <td>${new Date(a.created_at).toLocaleDateString('fr-FR')}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="dashboard.viewApplicationDetail('${a.id}')">Voir</button></td>
          </tr>
        `).join('') : '<tr><td colspan="6" class="text-center">Aucune demande pour le moment</td></tr>';
      }
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading dashboard:', error);
      this.showError('Erreur lors du chargement du dashboard');
    }
  }

  async loadApplications() {
    try {
      const apps = await this.fetchApplications(true);
      const tbody = document.getElementById('applications-tbody');
      tbody.innerHTML = apps.length ? apps.map(a => `
        <tr>
          <td>${a.id.slice(0, 8)}…</td>
          <td>${this.vehicleLabel(a)}</td>
          <td>${this.escape(a.customer_email)}</td>
          <td>${this.escape(a.customer_phone || '—')}</td>
          <td>${this.coverageLabel(a.coverage_type)}</td>
          <td><span class="status-badge status-${a.status}">${this.formatStatus(a.status)}</span></td>
          <td>${new Date(a.created_at).toLocaleDateString('fr-FR')}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="dashboard.viewApplicationDetail('${a.id}')">Détails</button></td>
        </tr>
      `).join('') : '<tr><td colspan="8" class="text-center">Aucune demande</td></tr>';

      const info = document.getElementById('pagination-info');
      if (info) info.textContent = `${apps.length} demande(s)`;
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading applications:', error);
      this.showError('Erreur lors du chargement des demandes');
    }
  }

  async loadClaims() {
    try {
      const claims = await this.api.adminGetClaims() || [];
      const tbody = document.getElementById('claims-tbody');
      tbody.innerHTML = claims.length ? claims.map(c => `
        <tr>
          <td>${c.id.slice(0, 8)}…</td>
          <td>${(c.application_id || '').slice(0, 8)}…</td>
          <td>${this.escape(c.claim_type || 'N/A')}</td>
          <td>${this.escape((c.description || '').slice(0, 50))}…</td>
          <td><span class="status-badge status-${c.status}">${this.formatStatus(c.status)}</span></td>
          <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
          <td>
            <select class="filter-select" style="min-width:auto;padding:4px 8px" onchange="dashboard.updateClaimStatus('${c.id}', this.value)">
              ${['pending','approved','rejected','paid'].map(s => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${this.formatStatus(s)}</option>`).join('')}
            </select>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="7" class="text-center">Aucun sinistre déclaré</td></tr>';
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading claims:', error);
      this.showError('Erreur lors du chargement des sinistres');
    }
  }

  async updateClaimStatus(claimId, status) {
    try {
      await this.api.adminUpdateClaimStatus(claimId, status);
      this.showSuccess('Sinistre mis à jour');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      this.showError('Erreur lors de la mise à jour du sinistre');
    }
  }

  async loadPayments() {
    try {
      const apps = await this.fetchApplications();
      const paid = apps.filter(a => a.paid_at);
      const revenue = paid.reduce((sum, a) => sum + (Number(a.annual_premium) || 0), 0);

      this.setText('payments-total', paid.length);
      this.setText('payments-revenue', `${revenue.toLocaleString('fr-FR')} DH`);

      const tbody = document.getElementById('payments-tbody');
      tbody.innerHTML = paid.length ? paid.map(a => `
        <tr>
          <td>${this.escape(a.customer_email)}</td>
          <td>${a.annual_premium ? Number(a.annual_premium).toLocaleString('fr-FR') + ' DH' : '—'}</td>
          <td>${this.coverageLabel(a.coverage_type)}</td>
          <td>${new Date(a.paid_at).toLocaleDateString('fr-FR')}</td>
          <td><span class="status-badge status-active">Payé</span></td>
        </tr>
      `).join('') : '<tr><td colspan="5" class="text-center">Aucun paiement</td></tr>';
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading payments:', error);
      this.showError('Erreur lors du chargement des paiements');
    }
  }

  async loadCustomers() {
    try {
      const apps = await this.fetchApplications();
      const seen = new Set();
      const customers = [];
      apps.forEach(a => {
        if (!seen.has(a.customer_email)) {
          seen.add(a.customer_email);
          customers.push(a);
        }
      });

      const tbody = document.getElementById('customers-tbody') || this.createCustomersTable();
      if (!tbody) return;
      tbody.innerHTML = customers.length ? customers.map(c => `
        <tr>
          <td>${this.escape(c.customer_email)}</td>
          <td>${this.escape(c.customer_email)}</td>
          <td>${this.escape(c.customer_phone || '—')}</td>
          <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
          <td><span class="status-badge status-active">Actif</span></td>
        </tr>
      `).join('') : '<tr><td colspan="5" class="text-center">Aucun client</td></tr>';
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading customers:', error);
    }
  }

  async viewApplicationDetail(applicationId) {
    try {
      const apps = await this.fetchApplications();
      const app = apps.find(a => a.id === applicationId);
      if (!app) return;

      const [answers, documents] = await Promise.all([
        this.api.adminGetApplicationAnswers(applicationId).catch(() => []),
        this.api.adminGetDocuments(applicationId).catch(() => []),
      ]);

      const modal = document.getElementById('detail-modal');
      const body = document.getElementById('modal-body');

      const answersHtml = (answers || []).length
        ? (answers || []).map(a => `<p><strong>${this.escape(a.field_key)}:</strong> ${this.escape(a.field_value)}</p>`).join('')
        : '';

      const docsHtml = (documents || []).length
        ? (documents || []).map(d => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #F3F4F6;">
              <span>📄 ${this.escape(d.name)}</span>
              <button class="btn btn-ghost btn-sm" onclick="dashboard.deleteDocument('${d.id}', '${encodeURIComponent(d.storage_path)}', '${applicationId}')" style="color:#EF4444">Supprimer</button>
            </div>`).join('')
        : '<p style="color:#9CA3AF;font-size:13px;">Aucun document déposé pour ce client.</p>';

      body.innerHTML = `
        <h2>${this.vehicleLabel(app)}</h2>
        <div style="margin-top: 16px;">
          <p><strong>Email:</strong> ${this.escape(app.customer_email)}</p>
          <p><strong>Téléphone:</strong> ${this.escape(app.customer_phone || '—')}</p>
          <p><strong>Immatriculation:</strong> ${this.escape(app.immatriculation || '—')}</p>
          <p><strong>Couverture:</strong> ${this.coverageLabel(app.coverage_type)}</p>
          <p><strong>Prime annuelle:</strong> ${app.annual_premium ? Number(app.annual_premium).toLocaleString('fr-FR') + ' DH/an' : '—'}</p>
          <p><strong>Adresse de livraison:</strong> ${this.escape(app.address || '—')}</p>
          <p><strong>Statut:</strong> <span class="status-badge status-${app.status}">${this.formatStatus(app.status)}</span></p>
          <p><strong>Créée le:</strong> ${new Date(app.created_at).toLocaleDateString('fr-FR')}</p>
          ${answersHtml ? `<h3 style="margin-top:16px;font-size:15px;">Infos véhicule</h3>${answersHtml}` : ''}
        </div>

        <div style="margin-top: 20px; display: flex; gap: 12px; align-items:center;">
          <select id="status-select" class="filter-select">
            ${['nouvelle','active','cancelled'].map(s => `<option value="${s}" ${s === app.status ? 'selected' : ''}>${this.formatStatus(s)}</option>`).join('')}
          </select>
          <button class="btn btn-primary" onclick="dashboard.updateApplicationStatus('${app.id}')">Mettre à jour le statut</button>
        </div>

        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
          <h3 style="font-size:15px;margin-bottom:12px;">📄 Documents du client</h3>
          <div id="doc-list">${docsHtml}</div>
          <div style="margin-top: 16px;">
            <input type="file" id="doc-file" style="margin-bottom:8px;display:block;font-size:14px;">
            <button class="btn btn-primary" id="doc-upload-btn" onclick="dashboard.uploadDocument('${applicationId}')">
              Déposer un document
            </button>
            <p style="font-size:12px;color:#9CA3AF;margin-top:8px;">Le client verra ce document dans son espace, onglet « Mes Documents ».</p>
          </div>
        </div>
      `;

      modal.classList.add('open');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading application detail:', error);
      this.showError('Erreur lors du chargement des détails');
    }
  }

  async uploadDocument(applicationId) {
    const fileInput = document.getElementById('doc-file');
    const btn = document.getElementById('doc-upload-btn');
    if (!fileInput || !fileInput.files.length) {
      this.showError('Choisis un fichier à déposer');
      return;
    }

    const apps = await this.fetchApplications();
    const app = apps.find(a => a.id === applicationId);
    if (!app) return;

    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';

    try {
      await this.api.adminUploadDocument(app, fileInput.files[0]);
      this.showSuccess('Document déposé ✓');
      // Rafraîchit la liste dans le modal
      this.viewApplicationDetail(applicationId);
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Upload error:', error);
      this.showError('Erreur lors du dépôt : ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Déposer un document';
    }
  }

  async deleteDocument(docId, encodedPath, applicationId) {
    if (!confirm('Supprimer ce document ? Le client n\'y aura plus accès.')) return;
    try {
      await this.api.adminDeleteDocument({ id: docId, storage_path: decodeURIComponent(encodedPath) });
      this.showSuccess('Document supprimé');
      this.viewApplicationDetail(applicationId);
    } catch (error) {
      if (this.handleAuthError(error)) return;
      this.showError('Erreur lors de la suppression');
    }
  }

  async updateApplicationStatus(applicationId) {
    const status = document.getElementById('status-select').value;
    try {
      await this.api.adminUpdateApplicationStatus(applicationId, status);
      this.showSuccess('Statut mis à jour');
      closeModal();
      this.loadApplications();
      this.fetchApplications(true);
    } catch (error) {
      if (this.handleAuthError(error)) return;
      this.showError('Erreur lors de la mise à jour');
    }
  }

  // --- Helpers ---
  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  escape(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  vehicleLabel(a) {
    const parts = [a.marque, a.modele].filter(Boolean).join(' ');
    return parts ? this.escape(`${parts}${a.annee ? ` (${a.annee})` : ''}`) : this.escape(a.customer_email || 'Demande');
  }

  coverageLabel(type) {
    return type === 'complete' ? 'Complète' : type === 'minimal' ? 'Minimale' : (type ? this.escape(type) : 'N/A');
  }

  formatStatus(status) {
    const labels = {
      'nouvelle': 'En attente', 'active': 'Active', 'cancelled': 'Annulée',
      'pending': 'En attente', 'approved': 'Approuvé', 'rejected': 'Rejeté', 'paid': 'Payé',
    };
    return labels[status] || status;
  }

  createCustomersTable() {
    const page = document.getElementById('customers-page');
    if (!page) return null;
    const card = document.createElement('div');
    card.className = 'section-card';
    card.innerHTML = `
      <div class="section-header"><h3>Tous les clients</h3></div>
      <div class="table-responsive">
        <table class="admin-table">
          <thead><tr><th>Client</th><th>Email</th><th>Téléphone</th><th>Depuis</th><th>Statut</th></tr></thead>
          <tbody id="customers-tbody"><tr><td colspan="5" class="text-center">Chargement…</td></tr></tbody>
        </table>
      </div>`;
    page.appendChild(card);
    return document.getElementById('customers-tbody');
  }

  showError(message) { alert(message); }
  showSuccess(message) { console.log(message); }
}

// Initialize
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new AdminDashboard();
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
    window.location.href = ADMIN_LOGIN_PAGE;
  }
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
}

function manageProducts() {
  alert('Gestion des produits et tarifs : à venir. Pour l\'instant, ajuste les prix dans la table insurance_pricing de Supabase.');
}
