import { html } from 'htm/preact';

export function PageHeader({ title, subtitle, children }) {
  return html`
    <div class="cabinet-page-head">
      <div class="cabinet-page-head-copy">
        <h1 class="cabinet-page-title">${title}</h1>
        ${subtitle ? html`<p class="cabinet-page-sub">${subtitle}</p>` : null}
      </div>
      ${children ? html`<div class="cabinet-page-head-actions">${children}</div>` : null}
    </div>
  `;
}

export function KpiStrip({ items }) {
  return html`
    <div class="cabinet-kpi-row">
      ${items.map((it) => html`
        <div class="cabinet-kpi" key=${it.label}>
          <div class="n">${it.value}</div>
          <div class="l">${it.label}</div>
        </div>
      `)}
    </div>
  `;
}

export function Toolbar({ search, onSearch, placeholder, children }) {
  return html`
    <div class="cabinet-toolbar">
      <div class="cabinet-search-wrap">
        <span class="cabinet-search-icon" aria-hidden="true">⌕</span>
        <input
          class="ops-input cabinet-search"
          type="search"
          placeholder=${placeholder}
          value=${search}
          onInput=${(e) => onSearch(e.target.value)}
        />
      </div>
      ${children ? html`<div class="cabinet-toolbar-extra">${children}</div>` : null}
    </div>
  `;
}

export function FilterChips({ options, value, onChange }) {
  return html`
    <div class="cabinet-filters" role="tablist">
      ${options.map((o) => html`
        <button
          type="button"
          key=${o.id}
          class=${`cabinet-chip${value === o.id ? ' is-active' : ''}${o.attn ? ' is-attn' : ''}`}
          onClick=${() => onChange(o.id)}
        >${o.label}${o.count != null ? html`<span class="cabinet-chip-count">${o.count}</span>` : null}</button>
      `)}
    </div>
  `;
}

export function DataPanel({ children, empty }) {
  if (empty) {
    return html`<div class="cabinet-panel cabinet-panel--empty">${empty}</div>`;
  }
  return html`<div class="cabinet-panel">${children}</div>`;
}

export function ClientCell({ title, meta }) {
  return html`
    <div class="cabinet-client-cell">
      <div class="cabinet-client-name">${title}</div>
      ${meta ? html`<div class="cabinet-client-meta">${meta}</div>` : null}
    </div>
  `;
}

export function VehicleCell({ label, plate }) {
  return html`
    <div class="cabinet-vehicle-cell">
      <div class="cabinet-vehicle-label">${label}</div>
      ${plate ? html`<span class="cabinet-plate">${plate}</span>` : null}
    </div>
  `;
}
