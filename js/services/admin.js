/* Admin / staff : applications, clients, pricing, documents. */
(function (root) {
  'use strict';

  const { SUPABASE_URL, SUPABASE_KEY } = root.SURO_CONFIG;

  // --- Helpers de construction de requêtes paginées (PostgREST) ---
  // Clause ORDER depuis le tri du DataTable (dir: 1 = asc, -1 = desc).
  const orderClause = (sortKey, sortDir, def) =>
    sortKey ? `${sortKey}.${sortDir === 1 ? 'asc' : 'desc'}` : def;
  // Recherche multi-colonnes → un seul `or=(col.ilike.*q*,...)` (jamais deux `or=`).
  const searchOr = (cols, search) => {
    const needle = encodeURIComponent(`*${search}*`);
    return `or=(${cols.map((c) => `${c}.ilike.${needle}`).join(',')})`;
  };

  root.SURO_ADMIN = {
    async isAdmin() {
      try {
        const result = await this.sb('/rest/v1/rpc/is_suro_admin', {
          method: 'POST',
          asUser: true,
          body: JSON.stringify({}),
        });
        return result === true;
      } catch (e) {
        return false;
      }
    },

    async isStaff() {
      try {
        const result = await this.sb('/rest/v1/rpc/is_suro_staff', {
          method: 'POST',
          asUser: true,
          body: JSON.stringify({}),
        });
        return result === true;
      } catch (e) {
        return false;
      }
    },

    adminGetApplications() {
      return this.sb('/rest/v1/insurance_applications?select=*&order=created_at.desc', { asUser: true });
    },

    // Souscriptions/contrats paginés côté serveur → { rows, total }.
    // statusIn = liste (ex. ['active','expired']) ; status = égalité simple ;
    // clauses = filtres PostgREST bruts additionnels (ex. `expires_at=lte.2026-08-01`).
    adminListApplications({ limit = 12, offset = 0, statusIn, status, clauses, search, sortKey, sortDir } = {}) {
      const parts = [
        'select=*',
        `order=${orderClause(sortKey, sortDir, 'created_at.desc')}`,
        `limit=${limit}`, `offset=${offset}`,
      ];
      if (statusIn && statusIn.length) parts.push(`status=in.(${statusIn.join(',')})`);
      else if (status) parts.push(`status=eq.${encodeURIComponent(status)}`);
      if (clauses && clauses.length) parts.push(...clauses);
      if (search) parts.push(searchOr(['customer_email', 'immatriculation', 'marque', 'modele', 'policy_number'], search));
      return this.sbList(`/rest/v1/insurance_applications?${parts.join('&')}`, { asUser: true });
    },

    // Compteur d'une vue Souscriptions (requête bornée limit=1, total via Content-Range).
    async adminCountApplications(clauses = []) {
      const parts = ['select=id', 'limit=1', ...clauses];
      const { total } = await this.sbList(`/rest/v1/insurance_applications?${parts.join('&')}`, { asUser: true });
      return total;
    },

    // application_id ayant au moins un document en attente (file KYC à vérifier).
    // Borné par la taille de la file (docs non traités), pas par le nombre de contrats.
    async adminPendingDocAppIds() {
      const rows = await this.sb(
        '/rest/v1/insurance_documents?select=application_id&or=(status.is.null,status.eq.pending)',
        { asUser: true }
      );
      return [...new Set((rows || []).map((r) => r.application_id).filter(Boolean))];
    },

    // Récupère une souscription par id (deep-link #/subscriptions/<id>).
    async adminApplicationById(id) {
      const rows = await this.sb(
        `/rest/v1/insurance_applications?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
        { asUser: true }
      );
      return rows && rows[0] ? rows[0] : null;
    },

    adminGetApplicationAnswers(applicationId) {
      return this.sb(
        `/rest/v1/insurance_application_answers?application_id=eq.${applicationId}&select=*`,
        { asUser: true }
      );
    },

    adminUpdateApplicationStatus(applicationId, status) {
      return this.sb(`/rest/v1/insurance_applications?id=eq.${applicationId}`, {
        method: 'PATCH',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
    },

    adminUpdateApplication(applicationId, fields) {
      return this.sb(`/rest/v1/insurance_applications?id=eq.${applicationId}`, {
        method: 'PATCH',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
      });
    },

    adminListCustomers() {
      return this.sb('/rest/v1/rpc/suro_list_customers', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({}),
      });
    },

    adminGetClaims() {
      return this.sb('/rest/v1/insurance_claims?select=*&order=created_at.desc', { asUser: true });
    },

    // Sinistres paginés côté serveur → { rows, total }.
    adminListClaims({ limit = 12, offset = 0, status, search, sortKey, sortDir } = {}) {
      const parts = [
        'select=*',
        `order=${orderClause(sortKey, sortDir, 'created_at.desc')}`,
        `limit=${limit}`, `offset=${offset}`,
      ];
      if (status) parts.push(`status=eq.${encodeURIComponent(status)}`);
      if (search) parts.push(searchOr(['claim_type', 'description'], search));
      return this.sbList(`/rest/v1/insurance_claims?${parts.join('&')}`, { asUser: true });
    },

    // Compteurs par statut (vues) — requêtes bornées (limit=1, on ne lit que le total
    // via Content-Range). Ne scale PAS avec le volume : une requête count par vue.
    async adminClaimCounts() {
      const statuses = ['pending', 'approved', 'rejected', 'paid'];
      const results = await Promise.all([
        this.sbList('/rest/v1/insurance_claims?select=id&limit=1', { asUser: true }),
        ...statuses.map((s) => this.sbList(`/rest/v1/insurance_claims?select=id&limit=1&status=eq.${s}`, { asUser: true })),
      ]);
      const out = { all: results[0].total };
      statuses.forEach((s, i) => { out[s] = results[i + 1].total; });
      return out;
    },

    adminGetPayments() {
      return this.sb('/rest/v1/suro_payments?select=*&order=paid_at.desc', { asUser: true });
    },

    // Paiements paginés côté serveur → { rows, total }.
    // status/search/tri appliqués par PostgREST (rien n'est filtré dans le navigateur).
    adminListPayments({ limit = 12, offset = 0, status, search, sortKey, sortDir } = {}) {
      const col = sortKey || 'paid_at';
      const dir = sortDir === 1 ? 'asc' : 'desc';
      const parts = ['select=*', `order=${col}.${dir}`, `limit=${limit}`, `offset=${offset}`];
      // 'succeeded' inclut les lignes à status NULL (traitées comme réussies côté UI).
      if (status === 'succeeded') parts.push('or=(status.is.null,status.eq.succeeded)');
      else if (status) parts.push(`status=eq.${encodeURIComponent(status)}`);
      if (search) parts.push(`customer_email=ilike.${encodeURIComponent(`*${search}*`)}`);
      return this.sbList(`/rest/v1/suro_payments?${parts.join('&')}`, { asUser: true });
    },

    adminGetFunnelStats(days) {
      return this.sb('/rest/v1/rpc/suro_funnel_stats', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({ p_days: days || 7 }),
      });
    },

    getSettings() {
      return this.sb('/rest/v1/suro_settings?select=key,value');
    },

    adminUpdateSetting(key, value) {
      if (key === 'operating_mode') {
        return Promise.reject(new Error('operating_mode : utiliser switchOperatingMode() (RPC suro_switch_operating_mode)'));
      }
      return this.sb(`/rest/v1/suro_settings?key=eq.${encodeURIComponent(key)}`, {
        method: 'PATCH',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ value, updated_at: new Date().toISOString() }),
      });
    },

    adminGetPricing() {
      return this.sb(
        '/rest/v1/insurance_pricing?select=*&order=vehicle_type.asc,coverage_type.desc,cv_min.asc',
        { asUser: true }
      );
    },

    adminUpdatePricing(id, annualPremium) {
      return this.sb(`/rest/v1/insurance_pricing?id=eq.${id}`, {
        method: 'PATCH',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ annual_premium: annualPremium }),
      });
    },

    adminGetFactors() {
      return this.sb('/rest/v1/insurance_pricing_factors?select=*&order=key.asc', { asUser: true });
    },

    adminUpdateFactor(key, factor) {
      return this.sb(`/rest/v1/insurance_pricing_factors?key=eq.${encodeURIComponent(key)}`, {
        method: 'PATCH',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ factor }),
      });
    },

    adminListAdmins() {
      return this.sb('/rest/v1/rpc/suro_list_admins', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({}),
      });
    },

    adminAddAdmin(email) {
      return this.sb('/rest/v1/rpc/suro_add_admin', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({ p_email: email }),
      });
    },

    adminRemoveAdmin(email) {
      return this.sb('/rest/v1/rpc/suro_remove_admin', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({ p_email: email }),
      });
    },

    adminRecentEvents(limit) {
      return this.sb('/rest/v1/rpc/suro_recent_events', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({ p_limit: limit || 50 }),
      });
    },

    adminUpdateClaimStatus(claimId, status) {
      return this.sb(`/rest/v1/insurance_claims?id=eq.${claimId}`, {
        method: 'PATCH',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
    },

    adminGetDocuments(applicationId) {
      const filter = applicationId ? `&application_id=eq.${applicationId}` : '';
      return this.sb(
        `/rest/v1/insurance_documents?select=*${filter}&order=created_at.desc`,
        { asUser: true }
      );
    },

    async adminUploadDocument(application, file) {
      const session = await root.SURO_SESSION.ensureValidSession();
      if (!session) throw new Error('Session admin expirée');

      const maxBytes = 10 * 1024 * 1024; // attestations/cartes vertes multi-pages
      if (file.size > maxBytes) throw new Error('Fichier trop volumineux (max. 10 Mo)');
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (file.type && !allowedTypes.includes(file.type)) {
        throw new Error('Format non accepté (JPG, PNG ou PDF uniquement)');
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${application.id}/${Date.now()}-${safeName}`;

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/suro-documents/${storagePath}`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'false',
          },
          body: file,
        }
      );
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.message || 'Échec de l\'upload du fichier');
      }

      await this.sb('/rest/v1/insurance_documents', {
        method: 'POST',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          application_id: application.id,
          customer_email: application.customer_email,
          name: file.name,
          storage_path: storagePath,
        }),
      });

      return { storage_path: storagePath };
    },

    async adminDeleteDocument(doc) {
      const session = root.SURO_SESSION.getSession();
      await fetch(
        `${SUPABASE_URL}/storage/v1/object/suro-documents/${doc.storage_path}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${session ? session.access_token : SUPABASE_KEY}`,
          },
        }
      );
      await this.sb(`/rest/v1/insurance_documents?id=eq.${doc.id}`, {
        method: 'DELETE',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
      });
    },

    adminCreateStaff({ email, password, role, name }) {
      return this.sb('/functions/v1/suro-create-staff', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({ email, password, role, name }),
      });
    },

    // Modifier l'email et/ou le mot de passe d'un collaborateur existant (super_admin).
    // targetEmail = email actuel ; newEmail / newPassword optionnels (au moins un).
    adminUpdateStaff({ targetEmail, newEmail, newPassword }) {
      return this.sb('/functions/v1/suro-update-staff', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({ targetEmail, newEmail: newEmail || null, newPassword: newPassword || null }),
      });
    },
  };
})(window);
