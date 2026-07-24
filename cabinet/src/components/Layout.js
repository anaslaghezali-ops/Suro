import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { navFor, roleLabel } from '../lib/permissions.js';
import { navigate } from '../router.js';
import { api, LOGIN } from '../lib/api.js';

function logout() {
  api.logout();
  location.href = LOGIN;
}

export function Layout({ role, route, session, cabinetName, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const nav = navFor(role);
  const email = (session && session.user && session.user.email) || (session && session.email) || '';

  useEffect(() => { setNavOpen(false); }, [route]);

  return html`
    ${window.SURO_ENV === 'staging' ? html`<div class="cabinet-env-banner">Environnement STAGING — données de test</div>` : null}
    <div class="ops-shell">
      ${navOpen ? html`<div class="ops-sidebar-backdrop" onClick=${() => setNavOpen(false)}></div>` : null}
      <aside class=${`ops-sidebar${navOpen ? ' open' : ''}`}>
        <div class="ops-brand cabinet-brand"><b>SURO</b><span>${cabinetName || 'Cabinet'}</span></div>
        <nav class="ops-nav">
          ${nav.map((n) => html`
            <a class=${n.id === route ? 'active' : ''} onClick=${() => navigate(n.id)}>
              <span class="ic">${n.icon}</span>${n.label}
            </a>`)}
        </nav>
        <div class="ops-sidebar-foot">
          <div class="ops-user">
            <div class="avatar">${(email[0] || '?').toUpperCase()}</div>
            <div class="meta">
              <div class="nm">${email}</div>
              <div class="rl">${roleLabel(role)}</div>
            </div>
          </div>
          <button class="btn-o sm" style="width:100%;margin-top:8px" onClick=${logout}>Déconnexion</button>
        </div>
      </aside>
      <div class="ops-main">
        <div class="ops-topbar">
          <button type="button" class="ops-menu-btn" aria-label="Menu" onClick=${() => setNavOpen((v) => !v)}>☰</button>
          <div style="font-weight:600;color:var(--color-neutral-700)">Portail cabinet partenaire</div>
        </div>
        <div class="ops-content">${children}</div>
      </div>
    </div>
  `;
}
