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
      const requireLegalConsent = !!opts.requireLegalConsent;
      const legalBase = opts.legalBase || '';

      return new Promise((resolve) => {
        const scrim = document.createElement('div');
        scrim.className = 'suro-confirm-scrim';
        scrim.innerHTML = `
          <div class="suro-confirm" role="dialog" aria-modal="true">
            <h3 class="suro-confirm-title"></h3>
            <div class="suro-confirm-body"></div>
            ${requireLegalConsent ? `
              <label class="suro-confirm-consent" for="suro-confirm-legal">
                <input type="checkbox" id="suro-confirm-legal" />
                <span>En validant, j'accepte les
                  <a href="${legalBase}conditions.html" target="_blank" rel="noopener">conditions générales d'utilisation et de vente (CGU/CGV)</a>
                  et la
                  <a href="${legalBase}confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>.
                </span>
              </label>
              <p class="suro-confirm-consent-hint" id="suro-confirm-legal-error" hidden>Tu dois accepter les CGU/CGV pour continuer.</p>
            ` : ''}
            <div class="suro-confirm-actions">
              <button type="button" class="btn btn-ghost" data-act="cancel"></button>
              <button type="button" class="btn btn-primary" data-act="ok"></button>
            </div>
          </div>`;
        scrim.querySelector('.suro-confirm-title').textContent = title;
        const bodyEl = scrim.querySelector('.suro-confirm-body');
        bodyEl.textContent = String(message || '');
        scrim.querySelector('[data-act="cancel"]').textContent = cancelLabel;
        const okBtn = scrim.querySelector('[data-act="ok"]');
        okBtn.textContent = okLabel;

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

        if (requireLegalConsent) {
          const consent = scrim.querySelector('#suro-confirm-legal');
          const errorEl = scrim.querySelector('#suro-confirm-legal-error');
          const sync = () => {
            const enabled = consent.checked;
            okBtn.disabled = !enabled;
            okBtn.classList.toggle('btn-disabled', !enabled);
            if (errorEl) errorEl.hidden = true;
          };
          consent.addEventListener('change', sync);
          sync();
          okBtn.addEventListener('click', () => {
            if (!consent.checked) {
              if (errorEl) errorEl.hidden = false;
              consent.focus();
              return;
            }
            close(true);
          });
        } else {
          okBtn.addEventListener('click', () => close(true));
        }

        document.addEventListener('keydown', onKey);
        document.body.appendChild(scrim);
        (requireLegalConsent ? scrim.querySelector('#suro-confirm-legal') : okBtn).focus();
      });
    },
  };

  if (typeof window !== 'undefined') window.SuroToast = SuroToast;
})();
