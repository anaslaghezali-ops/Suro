/* Client HTTP Supabase (REST + Auth). */
(function (root) {
  'use strict';

  root.SURO_HTTP = {
    // Cœur : fetch + auth + refresh de session sur 401. Renvoie la Response brute.
    async _fetch(path, options = {}, _retried) {
      const { SUPABASE_URL, SUPABASE_KEY } = root.SURO_CONFIG;

      let session = root.SURO_SESSION.getSession();
      if (options.asUser) {
        // Session garantie valide (rafraîchie si besoin) AVANT d'envoyer la requête.
        session = await root.SURO_SESSION.ensureValidSession();
        if (!session || !session.access_token) throw new Error('Session expirée — reconnecte-toi.');
      }

      // Requête authentifiée → TOUJOURS le token utilisateur validé.
      // Jamais de repli silencieux sur la clé anon (qui provoque des « non autorisé » trompeurs).
      const token = options.asUser ? session.access_token : SUPABASE_KEY;
      const response = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // `err.error` : format des Edge Functions (suro-create-staff, suro-update-staff…).
        const msg = err.msg || err.error_description || err.message || err.error || err.hint || `Erreur serveur (${response.status})`;

        if (options.asUser && response.status === 401 && !_retried && session && session.refresh_token) {
          const renewed = await root.SURO_SESSION.refreshSession();
          if (renewed) return this._fetch(path, options, true);
        }

        throw new Error(msg);
      }

      return response;
    },

    // Requête standard : renvoie le corps JSON (ou null).
    async sb(path, options = {}) {
      const response = await this._fetch(path, options);
      if (response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    },

    // Liste paginée : renvoie { rows, total }.
    // `total` est lu depuis l'en-tête Content-Range (via Prefer: count=exact),
    // ce qui permet une pagination serveur sans tout charger dans le navigateur.
    async sbList(path, options = {}) {
      const response = await this._fetch(path, {
        ...options,
        headers: { Prefer: 'count=exact', ...(options.headers || {}) },
      });
      const text = response.status === 204 ? '' : await response.text();
      const rows = text ? JSON.parse(text) : [];
      let total = rows.length;
      const cr = response.headers.get('content-range'); // ex: "0-24/1000"
      if (cr && cr.includes('/')) {
        const n = parseInt(cr.split('/')[1], 10);
        if (!Number.isNaN(n)) total = n;
      }
      return { rows, total };
    },
  };
})(window);
