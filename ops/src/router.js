import { useState, useEffect } from 'preact/hooks';
import { Dashboard } from './routes/dashboard.js';
import { Subscriptions } from './routes/subscriptions.js';
import { Clients, Contracts, Payments, Audit } from './routes/modules.js';
import { Claims } from './routes/claims.js';
import { Documents } from './routes/documents.js';
import { Users } from './routes/users.js';
import { Settings } from './routes/settings.js';

export const ROUTES = {
  dashboard: Dashboard,
  subscriptions: Subscriptions,
  clients: Clients,
  contracts: Contracts,
  documents: Documents,
  payments: Payments,
  claims: Claims,
  users: Users,
  settings: Settings,
  audit: Audit,
};

export function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return ROUTES[h] ? h : 'dashboard';
}

export function navigate(id) { location.hash = '#/' + id; }

export function useRoute() {
  const [r, setR] = useState(currentRoute());
  useEffect(() => {
    const on = () => setR(currentRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
