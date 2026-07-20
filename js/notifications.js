/* SURO — Cloche de notifications (partagée admin + client)
 * Usage : SuroNotifications.mount({ audience: 'admin'|'customer', container: el })
 */
(function () {
  const api = () => window.SURO_API;

  function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`;
    return d.toLocaleDateString('fr-FR');
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const SuroNotifications = {
    audience: 'customer',
    open: false,
    pollTimer: null,

    mount(opts) {
      this.audience = opts.audience || 'customer';
      const container = opts.container;
      if (!container) return;

      const wrap = document.createElement('div');
      wrap.className = 'notif-wrap';
      wrap.innerHTML = `
        <button class="notif-bell" id="notif-bell" aria-label="Notifications">
          🔔<span class="notif-badge" id="notif-badge" style="display:none;">0</span>
        </button>
        <div class="notif-panel" id="notif-panel" style="display:none;">
          <div class="notif-panel-head">
            <strong>Notifications</strong>
            <button class="notif-markall" id="notif-markall">Tout marquer lu</button>
          </div>
          <div class="notif-list" id="notif-list"><p class="notif-empty">Chargement…</p></div>
        </div>`;
      container.appendChild(wrap);

      this.injectStyles();

      document.getElementById('notif-bell').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
      document.getElementById('notif-markall').addEventListener('click', async (e) => {
        e.stopPropagation();
        try { await api().markAllNotificationsRead(this.audience); } catch (err) {}
        this.refreshBadge();
        this.loadPanel();
      });
      document.addEventListener('click', () => this.hide());
      const panel = document.getElementById('notif-panel');
      if (panel) panel.addEventListener('click', (e) => e.stopPropagation());

      this.refreshBadge();
      this.pollTimer = setInterval(() => this.refreshBadge(), 30000);
    },

    toggle() { this.open ? this.hide() : this.show(); },

    show() {
      this.open = true;
      const panel = document.getElementById('notif-panel');
      if (panel) panel.style.display = 'block';
      this.loadPanel();
    },

    hide() {
      this.open = false;
      const panel = document.getElementById('notif-panel');
      if (panel) panel.style.display = 'none';
    },

    async refreshBadge() {
      try {
        const n = await api().getUnreadCount(this.audience);
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        if (n > 0) {
          badge.textContent = n > 99 ? '99+' : String(n);
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      } catch (e) { /* silencieux */ }
    },

    async loadPanel() {
      const list = document.getElementById('notif-list');
      if (!list) return;
      try {
        const items = await api().getNotifications(this.audience, 30) || [];
        if (!items.length) {
          list.innerHTML = '<p class="notif-empty">Aucune notification.</p>';
          return;
        }
        list.innerHTML = items.map(n => `
          <div class="notif-item ${n.read_at ? '' : 'unread'}" data-id="${n.id}">
            <div class="notif-title">${esc(n.title)}</div>
            ${n.body ? `<div class="notif-body">${esc(n.body)}</div>` : ''}
            <div class="notif-time">${timeAgo(n.created_at)}</div>
          </div>`).join('');

        // Marque comme lues à l'ouverture (après un court délai pour laisser voir le surlignage)
        const unread = items.filter(n => !n.read_at);
        if (unread.length) {
          setTimeout(async () => {
            try { await api().markAllNotificationsRead(this.audience); } catch (e) {}
            this.refreshBadge();
          }, 1200);
        }
      } catch (e) {
        list.innerHTML = '<p class="notif-empty">Notifications indisponibles.</p>';
      }
    },

    injectStyles() {
      if (document.getElementById('notif-styles')) return;
      const s = document.createElement('style');
      s.id = 'notif-styles';
      s.textContent = `
        .notif-wrap { position: relative; }
        .notif-bell {
          position: relative; background: none; border: none; cursor: pointer;
          font-size: 22px; line-height: 1; padding: 6px; border-radius: 8px;
        }
        .notif-bell:hover { background: rgba(0,0,0,0.05); }
        .notif-badge {
          position: absolute; top: 0; right: 0; min-width: 18px; height: 18px;
          padding: 0 4px; background: #EF4444; color: #fff; font-size: 11px; font-weight: 700;
          border-radius: 9px; display: none; align-items: center; justify-content: center;
        }
        .notif-panel {
          position: absolute; right: 0; top: 44px; width: 340px; max-width: 90vw;
          background: #fff; border: 1px solid #E5E7EB; border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15); z-index: 300; overflow: hidden;
        }
        .notif-panel-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-bottom: 1px solid #F3F4F6;
        }
        .notif-markall { background: none; border: none; color: #0F766E; font-size: 12px; font-weight: 600; cursor: pointer; }
        .notif-list { max-height: 380px; overflow-y: auto; }
        .notif-empty { padding: 24px 16px; text-align: center; color: #9CA3AF; font-size: 14px; }
        .notif-item { padding: 12px 16px; border-bottom: 1px solid #F3F4F6; }
        .notif-item.unread { background: rgba(15,118,110,0.06); }
        .notif-title { font-weight: 600; font-size: 14px; color: #111827; }
        .notif-body { font-size: 13px; color: #4B5563; margin-top: 2px; }
        .notif-time { font-size: 11px; color: #9CA3AF; margin-top: 4px; }
        @media (max-width: 640px) {
          .notif-panel { position: fixed; right: 8px; left: 8px; top: 64px; width: auto; }
        }`;
      document.head.appendChild(s);
    },
  };

  if (typeof window !== 'undefined') window.SuroNotifications = SuroNotifications;
})();
