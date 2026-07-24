import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../../../ops/src/lib/useAsync.js';
import { SlideOver, Spinner, Empty, toast } from '../components/ui.js';
import { CLAIM_STATUS } from '../lib/permissions.js';
import { fmtDate } from '../../../ops/src/lib/format.js';

function ClaimDetail({ claim, onClose, onChanged }) {
  const [status, setStatus] = useState(claim.broker_status);

  const save = async () => {
    try {
      await api.claimSetStatus(claim.claim_id, status);
      toast('Statut mis à jour — client notifié par SURO', 'ok');
      onChanged();
      onClose();
    } catch (e) { toast(e.message || 'Erreur', 'err'); }
  };

  return html`
    <${SlideOver} open=${true} title=${'Sinistre — ' + (claim.claim_type || '')}
      subtitle=${`${claim.customer_name} · ${claim.immatriculation || ''}`}
      onClose=${onClose}>
      <div class="field-row"><div class="k">Survenu le</div><div class="v">${fmtDate(claim.claim_date)}</div></div>
      <div style="margin-top:16px">
        <label style="font-size:12px;font-weight:600">Changer le statut</label>
        <select class="ops-input" style="margin-top:6px" value=${status} onChange=${(e) => setStatus(e.target.value)}>
          ${Object.entries(CLAIM_STATUS).map(([k, v]) => html`<option value=${k}>${v}</option>`)}
        </select>
        <button class="btn-o primary" style="margin-top:10px" onClick=${save}>Appliquer & notifier le client</button>
      </div>
    <//>
  `;
}

export function Claims() {
  const [selected, setSelected] = useState(null);
  const claims = useAsync(() => api.listClaims(null, 100, 0), []);

  if (claims.loading) return html`<${Spinner}/>`;
  const rows = claims.data || [];

  return html`
    <h1 class="ops-h1">Sinistres</h1>
    ${rows.length === 0 ? html`<${Empty}>Aucun sinistre.<//>` : html`
      <table class="ops-table">
        <thead><tr><th>Date</th><th>Client</th><th>Véhicule</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${rows.map((c) => html`<tr key=${c.claim_id}>
            <td>${fmtDate(c.created_at)}</td>
            <td>${c.customer_name || '—'}</td>
            <td>${c.immatriculation || '—'}</td>
            <td>${CLAIM_STATUS[c.broker_status] || c.broker_status}</td>
            <td><button class="btn-o sm primary" onClick=${() => setSelected(c)}>Statut</button></td>
          </tr>`)}
        </tbody>
      </table>`}
    ${selected ? html`<${ClaimDetail} claim=${selected} onClose=${() => setSelected(null)} onChanged=${claims.reload} />` : null}
  `;
}
