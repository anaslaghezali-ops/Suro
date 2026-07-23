import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DataTable } from '../components/DataTable.js';
import { Badge, Spinner, Empty } from '../components/ui.js';
import { fmtDate, fmtDateTime, fmtMoney, coverageLabel, vehicleLabel, vehicleTypeLabel, subStatus, paymentStatus } from '../lib/format.js';

function Page({ title, subtitle, children }) {
  return html`<div><div class="page-head"><h1>${title}</h1><p>${subtitle}</p></div>${children}</div>`;
}
function Loading() { return html`<div style="padding:40px"><${Spinner}/></div>`; }

/* Clients : voir routes/clients.js (fiche client 360). */

/* ---------------- CONTRATS (souscriptions actives/expirées) ---------------- */
export function Contracts({ caps }) {
  const { data, loading, error } = useAsync(() => api.applications().catch(() => []), []);
  if (loading) return html`<${Loading}/>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;
  const rows = (data || []).filter((a) => a.status === 'active' || a.status === 'expired');
  const columns = [
    { key: 'policy_number', label: 'N° / Réf.', render: (a) => a.policy_number || html`<span class="muted">${a.id.slice(0, 8)}…</span>` },
    { key: 'customer_email', label: 'Client', sortable: true },
    { key: 'vehicle_type', label: 'Type', sortable: true, render: (a) => html`<${Badge} tone=${a.vehicle_type === 'moto' ? 'amber' : 'blue'}>${vehicleTypeLabel(a.vehicle_type)}<//>` },
    { key: 'vehicle', label: 'Véhicule', render: (a) => vehicleLabel(a) },
    { key: 'coverage_type', label: 'Couverture', render: (a) => coverageLabel(a.coverage_type) },
    { key: 'annual_premium', label: 'Prime', sortable: true, render: (a) => fmtMoney(a.annual_premium) },
    { key: 'status', label: 'Statut', sortable: true, render: (a) => { const s = subStatus(a.status); return html`<${Badge} tone=${s.tone}>${s.label}<//>`; } },
    { key: 'expires_at', label: 'Échéance', sortable: true, render: (a) => fmtDate(a.expires_at) },
  ];
  return html`<${Page} title="Contrats" subtitle="Contrats émis (souscriptions actives et expirées).">
    <div class="card"><${DataTable} columns=${columns} rows=${rows} searchKeys=${['customer_email', 'immatriculation', 'marque', 'modele', 'policy_number']} /></div>
  <//>`;
}

/* ---------------- PAIEMENTS (pagination serveur) ---------------- */
export function Payments({ caps }) {
  const [filter, setFilter] = useState('');
  // Recherche / tri / pagination délégués à PostgREST — rien n'est chargé en bloc.
  const fetchPage = ({ search, sortKey, sortDir, offset, limit }) =>
    api.paymentsPage({ status: filter || undefined, search, sortKey, sortDir, offset, limit });
  const columns = [
    { key: 'customer_email', label: 'Client', sortable: true },
    { key: 'amount', label: 'Montant', sortable: true, render: (p) => fmtMoney(p.amount) },
    { key: 'kind', label: 'Type', render: (p) => p.kind === 'renewal' ? 'Renouvellement' : 'Souscription' },
    { key: 'status', label: 'Statut', sortable: true, render: (p) => { const s = paymentStatus(p.status || 'succeeded'); return html`<${Badge} tone=${s.tone}>${s.label}<//>`; } },
    { key: 'paid_at', label: 'Date', sortable: true, render: (p) => fmtDate(p.paid_at) },
  ];
  return html`<${Page} title="Paiements" subtitle="Historique complet des paiements (souscriptions et renouvellements).">
    <div class="card"><${DataTable} columns=${columns}
      server=${fetchPage} serverKey=${filter} searchPlaceholder="Rechercher un client…"
      filters=${[{ id: 'status', label: 'Tous les statuts', value: filter, onChange: setFilter,
        options: [{ value: 'succeeded', label: 'Réussi' }, { value: 'pending', label: 'En attente' }, { value: 'failed', label: 'Échoué' }] }]}
    /></div>
  <//>`;
}

/* Sinistres : voir routes/claims.js (fiche de traitement complète). */

/* ---------------- JOURNAL D'ACTIVITÉ ---------------- */
export function Audit({ caps }) {
  const { data, loading, error } = useAsync(() => api.auditRecent(200).catch(() => []), []);
  if (loading) return html`<${Loading}/>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;
  const columns = [
    { key: 'created_at', label: 'Quand', sortable: true, render: (e) => fmtDateTime(e.created_at) },
    { key: 'actor_email', label: 'Acteur' },
    { key: 'action', label: 'Action', render: (e) => html`<${Badge} tone="gray">${e.action}<//>` },
    { key: 'entity', label: 'Entité', render: (e) => e.entity || html`<span class="muted">—</span>` },
    { key: 'entity_id', label: 'Réf.', render: (e) => e.entity_id ? html`<span class="muted">${String(e.entity_id).slice(0, 8)}…</span>` : null },
  ];
  return html`<${Page} title="Journal d'activité" subtitle="Traçabilité des actions du staff (connexions, créations, modifications, validations…).">
    <div class="card"><${DataTable} columns=${columns} rows=${data || []} searchKeys=${['actor_email', 'action', 'entity']} pageSize=${20} /></div>
  <//>`;
}
