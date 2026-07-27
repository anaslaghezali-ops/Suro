import { html } from 'htm/preact';
import { useState, useMemo } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../../../ops/src/lib/useAsync.js';
import { SlideOver, Badge, Spinner, Empty, toast } from '../components/ui.js';
import { TASK_STATUS } from '../lib/permissions.js';
import { fmtDate, fmtMoney, customerCell, vehicleCell, matchesSearch } from '../lib/cabinetFormat.js';
import {
  PageHeader, KpiStrip, Toolbar, FilterChips, DataPanel, ClientCell, VehicleCell,
} from '../components/listUi.js';

const Kyc = () => window.SuroKyc;

const TASK_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'nouveau', label: 'Nouveaux', attn: true },
  { id: 'en_cours', label: 'En cours' },
  { id: 'valide', label: 'Validés' },
  { id: 'done', label: 'Terminés' },
];

function docLabel(doc) {
  const kyc = Kyc();
  if (kyc && doc.document_type) return kyc.kycDocShortLabel(doc.document_type, doc.document_side);
  return doc.name || 'Document';
}

function DocumentsSection({ applicationId, customerEmail }) {
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

  if (docs.loading) return html`<div class="cabinet-detail-section"><${Spinner}/></div>`;
  const rows = docs.data || [];
  const kyc = Kyc();
  const summary = kyc ? kyc.summarizeKycForPolicy(applicationId, rows, customerEmail) : null;

  return html`
    <div class="cabinet-detail-section">
      <h3>Documents souscripteur</h3>
      ${summary ? html`<p class="cabinet-page-sub" style="margin:0 0 12px">
        ${summary.received}/${summary.totalSlots} pièces KYC · ${summary.piecesComplete}/${summary.totalPieces} validées
      </p>` : null}
      ${rows.length === 0
        ? html`<p class="cabinet-page-sub">Aucun document disponible.</p>`
        : html`<div class="cabinet-doc-list">
          ${rows.map((doc) => html`<div class="cabinet-doc-item" key=${doc.id}>
            <div style="flex:1;min-width:0">
              <strong>${docLabel(doc)}</strong>
              <small>${doc.name} · ${fmtDate(doc.created_at)}</small>
            </div>
            <button class="btn-o sm" disabled=${busyId === doc.id} onClick=${() => download(doc)}>⤓ Télécharger</button>
          </div>`)}
        </div>`}
    </div>
  `;
}

function TaskDetail({ task, onClose, onChanged }) {
  const [policyNum, setPolicyNum] = useState('');
  const veh = vehicleCell(task);
  const client = customerCell(task);
  const st = TASK_STATUS[task.status] || { label: task.status, tone: 'gray' };

  const act = async (action, payload) => {
    try {
      await api.taskAction(task.task_id, action, payload);
      toast('Action enregistrée', 'ok');
      onChanged();
      onClose();
    } catch (e) { toast(e.message || 'Erreur', 'err'); }
  };

  return html`
    <${SlideOver} open=${true} title=${client.title}
      subtitle=${`${veh.label}${veh.plate ? ` · ${veh.plate}` : ''}`}
      onClose=${onClose}>
      <div style="margin-bottom:12px"><${Badge} tone=${st.tone}>${st.label}<//></div>
      <div class="field-row"><div class="k">Email</div><div class="v">${task.customer_email || '—'}</div></div>
      <div class="field-row"><div class="k">Produit</div><div class="v">${task.coverage_type || '—'}</div></div>
      <div class="field-row"><div class="k">Prime</div><div class="v">${task.annual_premium ? fmtMoney(task.annual_premium) : '—'}</div></div>
      <div class="field-row"><div class="k">Reçu le</div><div class="v">${fmtDate(task.created_at)}</div></div>
      <${DocumentsSection} applicationId=${task.application_id} customerEmail=${task.customer_email} />
      <div class="cabinet-detail-section">
        <h3>Actions dossier</h3>
        <div class="cabinet-actions">
          <button class="btn-o primary" onClick=${() => act('prendre_en_charge')}>Prendre en charge</button>
          <button class="btn-o" onClick=${() => act('valider')}>Valider</button>
          <button class="btn-o" onClick=${() => act('demander_pieces', { message: 'SURO a besoin de documents complémentaires.' })}>Demander pièces</button>
          <button class="btn-o" onClick=${() => act('refuser')}>Refuser</button>
          <button class="btn-o" onClick=${() => act('anomalie', { note: 'Anomalie signalée' })}>Anomalie</button>
        </div>
      </div>
      <div class="cabinet-detail-section">
        <h3>Émettre la police</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="ops-input" style="flex:1;min-width:160px" placeholder="N° police" value=${policyNum}
            onInput=${(e) => setPolicyNum(e.target.value)} />
          <button class="btn-o primary" onClick=${() => act('emettre_police', { policy_number: policyNum })}>Émettre</button>
        </div>
      </div>
    <//>
  `;
}

