/* Notifications in-app (client + admin). */
(function () {
  'use strict';

  window.SURO_API_NOTIFICATIONS = {
    getNotifications(audience, limit) {
      const aud = audience || 'customer';
      return this.sb(
        `/rest/v1/suro_notifications?audience=eq.${aud}&select=*&order=created_at.desc&limit=${limit || 30}`,
        { asUser: true }
      );
    },

    async getUnreadCount(audience) {
      const aud = audience || 'customer';
      const rows = await this.sb(
        `/rest/v1/suro_notifications?audience=eq.${aud}&read_at=is.null&select=id`,
        { asUser: true, headers: { Prefer: 'count=exact' } }
      );
      return (rows || []).length;
    },

    markNotificationRead(id) {
      return this.sb(`/rest/v1/suro_notifications?id=eq.${id}`, {
        method: 'PATCH',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      });
    },

    markAllNotificationsRead(audience) {
      const aud = audience || 'customer';
      return this.sb(`/rest/v1/suro_notifications?audience=eq.${aud}&read_at=is.null`, {
        method: 'PATCH',
        asUser: true,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      });
    },
  };
})();
