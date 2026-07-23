/* Client HTTP Supabase (REST + Auth). */
(function (root) {
  'use strict';

  root.SURO_HTTP = {
    async sb(path, options = {}, _retried) {
      const { SUPABASE_URL, SUPABASE_KEY } = root.SURO_CONFIG;

      if (options.asUser) {
        const session = await root.SURO_SESSION.ensureValidSession();
        if (!session) throw new Error('Session expirée');
      }

      const session = root.SURO_SESSION.getSession();
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
        const msg = err.msg || err.error_description || err.message || err.hint || `Erreur serveur (${response.status})`;

        if (options.asUser && response.status === 401 && !_retried && session && session.refresh_token) {
          const renewed = await root.SURO_SESSION.refreshSession();
          if (renewed) return this.sb(path, options, true);
        }

        throw new Error(msg);
      }

      if (response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    },
  };
})(window);
