import { html } from 'htm/preact';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Spinner, Empty, Badge } from '../components/ui.js';
import { fmtMoney, timeAgo, subStatus, vehicleLabel } from '../lib/format.js';
import { navigate } from '../router.js';

function isToday(d) { const t = new Date(); const x = new Date(d); return x.toDateString() === t.toDateString(); }
function isThisMonth(d) { const t = new Date(); const x = new Date(d); return x.getMonth() === t.getMonth() && x.getFullYear() === t.getFullYear(); }

function Kpi({ label, value, sub, attn }) {
  return html`
    <div class="kpi ${attn ? 'attn' : ''}">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      ${sub ? html`<div class="sub">${sub}</div>` : null}
    </div>`;
}

export function Dashboard() {
  const { data, loading, error } = useAsync(async () => {
    const [apps, payments, claims, docs, audit] = await Promise.all([
      api.applications().catch(() => []),
      api.payments().catch(() => []),
      api.claims().catch(() => []),
      api.documents().catch(() => []),
      api.auditRecent(8).catch(() => []),
    ]);
    return { apps: apps || [], payments: payments || [], claims: claims || [], docs: docs || [], audit: audit || [] };
  }, []);

  if (loading) return html`<div style="padding:40px"><${Spinner}/></div>`;
  if (error) return html`<${Empty}>Erreur de chargement : ${error.message}<//>`;

  const { apps, payments, claims, docs, audit } = data;
  const subsToday = apps.filter((a) => isToday(a.created_at)).length;
  const subsMonth = apps.filter((a) => isThisMonth(a.created_at)).length;
  const active = apps.filter((a) => a.status === 'active').length;
  const paidMonth = payments.filter((p) => isThisMonth(p.paid_at) && (p.status || 'succeeded') === 'succeeded')
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pendingPay = payments.filter((p) => p.status === 'pending').length;
  const docsToCheck = docs.filter((d) => (d.status || 'pending') === 'pending').length;
  const openClaims = claims.filter((c) => c.status === 'pending').length;

  // File « à traiter »
  const queue = [];
  docs.filter((d) => (d.status || 'pending') === 'pending').forEach((d) =>
    queue.push({ type: 'Document', label: d.name, meta: d.customer_email, go: 'documents' }));
  claims.filter((c) => c.status === 'pending').forEach((c) =>
    queue.push({ type: 'Sinistre', label: c.claim_type || 'Sinistre', meta: (c.application_id || '').slice(0, 8), go: 'claims' }));
  payments.filter((p) => p.status === 'pending').forEach((p) =>
    queue.push({ type: 'Paiement', label: fmtMoney(p.amount), meta: p.customer_email, go: 'payments' }));

  return html`
    <div class="page-head">
      <h1>Dashboard</h1>
      <p>Vue d'ensemble de l'activité — ce qui doit être traité en priorité.</p>
    </div>

    <div class="kpi-grid">
      <${Kpi} label="Souscriptions aujourd'hui" value=${subsToday} />
      <${Kpi} label="Souscriptions ce mois" value=${subsMonth} />
      <${Kpi} label="Contrats actifs" value=${active} />
      <${Kpi} label="Paiements reçus (mois)" value=${fmtMoney(paidMonth)} />
      <${Kpi} label="Paiements en attente" value=${pendingPay} attn=${pendingPay > 0} />
      <${Kpi} label="Documents à vérifier" value=${docsToCheck} attn=${docsToCheck > 0} />
      <${Kpi} label="Sinistres ouverts" value=${openClaims} attn=${openClaims > 0} />
    </div>

    <div class="card">
      <div class="card-head"><h3>À traiter (${queue.length})</h3></div>
      ${queue.length === 0 ? html`<${Empty}>Rien en attente. 🎉<//>` : html`
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Type</th><th>Élément</th><th>Client / Réf.</th><th></th></tr></thead>
          <tbody>
            ${queue.slice(0, 12).map((q) => html`
              <tr class="clickable" onClick=${() => navigate(q.go)}>
                <td><${Badge} tone="amber">${q.type}<//></td>
                <td>${q.label}</td>
                <td class="muted">${q.meta || '—'}</td>
                <td style="text-align:right"><span class="muted">Traiter →</span></td>
              </tr>`)}
          </tbody>
        </table></div>`}
    </div>

    <div class="card">
      <div class="card-head"><h3>Activité récente</h3></div>
      <div class="card-body">
        ${(!audit || audit.length === 0) ? html`<${Empty}>Aucune activité enregistrée pour l'instant.<//>` : html`
          <div style="display:flex;flex-direction:column;gap:10px">
            ${audit.map((e) => html`
              <div style="display:flex;gap:10px;align-items:center;font-size:13.5px">
                <${Badge} tone="gray">${e.action}<//>
                <span>${e.entity || ''}</span>
                <span class="muted" style="margin-left:auto">${e.actor_email || ''} · ${timeAgo(e.created_at)}</span>
              </div>`)}
          </div>`}
      </div>
    </div>
  `;
}
