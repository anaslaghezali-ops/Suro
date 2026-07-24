import { useState, useEffect } from 'preact/hooks';
import { Dashboard } from './routes/dashboard.js?v=24';
import { Subscriptions } from './routes/subscriptions.js?v=24';
import { Contracts, Payments, Audit } from './routes/modules.js?v=24';
import { Clients } from './routes/clients.js?v=24';
import { Claims } from './routes/claims.js?v=24';
import { Documents } from './routes/documents.js?v=24';
import { Users } from './routes/users.js?v=24';
import { Settings } from './routes/settings.js?v=24';
import { Privileges } from './routes/privileges.js?v=24';
import { Analytics } from './routes/analytics.js?v=24';

export const ROUTES = {
  dashboard: Dashboard,
  subscriptions: Subscriptions,
  clients: Clients,
  contracts: Contracts,
  documents: Documents,
  payments: Payments,
  claims: Claims,
  analytics: Analytics,
  users: Users,
  settings: Settings,
  audit: Audit,
  privileges: Privileges,
};

export function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return ROUTES[h] ? h : 'dashboard';
}

// Second segment du hash (ex: #/subscriptions/<id> → '<id>')
export function routeParam() {
  return (location.hash || '').replace(/^#\/?/, '').split('/')[1] || null;
}

// navigate('subscriptions') ou navigate('subscriptions/<id>')
export function navigate(path) { location.hash = '#/' + path; }

export function useRoute() {
  const [r, setR] = useState(currentRoute());
  useEffect(() => {
    const on = () => setR(currentRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function useRouteParam() {
  const [p, setP] = useState(routeParam());
  useEffect(() => {
    const on = () => setP(routeParam());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return p;
}
