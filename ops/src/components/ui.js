import { html } from 'htm/preact';
import { useEffect } from 'preact/hooks';

export function Badge({ tone = 'gray', children }) {
  return html`<span class="badge ${tone}">${children}</span>`;
}

export function Spinner() {
  return html`<div class="spinner"></div>`;
}

export function FullSpinner() {
  return html`<div class="center-screen"><div class="spinner"></div></div>`;
}

export function Empty({ children }) {
  return html`<div class="empty">${children}</div>`;
}

export function Stub({ title, children }) {
  return html`<div class="stub"><h2>${title}</h2><p>${children}</p></div>`;
}

/* SlideOver : panneau latéral avec fermeture par scrim + touche Échap. */
export function SlideOver({ open, title, subtitle, tabs, activeTab, onTab, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  if (!open) return null;
  return html`
    <div class="slide-scrim" onClick=${onClose}></div>
    <aside class="slide-panel" role="dialog" aria-modal="true">
      <div class="slide-head">
        <div>
          <h2>${title}</h2>
          ${subtitle ? html`<div class="sub">${subtitle}</div>` : null}
        </div>
        <button class="slide-close" onClick=${onClose} aria-label="Fermer">✕</button>
      </div>
      ${tabs && tabs.length ? html`
        <div class="slide-tabs">
          ${tabs.map((t) => html`
            <button class=${t.id === activeTab ? 'active' : ''} onClick=${() => onTab(t.id)}>${t.label}</button>
          `)}
        </div>` : null}
      <div class="slide-body">${children}</div>
    </aside>
  `;
}

/* Toast minimaliste (file d'attente en module). */
let _push = null;
export function toast(message, kind = 'ok') { if (_push) _push(message, kind); }
export function registerToast(fn) { _push = fn; }
