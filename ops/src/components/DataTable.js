import { html } from 'htm/preact';
import { useState, useMemo } from 'preact/hooks';
import { Empty } from './ui.js';

/* DataTable générique : recherche instantanée, tri, pagination — côté client.
   (Passera en pagination serveur quand les volumes le justifieront.)

   Props:
   - columns: [{ key, label, sortable?, render?(row), width? }]
   - rows: array
   - searchKeys: [k] champs concaténés pour la recherche
   - onRowClick?(row)
   - filters?: [{ id, label, options:[{value,label}], value, onChange }]
   - pageSize (défaut 12)
   - toolbarExtra? : noeud additionnel dans la barre d'outils
*/
export function DataTable({ columns, rows, searchKeys = [], onRowClick, filters = [], pageSize = 12, toolbarExtra }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
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
  }, [rows, q, sort, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  const toggleSort = (col) => {
    if (!col.sortable) return;
    setSort((s) => s.key === col.key ? { key: col.key, dir: -s.dir } : { key: col.key, dir: 1 });
  };

  return html`
    <div>
      <div class="toolbar">
        <input class="filter" type="search" placeholder="Rechercher…" value=${q}
          onInput=${(e) => { setQ(e.target.value); setPage(0); }} />
        ${filters.map((f) => html`
          <select class="filter" value=${f.value} onChange=${(e) => { f.onChange(e.target.value); setPage(0); }}>
            <option value="">${f.label}</option>
            ${f.options.map((o) => html`<option value=${o.value}>${o.label}</option>`)}
          </select>
        `)}
        ${toolbarExtra || null}
        <div class="spacer"></div>
        <span class="count">${filtered.length} résultat${filtered.length > 1 ? 's' : ''}</span>
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
            ${slice.length === 0 ? html`
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
