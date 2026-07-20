import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { navFor } from '../lib/permissions.js';
import { navigate } from '../router.js';

/* Déclencheur externe (topbar) — même pattern que les toasts */
let _open = null;
export function openCommandPalette() { if (_open) _open(); }

export function CommandPalette({ role }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // Commandes = navigation autorisée par le rôle
  const commands = navFor(role).map((n) => ({ id: n.id, label: n.label, icon: n.icon, hint: 'Aller à' }));
  const needle = q.trim().toLowerCase();
  const items = needle ? commands.filter((c) => c.label.toLowerCase().includes(needle)) : commands;

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

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  if (!open) return null;

  const choose = (item) => { if (!item) return; navigate(item.id); setOpen(false); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]); }
  };

  return html`
    <div class="cmdk-scrim" onClick=${() => setOpen(false)}>
      <div class="cmdk" onClick=${(e) => e.stopPropagation()}>
        <input ref=${inputRef} class="cmdk-input" placeholder="Aller à… (tapez pour filtrer)"
          value=${q} onInput=${(e) => { setQ(e.target.value); setActive(0); }} onKeyDown=${onKeyDown} />
        <div class="cmdk-list">
          ${items.length === 0 ? html`<div class="cmdk-empty">Aucune commande</div>` :
            items.map((item, i) => html`
              <div class="cmdk-item ${i === active ? 'active' : ''}"
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