function taskMatchesFilter(task, filterId) {
  if (filterId === 'all') return true;
  if (filterId === 'done') return ['police_emise', 'refuse', 'cloture'].includes(task.status);
  return task.status === filterId;
}

export function Subscriptions() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const tasks = useAsync(() => api.listTasks(null, 100, 0), []);

  const rows = useMemo(() => {
    const all = tasks.data || [];
    return all.filter((t) => taskMatchesFilter(t, filter) && matchesSearch(t, search, [
      'customer_name', 'customer_email', 'immatriculation', 'marque', 'modele', 'status',
    ]));
  }, [tasks.data, filter, search]);

  if (tasks.loading) return html`<${Spinner}/>`;
  if (tasks.error) {
    return html`<${PageHeader} title="Souscriptions" subtitle="Dossiers clients assignés à votre cabinet" />
      <${Empty}>Impossible de charger les dossiers.<//>`;
  }

  const all = tasks.data || [];
  const open = all.filter((t) => !['police_emise', 'refuse', 'cloture'].includes(t.status));
  const kpis = [
    { label: 'Dossiers ouverts', value: open.length },
    { label: 'Nouveaux', value: all.filter((t) => t.status === 'nouveau').length },
    { label: 'En cours', value: all.filter((t) => t.status === 'en_cours').length },
    { label: 'Validés', value: all.filter((t) => t.status === 'valide').length },
  ];

  const filterOptions = TASK_FILTERS.map((f) => ({
    ...f,
    count: f.id === 'all' ? all.length : all.filter((t) => taskMatchesFilter(t, f.id)).length,
  }));

  return html`
    <${PageHeader}
      title="Souscriptions"
      subtitle="Consultez les dossiers, téléchargez les pièces KYC et émettez les polices."
    />
    <${KpiStrip} items=${kpis} />
    <${Toolbar} search=${search} onSearch=${setSearch} placeholder="Rechercher client, immatriculation…" />
    <${FilterChips} options=${filterOptions} value=${filter} onChange=${setFilter} />
    ${rows.length === 0
      ? html`<${DataPanel} empty=${html`<${Empty}>Aucun dossier pour ce filtre.<//>`} />`
      : html`<${DataPanel}>
        <table class="cabinet-table">
          <thead><tr>
            <th class="col-date">Date</th>
            <th>Client</th>
            <th>Véhicule</th>
            <th class="col-narrow">Statut</th>
            <th class="col-narrow">Priorité</th>
            <th class="col-actions"></th>
          </tr></thead>
          <tbody>
            ${rows.map((t) => {
              const client = customerCell(t);
              const veh = vehicleCell(t);
              const st = TASK_STATUS[t.status] || { label: t.status, tone: 'gray' };
              return html`<tr key=${t.task_id} onClick=${() => setSelected(t)}>
                <td class="col-date" data-label="Date">${fmtDate(t.created_at)}</td>
                <td data-label="Client"><${ClientCell} title=${client.title} meta=${client.meta} /></td>
                <td data-label="Véhicule"><${VehicleCell} label=${veh.label} plate=${veh.plate} /></td>
                <td class="col-narrow" data-label="Statut"><${Badge} tone=${st.tone}>${st.label}<//></td>
                <td class="col-narrow" data-label="Priorité"><span class="cabinet-priority ${t.priority}">${t.priority}</span></td>
                <td class="col-actions" data-label="">
                  <button class="btn-o sm primary" onClick=${(e) => { e.stopPropagation(); setSelected(t); }}>Ouvrir</button>
                </td>
              </tr>`;
            })}
          </tbody>
        </table>
      <//>`}
    ${selected ? html`<${TaskDetail} task=${selected} onClose=${() => setSelected(null)} onChanged=${tasks.reload} />` : null}
  `;
}
