/* SURO — Cloche de notifications (partagée admin + client)
 * Usage : SuroNotifications.mount({ audience: 'admin'|'customer', container: el })
 */
(function () {
  const api = () => window.SURO_API;
  let instanceSeq = 0;

  const BELL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

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
    uid: '',

    mount(opts) {
      this.audience = opts.audience || 'customer';
      const container = opts.container;
      if (!container) return;

      instanceSeq += 1;
      this.uid = `notif-${instanceSeq}`;
      const bellId = `${this.uid}-bell`;
      const badgeId = `${this.uid}-badge`;
      const panelId = `${this.uid}-panel`;
      const listId = `${this.uid}-list`;
      const markAllId = `${this.uid}-markall`;

      const wrap = document.createElement('div');
      wrap.className = 'notif-wrap';
      wrap.innerHTML = `
        <button type="button" class="notif-bell" id="${bellId}" aria-label="Notifications" aria-expanded="false">
          ${BELL_SVG}
          <span class="notif-badge" id="${badgeId}" style="display:none;">0</span>
        </button>
        <div class="notif-panel" id="${panelId}" style="display:none;" role="region" aria-label="Liste des notifications">
          <div class="notif-panel-head">
            <strong>Notifications</strong>
            <button type="button" class="notif-markall" id="${markAllId}">Tout marquer lu</button>
          </div>
          <div class="notif-list" id="${listId}"><p class="notif-empty">Chargement…</p></div>
        </div>`;
      container.appendChild(wrap);

      document.getElementById(bellId).addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
      document.getElementById(markAllId).addEventListener('click', async (e) => {
        e.stopPropagation();
        try { await api().markAllNotificationsRead(this.audience); } catch (err) {}
        this.refreshBadge();
        this.loadPanel();
      });
      document.addEventListener('click', () => this.hide());
      const panel = document.getElementById(panelId);
      if (panel) panel.addEventListener('click', (e) => e.stopPropagation());

      this.refreshBadge();
      this.pollTimer = setInterval(() => this.refreshBadge(), 30000);
    },

    toggle() { this.open ? this.hide() : this.show(); },

    show() {
      this.open = true;
      const panel = document.getElementById(`${this.uid}-panel`);
      const bell = document.getElementById(`${this.uid}-bell`);
      if (panel) panel.style.display = 'block';
      if (bell) bell.setAttribute('aria-expanded', 'true');
      this.loadPanel();
    },

    hide() {
      this.open = false;
      const panel = document.getElementById(`${this.uid}-panel`);
      const bell = document.getElementById(`${this.uid}-bell`);
      if (panel) panel.style.display = 'none';
      if (bell) bell.setAttribute('aria-expanded', 'false');
    },

    async refreshBadge() {
      try {
        const n = await api().getUnreadCount(this.audience);
        const badge = document.getElementById(`${this.uid}-badge`);
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
      const list = document.getElementById(`${this.uid}-list`);
      if (!list) return;
      try {
        const items = await api().getNotifications(this.audience, 30) || [];
        if (!items.length) {
          list.innerHTML = '<p class="notif-empty">Aucune notification.</p>';
          return;
        }
        list.innerHTML = items.map((n) => `
          <div class="notif-item ${n.read_at ? '' : 'unread'}" data-id="${n.id}">
            <div class="notif-title">${esc(n.title)}</div>
            ${n.body ? `<div class="notif-body">${esc(n.body)}</div>` : ''}
            <div class="notif-time">${timeAgo(n.created_at)}</div>
          </div>`).join('');

        const unread = items.filter((n) => !n.read_at);
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
  };

  if (typeof window !== 'undefined') window.SuroNotifications = SuroNotifications;
})();
