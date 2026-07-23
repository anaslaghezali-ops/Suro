/* Auth Supabase (signup, login, reset password). */
(function (root) {
  'use strict';

  root.SURO_AUTH = {
    async signup(email, password, metadata) {
      const normEmail = (email || '').trim().toLowerCase();
      const data = await this.sb('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({ email: normEmail, password, data: metadata || {} }),
      });

      if (data && data.access_token) {
        this.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          email: data.user && data.user.email,
        });
        return { session: true };
      }
      return { session: false, confirmationRequired: true };
    },

    async login(email, password) {
      const data = await this.sb('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: (email || '').trim().toLowerCase(), password }),
      });

      this.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        email: data.user && data.user.email,
      });
      return data;
    },

    logout() {
      this.setSession(null);
      return Promise.resolve();
    },

    requestPasswordReset(email, redirectTo) {
      const q = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
      return this.sb(`/auth/v1/recover${q}`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async updatePasswordWithToken(accessToken, newPassword) {
      const { SUPABASE_URL, SUPABASE_KEY } = root.SURO_CONFIG;
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
    },

    getUser() {
      return this.sb('/auth/v1/user', { asUser: true });
    },

    updateUser(payload) {
      return this.sb('/auth/v1/user', {
        method: 'PUT',
        asUser: true,
        body: JSON.stringify(payload),
      });
    },
  };
})(window);
