/* SURO API Service
 *
 * Le site est hébergé en statique (GitHub Pages) : il n'y a pas de backend
 * Express. Le tunnel parle donc directement à Supabase via son API REST,
 * protégée par Row Level Security (la clé publishable est publique par design).
 */

const SUPABASE_URL = 'https://dnrudcpaqcqyybpbbrum.supabase.co';
const SUPABASE_KEY = 'sb_publishable__c1wQLooo7xS-34-zNi3_A_EZetrQDv';

class API {
  // --- Supabase REST helper ---
  static async sb(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.hint || `Erreur serveur (${response.status})`);
    }

    // 204 No Content (return=minimal, RPC void)
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

  // --- Onboarding ---
  static async createApplication(data) {
    // 1. Find the product
    const slug = encodeURIComponent(data.product_slug || 'automobile');
    const products = await this.sb(
      `/rest/v1/insurance_products?slug=eq.${slug}&select=id&limit=1`
    );
    if (!products || !products.length) {
      throw new Error('Produit d\'assurance introuvable');
    }

    // 2. Create the application (id generated client-side: no SELECT needed)
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
      }),
    });

    // 3. Save vehicle details as answers
    const vehicle = {
      immatriculation: data.immatriculation,
      marque: data.marque,
      modele: data.modele,
      annee: data.annee,
      puissance: data.puissance,
    };
    const rows = Object.entries(vehicle)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([field_key, field_value]) => ({
        application_id: appId,
        field_key,
        field_value: String(field_value),
      }));

    if (rows.length) {
      await this.sb('/rest/v1/insurance_application_answers', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(rows),
      });
    }

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

  static getCoverage() {
    return this.sb('/rest/v1/insurance_products?slug=eq.automobile&select=*&limit=1');
  }
}

// Export
if (typeof window !== 'undefined') {
  window.SURO_API = API;
}
