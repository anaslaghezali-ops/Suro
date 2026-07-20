import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DataTable } from '../components/DataTable.js';
import { Badge, Spinner, Empty } from '../components/ui.js';
import { fmtDate, fmtDateTime, fmtMoney, coverageLabel, vehicleLabel, subStatus, paymentStatus } from '../lib/format.js';

function Page({ title, subtitle, children }) {
  return html`<div><div class="page-head"><h1>${title}</h1><p>${subtitle}</p></div>${children}</div>`;
}
function Loading() { return html`<div style="padding:40px"><${Spinner}/></div>`; }

/* ---------------- CLIENTS ---------------- */
export function Clients() {
  const { data, loading, error } = useAsync(() => api.customers().catch(() => []), []);
  if (loading) return html`<${Loading}/>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;
  const columns = [
    { key: 'name', label: 'Nom', sortable: true, render: (c) => c.name || html`<span class="muted">—</span>` },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Téléphone', render: (c) => c.phone || html`<span class="muted">—</span>` },
    { key: 'contracts', label: 'Contrats', sortable: true },
    { key: 'registered_at', label: 'Inscrit le', sortable: true, render: (c) => fmtDate(c.registered_at) },
    { key: 'is_admin', label: '', render: (c) => c.is_admin ? html`<${Badge} tone="blue">staff<//>` : null },
  ];
  return html`<${Page} title="Clients" subtitle="Comptes clients inscrits (avec ou sans contrat).">
    <div class="card"><${DataTable} columns=${columns} rows=${data || []} searchKeys=${['name', 'email', 'phone']} /></div>
  <//>`;
}

/* ---------------- CONTRATS (souscriptions actives/expirées) ---------------- */
export function Contracts() {
  const { data, loading, error } = useAsync(() => api.applications().catch(() => []), []);
  if (loading) return html`<${Loading}/>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;
  const rows = (data || []).filter((a) => a.status === 'active' || a.status === 'expired');
  const columns = [
    { key: 'policy_number', label: 'N° / Réf.', render: (a) => a.policy_number || html`<span class="muted">${a.id.slice(0, 8)}…</span>` },
    { key: 'customer_email', label: 'Client', sortable: true },
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

/* ---------------- PAIEMENTS ---------------- */
export function Payments() {
  const { data, loading, error } = useAsync(() => api.payments().catch(() => []), []);
  const [filter, setFilter] = useState('');
  if (loading) return html`<${Loading}/>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;
  const rows = (data || []).filter((p) => !filter || (p.status || 'succeeded') === filter);
  const columns = [
    { key: 'customer_email', label: 'Client', sortable: true },
    { key: 'amount', label: 'Montant', sortable: true, render: (p) => fmtMoney(p.amount) },
    { key: 'kind', label: 'Type', render: (p) => p.kind === 'renewal' ? 'Renouvellement' : 'Souscription' },
    { key: 'status', label: 'Statut', sortable: true, render: (p) => { const s = paymentStatus(p.status || 'succeeded'); return html`<${Badge} tone=${s.tone}>${s.label}<//>`; } },
    { key: 'paid_at', label: 'Date', sortable: true, render: (p) => fmtDate(p.paid_at) },
  ];
  return html`<${Page} title="Paiements" subtitle="Historique complet des paiements (souscriptions et renouvellements).">
    <div class="card"><${DataTable} columns=${columns} rows=${rows}
      searchKeys=${['customer_email']}
      filters=${[{ id: 'status', label: 'Tous les statuts', value: filter, onChange: setFilter,
        options: [{ value: 'succeeded', label: 'Réussi' }, { value: 'pending', label: 'En attente' }, { value: 'failed', label: 'Échoué' }] }]}
    /></div>
  <//>`;
}

/* ---------------- SINISTRES ---------------- */
export function Claims() {
  const { data, loading, error } = useAsync(() => api.claims().catch(() => []), []);
  if (loading) return html`<${Loading}/>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;
  const tone = (s) => ({ pending: 'amber', approved: 'green', rejected: 'red', paid: 'blue' }[s] || 'gray');
  const columns = [
    { key: 'id', label: 'Réf.', render: (c) => html`<span class="muted">${c.id.slice(0, 8)}…</span>` },
    { key: 'application_id', label: 'Contrat', render: (c) => html`<span class="muted">${(c.application_id || '').slice(0, 8)}…</span>` },
    { key: 'claim_type', label: 'Type', sortable: true },
    { key: 'status', label: 'Statut', sortable: true, render: (c) => html`<${Badge} tone=${tone(c.status)}>${c.status || '—'}<//>` },
    { key: 'created_at', label: 'Déclaré le', sortable: true, render: (c) => fmtDate(c.created_at) },
  ];
  return html`<${Page} title="Sinistres" subtitle="Réclamations clients. Le traitement détaillé (timeline, messagerie) sera porté ici en Phase 6.">
    <div class="card"><${DataTable} columns=${columns} rows=${data || []} searchKeys=${['claim_type', 'description']} /></div>
  <//>`;
}

/* ---------------- JOURNAL D'ACTIVITÉ ---------------- */
export function Audit() {
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
