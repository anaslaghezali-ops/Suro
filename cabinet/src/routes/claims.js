import { html } from 'htm/preact';
import { useState, useMemo } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../../../ops/src/lib/useAsync.js';
import { SlideOver, Badge, Spinner, Empty, toast } from '../components/ui.js';
import { CLAIM_STATUS, CLAIM_STATUS_META } from '../lib/permissions.js';
import { fmtDate, claimTypeLabel, customerCell, vehicleCell, matchesSearch } from '../lib/cabinetFormat.js';
import {
  PageHeader, KpiStrip, Toolbar, FilterChips, DataPanel, ClientCell, VehicleCell,
} from '../components/listUi.js';

const CLAIM_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'open', label: 'En cours', attn: true },
  { id: 'dossier_recu', label: 'Reçus' },
  { id: 'cloture', label: 'Clôturés' },
];

function claimMatchesFilter(claim, filterId) {
  if (filterId === 'all') return true;
  if (filterId === 'open') return claim.broker_status !== 'cloture';
  return claim.broker_status === filterId;
}

function ClaimDetail({ claim, onClose, onChanged }) {
  const [status, setStatus] = useState(claim.broker_status);
  const client = customerCell(claim);
  const veh = vehicleCell(claim);
  const meta = CLAIM_STATUS_META[claim.broker_status] || { label: claim.broker_status, tone: 'gray' };

  const save = async () => {
    try {
      await api.claimSetStatus(claim.claim_id, status);
      toast('Statut mis à jour — client notifié par SURO', 'ok');
      onChanged();
      onClose();
    } catch (e) { toast(e.message || 'Erreur', 'err'); }
  };

  return html`
    <${SlideOver} open=${true} title=${claimTypeLabel(claim.claim_type)}
      subtitle=${`${client.title}${veh.plate ? ` · ${veh.plate}` : ''}`}
      onClose=${onClose}>
      <div style="margin-bottom:12px"><${Badge} tone=${meta.tone}>${meta.label}<//></div>
      <div class="field-row"><div class="k">Client</div><div class="v">${client.title}</div></div>
      <div class="field-row"><div class="k">Véhicule</div><div class="v">${veh.label}${veh.plate ? ` (${veh.plate})` : ''}</div></div>
      <div class="field-row"><div class="k">Déclaré le</div><div class="v">${fmtDate(claim.created_at)}</div></div>
      <div class="field-row"><div class="k">Survenu le</div><div class="v">${fmtDate(claim.claim_date)}</div></div>
      <div class="cabinet-detail-section cabinet-status-form">
        <h3>Mise à jour statut</h3>
        <label for="claim-status-select">Statut cabinet</label>
        <select id="claim-status-select" class="ops-input" style="margin-top:6px" value=${status}
          onChange=${(e) => setStatus(e.target.value)}>
          ${Object.entries(CLAIM_STATUS).map(([k, v]) => html`<option value=${k}>${v}</option>`)}
        </select>
        <button class="btn-o primary" style="margin-top:12px" onClick=${save}>Appliquer & notifier le client</button>
      </div>
    <//>
  `;
}

export function Claims() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const claims = useAsync(() => api.listClaims(null, 100, 0), []);

  const rows = useMemo(() => {
    const all = claims.data || [];
    return all.filter((c) => claimMatchesFilter(c, filter) && matchesSearch(c, search, [
      'customer_name', 'customer_email', 'immatriculation', 'claim_type', 'broker_status',
    ]));
  }, [claims.data, filter, search]);

  if (claims.loading) return html`<${Spinner}/>`;
  if (claims.error) {
    return html`
      <${PageHeader} title="Sinistres" subtitle="Suivi des sinistres clients assignés à votre cabinet" />
      <${Empty}>Impossible de charger : ${claims.error.message || 'erreur'}<//>
    `;
  }

  const all = claims.data || [];
  const open = all.filter((c) => c.broker_status !== 'cloture');
  const kpis = [
    { label: 'Sinistres actifs', value: open.length },
    { label: 'Dossiers reçus', value: all.filter((c) => c.broker_status === 'dossier_recu').length },
    { label: 'En traitement', value: all.filter((c) => !['dossier_recu', 'cloture'].includes(c.broker_status)).length },
    { label: 'Total', value: all.length },
  ];

  const filterOptions = CLAIM_FILTERS.map((f) => ({
    ...f,
    count: f.id === 'all' ? all.length : all.filter((c) => claimMatchesFilter(c, f.id)).length,
  }));

  return html`
    <${PageHeader}
      title="Sinistres"
      subtitle="Consultez les déclarations clients et mettez à jour le statut — le client est notifié par SURO."
    />
    <${KpiStrip} items=${kpis} />
    <${Toolbar} search=${search} onSearch=${setSearch} placeholder="Rechercher client, immatriculation, type…" />
    <${FilterChips} options=${filterOptions} value=${filter} onChange=${setFilter} />
    ${rows.length === 0
      ? html`<${DataPanel} empty=${html`<${Empty}>Aucun sinistre pour ce filtre.<//>`} />`
      : html`<${DataPanel}>
        <table class="cabinet-table">
          <thead><tr>
            <th class="col-date">Déclaré</th>
            <th>Client</th>
            <th>Véhicule</th>
            <th class="col-narrow">Type</th>
            <th class="col-narrow">Statut</th>
            <th class="col-actions"></th>
          </tr></thead>
          <tbody>
            ${rows.map((c) => {
              const client = customerCell(c);
              const veh = vehicleCell(c);
              const meta = CLAIM_STATUS_META[c.broker_status] || { label: c.broker_status, tone: 'gray' };
              return html`<tr key=${c.claim_id} onClick=${() => setSelected(c)}>
                <td class="col-date" data-label="Déclaré">${fmtDate(c.created_at)}</td>
                <td data-label="Client"><${ClientCell} title=${client.title} meta=${client.meta} /></td>
                <td data-label="Véhicule"><${VehicleCell} label=${veh.label} plate=${veh.plate} /></td>
                <td class="col-narrow" data-label="Type"><span class="cabinet-priority normale">${claimTypeLabel(c.claim_type)}</span></td>
                <td class="col-narrow" data-label="Statut"><${Badge} tone=${meta.tone}>${meta.label}<//></td>
                <td class="col-actions" data-label="">
                  <button class="btn-o sm primary" onClick=${(e) => { e.stopPropagation(); setSelected(c); }}>Ouvrir</button>
                </td>
              </tr>`;
            })}
          </tbody>
        </table>
      <//>`}
    ${selected ? html`<${ClaimDetail} claim=${selected} onClose=${() => setSelected(null)} onChanged=${claims.reload} />` : null}
  `;
}
