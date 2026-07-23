/* Session JWT (localStorage) + refresh automatique. */
(function (root) {
  'use strict';

  const SESSION_KEY = 'suroSession';
  let refreshPromise = null;

  function jwtExp(accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp || 0;
    } catch (e) {
      return 0;
    }
  }

  root.SURO_SESSION = {
    getSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    setSession(session) {
      if (session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    },

    async refreshSession() {
      const session = this.getSession();
      if (!session || !session.refresh_token) return null;

      if (refreshPromise) return refreshPromise;

      const { SUPABASE_URL, SUPABASE_KEY } = root.SURO_CONFIG;
      refreshPromise = fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      })
        .then(async (response) => {
          if (!response.ok) {
            this.setSession(null);
            return null;
          }
          const data = await response.json();
          const next = {
            access_token: data.access_token,
            refresh_token: data.refresh_token || session.refresh_token,
            email: (data.user && data.user.email) || session.email,
          };
          this.setSession(next);
          return next;
        })
        .catch(() => {
          this.setSession(null);
          return null;
        })
        .finally(() => {
          refreshPromise = null;
        });

      return refreshPromise;
    },

    /** Renouvelle le JWT s'il expire dans moins de 60 s. */
    async ensureValidSession() {
      const session = this.getSession();
      if (!session || !session.access_token) return null;

      const now = Math.floor(Date.now() / 1000);
      if (jwtExp(session.access_token) - now > 60) return session;

      return this.refreshSession();
    },
  };
})(window);
