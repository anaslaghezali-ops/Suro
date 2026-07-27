import { html } from 'htm/preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
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

function claimFileKind(file) {
  const type = file.content_type || '';
  if (type.startsWith('image')) return 'image';
  if (type.startsWith('video')) return 'video';
  if (/\.(png|jpe?g|gif|webp)$/i.test(file.name || '')) return 'image';
  if (/\.(mp4|webm|mov)$/i.test(file.name || '')) return 'video';
  return 'file';
}

function ClaimFilePreview({ file }) {
  const [state, setState] = useState({ loading: true, url: null, type: '', error: null });
  const kind = claimFileKind(file);

  useEffect(() => {
    let revoked = false;
    let objUrl = null;
    setState({ loading: true, url: null, type: '', error: null });
    api.getClaimFileBlobUrl(file.storage_path)
      .then(({ url, type }) => {
        if (!revoked) {
          objUrl = url;
          setState({ loading: false, url, type, error: null });
        }
      })
      .catch((e) => {
        if (!revoked) setState({ loading: false, url: null, type: '', error: e.message || 'Erreur' });
      });
    return () => {
      revoked = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [file.id]);

  if (state.loading) return html`<div class="cabinet-claim-file-preview"><${Spinner}/></div>`;
  if (state.error) return html`<div class="cabinet-claim-file-preview cabinet-claim-file-fallback">Aperçu indisponible</div>`;

  const mime = state.type || file.content_type || '';
  if (kind === 'image' || mime.startsWith('image')) {
    return html`<div class="cabinet-claim-file-preview">
      <img src=${state.url} alt=${file.name} loading="lazy" />
    </div>`;
  }
  if (kind === 'video' || mime.startsWith('video')) {
    return html`<div class="cabinet-claim-file-preview">
      <video src=${state.url} controls preload="metadata"></video>
    </div>`;
  }
  return html`<div class="cabinet-claim-file-preview cabinet-claim-file-fallback">📎 Fichier</div>`;
}

function ClaimFilesSection({ claimId }) {
  const files = useAsync(() => api.listClaimFiles(claimId), [claimId]);
  const [busyId, setBusyId] = useState(null);

  const download = async (file) => {
    setBusyId(file.id);
    try {
      await api.downloadClaimFile(file.storage_path, file.name);
    } catch (e) {
      toast(e.message || 'Téléchargement impossible', 'err');
    } finally {
      setBusyId(null);
    }
  };

  if (files.loading) return html`<div class="cabinet-detail-section"><${Spinner}/></div>`;
  const rows = files.data || [];

  return html`
    <div class="cabinet-detail-section">
      <h3>Photos & pièces jointes</h3>
      ${rows.length === 0
        ? html`<p class="cabinet-page-sub">Aucune photo ou pièce jointe pour ce sinistre.</p>`
        : html`<div class="cabinet-claim-gallery">
          ${rows.map((file) => {
            const kind = claimFileKind(file);
            const label = kind === 'video' ? 'Vidéo' : kind === 'image' ? 'Photo' : 'Fichier';
            return html`<div class="cabinet-claim-file" key=${file.id}>
              <${ClaimFilePreview} file=${file} />
              <div class="cabinet-claim-file-meta">
                <strong>${label}</strong>
                <small>${file.name} · ${fmtDate(file.created_at)}</small>
                <button class="btn-o sm" disabled=${busyId === file.id} onClick=${() => download(file)}>⤓ Télécharger</button>
              </div>
            </div>`;
          })}
        </div>`}
    </div>
  `;
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
      <${ClaimFilesSection} claimId=${claim.claim_id} />
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
