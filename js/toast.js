/* SURO — Toasts & confirmations (app + backoffice) */
(function () {
  const ICONS = {
    ok: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    err: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  };

  function host() {
    let el = document.getElementById('suro-toast-host');
    if (!el) {
      el = document.createElement('div');
      el.id = 'suro-toast-host';
      el.className = 'suro-toast-host';
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  const SuroToast = {
    show(message, type = 'ok', duration = 4200) {
      const wrap = host();
      const toast = document.createElement('div');
      toast.className = `suro-toast suro-toast--${type === 'err' ? 'err' : type === 'info' ? 'info' : 'ok'}`;
      toast.innerHTML = `
        <span class="suro-toast-icon" aria-hidden="true">${ICONS[type] || ICONS.info}</span>
        <span class="suro-toast-msg"></span>`;
      toast.querySelector('.suro-toast-msg').textContent = String(message || '');
      wrap.appendChild(toast);
      const timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(6px)';
        toast.style.transition = 'opacity 160ms ease, transform 160ms ease';
        setTimeout(() => toast.remove(), 180);
      }, duration);
      toast.addEventListener('click', () => {
        clearTimeout(timer);
        toast.remove();
      });
      return toast;
    },

    confirm(message, opts = {}) {
      const title = opts.title || 'Confirmer';
      const okLabel = opts.okLabel || 'Confirmer';
      const cancelLabel = opts.cancelLabel || 'Annuler';

      return new Promise((resolve) => {
        const scrim = document.createElement('div');
        scrim.className = 'suro-confirm-scrim';
        scrim.innerHTML = `
          <div class="suro-confirm" role="dialog" aria-modal="true">
            <h3 class="suro-confirm-title"></h3>
            <p class="suro-confirm-body"></p>
            <div class="suro-confirm-actions">
              <button type="button" class="btn btn-ghost" data-act="cancel"></button>
              <button type="button" class="btn btn-primary" data-act="ok"></button>
            </div>
          </div>`;
        scrim.querySelector('.suro-confirm-title').textContent = title;
        scrim.querySelector('.suro-confirm-body').textContent = String(message || '');
        scrim.querySelector('[data-act="cancel"]').textContent = cancelLabel;
        scrim.querySelector('[data-act="ok"]').textContent = okLabel;

        function close(result) {
          scrim.remove();
          document.removeEventListener('keydown', onKey);
          resolve(result);
        }

        function onKey(e) {
          if (e.key === 'Escape') close(false);
        }

        scrim.addEventListener('click', (e) => {
          if (e.target === scrim) close(false);
        });
        scrim.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
        scrim.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
        document.addEventListener('keydown', onKey);
        document.body.appendChild(scrim);
        scrim.querySelector('[data-act="ok"]').focus();
      });
    },
  };

  if (typeof window !== 'undefined') window.SuroToast = SuroToast;
})();
