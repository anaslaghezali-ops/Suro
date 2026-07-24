import { useState, useEffect } from 'preact/hooks';

export const ROUTES = {};

export function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return ROUTES[h] ? h : 'dashboard';
}

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

export function registerRoutes(map) {
  Object.assign(ROUTES, map);
}
