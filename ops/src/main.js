import { html, render } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { api } from './lib/api.js';
import { useRoute, ROUTES } from './router.js';
import { Layout } from './components/Layout.js';
import { CommandPalette } from './components/CommandPalette.js';
import { FullSpinner, registerToast } from './components/ui.js';
import { navFor } from './lib/permissions.js';

const LOGIN = '../admin-login.html';

function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    registerToast((message, kind) => {
      const id = Math.random().toString(36).slice(2);
      setItems((x) => [...x, { id, message, kind }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
    });
  }, []);
  return html`<div class="toast-wrap">${items.map((t) => html`<div class="toast ${t.kind}" key=${t.id}>${t.message}</div>`)}</div>`;
}

function App() {
  const [role, setRole] = useState(undefined); // undefined = chargement
  const [caps, setCaps] = useState(null); // capacités de l'utilisateur
  const [session] = useState(api.session());
  const route = useRoute();

  useEffect(() => {
    (async () => {
      const s = api.session();
      if (!s || !s.access_token) { location.href = LOGIN; return; }
      let r = null;
      try { r = await api.currentRole(); } catch (e) { /* réseau/perm */ }
      if (!r) { api.logout(); location.href = LOGIN; return; } // pas membre du staff
      setRole(r);

      // Charger les capacités de l'utilisateur
      try {
        const privileges = await api.myPrivileges();
        setCaps(privileges || []);
      } catch (e) {
        console.error('Failed to load privileges:', e);
        setCaps([]);
      }

      api.logAction('login', 'staff').catch(() => {});
    })();
  }, []);

  if (role === undefined) return html`<${FullSpinner}/>`;

  // Garde de route : on ne rend qu'un écran autorisé pour le rôle
  const allowed = navFor(role).map((n) => n.id);
  const activeId = allowed.includes(route) ? route : 'dashboard';
  const View = ROUTES[activeId];

  return html`
    <${Layout} role=${role} route=${activeId} session=${session}>
      <${View} role=${role} caps=${caps} />
    <//>
    <${CommandPalette} role=${role} />
  `;
}

function Root() {
  return html`<${App}/><${Toasts}/>`;
}

render(html`<${Root}/>`, document.getElementById('ops-root'));
