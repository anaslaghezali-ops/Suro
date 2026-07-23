/* Analytics tunnel (fire-and-forget). */
(function (root) {
  'use strict';

  root.SURO_ANALYTICS = {
    uuid() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },

    getTrackingSessionId() {
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
    },

    track(event, step, meta) {
      try {
        const { SUPABASE_URL, SUPABASE_KEY } = root.SURO_CONFIG;
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
    },
  };
})(window);
