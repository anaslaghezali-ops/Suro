/* Espace client : polices, documents, sinistres, storage. */
(function (root) {
  'use strict';

  const { SUPABASE_URL, SUPABASE_KEY } = root.SURO_CONFIG;

  async function storageFetch(path, session) {
    const s = session || root.SURO_SESSION.getSession();
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/authenticated/${path}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${s ? s.access_token : SUPABASE_KEY}`,
        },
      }
    );
    if (!response.ok) throw new Error('Fichier inaccessible');
    return response.blob();
  }

  root.SURO_CUSTOMER = {
    getMyPolicies() {
      return this.sb('/rest/v1/insurance_applications?select=*&order=created_at.desc', { asUser: true });
    },

    getMyDocuments() {
      return this.sb('/rest/v1/insurance_documents?select=*&order=created_at.desc', { asUser: true });
    },

    getMyPayments() {
      return this.sb('/rest/v1/suro_payments?select=*&order=paid_at.desc', { asUser: true });
    },

    getDocumentsForPolicy(policyId) {
      return this.sb(
        `/rest/v1/insurance_documents?application_id=eq.${policyId}&select=*&order=created_at.desc`,
        { asUser: true }
      );
    },

    async uploadPolicyDocument(applicationId, customerEmail, documentType, documentSide, file) {
      const session = await root.SURO_SESSION.ensureValidSession();
      if (!session) throw new Error('Session expirée');

      const allowed = ['cin', 'permis', 'carte_grise'];
      if (!allowed.includes(documentType)) throw new Error('Type de document invalide');

      const allowedSides = ['recto', 'verso'];
      if (!allowedSides.includes(documentSide)) throw new Error('Face du document invalide');

      const maxBytes = 5 * 1024 * 1024;
      if (file.size > maxBytes) throw new Error('Fichier trop volumineux (max. 5 Mo)');

      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (file.type && !allowedTypes.includes(file.type)) {
        throw new Error('Format non accepté (JPG, PNG ou PDF uniquement)');
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${applicationId}/kyc/${documentType}/${documentSide}/${Date.now()}-${safeName}`;

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
        throw new Error(err.message || err.error || 'Échec de l\'envoi du fichier');
      }

      await this.sb('/rest/v1/insurance_documents', {
        method: 'POST',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          application_id: applicationId,
          customer_email: (customerEmail || session.email || '').toLowerCase(),
          name: file.name,
          storage_path: storagePath,
          document_type: documentType,
          document_side: documentSide,
          status: 'pending',
        }),
      });

      return { storage_path: storagePath };
    },

    renewPolicy(policyId) {
      return this.sb('/rest/v1/rpc/suro_renew_application', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({ app_id: policyId }),
      });
    },

    async getDocumentBlobUrl(storagePath) {
      const blob = await storageFetch(`suro-documents/${storagePath}`);
      return { url: window.URL.createObjectURL(blob), type: blob.type };
    },

    async downloadDocument(storagePath, fileName) {
      const blob = await storageFetch(`suro-documents/${storagePath}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || storagePath.split('/').pop();
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    },

    declareClaim(claimData) {
      return this.sb('/rest/v1/insurance_claims', {
        method: 'POST',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(claimData),
      });
    },

    getMyClaims() {
      return this.sb('/rest/v1/insurance_claims?select=*&order=created_at.desc', { asUser: true });
    },

    async uploadClaimFile(claimId, customerEmail, file) {
      const session = await root.SURO_SESSION.ensureValidSession();
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
    },

    getClaimFiles(claimId) {
      return this.sb(
        `/rest/v1/insurance_claim_files?claim_id=eq.${claimId}&select=*&order=created_at.asc`,
        { asUser: true }
      );
    },

    async downloadClaimFile(storagePath, fileName) {
      const blob = await storageFetch(`suro-claims/${storagePath}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || storagePath.split('/').pop();
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    },

    getClaimMessages(claimId) {
      return this.sb(
        `/rest/v1/insurance_claim_messages?claim_id=eq.${claimId}&select=*&order=created_at.asc`,
        { asUser: true }
      );
    },

    sendClaimMessage(claimId, body, sender) {
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
    },
  };
})(window);
