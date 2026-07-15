// Customer Dashboard Controller
class CustomerDashboard {
  constructor() {
    this.token = localStorage.getItem('customerToken') || '';
    this.customerEmail = localStorage.getItem('customerEmail') || '';
    this.currentPage = 'dashboard';
    this.init();
  }

  init() {
    // Check if customer is authenticated
    if (!this.token || !this.customerEmail) {
      this.redirectToLogin();
      return;
    }

    this.setupNavigation();
    this.loadProfile();
    this.loadDashboard();
    this.startAutoRefresh();
  }

  redirectToLogin() {
    window.location.href = '/customer-login.html';
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
      case 'policies':
        this.loadPolicies();
        break;
      case 'claims':
        this.loadClaims();
        break;
      case 'payments':
        this.loadPayments();
        break;
      case 'profile':
        this.loadProfilePage();
        break;
    }
  }

  async loadProfile() {
    try {
      const response = await fetch('/api/customer/profile', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      // Update header
      document.getElementById('user-name').textContent = data.customer.name || 'Client';
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

  async loadDashboard() {
    try {
      // Load policies count
      const policiesRes = await fetch('/api/customer/policies', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const policiesData = await policiesRes.json();

      // Load claims count
      const claimsRes = await fetch('/api/customer/claims', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const claimsData = await claimsRes.json();

      // Load payments count
      const paymentsRes = await fetch('/api/customer/payments', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const paymentsData = paymentsRes.json();

      // Update stats
      const policies = policiesData.policies || [];
      const claims = claimsData.claims || [];
      const payments = await paymentsData;

      document.getElementById('stat-active-policies').textContent = policies.filter(p => p.status === 'active').length;
      document.getElementById('stat-claims').textContent = claims.length;
      document.getElementById('stat-payments').textContent = (payments.payments || []).length;

      // Set next renewal (next policy expiration or mock date)
      if (policies.length > 0) {
        const nextPolicy = policies.find(p => p.status === 'active');
        if (nextPolicy) {
          const createdDate = new Date(nextPolicy.created_at);
          const renewalDate = new Date(createdDate.getTime() + 365 * 24 * 60 * 60 * 1000);
          document.getElementById('stat-next-renewal').textContent = renewalDate.toLocaleDateString('fr-FR');
        }
      }

      // Load recent policies
      await this.loadRecentPolicies();
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.showError('Erreur lors du chargement du tableau de bord');
    }
  }

  async loadRecentPolicies() {
    try {
      const response = await fetch('/api/customer/policies', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const tbody = document.getElementById('active-policies-tbody');
      const policies = (data.policies || []).filter(p => p.status === 'active').slice(0, 5);

      if (policies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Aucune police active</td></tr>';
        return;
      }

      tbody.innerHTML = policies.map(policy => `
        <tr>
          <td>${policy.coverage_type || 'N/A'}</td>
          <td>${new Date(policy.created_at).toLocaleDateString('fr-FR')}</td>
          <td><span class="status-badge status-${policy.status}">${this.formatStatus(policy.status)}</span></td>
          <td><button class="btn btn-ghost btn-sm" onclick="dashboard.viewPolicyDetail('${policy.id}')">Détails</button></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading recent policies:', error);
    }
  }

  async loadPolicies() {
    try {
      const response = await fetch('/api/customer/policies', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const tbody = document.getElementById('policies-tbody');
      const policies = data.policies || [];

      if (policies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Aucune police trouvée</td></tr>';
        return;
      }

      tbody.innerHTML = policies.map(policy => `
        <tr>
          <td>${policy.id.slice(0, 8)}...</td>
          <td>${policy.coverage_type || 'N/A'}</td>
          <td>${new Date(policy.created_at).toLocaleDateString('fr-FR')}</td>
          <td><span class="status-badge status-${policy.status}">${this.formatStatus(policy.status)}</span></td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="dashboard.viewPolicyDetail('${policy.id}')">Détails</button>
            ${policy.status === 'active' ? `<button class="btn btn-ghost btn-sm" onclick="dashboard.renewPolicy('${policy.id}')">Renouveler</button>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading policies:', error);
      this.showError('Erreur lors du chargement des polices');
    }
  }

  async loadClaims() {
    try {
      const response = await fetch('/api/customer/claims', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const tbody = document.getElementById('claims-tbody');
      const claims = data.claims || [];

      if (claims.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Aucun sinistre déclaré</td></tr>';
        return;
      }

      tbody.innerHTML = claims.map(claim => `
        <tr>
          <td>${claim.id.slice(0, 8)}...</td>
          <td>${claim.application_id.slice(0, 8)}...</td>
          <td>${claim.claim_type || 'N/A'}</td>
          <td>${claim.description.slice(0, 40)}...</td>
          <td><span class="status-badge status-${claim.status}">${this.formatStatus(claim.status)}</span></td>
          <td>${new Date(claim.created_at).toLocaleDateString('fr-FR')}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="dashboard.viewClaimDetail('${claim.id}')">Voir</button></td>
        </tr>
      `).join('');

      // Load policies for claim form
      await this.loadPoliciesForClaimForm();
    } catch (error) {
      console.error('Error loading claims:', error);
      this.showError('Erreur lors du chargement des sinistres');
    }
  }

  async loadPoliciesForClaimForm() {
    try {
      const response = await fetch('/api/customer/policies', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await response.json();

      if (!response.ok) return;

      const select = document.getElementById('claim-policy');
      const policies = data.policies || [];

      const policiesHtml = policies
        .filter(p => p.status === 'active')
        .map(p => `<option value="${p.id}">${p.coverage_type} (${new Date(p.created_at).toLocaleDateString('fr-FR')})</option>`)
        .join('');

      select.innerHTML = '<option value="">-- Choisir une police --</option>' + policiesHtml;
    } catch (error) {
      console.error('Error loading policies for claim form:', error);
    }
  }

  async loadPayments() {
    try {
      const response = await fetch('/api/customer/payments', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const payments = data.payments || [];
      const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

      document.getElementById('payment-total').textContent = `${totalAmount.toLocaleString('fr-FR')} DH`;
      document.getElementById('payment-count').textContent = payments.length;

      const tbody = document.getElementById('payments-tbody');

      if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Aucun paiement effectué</td></tr>';
        return;
      }

      tbody.innerHTML = payments.map(payment => `
        <tr>
          <td>${payment.amount.toLocaleString('fr-FR')} DH</td>
          <td>Virement bancaire</td>
          <td>${new Date(payment.date).toLocaleDateString('fr-FR')}</td>
          <td><span class="status-badge status-${payment.status}">${this.formatStatus(payment.status)}</span></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading payments:', error);
      this.showError('Erreur lors du chargement des paiements');
    }
  }

  async loadProfilePage() {
    try {
      const response = await fetch('/api/customer/profile', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const customer = data.customer;
      document.getElementById('profile-email').value = customer.email;
      document.getElementById('profile-name').value = customer.name || '';
      document.getElementById('profile-phone').value = customer.phone || '';
      document.getElementById('profile-created').value = new Date(customer.created_at).toLocaleDateString('fr-FR');

      // Setup form submission
      const form = document.getElementById('profile-form');
      form.onsubmit = (e) => this.updateProfile(e);
    } catch (error) {
      console.error('Error loading profile:', error);
      this.showError('Erreur lors du chargement du profil');
    }
  }

  async updateProfile(e) {
    e.preventDefault();

    const name = document.getElementById('profile-name').value;
    const phone = document.getElementById('profile-phone').value;

    try {
      const response = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, phone })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      this.showSuccess('Profil mis à jour');
      document.getElementById('user-name').textContent = name;
    } catch (error) {
      console.error('Error updating profile:', error);
      this.showError('Erreur lors de la mise à jour du profil');
    }
  }

  async viewPolicyDetail(policyId) {
    try {
      const response = await fetch(`/api/customer/policies/${policyId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const policy = data.policy;
      const modal = document.getElementById('detail-modal');
      const body = document.getElementById('modal-body');

      const answersHtml = (policy.answers || [])
        .map(a => `<p><strong>${a.field_key}:</strong> ${a.field_value}</p>`)
        .join('');

      body.innerHTML = `
        <h2>${policy.coverage_type}</h2>
        <div style="margin-top: 20px;">
          <p><strong>Numéro de police:</strong> ${policy.id}</p>
          <p><strong>Type de couverture:</strong> ${policy.coverage_type}</p>
          <p><strong>Statut:</strong> <span class="status-badge status-${policy.status}">${this.formatStatus(policy.status)}</span></p>
          <p><strong>Date de souscription:</strong> ${new Date(policy.created_at).toLocaleDateString('fr-FR')}</p>

          ${answersHtml ? `<h3 style="margin-top: 20px;">Détails de la couverture</h3>${answersHtml}` : ''}

          <div style="margin-top: 20px; display: flex; gap: 12px;">
            <button class="btn btn-primary" onclick="dashboard.downloadCertificate('${policy.id}')">Télécharger le certificat</button>
            ${policy.status === 'active' ? `<button class="btn btn-secondary" onclick="dashboard.renewPolicy('${policy.id}')">Renouveler</button>` : ''}
          </div>
        </div>
      `;

      modal.classList.add('open');
    } catch (error) {
      console.error('Error loading policy details:', error);
      this.showError('Erreur lors du chargement des détails');
    }
  }

  async viewClaimDetail(claimId) {
    try {
      const response = await fetch(`/api/customer/claims/${claimId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const claim = data.claim;
      const modal = document.getElementById('detail-modal');
      const body = document.getElementById('modal-body');

      body.innerHTML = `
        <h2>Sinistre ${claim.id.slice(0, 8)}</h2>
        <div style="margin-top: 20px;">
          <p><strong>Type:</strong> ${claim.claim_type}</p>
          <p><strong>Description:</strong> ${claim.description}</p>
          <p><strong>Date du sinistre:</strong> ${new Date(claim.claim_date).toLocaleDateString('fr-FR')}</p>
          <p><strong>Statut:</strong> <span class="status-badge status-${claim.status}">${this.formatStatus(claim.status)}</span></p>
          <p><strong>Déclaré le:</strong> ${new Date(claim.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
      `;

      modal.classList.add('open');
    } catch (error) {
      console.error('Error loading claim details:', error);
      this.showError('Erreur lors du chargement des détails');
    }
  }

  async downloadCertificate(policyId) {
    try {
      window.location.href = `/api/customer/certificate/${policyId}`;
    } catch (error) {
      console.error('Error downloading certificate:', error);
      this.showError('Erreur lors du téléchargement du certificat');
    }
  }

  async renewPolicy(policyId) {
    if (!confirm('Êtes-vous sûr de vouloir renouveler cette police?')) return;

    try {
      const response = await fetch(`/api/customer/renew/${policyId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      this.showSuccess('Police renouvelée avec succès');
      this.closeModal();
      this.loadDashboard();
    } catch (error) {
      console.error('Error renewing policy:', error);
      this.showError('Erreur lors du renouvellement de la police');
    }
  }

  formatStatus(status) {
    const labels = {
      'nouvelle': 'Nouvelle',
      'active': 'Active',
      'expired': 'Expirée',
      'cancelled': 'Annulée',
      'pending': 'En attente',
      'approved': 'Approuvé',
      'rejected': 'Rejeté',
      'paid': 'Payé',
      'completed': 'Complété'
    };
    return labels[status] || status;
  }

  showError(message) {
    console.error(message);
    alert(message);
  }

  showSuccess(message) {
    console.log(message);
    alert(message);
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
  dashboard = new CustomerDashboard();
});

// Global functions
function logout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter?')) {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerEmail');
    window.location.href = '/customer-login.html';
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

    try {
      const response = await fetch('/api/customer/claims', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dashboard.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          policy_id: policyId,
          claim_type: claimType,
          claim_date: claimDate,
          description
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      dashboard.showSuccess('Sinistre déclaré avec succès');
      closeModal();
      dashboard.loadClaims();
      form.reset();
    } catch (error) {
      console.error('Error submitting claim:', error);
      dashboard.showError('Erreur lors de la déclaration du sinistre');
    }
  };
}

function openChangePasswordModal() {
  document.getElementById('password-modal').classList.add('open');

  const form = document.getElementById('password-form');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      dashboard.showError('Les mots de passe ne correspondent pas');
      return;
    }

    // Note: Implement password change endpoint in customer routes
    dashboard.showSuccess('Fonctionnalité de changement de mot de passe à développer');
    closeModal();
    form.reset();
  };
}
