import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useRouteParam, navigate } from '../router.js';
import { DataTable } from '../components/DataTable.js';
import { SlideOver, Badge, Spinner, Empty } from '../components/ui.js';
import { fmtDate, fmtMoney, coverageLabel, vehicleLabel, subStatus, paymentStatus, docStatus } from '../lib/format.js';

const claimTone = (s) => ({ pending: 'amber', approved: 'green', rejected: 'red', paid: 'blue' }[s] || 'gray');

/* Fiche client 360 : recoupe véhicules, contrats, paiements, documents, sinistres */
function ClientDetail({ client, onClose }) {
  const [tab, setTab] = useState('profil');
  const { data, loading } = useAsync(async () => {
    const [apps, payments, docs, claims] = await Promise.all([
      api.applications().catch(() => []),
      api.payments().catch(() => []),
      api.allDocuments().catch(() => []),
      api.claims().catch(() => []),
    ]);
    const email = client.email;
    const myApps = (apps || []).filter((a) => a.customer_email === email);
    const appIds = new Set(myApps.map((a) => a.id));
    return {
      apps: myApps,
      payments: (payments || []).filter((p) => p.customer_email === email),
      docs: (docs || []).filter((d) => d.customer_email === email),
      claims: (claims || []).filter((c) => appIds.has(c.application_id)),
    };
  }, [client.email]);

  const tabs = [
    { id: 'profil', label: 'Profil' },
    { id: 'contrats', label: 'Contrats' },
    { id: 'paiements', label: 'Paiements' },
    { id: 'documents', label: 'Documents' },
    { id: 'sinistres', label: 'Sinistres' },
  ];

  const openDossier = (id) => { onClose(); navigate('subscriptions/' + id); };

  const body = () => {
    if (loading) return html`<div style="padding:30px"><${Spinner}/></div>`;
    const d = data || { apps: [], payments: [], docs: [], claims: [] };

    if (tab === 'profil') {
      const active = d.apps.filter((a) => a.status === 'active').length;
      const totalPaid = d.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const pendingDocs = d.docs.filter((x) => (x.status || 'pending') === 'pending').length;
      const openClaims = d.claims.filter((c) => c.status === 'pending').length;
      // Véhicules uniques
      const seen = new Set(); const vehicles = [];
      d.apps.forEach((a) => { const k = (a.immatriculation || vehicleLabel(a)); if (!seen.has(k)) { seen.add(k); vehicles.push(a); } });
      return html`
        <div class="field-row"><div class="k">Nom</div><div class="v">${client.name || '—'}</div></div>
        <div class="field-row"><div class="k">Email</div><div class="v">${client.email}</div></div>
        <div class="field-row"><div class="k">Téléphone</div><div class="v">${client.phone || '—'}</div></div>
        <div class="field-row"><div class="k">Inscrit le</div><div class="v">${fmtDate(client.registered_at)}</div></div>

        <div class="kpi-grid" style="margin-top:16px">
          <div class="kpi"><div class="label">Contrats actifs</div><div class="value">${active}</div></div>
          <div class="kpi"><div class="label">Total payé</div><div class="value" style="font-size:20px">${fmtMoney(totalPaid)}</div></div>
          <div class="kpi ${pendingDocs ? 'attn' : ''}"><div class="label">Docs à vérifier</div><div class="value">${pendingDocs}</div></div>
          <div class="kpi ${openClaims ? 'attn' : ''}"><div class="label">Sinistres ouverts</div><div class="value">${openClaims}</div></div>
        </div>

        <div style="margin-top:18px">
          <div style="font-size:12px;font-weight:600;color:var(--color-neutral-600);margin-bottom:8px">🚗 VÉHICULES (${vehicles.length})</div>
          ${vehicles.length === 0 ? html`<p class="muted">Aucun véhicule.</p>` :
            vehicles.map((a) => html`<div class="field-row"><div class="v">${vehicleLabel(a)}</div><div class="k">${a.immatriculation || '—'}</div></div>`)}
        </div>`;
    }

    if (tab === 'contrats') {
      if (!d.apps.length) return html`<${Empty}>Aucun contrat.<//>`;
      return html`<div>${d.apps.map((a) => { const s = subStatus(a.status); return html`
        <div class="field-row" style="grid-template-columns:1fr auto;align-items:center">
          <div>
            <div class="v">${vehicleLabel(a)} · ${coverageLabel(a.coverage_type)}</div>
            <div class="k">${fmtMoney(a.annual_premium)} · échéance ${fmtDate(a.expires_at)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <${Badge} tone=${s.tone}>${s.label}<//>
            <button class="btn-o sm" onClick=${() => openDossier(a.id)}>Ouvrir →</button>
          </div>
        </div>`; })}</div>`;
    }

    if (tab === 'paiements') {
      if (!d.payments.length) return html`<${Empty}>Aucun paiement.<//>`;
      return html`<div>${d.payments.map((p) => { const s = paymentStatus(p.status || 'succeeded'); return html`
        <div class="field-row" style="grid-template-columns:1fr auto auto;gap:10px;align-items:center">
          <div><div class="v">${fmtMoney(p.amount)}</div><div class="k">${p.kind === 'renewal' ? 'Renouvellement' : 'Souscription'} · ${fmtDate(p.paid_at)}</div></div>
          <${Badge} tone=${s.tone}>${s.label}<//>
        </div>`; })}</div>`;
    }

    if (tab === 'documents') {
      if (!d.docs.length) return html`<${Empty}>Aucun document.<//>`;
      return html`<div>${d.docs.map((doc) => { const s = docStatus(doc.status || 'pending'); return html`
        <div class="field-row" style="grid-template-columns:1fr auto;align-items:center">
          <div class="v">📄 ${doc.name}</div><${Badge} tone=${s.tone}>${s.label}<//>
        </div>`; })}</div>`;
    }

    if (tab === 'sinistres') {
      if (!d.claims.length) return html`<${Empty}>Aucun sinistre.<//>`;
      return html`<div>${d.claims.map((c) => html`
        <div class="field-row" style="grid-template-columns:1fr auto;align-items:center">
          <div><div class="v">${c.claim_type || 'Sinistre'}</div><div class="k">${fmtDate(c.created_at)}</div></div>
          <${Badge} tone=${claimTone(c.status)}>${c.status || '—'}<//>
        </div>`)}</div>`;
    }
  };

  return html`
    <${SlideOver} open=${true} title=${client.name || client.email}
      subtitle=${client.name ? client.email : 'Client'} tabs=${tabs} activeTab=${tab} onTab=${setTab} onClose=${onClose}>
      ${body()}
    <//>`;
}

export function Clients() {
  const { data, loading, error } = useAsync(() => api.customers().catch(() => []), []);
  const [selected, setSelected] = useState(null);
  const param = useRouteParam();

  useEffect(() => {
    if (param && data) {
      const email = decodeURIComponent(param);
      const found = data.find((c) => c.email === email);
      if (found) setSelected(found);
    }
  }, [param, data]);

  const close = () => { setSelected(null); if (param) navigate('clients'); };

  if (loading) return html`<div style="padding:40px"><${Spinner}/></div>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;

  const columns = [
    { key: 'name', label: 'Nom', sortable: true, render: (c) => c.name || html`<span class="muted">—</span>` },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Téléphone', render: (c) => c.phone || html`<span class="muted">—</span>` },
    { key: 'contracts', label: 'Contrats', sortable: true },
    { key: 'registered_at', label: 'Inscrit le', sortable: true, render: (c) => fmtDate(c.registered_at) },
    { key: 'is_admin', label: '', render: (c) => c.is_admin ? html`<${Badge} tone="blue">staff<//>` : null },
  ];

  return html`
    <div class="page-head">
      <h1>Clients</h1>
      <p>Comptes clients inscrits. Cliquez pour ouvrir la fiche 360 (véhicules, contrats, paiements, documents, sinistres).</p>
    </div>
    <div class="card">
      <${DataTable} columns=${columns} rows=${data || []} searchKeys=${['name', 'email', 'phone']}
        onRowClick=${(c) => setSelected(c)} />
    </div>
    ${selected ? html`<${ClientDetail} client=${selected} onClose=${close} />` : null}
  `;
}
