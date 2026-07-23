import { html } from 'htm/preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import { Empty, Spinner } from './ui.js';

/* DataTable générique : recherche, tri, pagination.

   Deux modes :
   - CLIENT (défaut) : on passe `rows` (tableau complet), filtre/tri/pagination en mémoire.
   - SERVEUR : on passe `server` (fonction) → recherche/tri/pagination délégués au backend.
     Utilisé quand le volume interdit de tout charger dans le navigateur.

   Props communes :
   - columns: [{ key, label, sortable?, render?(row), width? }]
   - onRowClick?(row)
   - filters?: [{ id, label, options:[{value,label}], value, onChange }]
   - pageSize (défaut 12)
   - toolbarExtra? : nœud additionnel dans la barre d'outils
   - searchPlaceholder?

   Mode CLIENT :
   - rows: array
   - searchKeys: [k] champs concaténés pour la recherche

   Mode SERVEUR :
   - server: async ({ search, sortKey, sortDir, offset, limit }) => ({ rows, total })
   - serverKey?: valeur qui, si elle change (ex. un filtre parent), relance à la page 0
*/
export function DataTable({
  columns, rows, searchKeys = [], onRowClick, filters = [], pageSize = 12,
  toolbarExtra, server = null, serverKey = '', searchPlaceholder = 'Rechercher…',
}) {
  const isServer = !!server;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [page, setPage] = useState(0);

  // --- Mode serveur : état des résultats + recherche débouncée ---
  const [srv, setSrv] = useState({ rows: [], total: 0, loading: isServer });
  const [debouncedQ, setDebouncedQ] = useState('');
  const serverRef = useRef(server);
  serverRef.current = server; // évite de relancer sur l'identité de la fonction (inline à chaque rendu)

  // Débounce de la saisie (300 ms) : on ne requête pas à chaque frappe.
  useEffect(() => {
    if (!isServer) return undefined;
    const t = setTimeout(() => { setDebouncedQ(q); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [q, isServer]);

  // Toute page/tri/recherche/filtre parent qui change → on recharge la page courante.
  useEffect(() => {
    if (!isServer) return undefined;
    let alive = true;
    setSrv((s) => ({ ...s, loading: true }));
    Promise.resolve(serverRef.current({
      search: debouncedQ.trim(),
      sortKey: sort.key, sortDir: sort.dir,
      offset: page * pageSize, limit: pageSize,
    }))
      .then((res) => { if (alive) setSrv({ rows: res.rows || [], total: res.total || 0, loading: false }); })
      .catch(() => { if (alive) setSrv({ rows: [], total: 0, loading: false }); });
    return () => { alive = false; };
  }, [isServer, debouncedQ, sort.key, sort.dir, page, pageSize, serverKey]);

  // --- Mode client : filtre + tri en mémoire ---
  const filtered = useMemo(() => {
    if (isServer) return [];
    let r = rows || [];
    const needle = q.trim().toLowerCase();
    if (needle) {
      r = r.filter((row) =>
        searchKeys.map((k) => String(row[k] == null ? '' : row[k])).join(' ').toLowerCase().includes(needle)
      );
    }
    if (sort.key) {
      r = [...r].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
      });
    }
    return r;
  }, [isServer, rows, q, sort, searchKeys]);

  const total = isServer ? srv.total : filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = isServer ? srv.rows : filtered.slice(cur * pageSize, cur * pageSize + pageSize);
  const loading = isServer && srv.loading;

  const toggleSort = (col) => {
    if (!col.sortable) return;
    setSort((s) => s.key === col.key ? { key: col.key, dir: -s.dir } : { key: col.key, dir: 1 });
    if (isServer) setPage(0);
  };

  return html`
    <div>
      <div class="toolbar">
        <input class="filter" type="search" placeholder=${searchPlaceholder} value=${q}
          onInput=${(e) => { setQ(e.target.value); if (!isServer) setPage(0); }} />
        ${filters.map((f) => html`
          <select class="filter" value=${f.value} onChange=${(e) => { f.onChange(e.target.value); setPage(0); }}>
            <option value="">${f.label}</option>
            ${f.options.map((o) => html`<option value=${o.value}>${o.label}</option>`)}
          </select>
        `)}
        ${toolbarExtra || null}
        <div class="spacer"></div>
        <span class="count">${loading ? 'Chargement…' : `${total} résultat${total > 1 ? 's' : ''}`}</span>
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              ${columns.map((c) => html`
                <th class=${c.sortable ? 'sortable' : ''} style=${c.width ? `width:${c.width}` : ''} onClick=${() => toggleSort(c)}>
                  ${c.label}
                  ${c.sortable ? html`<span class="arrow">${sort.key === c.key ? (sort.dir > 0 ? '▲' : '▼') : '↕'}</span>` : null}
                </th>
              `)}
            </tr>
          </thead>
          <tbody>
            ${loading && slice.length === 0 ? html`
              <tr><td colspan=${columns.length}><div style="padding:24px;text-align:center"><${Spinner}/></div></td></tr>
            ` : slice.length === 0 ? html`
              <tr><td colspan=${columns.length}><${Empty}>Aucun résultat<//></td></tr>
            ` : slice.map((row) => html`
              <tr class=${onRowClick ? 'clickable' : ''} onClick=${onRowClick ? () => onRowClick(row) : null}>
                ${columns.map((c) => html`<td>${c.render ? c.render(row) : (row[c.key] ?? html`<span class="muted">—</span>`)}</td>`)}
              </tr>
            `)}
          </tbody>
        </table>
      </div>

      ${pages > 1 ? html`
        <div class="pager">
          <span class="count">Page ${cur + 1} / ${pages}</span>
          <button disabled=${cur === 0} onClick=${() => setPage(cur - 1)}>← Précédent</button>
          <button disabled=${cur >= pages - 1} onClick=${() => setPage(cur + 1)}>Suivant →</button>
        </div>` : null}
    </div>
  `;
}
