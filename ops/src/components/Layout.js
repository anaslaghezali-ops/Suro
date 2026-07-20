import { html } from 'htm/preact';
import { navFor, roleLabel } from '../lib/permissions.js';
import { navigate } from '../router.js';
import { api } from '../lib/api.js';
import { initials } from '../lib/format.js';

function logout() {
  api.logAction('logout', 'staff').catch(() => {});
  api.logout();
  location.href = '../admin-login.html';
}

export function Layout({ role, route, session, children }) {
  const nav = navFor(role);
  const email = (session && session.email) || '';
  return html`
    <div class="ops-shell">
      <aside class="ops-sidebar">
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
          <div class="search">
            <span class="mag">⌕</span>
            <input placeholder="Rechercher un dossier, un client…" />
          </div>
          <span class="kbd">⌘K bientôt</span>
        </div>
        <div class="ops-content">${children}</div>
      </div>
    </div>
  `;
}
