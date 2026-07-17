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

    if (window.SuroNotifications) {
      window.SuroNotifications.mount({ audience: 'admin', container: document.getElementById('notif-mount') });
    }

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
      case 'settings': this.loadSettings(); break;
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

      this.loadFunnel();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading dashboard:', error);
      this.showError('Erreur lors du chargement du dashboard');
    }
  }

  async loadFunnel() {
    const el = document.getElementById('funnel-body');
    if (!el) return;
    try {
      const rows = await this.api.adminGetFunnelStats(7) || [];
      const by = {};
      rows.forEach(r => { by[r.event] = Number(r.sessions) || 0; });

      const steps = [
        ['Visite du tunnel', 'tunnel_view'],
        ['Véhicule complété', 'quote_shown'],
        ['Couverture choisie', 'choice_selected'],
        ['Compte créé / connecté', null, (b) => (b.account_created || 0) + (b.account_login || 0)],
        ['Demande créée', 'application_created'],
        ['Écran paiement', 'payment_view'],
        ['Paiement réussi', 'payment_success'],
      ];

      const base = by.tunnel_view || 0;
      if (!base) {
        el.innerHTML = '<p class="text-center">Aucune visite trackée sur les 7 derniers jours.</p>';
        return;
      }

      el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">` + steps.map(([label, key, fn]) => {
        const n = fn ? fn(by) : (by[key] || 0);
        const pct = Math.round((n / base) * 100);
        return `
          <div style="display:grid;grid-template-columns:190px 1fr 90px;align-items:center;gap:12px;font-size:14px;">
            <span>${label}</span>
            <div style="background:var(--color-neutral-100);border-radius:6px;height:20px;overflow:hidden;">
              <div style="width:${Math.min(pct,100)}%;height:100%;background:var(--color-primary);border-radius:6px;"></div>
            </div>
            <span style="text-align:right;font-weight:600;">${n} <span style="color:var(--color-neutral-400);font-weight:400;">(${pct}%)</span></span>
          </div>`;
      }).join('') + `</div>
      <p style="margin-top:12px;font-size:12px;color:var(--color-neutral-400);">Sessions uniques — abandon principal = plus grande marche entre deux barres.</p>`;
    } catch (error) {
      el.innerHTML = '<p class="text-center">Funnel indisponible</p>';
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
      this.claimsCache = claims;
      const tbody = document.getElementById('claims-tbody');
      tbody.innerHTML = claims.length ? claims.map(c => `
        <tr>
          <td>${c.id.slice(0, 8)}…</td>
          <td>${(c.application_id || '').slice(0, 8)}…</td>
          <td>${this.escape(c.claim_type || 'N/A')}</td>
          <td>${this.escape((c.description || '').slice(0, 50))}…</td>
          <td><span class="status-badge status-${c.status}">${this.formatStatus(c.status)}</span></td>
          <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-sm" onclick="dashboard.viewClaimDetail('${c.id}')">Gérer</button>
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

  async viewClaimDetail(claimId) {
    try {
      const claims = this.claimsCache || await this.api.adminGetClaims() || [];
      const c = claims.find(x => x.id === claimId);
      if (!c) return;

      const [files, messages] = await Promise.all([
        this.api.getClaimFiles(claimId).catch(() => []),
        this.api.getClaimMessages(claimId).catch(() => []),
      ]);

      const filesHtml = (files || []).length
        ? (files || []).map(f => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #F3F4F6;">
              <span>${(f.content_type || '').startsWith('video') ? '🎬' : '📷'} ${this.escape(f.name)}</span>
              <button class="btn btn-ghost btn-sm" onclick="dashboard.downloadClaimMedia('${encodeURIComponent(f.storage_path)}', '${this.escape(f.name).replace(/'/g, "\\'")}')">Télécharger</button>
            </div>`).join('')
        : '<p style="color:#9CA3AF;font-size:13px;">Aucune pièce jointe.</p>';

      const messagesHtml = (messages || []).length
        ? (messages || []).map(m => `
            <div style="padding:8px 12px;border-radius:8px;margin-bottom:8px;background:${m.sender === 'admin' ? 'rgba(15,118,110,0.08)' : '#F3F4F6'};">
              <div style="font-size:11px;color:#6B7280;">${m.sender === 'admin' ? 'SURO (équipe)' : this.escape(m.sender_email || 'Client')} — ${new Date(m.created_at).toLocaleString('fr-FR')}</div>
              <div style="font-size:14px;">${this.escape(m.body)}</div>
            </div>`).join('')
        : '<p style="color:#9CA3AF;font-size:13px;">Aucun message.</p>';

      const modal = document.getElementById('detail-modal');
      const body = document.getElementById('modal-body');

      body.innerHTML = `
        <h2>Sinistre — ${this.escape(c.claim_type || 'N/A')}</h2>
        <div style="margin-top:12px;">
          <p><strong>Contrat:</strong> ${(c.application_id || '').slice(0, 8)}…</p>
          <p><strong>Survenu le:</strong> ${c.claim_date ? new Date(c.claim_date).toLocaleDateString('fr-FR') : '—'}</p>
          <p><strong>Déclaré le:</strong> ${new Date(c.created_at).toLocaleDateString('fr-FR')}</p>
          <p><strong>Statut:</strong> <span class="status-badge status-${c.status}">${this.formatStatus(c.status)}</span></p>
        </div>
        <div style="margin-top:12px;padding:12px;background:#F9FAFB;border-radius:8px;font-size:14px;">${this.escape(c.description || '')}</div>

        <div style="margin-top:20px;">
          <h3 style="font-size:15px;margin-bottom:8px;">📎 Pièces jointes du client</h3>
          ${filesHtml}
        </div>

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #E5E7EB;">
          <h3 style="font-size:15px;margin-bottom:8px;">💬 Conversation avec le client</h3>
          <div id="admin-claim-messages" style="max-height:220px;overflow-y:auto;">${messagesHtml}</div>
          <form id="admin-claim-msg-form" style="display:flex;gap:8px;margin-top:12px;">
            <input type="text" id="admin-claim-msg-input" placeholder="Répondre au client…" style="flex:1;padding:10px 12px;border:1px solid #E5E7EB;border-radius:8px;font-size:14px;" autocomplete="off">
            <button type="submit" class="btn btn-primary btn-sm">Envoyer</button>
          </form>
        </div>
      `;

      document.getElementById('admin-claim-msg-form').onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('admin-claim-msg-input');
        const text = input.value.trim();
        if (!text) return;
        try {
          await this.api.sendClaimMessage(claimId, text, 'admin');
          this.viewClaimDetail(claimId);
        } catch (err) {
          this.showError('Message non envoyé');
        }
      };

      modal.classList.add('open');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      console.error('Error loading claim detail:', error);
      this.showError('Erreur lors du chargement du sinistre');
    }
  }

  async downloadClaimMedia(encodedPath, name) {
    try {
      await this.api.downloadClaimFile(decodeURIComponent(encodedPath), name);
    } catch (e) {
      this.showError('Fichier inaccessible');
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
      // Vrais comptes clients (inscrits), avec ou sans contrat
      const customers = await this.api.adminListCustomers() || [];

      const tbody = document.getElementById('customers-tbody') || this.createCustomersTable();
      if (!tbody) return;
      tbody.innerHTML = customers.length ? customers.map(c => `
        <tr>
          <td>${this.escape(c.name || '—')} ${c.is_admin ? '<span class="status-badge status-active" style="margin-left:6px;">admin</span>' : ''}</td>
          <td>${this.escape(c.email)}</td>
          <td>${this.escape(c.phone || '—')}</td>
          <td>${c.registered_at ? new Date(c.registered_at).toLocaleDateString('fr-FR') : '—'}</td>
          <td>${c.contracts} contrat(s)</td>
        </tr>
      `).join('') : '<tr><td colspan="5" class="text-center">Aucun client inscrit</td></tr>';
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

      const field = (label, id, value, type) => `
        <label style="display:block;font-size:12px;font-weight:600;color:#4B5563;margin-bottom:12px;">
          ${label}
          <input type="${type || 'text'}" id="edit-${id}" value="${this.escape(value == null ? '' : value)}"
            style="display:block;width:100%;margin-top:4px;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;">
        </label>`;

      body.innerHTML = `
        <h2>${this.vehicleLabel(app)}</h2>
        <p style="color:#6B7280;font-size:13px;margin-top:4px;">${this.escape(app.customer_email)} · créé le ${new Date(app.created_at).toLocaleDateString('fr-FR')}</p>

        <h3 style="margin-top:20px;font-size:15px;">✏️ Modifier le contrat</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px;margin-top:12px;">
          ${field('Immatriculation', 'immatriculation', app.immatriculation)}
          ${field('Téléphone', 'customer_phone', app.customer_phone, 'tel')}
          ${field('Marque', 'marque', app.marque)}
          ${field('Modèle', 'modele', app.modele)}
          ${field('Année', 'annee', app.annee, 'number')}
          ${field('Puissance (CV)', 'puissance', app.puissance, 'number')}
        </div>
        <label style="display:block;font-size:12px;font-weight:600;color:#4B5563;margin-bottom:12px;">
          Couverture
          <select id="edit-coverage_type" style="display:block;width:100%;margin-top:4px;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;">
            <option value="minimal" ${app.coverage_type === 'minimal' ? 'selected' : ''}>Minimale (RC)</option>
            <option value="complete" ${app.coverage_type === 'complete' ? 'selected' : ''}>Complète</option>
          </select>
        </label>
        ${field('Adresse de livraison', 'address', app.address)}
        ${field('Prime annuelle (DH)', 'annual_premium', app.annual_premium, 'number')}
        <button class="btn btn-primary" onclick="dashboard.saveApplicationEdit('${app.id}')">💾 Enregistrer les modifications</button>

        <div style="margin-top: 20px; padding-top:16px; border-top:1px solid #E5E7EB; display: flex; gap: 12px; align-items:center;">
          <select id="status-select" class="filter-select">
            ${['nouvelle','active','expired','cancelled'].map(s => `<option value="${s}" ${s === app.status ? 'selected' : ''}>${this.formatStatus(s)}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" onclick="dashboard.updateApplicationStatus('${app.id}')">Changer le statut</button>
        </div>

        ${answersHtml ? `<details style="margin-top:16px;"><summary style="cursor:pointer;font-size:13px;color:#6B7280;">Données de souscription initiales</summary><div style="margin-top:8px;">${answersHtml}</div></details>` : ''}

        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
          <h3 style="font-size:15px;margin-bottom:12px;">📄 Documents du client</h3>
          <div id="doc-list">${docsHtml}</div>
          <div style="margin-top: 16px;">
            <input type="file" id="doc-file" style="margin-bottom:8px;display:block;font-size:14px;">
            <button class="btn btn-primary" id="doc-upload-btn" onclick="dashboard.uploadDocument('${applicationId}')">
              Déposer un document
            </button>
            <p style="font-size:12px;color:#9CA3AF;margin-top:8px;">Le client verra ce document dans son espace. Toute modification lui envoie une notification.</p>
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

  async saveApplicationEdit(applicationId) {
    const get = (id) => (document.getElementById('edit-' + id) || {}).value;
    const fields = {
      immatriculation: get('immatriculation') || null,
      customer_phone: get('customer_phone') || null,
      marque: get('marque') || null,
      modele: get('modele') || null,
      annee: parseInt(get('annee'), 10) || null,
      puissance: parseInt(get('puissance'), 10) || null,
      coverage_type: get('coverage_type') || null,
      address: get('address') || null,
      annual_premium: parseFloat(get('annual_premium')) || null,
    };
    try {
      await this.api.adminUpdateApplication(applicationId, fields);
      this.showSuccess('Contrat mis à jour');
      alert('Contrat mis à jour ✓ Le client a reçu une notification.');
      closeModal();
      this.fetchApplications(true);
      if (this.currentPage === 'applications') this.loadApplications();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      this.showError('Erreur lors de la mise à jour : ' + (error.message || ''));
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

  // ===== PARAMÈTRES =====

  async loadSettings() {
    this.loadPricingSection();
    this.loadSupportSection();
    this.loadAdminsSection();
    this.loadLogsSection();
  }

  coverageName(t) {
    return t === 'complete' ? 'Complète' : t === 'minimal' ? 'Minimale (RC)' : this.escape(t);
  }

  async loadPricingSection() {
    const el = document.getElementById('pricing-body');
    if (!el) return;
    try {
      const [pricing, factors] = await Promise.all([
        this.api.adminGetPricing(),
        this.api.adminGetFactors(),
      ]);

      const rowsHtml = (pricing || []).map(p => `
        <tr>
          <td>${this.coverageName(p.coverage_type)}</td>
          <td>${p.cv_min}–${p.cv_max === 99 ? '∞' : p.cv_max} CV</td>
          <td>
            <input type="number" id="price-${p.id}" value="${Number(p.annual_premium)}" min="0" step="50"
              style="width:110px;padding:6px 8px;border:1px solid var(--color-neutral-200);border-radius:6px;"> DH/an
          </td>
          <td><button class="btn btn-primary btn-sm" onclick="dashboard.savePricing('${p.id}')">Enregistrer</button></td>
        </tr>`).join('');

      const factorsHtml = (factors || []).map(f => `
        <tr>
          <td>${this.escape(f.description || f.key)}</td>
          <td>
            <input type="number" id="factor-${this.escape(f.key)}" value="${Number(f.factor)}" min="0" step="0.05"
              style="width:90px;padding:6px 8px;border:1px solid var(--color-neutral-200);border-radius:6px;"> ×
          </td>
          <td><button class="btn btn-primary btn-sm" onclick="dashboard.saveFactor('${this.escape(f.key)}')">Enregistrer</button></td>
        </tr>`).join('');

      el.innerHTML = `
        <div class="table-responsive">
          <table class="admin-table">
            <thead><tr><th>Couverture</th><th>Puissance</th><th>Prime annuelle</th><th></th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <h4 style="margin:20px 0 8px;font-size:14px;">Facteurs multiplicateurs (couverture complète)</h4>
        <div class="table-responsive">
          <table class="admin-table">
            <thead><tr><th>Règle</th><th>Facteur</th><th></th></tr></thead>
            <tbody>${factorsHtml}</tbody>
          </table>
        </div>`;
    } catch (error) {
      if (this.handleAuthError(error)) return;
      el.innerHTML = '<p class="text-center">Grille indisponible</p>';
    }
  }

  async savePricing(id) {
    const input = document.getElementById(`price-${id}`);
    const value = parseFloat(input && input.value);
    if (isNaN(value) || value < 0) { this.showError('Montant invalide'); return; }
    try {
      await this.api.adminUpdatePricing(id, value);
      this.showSuccess('Tarif mis à jour');
      alert('Tarif mis à jour ✓ Il s\'applique immédiatement aux nouveaux devis.');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      this.showError('Erreur lors de la mise à jour du tarif');
    }
  }

  async saveFactor(key) {
    const input = document.getElementById(`factor-${key}`);
    const value = parseFloat(input && input.value);
    if (isNaN(value) || value < 0) { this.showError('Facteur invalide'); return; }
    try {
      await this.api.adminUpdateFactor(key, value);
      alert('Facteur mis à jour ✓');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      this.showError('Erreur lors de la mise à jour du facteur');
    }
  }

  async loadSupportSection() {
    const el = document.getElementById('support-body');
    if (!el) return;
    try {
      const settings = await this.api.getSettings() || [];
      const by = {};
      settings.forEach(s => { by[s.key] = s.value; });

      el.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px;max-width:420px;">
          <label style="font-size:14px;font-weight:600;">Téléphone (format +2126XXXXXXXX)
            <input type="tel" id="setting-support_phone" value="${this.escape(by.support_phone || '')}"
              style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid var(--color-neutral-200);border-radius:8px;">
          </label>
          <label style="font-size:14px;font-weight:600;">WhatsApp (format international sans +, ex: 2126XXXXXXXX)
            <input type="text" id="setting-support_whatsapp" value="${this.escape(by.support_whatsapp || '')}"
              style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid var(--color-neutral-200);border-radius:8px;">
          </label>
          <button class="btn btn-primary" style="align-self:flex-start;" onclick="dashboard.saveSupport()">Enregistrer les contacts</button>
        </div>`;
    } catch (error) {
      el.innerHTML = '<p class="text-center">Paramètres indisponibles</p>';
    }
  }

  async saveSupport() {
    const phone = (document.getElementById('setting-support_phone') || {}).value || '';
    const wa = (document.getElementById('setting-support_whatsapp') || {}).value || '';
    try {
      await this.api.adminUpdateSetting('support_phone', phone.trim());
      await this.api.adminUpdateSetting('support_whatsapp', wa.trim());
      alert('Contacts mis à jour ✓ Visibles immédiatement dans l\'espace client.');
    } catch (error) {
      if (this.handleAuthError(error)) return;
      this.showError('Erreur lors de la mise à jour des contacts');
    }
  }

  async loadAdminsSection() {
    const el = document.getElementById('admins-body');
    if (!el) return;
    try {
      const admins = await this.api.adminListAdmins() || [];
      const rows = admins.map(a => `
        <tr>
          <td>${this.escape(a.email)}</td>
          <td>${new Date(a.admin_since).toLocaleDateString('fr-FR')}</td>
          <td><button class="btn btn-ghost btn-sm" style="color:#EF4444;" onclick="dashboard.removeAdmin('${this.escape(a.email)}')">Retirer</button></td>
        </tr>`).join('');

      el.innerHTML = `
        <div class="table-responsive">
          <table class="admin-table">
            <thead><tr><th>Email</th><th>Admin depuis</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
          <input type="email" id="new-admin-email" placeholder="email@exemple.com"
            style="flex:1;min-width:220px;padding:10px 12px;border:1px solid var(--color-neutral-200);border-radius:8px;">
          <button class="btn btn-primary" onclick="dashboard.addAdmin()">+ Ajouter un admin</button>
        </div>`;
    } catch (error) {
      if (this.handleAuthError(error)) return;
      el.innerHTML = '<p class="text-center">Liste indisponible</p>';
    }
  }

  async addAdmin() {
    const input = document.getElementById('new-admin-email');
    const email = (input && input.value || '').trim();
    if (!email) { this.showError('Entre un email'); return; }
    try {
      await this.api.adminAddAdmin(email);
      alert('Admin ajouté ✓');
      this.loadAdminsSection();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      this.showError(error.message || 'Erreur lors de l\'ajout');
    }
  }

  async removeAdmin(email) {
    if (!confirm(`Retirer les droits admin de ${email} ?`)) return;
    try {
      await this.api.adminRemoveAdmin(email);
      alert('Droits retirés ✓');
      this.loadAdminsSection();
    } catch (error) {
      if (this.handleAuthError(error)) return;
      this.showError(error.message || 'Erreur lors du retrait');
    }
  }

  async loadLogsSection() {
    const el = document.getElementById('logs-body');
    if (!el) return;
    try {
      const events = await this.api.adminRecentEvents(50) || [];
      if (!events.length) {
        el.innerHTML = '<p class="text-center">Aucun événement enregistré.</p>';
        return;
      }
      el.innerHTML = `
        <div class="table-responsive">
          <table class="admin-table">
            <thead><tr><th>Quand</th><th>Événement</th><th>Étape</th><th>Détails</th></tr></thead>
            <tbody>
              ${events.map(e => `
                <tr>
                  <td style="white-space:nowrap;">${new Date(e.created_at).toLocaleString('fr-FR')}</td>
                  <td><strong>${this.escape(e.event)}</strong></td>
                  <td>${this.escape(e.step || '—')}</td>
                  <td style="font-size:12px;color:var(--color-neutral-600);">${e.meta ? this.escape(JSON.stringify(e.meta)) : '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (error) {
      if (this.handleAuthError(error)) return;
      el.innerHTML = '<p class="text-center">Journal indisponible</p>';
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
          <thead><tr><th>Client</th><th>Email</th><th>Téléphone</th><th>Inscrit le</th><th>Contrats</th></tr></thead>
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

