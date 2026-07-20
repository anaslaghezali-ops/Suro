import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { navFor } from '../lib/permissions.js';
import { navigate } from '../router.js';
import { api } from '../lib/api.js';
import { vehicleLabel } from '../lib/format.js';

/* Déclencheur externe (topbar) — même pattern que les toasts */
let _open = null;
export function openCommandPalette() { if (_open) _open(); }

export function CommandPalette({ role }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState({ apps: [], customers: [], loaded: false });
  const inputRef = useRef(null);

  useEffect(() => {
    _open = () => { setOpen(true); setQ(''); setActive(0); };
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); setOpen((o) => !o); setQ(''); setActive(0);
      } else if (e.key === 'Escape') { setOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); _open = null; };
  }, []);

  // Charge les entités (souscriptions + clients) au premier ouverture
  useEffect(() => {
    if (open && !data.loaded) {
      Promise.all([api.applications().catch(() => []), api.customers().catch(() => [])])
        .then(([apps, customers]) => setData({ apps: apps || [], customers: customers || [], loaded: true }));
    }
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const needle = q.trim().toLowerCase();
  const navItems = navFor(role)
    .filter((n) => !needle || n.label.toLowerCase().includes(needle))
    .map((n) => ({ key: 'nav-' + n.id, icon: n.icon, label: n.label, hint: 'Aller à', go: n.id }));

  let entityItems = [];
  if (needle.length >= 2) {
    const subs = (data.apps || []).filter((a) =>
      [a.customer_email, a.immatriculation, a.marque, a.modele, a.policy_number, a.customer_phone]
        .map((x) => String(x || '').toLowerCase()).join(' ').includes(needle)
    ).slice(0, 5).map((a) => ({
      key: 'sub-' + a.id, icon: '▤', label: `${a.customer_email} — ${vehicleLabel(a)}`, hint: 'Souscription', go: 'subscriptions/' + a.id,
    }));
    const clients = (data.customers || []).filter((c) =>
      [c.name, c.email, c.phone].map((x) => String(x || '').toLowerCase()).join(' ').includes(needle)
    ).slice(0, 5).map((c) => ({
      key: 'cli-' + c.email, icon: '☺', label: c.name ? `${c.name} · ${c.email}` : c.email, hint: 'Client', go: 'clients',
    }));
    entityItems = [...subs, ...clients];
  }

  const items = [...navItems, ...entityItems];

  if (!open) return null;

  const choose = (item) => { if (!item) return; navigate(item.go); setOpen(false); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]); }
  };

  return html`
    <div class="cmdk-scrim" onClick=${() => setOpen(false)}>
      <div class="cmdk" onClick=${(e) => e.stopPropagation()}>
        <input ref=${inputRef} class="cmdk-input" placeholder="Aller à, ou chercher un dossier / un client…"
          value=${q} onInput=${(e) => { setQ(e.target.value); setActive(0); }} onKeyDown=${onKeyDown} />
        <div class="cmdk-list">
          ${items.length === 0 ? html`<div class="cmdk-empty">Aucun résultat</div>` :
            items.map((item, i) => html`
              <div class="cmdk-item ${i === active ? 'active' : ''}" key=${item.key}
                onMouseEnter=${() => setActive(i)} onClick=${() => choose(item)}>
                <span class="ic">${item.icon}</span>
                <span class="lbl">${item.label}</span>
                <span class="hint">${item.hint}</span>
              </div>`)}
        </div>
        <div class="cmdk-foot"><kbd>↑↓</kbd> naviguer · <kbd>↵</kbd> ouvrir · <kbd>esc</kbd> fermer</div>
      </div>
    </div>
  `;
}
