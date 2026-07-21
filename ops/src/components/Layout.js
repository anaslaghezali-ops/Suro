import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { navFor, roleLabel } from '../lib/permissions.js';
import { navigate } from '../router.js';
import { api } from '../lib/api.js';
import { initials } from '../lib/format.js';
import { openCommandPalette } from './CommandPalette.js';

function logout() {
  api.logAction('logout', 'staff').catch(() => {});
  api.logout();
  location.href = '../admin-login.html';
}

const MENU_SVG = html`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;

export function Layout({ role, route, session, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const nav = navFor(role);
  const email = (session && session.email) || '';

  useEffect(() => {
    setNavOpen(false);
  }, [route]);

  useEffect(() => {
    const el = document.getElementById('ops-notif-mount');
    if (el && window.SuroNotifications && !el.dataset.mounted) {
      el.dataset.mounted = '1';
      window.SuroNotifications.mount({ audience: 'admin', container: el });
    }
  }, []);

  return html`
    <div class="ops-shell">
      ${navOpen ? html`<div class="ops-sidebar-backdrop" onClick=${() => setNavOpen(false)}></div>` : null}
      <aside class=${`ops-sidebar${navOpen ? ' open' : ''}`}>
        <div class="ops-brand"><b>SURO</b><span>Ops</span></div>
        <nav class="ops-nav">
          ${nav.map((n) => html`
            <a class=${n.id === route ? 'active' : ''} onClick=${() => navigate(n.id)}>
              <span class="ic">${n.icon}</span>${n.label}
            </a>`)}
        </nav>
        <div class="ops-sidebar-foot">
          <div class="ops-user">
            <div class="avatar">${initials(email)}</div>
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
          <button type="button" class="ops-menu-btn" aria-label="Ouvrir le menu" onClick=${() => setNavOpen((v) => !v)}>
            ${MENU_SVG}
          </button>
          <div class="search" onClick=${openCommandPalette} style="cursor:pointer">
            <span class="mag">⌕</span>
            <input placeholder="Rechercher, aller à… (⌘K)" readonly style="cursor:pointer" />
          </div>
          <div class="ops-topbar-actions">
            <div id="ops-notif-mount" class="ops-notif-mount"></div>
            <span class="kbd" onClick=${openCommandPalette} style="cursor:pointer">⌘K</span>
          </div>
        </div>
        <div class="ops-content">
          ${children}
          <footer class="ops-legal-foot">
            © 2026 SURO ·
            <a href="../conditions.html" target="_blank" rel="noopener">Conditions</a> ·
            <a href="../confidentialite.html" target="_blank" rel="noopener">Confidentialité</a>
          </footer>
        </div>
      </div>
    </div>
  `;
}
