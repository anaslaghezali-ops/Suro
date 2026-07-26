import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../../../ops/src/lib/useAsync.js';
import { SlideOver, Badge, Spinner, Empty, toast } from '../components/ui.js';
import { TASK_STATUS } from '../lib/permissions.js';
import { fmtDate } from '../../../ops/src/lib/format.js';

const Kyc = () => window.SuroKyc;

function docLabel(doc) {
  const kyc = Kyc();
  if (kyc && doc.document_type) {
    return kyc.kycDocShortLabel(doc.document_type, doc.document_side);
  }
  return doc.name || 'Document';
}

function DocumentsSection({ applicationId }) {
  const docs = useAsync(() => api.listApplicationDocuments(applicationId), [applicationId]);
  const [busyId, setBusyId] = useState(null);

  const download = async (doc) => {
    setBusyId(doc.id);
    try {
      await api.downloadDocument(doc.storage_path, doc.name);
    } catch (e) {
      toast(e.message || 'Téléchargement impossible', 'err');
    } finally {
      setBusyId(null);
    }
  };

  if (docs.loading) return html`<div style="margin-top:16px"><${Spinner}/></div>`;
  const rows = docs.data || [];
  if (rows.length === 0) {
    return html`<div style="margin-top:16px" class="muted">Aucun document client.</div>`;
  }

  const kyc = Kyc();
  const summary = kyc ? kyc.summarizeKycForPolicy(applicationId, rows) : null;

  return html`
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--color-neutral-200)">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px">DOCUMENTS SOUSCRIPTEUR</div>
      ${summary ? html`<div class="muted" style="font-size:12px;margin-bottom:10px">
        ${summary.received}/${summary.totalSlots} pièces KYC reçues
      </div>` : null}
      <div style="display:flex;flex-direction:column;gap:8px">
        ${rows.map((doc) => html`<div key=${doc.id}
          style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--color-neutral-200);border-radius:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${docLabel(doc)}</div>
            <div class="muted" style="font-size:11px">${doc.name} · ${fmtDate(doc.created_at)}</div>
          </div>
          <button class="btn-o sm" disabled=${busyId === doc.id}
            onClick=${() => download(doc)}>⤓ Télécharger</button>
        </div>`)}
      </div>
    </div>
  `;
}

function TaskDetail({ task, onClose, onChanged }) {
  const [policyNum, setPolicyNum] = useState('');

  const act = async (action, payload) => {
    try {
      await api.taskAction(task.task_id, action, payload);
      toast('Action enregistrée', 'ok');
      onChanged();
      onClose();
    } catch (e) { toast(e.message || 'Erreur', 'err'); }
  };

  return html`
    <${SlideOver} open=${true} title=${task.customer_name || 'Client'}
      subtitle=${`${task.immatriculation || ''} · ${task.marque || ''} ${task.modele || ''}`}
      onClose=${onClose}>
      <div class="field-row"><div class="k">Email</div><div class="v">${task.customer_email}</div></div>
      <div class="field-row"><div class="k">Produit</div><div class="v">${task.coverage_type || '—'}</div></div>
      <div class="field-row"><div class="k">Prime</div><div class="v">${task.annual_premium ? task.annual_premium + ' MAD' : '—'}</div></div>
      <div class="field-row"><div class="k">Statut</div><div class="v">${(TASK_STATUS[task.status] || {}).label || task.status}</div></div>
      <${DocumentsSection} applicationId=${task.application_id} />
      <div class="cabinet-actions" style="margin-top:20px">
        <button class="btn-o primary" onClick=${() => act('prendre_en_charge')}>Prendre en charge</button>
        <button class="btn-o" onClick=${() => act('valider')}>Valider</button>
        <button class="btn-o" onClick=${() => act('demander_pieces', { message: 'SURO a besoin de documents complémentaires.' })}>Demander pièces</button>
        <button class="btn-o" onClick=${() => act('refuser')}>Refuser</button>
        <button class="btn-o" onClick=${() => act('anomalie', { note: 'Anomalie signalée' })}>Anomalie</button>
      </div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--color-neutral-200)">
        <div style="font-size:12px;font-weight:600;margin-bottom:8px">ÉMETTRE LA POLICE</div>
        <div style="display:flex;gap:8px">
          <input class="ops-input" placeholder="N° police" value=${policyNum} onInput=${(e) => setPolicyNum(e.target.value)} />
          <button class="btn-o primary" onClick=${() => act('emettre_police', { policy_number: policyNum })}>Émettre</button>
        </div>
      </div>
    <//>
  `;
}

export function Subscriptions() {
  const [selected, setSelected] = useState(null);
  const tasks = useAsync(() => api.listTasks(null, 100, 0), []);

  if (tasks.loading) return html`<${Spinner}/>`;
  const rows = tasks.data || [];

  return html`
    <h1 class="ops-h1">Souscriptions</h1>
    ${rows.length === 0 ? html`<${Empty}>Aucun dossier.<//>` : html`
      <table class="ops-table">
        <thead><tr>
          <th>Date</th><th>Client</th><th>Véhicule</th><th>Statut</th><th>Priorité</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map((t) => html`<tr key=${t.task_id}>
            <td>${fmtDate(t.created_at)}</td>
            <td>${t.customer_name || '—'}</td>
            <td>${t.immatriculation || ''} ${t.marque || ''}</td>
            <td><${Badge} tone=${(TASK_STATUS[t.status] || {}).tone || 'gray'}>${(TASK_STATUS[t.status] || {}).label || t.status}<//></td>
            <td><span class="cabinet-priority ${t.priority}">${t.priority}</span></td>
            <td><button class="btn-o sm primary" onClick=${() => setSelected(t)}>Traiter</button></td>
          </tr>`)}
        </tbody>
      </table>`}
    ${selected ? html`<${TaskDetail} task=${selected} onClose=${() => setSelected(null)} onChanged=${tasks.reload} />` : null}
  `;
}
