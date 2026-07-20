/* SURO API Service
 *
 * Le site est hébergé en statique (GitHub Pages) : il n'y a pas de backend
 * Express. Le frontend parle directement à Supabase (REST + Auth),
 * protégé par Row Level Security. La clé publishable est publique par design.
 */

const SUPABASE_URL = 'https://eprtmdugiusidtbwzozj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hltn9fC1cJKrsJ7QJf6sJQ_mbBHLx4-';

class API {
  // --- Supabase REST helper ---
  static async sb(path, options = {}) {
    const session = this.getSession();
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${(options.asUser && session && session.access_token) || SUPABASE_KEY}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        err.msg || err.error_description || err.message || err.hint || `Erreur serveur (${response.status})`
      );
    }

    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  static uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // --- Analytics (fire-and-forget : ne bloque et ne casse jamais l'UX) ---
  static getTrackingSessionId() {
    try {
      let sid = localStorage.getItem('suroSid');
      if (!sid) {
        sid = this.uuid();
        localStorage.setItem('suroSid', sid);
      }
      return sid;
    } catch (e) {
      return 'anonymous';
    }
  }

  static track(event, step, meta) {
    try {
      fetch(`${SUPABASE_URL}/rest/v1/suro_events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal',
        },
        keepalive: true,
        body: JSON.stringify({
          session_id: this.getTrackingSessionId(),
          event,
          step: step || null,
          meta: meta || null,
        }),
      }).catch(() => {});
    } catch (e) {
      /* jamais bloquant */
    }
  }

  // --- Tarification ---
  // Prix calculés côté serveur depuis la table insurance_pricing (modifiable par l'équipe)
  static async getQuote({ annee, puissance, marque, modele }) {
    const rows = await this.sb('/rest/v1/rpc/suro_get_quote', {
      method: 'POST',
      body: JSON.stringify({
        p_annee: parseInt(annee, 10) || null,
        p_puissance: parseInt(puissance, 10) || null,
        p_marque: marque || null,
        p_modele: modele || null,
      }),
    });
    // -> { minimal: 2100, complete: 4600 }
    const quote = {};
    (rows || []).forEach((r) => {
      quote[r.coverage_type] = r.annual_premium != null ? Number(r.annual_premium) : null;
    });
    return quote;
  }

  // --- Onboarding ---
  static async createApplication(data) {
    const slug = encodeURIComponent(data.product_slug || 'automobile');
    const products = await this.sb(
      `/rest/v1/insurance_products?slug=eq.${slug}&select=id&limit=1`
    );
    if (!products || !products.length) {
      throw new Error('Produit d\'assurance introuvable');
    }

    // id generated client-side (return=minimal: no SELECT policy needed).
    // The annual premium is recomputed server-side by a trigger.
    const appId = this.uuid();
    await this.sb('/rest/v1/insurance_applications', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: appId,
        product_id: products[0].id,
        customer_email: data.email,
        customer_phone: data.phone || null,
        coverage_type: data.coverage || null,
        immatriculation: data.immatriculation || null,
        marque: data.marque || null,
        modele: data.modele || null,
        annee: parseInt(data.annee, 10) || null,
        puissance: parseInt(data.puissance, 10) || null,
        address: data.address || null,
      }),
    });

    return { application: { id: appId } };
  }

  static async submitPayment(applicationId, paymentData) {
    // Paiement simulé : marque l'application comme payée/active.
    // (Une vraie intégration CMI/carte viendra plus tard.)
    await this.sb('/rest/v1/rpc/suro_mark_application_paid', {
      method: 'POST',
      body: JSON.stringify({ app_id: applicationId }),
    });

    return {
      payment: {
        application_id: applicationId,
        method: paymentData && paymentData.method,
        status: 'success',
        timestamp: new Date().toISOString(),
      },
    };
  }

  // --- Auth (Supabase Auth) ---
  static getSession() {
    try {
      const raw = localStorage.getItem('suroSession');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  static setSession(session) {
    if (session) {
      localStorage.setItem('suroSession', JSON.stringify(session));
    } else {
      localStorage.removeItem('suroSession');
    }
  }

  static async signup(email, password, metadata) {
    const data = await this.sb('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: metadata || {} }),
    });

    if (data && data.access_token) {
      this.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        email: data.user && data.user.email,
      });
      return { session: true };
    }
    // Confirmation email requise : pas de session immédiate
    return { session: false, confirmationRequired: true };
  }

  static async login(email, password) {
    const data = await this.sb('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      email: data.user && data.user.email,
    });
    return data;
  }

  static logout() {
    this.setSession(null);
    return Promise.resolve();
  }

  // Envoie l'email de réinitialisation (le lien redirige vers reset-password.html)
  static requestPasswordReset(email, redirectTo) {
    const q = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
    return this.sb(`/auth/v1/recover${q}`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Définit le nouveau mot de passe avec le token reçu par email
  static async updatePasswordWithToken(accessToken, newPassword) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.msg || err.error_description || err.message || `Erreur (${response.status})`);
    }
    return response.json();
  }

  static getUser() {
    return this.sb('/auth/v1/user', { asUser: true });
  }

  static updateUser(payload) {
    return this.sb('/auth/v1/user', {
      method: 'PUT',
      asUser: true,
      body: JSON.stringify(payload),
    });
  }

  // --- Espace client (requêtes authentifiées, RLS = données du client uniquement) ---
  static getMyPolicies() {
    return this.sb('/rest/v1/insurance_applications?select=*&order=created_at.desc', {
      asUser: true,
    });
  }

  static getMyDocuments() {
    return this.sb('/rest/v1/insurance_documents?select=*&order=created_at.desc', {
      asUser: true,
    });
  }

  // Historique complet des paiements du client (initial + chaque renouvellement)
  static getMyPayments() {
    return this.sb('/rest/v1/suro_payments?select=*&order=paid_at.desc', {
      asUser: true,
    });
  }

  static getDocumentsForPolicy(policyId) {
    return this.sb(
      `/rest/v1/insurance_documents?application_id=eq.${policyId}&select=*&order=created_at.desc`,
      { asUser: true }
    );
  }

  // Renouvellement : prolonge le contrat existant d'un an (retourne la nouvelle échéance)
  static renewPolicy(policyId) {
    return this.sb('/rest/v1/rpc/suro_renew_application', {
      method: 'POST',
      asUser: true,
      body: JSON.stringify({ app_id: policyId }),
    });
  }

  // Renvoie un object URL (blob) pour aperçu inline d'un document (bucket privé).
  // L'appelant doit révoquer l'URL via URL.revokeObjectURL après usage.
  static async getDocumentBlobUrl(storagePath) {
    const session = this.getSession();
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/authenticated/suro-documents/${storagePath}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${session ? session.access_token : SUPABASE_KEY}`,
        },
      }
    );
    if (!response.ok) throw new Error('Document inaccessible');
    const blob = await response.blob();
    return { url: window.URL.createObjectURL(blob), type: blob.type };
  }

  static async downloadDocument(storagePath, fileName) {
    const session = this.getSession();
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/authenticated/suro-documents/${storagePath}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${session ? session.access_token : SUPABASE_KEY}`,
        },
      }
    );
    if (!response.ok) throw new Error('Document inaccessible');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || storagePath.split('/').pop();
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  static declareClaim(claimData) {
    return this.sb('/rest/v1/insurance_claims', {
      method: 'POST',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(claimData),
    });
  }

  static getMyClaims() {
    return this.sb('/rest/v1/insurance_claims?select=*&order=created_at.desc', {
      asUser: true,
    });
  }

  // --- Sinistres v2 : pièces jointes (photos/vidéos) ---
  static async uploadClaimFile(claimId, customerEmail, file) {
    const session = this.getSession();
    if (!session) throw new Error('Session expirée');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${claimId}/${Date.now()}-${safeName}`;

    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/suro-claims/${storagePath}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      }
    );
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(err.message || 'Échec de l\'envoi du fichier');
    }

    await this.sb('/rest/v1/insurance_claim_files', {
      method: 'POST',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        claim_id: claimId,
        customer_email: customerEmail,
        name: file.name,
        storage_path: storagePath,
        content_type: file.type || null,
      }),
    });

    return { storage_path: storagePath };
  }

  static getClaimFiles(claimId) {
    return this.sb(
      `/rest/v1/insurance_claim_files?claim_id=eq.${claimId}&select=*&order=created_at.asc`,
      { asUser: true }
    );
  }

  static async downloadClaimFile(storagePath, fileName) {
    const session = this.getSession();
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/authenticated/suro-claims/${storagePath}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${session ? session.access_token : SUPABASE_KEY}`,
        },
      }
    );
    if (!response.ok) throw new Error('Fichier inaccessible');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || storagePath.split('/').pop();
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  // --- Sinistres v2 : messagerie client <-> gestionnaire ---
  static getClaimMessages(claimId) {
    return this.sb(
      `/rest/v1/insurance_claim_messages?claim_id=eq.${claimId}&select=*&order=created_at.asc`,
      { asUser: true }
    );
  }

  static sendClaimMessage(claimId, body, sender) {
    const session = this.getSession();
    return this.sb('/rest/v1/insurance_claim_messages', {
      method: 'POST',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        claim_id: claimId,
        sender: sender || 'customer',
        sender_email: session ? session.email : null,
        body,
      }),
    });
  }

  // --- Admin (compte authentifié + membre de suro_admins ; RLS applique les droits) ---
  static async isAdmin() {
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
  }

  // Membre de l'équipe SURO (tout rôle : super_admin, admin, operations, support)
  static async isStaff() {
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
  }

  static adminGetApplications() {
    return this.sb('/rest/v1/insurance_applications?select=*&order=created_at.desc', {
      asUser: true,
    });
  }

  static adminGetApplicationAnswers(applicationId) {
    return this.sb(
      `/rest/v1/insurance_application_answers?application_id=eq.${applicationId}&select=*`,
      { asUser: true }
    );
  }

  static adminUpdateApplicationStatus(applicationId, status) {
    return this.sb(`/rest/v1/insurance_applications?id=eq.${applicationId}`, {
      method: 'PATCH',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    });
  }

  // Modifie les champs d'un contrat (véhicule, coordonnées, couverture, adresse…)
  static adminUpdateApplication(applicationId, fields) {
    return this.sb(`/rest/v1/insurance_applications?id=eq.${applicationId}`, {
      method: 'PATCH',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    });
  }

  // Liste des comptes clients (admin)
  static adminListCustomers() {
    return this.sb('/rest/v1/rpc/suro_list_customers', {
      method: 'POST',
      asUser: true,
      body: JSON.stringify({}),
    });
  }

  static adminGetClaims() {
    return this.sb('/rest/v1/insurance_claims?select=*&order=created_at.desc', {
      asUser: true,
    });
  }

  // Historique complet des paiements (tous clients) pour l'admin
  static adminGetPayments() {
    return this.sb('/rest/v1/suro_payments?select=*&order=paid_at.desc', {
      asUser: true,
    });
  }

  static adminGetFunnelStats(days) {
    return this.sb('/rest/v1/rpc/suro_funnel_stats', {
      method: 'POST',
      asUser: true,
      body: JSON.stringify({ p_days: days || 7 }),
    });
  }

  // --- Paramètres applicatifs (contacts support, lisibles par tous) ---
  static getSettings() {
    return this.sb('/rest/v1/suro_settings?select=key,value');
  }

  static adminUpdateSetting(key, value) {
    return this.sb(`/rest/v1/suro_settings?key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ value, updated_at: new Date().toISOString() }),
    });
  }

  // --- Grille tarifaire (édition admin) ---
  static adminGetPricing() {
    return this.sb(
      '/rest/v1/insurance_pricing?select=*&order=coverage_type.desc,cv_min.asc',
      { asUser: true }
    );
  }

  static adminUpdatePricing(id, annualPremium) {
    return this.sb(`/rest/v1/insurance_pricing?id=eq.${id}`, {
      method: 'PATCH',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ annual_premium: annualPremium }),
    });
  }

  static adminGetFactors() {
    return this.sb('/rest/v1/insurance_pricing_factors?select=*&order=key.asc', {
      asUser: true,
    });
  }

  static adminUpdateFactor(key, factor) {
    return this.sb(`/rest/v1/insurance_pricing_factors?key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ factor }),
    });
  }

  // --- Gestion des administrateurs ---
  static adminListAdmins() {
    return this.sb('/rest/v1/rpc/suro_list_admins', {
      method: 'POST',
      asUser: true,
      body: JSON.stringify({}),
    });
  }

  static adminAddAdmin(email) {
    return this.sb('/rest/v1/rpc/suro_add_admin', {
      method: 'POST',
      asUser: true,
      body: JSON.stringify({ p_email: email }),
    });
  }

  static adminRemoveAdmin(email) {
    return this.sb('/rest/v1/rpc/suro_remove_admin', {
      method: 'POST',
      asUser: true,
      body: JSON.stringify({ p_email: email }),
    });
  }

  // --- Journal d'activité ---
  static adminRecentEvents(limit) {
    return this.sb('/rest/v1/rpc/suro_recent_events', {
      method: 'POST',
      asUser: true,
      body: JSON.stringify({ p_limit: limit || 50 }),
    });
  }

  static adminUpdateClaimStatus(claimId, status) {
    return this.sb(`/rest/v1/insurance_claims?id=eq.${claimId}`, {
      method: 'PATCH',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    });
  }

  static adminGetDocuments(applicationId) {
    const filter = applicationId ? `&application_id=eq.${applicationId}` : '';
    return this.sb(
      `/rest/v1/insurance_documents?select=*${filter}&order=created_at.desc`,
      { asUser: true }
    );
  }

  // Upload d'un fichier dans le bucket privé + création de la ligne insurance_documents
  static async adminUploadDocument(application, file) {
    const session = this.getSession();
    if (!session) throw new Error('Session admin expirée');

    // Chemin: <application_id>/<timestamp>-<nom de fichier nettoyé>
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${application.id}/${Date.now()}-${safeName}`;

    // 1. Upload dans le storage
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

    // 2. Enregistrement de la ligne (visible par le client)
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
  }

  static async adminDeleteDocument(doc) {
    const session = this.getSession();
    // 1. Supprime le fichier du storage
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
    // 2. Supprime la ligne
    await this.sb(`/rest/v1/insurance_documents?id=eq.${doc.id}`, {
      method: 'DELETE',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
    });
  }

  // ===== NOTIFICATIONS (client ou admin selon l'audience) =====
  static getNotifications(audience, limit) {
    const aud = audience || 'customer';
    return this.sb(
      `/rest/v1/suro_notifications?audience=eq.${aud}&select=*&order=created_at.desc&limit=${limit || 30}`,
      { asUser: true }
    );
  }

  static async getUnreadCount(audience) {
    const aud = audience || 'customer';
    const rows = await this.sb(
      `/rest/v1/suro_notifications?audience=eq.${aud}&read_at=is.null&select=id`,
      { asUser: true, headers: { Prefer: 'count=exact' } }
    );
    return (rows || []).length;
  }

  static markNotificationRead(id) {
    return this.sb(`/rest/v1/suro_notifications?id=eq.${id}`, {
      method: 'PATCH',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ read_at: new Date().toISOString() }),
    });
  }

  static markAllNotificationsRead(audience) {
    const aud = audience || 'customer';
    return this.sb(`/rest/v1/suro_notifications?audience=eq.${aud}&read_at=is.null`, {
      method: 'PATCH',
      asUser: true,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ read_at: new Date().toISOString() }),
    });
  }
}

// Export
if (typeof window !== 'undefined') {
  window.SURO_API = API;
}
