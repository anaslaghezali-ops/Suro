import { html } from 'htm/preact';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Spinner, Badge } from '../components/ui.js';
import { fmtDate } from '../lib/format.js';

export function Cabinets({ role }) {
  const overview = useAsync(() => window.SURO_CABINET.opsOverview(), []);
  const anomalies = useAsync(() => window.SURO_CABINET.opsAnomalies(30), []);

  if (overview.loading) return html`<${Spinner}/>`;

  return html`
    <h1 class="ops-h1">Cabinets partenaires</h1>
    <p style="color:var(--color-neutral-600);margin-bottom:20px">Supervision des cabinets — dossiers ouverts, anomalies et sinistres.</p>

    <h2 style="font-size:16px;margin-bottom:12px">Vue d'ensemble</h2>
    <table class="ops-table" style="margin-bottom:28px">
      <thead><tr>
        <th>Cabinet</th><th>Actif</th><th>Dossiers ouverts</th><th>Anomalies</th><th>Sinistres</th><th>Âge moy. (h)</th>
      </tr></thead>
      <tbody>
        ${(overview.data || []).map((c) => html`<tr key=${c.cabinet_id}>
          <td><strong>${c.cabinet_name}</strong></td>
          <td>${c.is_active ? html`<${Badge} tone="green">Oui<//>` : html`<${Badge} tone="gray">Non<//>`}</td>
          <td>${c.tasks_open}</td>
          <td>${c.tasks_anomaly > 0 ? html`<${Badge} tone="red">${c.tasks_anomaly}<//>` : '0'}</td>
          <td>${c.claims_open}</td>
          <td>${c.avg_task_age_hours ?? '—'}</td>
        </tr>`)}
      </tbody>
    </table>

    <h2 style="font-size:16px;margin-bottom:12px">Anomalies signalées</h2>
    ${anomalies.loading ? html`<${Spinner}/>` :
      (anomalies.data || []).length === 0 ? html`<p style="color:var(--color-neutral-500)">Aucune anomalie.</p>` : html`
      <table class="ops-table">
        <thead><tr><th>Date</th><th>Cabinet</th><th>Client</th><th>Statut</th><th>Note</th></tr></thead>
        <tbody>
          ${anomalies.data.map((a) => html`<tr key=${a.task_id}>
            <td>${fmtDate(a.created_at)}</td>
            <td>${a.cabinet_name}</td>
            <td>${a.customer_name}</td>
            <td>${a.status}</td>
            <td>${a.anomaly_note || '—'}</td>
          </tr>`)}
        </tbody>
      </table>`}
  `;
}
