import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DataTable } from '../components/DataTable.js';
import { SavedViews } from '../components/SavedViews.js';
import { SlideOver, Badge, Spinner, Empty, toast } from '../components/ui.js';
import { can } from '../lib/permissions.js';
import { fmtDate, fmtDateTime } from '../lib/format.js';

const STATUSES = ['pending', 'approved', 'rejected', 'paid'];
const CLAIM_VIEWS = [
  { id: '',         label: 'Tous',       match: () => true },
  { id: 'pending',  label: 'En attente', attn: true, match: (c) => c.status === 'pending' },
  { id: 'approved', label: 'Approuvés',  match: (c) => c.status === 'approved' },
  { id: 'rejected', label: 'Rejetés',    match: (c) => c.status === 'rejected' },
  { id: 'paid',     label: 'Payés',      match: (c) => c.status === 'paid' },
];
const statusMeta = (s) => ({
  pending:  { label: 'En attente', tone: 'amber' },
  approved: { label: 'Approuvé',   tone: 'green' },
  rejected: { label: 'Rejeté',     tone: 'red' },
  paid:     { label: 'Payé',       tone: 'blue' },
}[s] || { label: s || '—', tone: 'gray' });

function Timeline({ status }) {
  const steps = [
    { label: 'Déclaré', state: 'done' },
    { label: 'En examen', state: status === 'pending' ? 'current' : 'done' },
    { label: status === 'rejected' ? 'Rejeté' : 'Décision', state: status === 'pending' ? 'todo' : 'done' },
    { label: status === 'paid' ? 'Indemnisé' : 'Indemnisation', state: status === 'paid' ? 'done' : status === 'approved' ? 'current' : 'todo' },
  ];
  const visible = status === 'rejected' ? steps.slice(0, 3) : steps;
  const tone = (st) => st === 'done' ? 'green' : st === 'current' ? 'amber' : 'gray';
  return html`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
    ${visible.map((s) => html`<${Badge} tone=${tone(s.state)}>${s.label}<//>`)}
  </div>`;
}

function Detail({ claim, caps, onClose, onChanged }) {
  const [tab, setTab] = useState('suivi');
  const [status, setStatus] = useState(claim.status);
  const files = useAsync(() => api.claimFiles(claim.id).catch(() => []), [claim.id]);
  const msgs = useAsync(() => api.claimMessages(claim.id).catch(() => []), [claim.id]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const canHandle = can(caps, 'claim.handle');

  const applyStatus = async () => {
    try { await api.updateClaimStatus(claim.id, status); toast('Statut mis à jour', 'ok'); onChanged(); }
    catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
  };

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try { await api.sendClaimMessage(claim.id, reply.trim()); setReply(''); msgs.reload(); }
    catch (e) { toast('Message non envoyé', 'err'); }
    finally { setSending(false); }
  };

  const tabs = [
    { id: 'suivi', label: 'Suivi' },
    { id: 'pieces', label: 'Pièces jointes' },
    { id: 'messages', label: 'Messages' },
  ];

  return html`
    <${SlideOver} open=${true} title=${'Sinistre — ' + (claim.claim_type || 'N/A')}
      subtitle=${html`Contrat ${(claim.application_id || '').slice(0, 8)}… · déclaré le ${fmtDate(claim.created_at)}`}
      tabs=${tabs} activeTab=${tab} onTab=${setTab} onClose=${onClose}>

      ${tab === 'suivi' ? html`
        <${Timeline} status=${claim.status} />
        <div class="field-row"><div class="k">Survenu le</div><div class="v">${fmtDate(claim.claim_date)}</div></div>
        <div class="field-row"><div class="k">Statut</div><div class="v">${(() => { const m = statusMeta(claim.status); return html`<${Badge} tone=${m.tone}>${m.label}<//>`; })()}</div></div>
        <div style="margin-top:12px;padding:12px;background:var(--color-neutral-50);border-radius:8px;font-size:13.5px">${claim.description || '—'}</div>

        ${canHandle ? html`
          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--color-neutral-200)">
            <div style="font-size:12px;font-weight:600;color:var(--color-neutral-600);margin-bottom:8px">CHANGER LE STATUT</div>
            <div style="display:flex;gap:10px">
              <select class="ops-input" style="max-width:200px" value=${status} onChange=${(e) => setStatus(e.target.value)}>
                ${STATUSES.map((s) => html`<option value=${s}>${statusMeta(s).label}</option>`)}
              </select>
              <button class="btn-o primary" onClick=${applyStatus}>Appliquer</button>
            </div>
          </div>` : null}
      ` : null}

      ${tab === 'pieces' ? html`
        ${files.loading ? html`<${Spinner}/>` :
          (!files.data || files.data.length === 0) ? html`<${Empty}>Aucune pièce jointe.<//>` : html`
          <div>${files.data.map((f) => html`
            <div class="field-row" style="grid-template-columns:1fr auto">
              <div class="v">${(f.content_type || '').startsWith('video') ? 'Vidéo' : 'Photo'} — ${f.name}</div>
              <button class="btn-o sm" onClick=${() => api.downloadClaimFile(f.storage_path, f.name)}>⤓ Télécharger</button>
            </div>`)}</div>`}
      ` : null}

      ${tab === 'messages' ? html`
        ${msgs.loading ? html`<${Spinner}/>` : html`
          <div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;margin-bottom:12px">
            ${(!msgs.data || msgs.data.length === 0) ? html`<${Empty}>Aucun message.<//>` :
              msgs.data.map((m) => html`
                <div style="padding:8px 12px;border-radius:8px;background:${m.sender === 'admin' ? 'rgba(15,118,110,0.08)' : 'var(--color-neutral-100)'}">
                  <div style="font-size:11px;color:var(--color-neutral-600)">${m.sender === 'admin' ? 'SURO (équipe)' : (m.sender_email || 'Client')} — ${fmtDateTime(m.created_at)}</div>
                  <div style="font-size:13.5px">${m.body}</div>
                </div>`)}
          </div>
          ${canHandle ? html`
            <div style="display:flex;gap:8px">
              <input class="ops-input" placeholder="Répondre au client…" value=${reply}
                onInput=${(e) => setReply(e.target.value)}
                onKeyDown=${(e) => { if (e.key === 'Enter') send(); }} />
              <button class="btn-o primary" disabled=${sending} onClick=${send}>Envoyer</button>
            </div>` : null}
        `}
      ` : null}
    <//>
  `;
}

export function Claims({ caps }) {
  const [activeView, setActiveView] = useState('');
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Compteurs par vue (bornés côté serveur) ; rechargés après un changement de statut.
  const counts = useAsync(() => api.claimsCounts().catch(() => null), [reloadKey]);
  const views = CLAIM_VIEWS.map((v) => ({
    id: v.id, label: v.label, attn: v.attn,
    count: counts.data ? (counts.data[v.id || 'all'] ?? null) : null,
  }));

  // Liste paginée serveur : la vue active devient un filtre `status`.
  const fetchPage = ({ search, sortKey, sortDir, offset, limit }) =>
    api.claimsPage({ status: activeView || undefined, search, sortKey, sortDir, offset, limit });

  const columns = [
    { key: 'id', label: 'Réf.', render: (c) => html`<span class="muted">${c.id.slice(0, 8)}…</span>` },
    { key: 'application_id', label: 'Contrat', render: (c) => html`<span class="muted">${(c.application_id || '').slice(0, 8)}…</span>` },
    { key: 'claim_type', label: 'Type', sortable: true },
    { key: 'status', label: 'Statut', sortable: true, render: (c) => { const m = statusMeta(c.status); return html`<${Badge} tone=${m.tone}>${m.label}<//>`; } },
    { key: 'created_at', label: 'Déclaré le', sortable: true, render: (c) => fmtDate(c.created_at) },
  ];

  return html`
    <div class="page-head">
      <h1>Sinistres</h1>
      <p>Réclamations clients. Cliquez pour traiter : suivi, pièces jointes et messagerie.</p>
    </div>
    <div class="card">
      <${SavedViews} views=${views} active=${activeView} onChange=${setActiveView} />
      <${DataTable} columns=${columns} server=${fetchPage} serverKey=${`${activeView}|${reloadKey}`}
        searchPlaceholder="Rechercher (type, description)…"
        onRowClick=${(c) => setSelected(c)} />
    </div>
    ${selected ? html`<${Detail} claim=${selected} caps=${caps}
      onClose=${() => setSelected(null)}
      onChanged=${() => { setSelected(null); setReloadKey((k) => k + 1); }} />` : null}
  `;
}
