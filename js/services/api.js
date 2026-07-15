/* SURO API Service
 *
 * Le site est hébergé en statique (GitHub Pages) : il n'y a pas de backend
 * Express. Le frontend parle directement à Supabase (REST + Auth),
 * protégé par Row Level Security. La clé publishable est publique par design.
 */

const SUPABASE_URL = 'https://dnrudcpaqcqyybpbbrum.supabase.co';
const SUPABASE_KEY = 'sb_publishable__c1wQLooo7xS-34-zNi3_A_EZetrQDv';

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
}

// Export
if (typeof window !== 'undefined') {
  window.SURO_API = API;
}
