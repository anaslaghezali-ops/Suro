/* Tunnel onboarding : devis, création devis, paiement simulé. */
(function () {
  'use strict';

  window.SURO_ONBOARDING = {
    async getQuote({ annee, puissance, marque, modele, vehicle_type }) {
      const rows = await this.sb('/rest/v1/rpc/suro_get_quote', {
        method: 'POST',
        body: JSON.stringify({
          p_annee: parseInt(annee, 10) || null,
          p_puissance: parseInt(puissance, 10) || null,
          p_marque: marque || null,
          p_modele: modele || null,
          p_vehicle_type: vehicle_type || 'voiture',
        }),
      });
      const quote = {};
      (rows || []).forEach((r) => {
        quote[r.coverage_type] = r.annual_premium != null ? Number(r.annual_premium) : null;
      });
      return quote;
    },

    async createApplication(data) {
      const slug = encodeURIComponent(data.product_slug || 'automobile');
      const products = await this.sb(
        `/rest/v1/insurance_products?slug=eq.${slug}&select=id&limit=1`
      );
      if (!products || !products.length) {
        throw new Error('Produit d\'assurance introuvable');
      }

      const appId = this.uuid();
      await this.sb('/rest/v1/insurance_applications', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: appId,
          product_id: products[0].id,
          customer_email: (data.email || '').trim().toLowerCase(),
          customer_name: data.customer_name || null,
          customer_phone: data.phone || null,
          coverage_type: data.coverage || null,
          vehicle_type: data.vehicle_type || 'voiture',
          immatriculation: data.immatriculation || null,
          marque: data.marque || null,
          modele: data.modele || null,
          annee: parseInt(data.annee, 10) || null,
          puissance: parseInt(data.puissance, 10) || null,
          address: data.address || null,
        }),
      });

      return { application: { id: appId } };
    },

    async submitPayment(applicationId, paymentData) {
      await this.sb('/rest/v1/rpc/suro_mark_application_paid', {
        method: 'POST',
        asUser: true,
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
    },
  };
})();
