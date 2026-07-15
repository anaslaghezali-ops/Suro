// Admin Dashboard Controller
class AdminDashboard {
  constructor() {
    this.adminKey = localStorage.getItem('adminKey') || '';
    this.currentPage = 'dashboard';
    this.init();
  }

  init() {
    // Check if admin is authenticated
    if (!this.adminKey) {
      this.showLoginPrompt();
      return;
    }

    this.setupNavigation();
    this.loadDashboard();
    this.startAutoRefresh();
  }

  showLoginPrompt() {
    const key = prompt('Entrez la clé d\'administration SURO:');
    if (key) {
      localStorage.setItem('adminKey', key);
      this.adminKey = key;
      this.setupNavigation();
      this.loadDashboard();
    } else {
      window.location.href = '/';
    }
  }

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.navigateTo(page);
      });
    });
  }

  navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
      p.style.display = 'none';
    });

    // Show selected page
    const pageEl = document.getElementById(`${page}-page`);
    if (pageEl) {
      pageEl.style.display = 'block';
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`).classList.add('active');

    this.currentPage = page;

    // Load page data
    switch (page) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'applications':
        this.loadApplications();
        break;
      case 'claims':
        this.loadClaims();
        break;
      case 'payments':
        this.loadPayments();
        break;
      case 'customers':
        this.loadCustomers();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
  }

  async loadDashboard() {
    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: { 'x-admin-key': this.adminKey }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      // Update stats
      document.getElementById('stat-total-apps').textContent = data.totalApplications;
      document.getElementById('stat-active').textContent = data.activeApplications;
      document.getElementById('stat-pending').textContent = data.pendingApplications;
      document.getElementById('stat-conversion').textContent = data.conversionRate;
      document.getElementById('stat-revenue').textContent = `${data.totalRevenue.toLocaleString('fr-FR')} DH`;
      document.getElementById('stat-apps-change').textContent = Math.floor(Math.random() * 20 + 5); // Mock

      // Load recent applications
      await this.loadRecentApplications();
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.showError('Erreur lors du chargement du dashboard');
    }
  }

  async loadRecentApplications() {
    try {
      const response = await fetch('/api/admin/applications?limit=5', {
        headers: { 'x-admin-key': this.adminKey }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const tbody = document.getElementById('recent-apps-tbody');
      tbody.innerHTML = data.applications.map(app => `
        <tr>
          <td>${app.customer_name}</td>
          <td>${app.customer_email}</td>
          <td>${app.coverage_type || 'N/A'}</td>
          <td><span class="status-badge status-${app.status}">${this.formatStatus(app.status)}</span></td>
          <td>${new Date(app.created_at).toLocaleDateString('fr-FR')}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="dashboard.viewApplicationDetail('${app.id}')">Voir</button></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading recent applications:', error);
    }
  }

  async loadApplications() {
    try {
      const response = await fetch('/api/admin/applications?limit=20', {
        headers: { 'x-admin-key': this.adminKey }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const tbody = document.getElementById('applications-tbody');
      tbody.innerHTML = data.applications.map(app => `
        <tr>
          <td>${app.id.slice(0, 8)}...</td>
          <td>${app.customer_name}</td>
          <td>${app.customer_email}</td>
          <td>${app.customer_phone}</td>
          <td>${app.coverage_type || 'N/A'}</td>
          <td><span class="status-badge status-${app.status}">${this.formatStatus(app.status)}</span></td>
          <td>${new Date(app.created_at).toLocaleDateString('fr-FR')}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="dashboard.viewApplicationDetail('${app.id}')">Détails</button>
          </td>
        </tr>
      `).join('');

      document.getElementById('pagination-info').textContent = `Page ${data.page}/${data.pages}`;
    } catch (error) {
      console.error('Error loading applications:', error);
      this.showError('Erreur lors du chargement des applications');
    }
  }

  async loadClaims() {
    try {
      const response = await fetch('/api/admin/claims?limit=20', {
        headers: { 'x-admin-key': this.adminKey }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const tbody = document.getElementById('claims-tbody');
      tbody.innerHTML = data.claims.map(claim => `
        <tr>
          <td>${claim.id.slice(0, 8)}...</td>
          <td>${claim.application_id.slice(0, 8)}...</td>
          <td>${claim.claim_type || 'N/A'}</td>
          <td>${claim.description.slice(0, 50)}...</td>
          <td><span class="status-badge status-${claim.status}">${this.formatStatus(claim.status)}</span></td>
          <td>${new Date(claim.created_at).toLocaleDateString('fr-FR')}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="dashboard.viewClaimDetail('${claim.id}')">Gérer</button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading claims:', error);
      this.showError('Erreur lors du chargement des sinistres');
    }
  }

  async loadPayments() {
    try {
      const response = await fetch('/api/admin/payments', {
        headers: { 'x-admin-key': this.adminKey }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      document.getElementById('payments-total').textContent = data.totalPayments;
      document.getElementById('payments-revenue').textContent = `${data.totalRevenue.toLocaleString('fr-FR')} DH`;

      const tbody = document.getElementById('payments-tbody');
      tbody.innerHTML = data.payments.map(payment => `
        <tr>
          <td>${payment.customer_name}</td>
          <td>120 DH</td>
          <td>Virement bancaire</td>
          <td>${new Date(payment.paid_at).toLocaleDateString('fr-FR')}</td>
          <td><span class="status-badge status-active">Payé</span></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading payments:', error);
      this.showError('Erreur lors du chargement des paiements');
    }
  }

  async loadCustomers() {
    try {
      const response = await fetch('/api/admin/applications?limit=50', {
        headers: { 'x-admin-key': this.adminKey }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      // Group by email to get unique customers
      const customers = [];
      const seen = new Set();
      data.applications.forEach(app => {
        if (!seen.has(app.customer_email)) {
          seen.add(app.customer_email);
          customers.push(app);
        }
      });

      const tbody = document.getElementById('customers-tbody') || this.createCustomersTable();
      tbody.innerHTML = customers.slice(0, 20).map(customer => `
        <tr>
          <td>${customer.customer_name}</td>
          <td>${customer.customer_email}</td>
          <td>${customer.customer_phone}</td>
          <td>${new Date(customer.created_at).toLocaleDateString('fr-FR')}</td>
          <td><span class="status-badge status-active">Actif</span></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  }

  async loadSettings() {
    try {
      const response = await fetch('/api/admin/products', {
        headers: { 'x-admin-key': this.adminKey }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      console.log('Products loaded:', data.products);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async viewApplicationDetail(applicationId) {
    try {
      const response = await fetch(`/api/admin/applications/${applicationId}`, {
        headers: { 'x-admin-key': this.adminKey }
      });
      const app = await response.json();

      if (!response.ok) throw new Error(app.error);

      const modal = document.getElementById('detail-modal');
      const body = document.getElementById('modal-body');

      body.innerHTML = `
        <h2>${app.customer_name}</h2>
        <div style="margin-top: 20px;">
          <p><strong>Email:</strong> ${app.customer_email}</p>
          <p><strong>Téléphone:</strong> ${app.customer_phone}</p>
          <p><strong>Couverture:</strong> ${app.coverage_type}</p>
          <p><strong>Statut:</strong> <span class="status-badge status-${app.status}">${this.formatStatus(app.status)}</span></p>
          <p><strong>Créée le:</strong> ${new Date(app.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <div style="margin-top: 20px; display: flex; gap: 12px;">
          <select id="status-select" class="filter-select">
            <option value="nouvelle">Nouvelle</option>
            <option value="active" selected>Active</option>
            <option value="cancelled">Annulée</option>
          </select>
          <button class="btn btn-primary" onclick="dashboard.updateApplicationStatus('${app.id}')">Mettre à jour</button>
        </div>
      `;

      modal.classList.add('open');
    } catch (error) {
      console.error('Error loading application details:', error);
      this.showError('Erreur lors du chargement des détails');
    }
  }

  async updateApplicationStatus(applicationId) {
    const status = document.getElementById('status-select').value;

    try {
      const response = await fetch(`/api/admin/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: {
          'x-admin-key': this.adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      this.showSuccess('Application mise à jour');
      this.closeModal();
      this.loadApplications();
    } catch (error) {
      console.error('Error updating application:', error);
      this.showError('Erreur lors de la mise à jour');
    }
  }

  async viewClaimDetail(claimId) {
    // Similar to viewApplicationDetail but for claims
    console.log('Viewing claim:', claimId);
  }

  formatStatus(status) {
    const labels = {
      'nouvelle': 'Nouvelle',
      'active': 'Active',
      'cancelled': 'Annulée',
      'pending': 'En attente',
      'approved': 'Approuvé',
      'rejected': 'Rejeté',
      'paid': 'Payé'
    };
    return labels[status] || status;
  }

  createCustomersTable() {
    const page = document.getElementById('customers-page');
    if (!page) return null;

    const card = document.createElement('div');
    card.className = 'section-card';
    card.innerHTML = `
      <div class="section-header">
        <h3>Tous les clients</h3>
      </div>
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Inscrit le</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody id="customers-tbody">
            <tr><td colspan="5" class="text-center">Chargement...</td></tr>
          </tbody>
        </table>
      </div>
    `;
    page.appendChild(card);
    return document.getElementById('customers-tbody');
  }

  showError(message) {
    console.error(message);
    alert(message);
  }

  showSuccess(message) {
    console.log(message);
    // Could show a toast notification here
  }

  startAutoRefresh() {
    // Refresh dashboard every 5 minutes
    setInterval(() => {
      if (this.currentPage === 'dashboard') {
        this.loadDashboard();
      }
    }, 5 * 60 * 1000);
  }
}

// Initialize dashboard
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new AdminDashboard();
});

// Global functions
function logout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter?')) {
    localStorage.removeItem('adminKey');
    window.location.href = '/';
  }
}

function closeModal() {
  document.getElementById('detail-modal').classList.remove('open');
}

function manageProducts() {
  alert('Fonctionnalité de gestion des produits (à développer)');
}
