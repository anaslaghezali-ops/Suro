import { html, render } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { api, LOGIN } from './lib/api.js';
import { useRoute, registerRoutes } from './router.js';
import { Layout } from './components/Layout.js';
import { FullSpinner, registerToast } from './components/ui.js';
import { navFor } from './lib/permissions.js';
import { Dashboard } from './routes/dashboard.js';
import { Subscriptions } from './routes/subscriptions.js';
import { Claims } from './routes/claims.js';
import { Notifications } from './routes/notifications.js';
import { Team } from './routes/team.js';

registerRoutes({
  dashboard: Dashboard,
  subscriptions: Subscriptions,
  claims: Claims,
  notifications: Notifications,
  team: Team,
});

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
  const [ctx, setCtx] = useState(undefined);
  const [session] = useState(api.session());
  const route = useRoute();

  useEffect(() => {
    (async () => {
      const s = api.session();
      if (!s || !s.access_token) { location.href = LOGIN; return; }
      try {
        const c = await api.context();
        if (!c || !c.cabinet_id) { api.logout(); location.href = LOGIN; return; }
        setCtx(c);
      } catch (e) {
        api.logout();
        location.href = LOGIN;
      }
    })();
  }, []);

  if (ctx === undefined) return html`<${FullSpinner}/>`;

  const role = ctx.cabinet_role;
  const allowed = navFor(role).map((n) => n.id);
  const activeId = allowed.includes(route) ? route : 'dashboard';
  const View = { dashboard: Dashboard, subscriptions: Subscriptions, claims: Claims, notifications: Notifications, team: Team }[activeId];

  return html`
    <${Layout} role=${role} route=${activeId} session=${session} cabinetName=${ctx.cabinet_name}>
      <${View} />
    <//>
  `;
}

render(html`<${App}/><${Toasts}/>`, document.getElementById('cabinet-root'));
