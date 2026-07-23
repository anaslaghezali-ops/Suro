import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useRouteParam, navigate } from '../router.js';
import { DataTable } from '../components/DataTable.js';
import { SavedViews } from '../components/SavedViews.js';
import { SlideOver, Badge, Spinner, Empty, toast } from '../components/ui.js';
import { can } from '../lib/permissions.js';
import { fmtDate, fmtMoney, coverageLabel, vehicleLabel, vehicleTypeLabel, subStatus, docStatus } from '../lib/format.js';

const STATUSES = ['nouvelle', 'active', 'expired', 'cancelled'];

const dayISO = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
// Vue « docs » : filtre sur les application_id en attente (ctx.pendingDocApps).
// Ensemble vide → filtre impossible (id nul) pour ne rien renvoyer.
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// Chaque vue produit ses clauses PostgREST (filtre serveur), pas un match client.
// ctx.pendingDocApps = tableau des application_id ayant un document en attente.
const VIEW_DEFS = [
  { id: '',          label: 'Toutes',          clauses: () => [] },
  { id: 'docs',       label: 'Docs à vérifier', attn: true,
    clauses: (ctx) => [`id=in.(${ctx.pendingDocApps.length ? ctx.pendingDocApps.join(',') : NIL_UUID})`] },
  { id: 'expiring',   label: 'Expire < 30j',    attn: true,
    clauses: () => ['status=eq.active', `expires_at=gte.${dayISO(0)}`, `expires_at=lte.${dayISO(30)}`] },
  { id: 'nouvelle',   label: 'Nouvelles',       clauses: () => ['status=eq.nouvelle'] },
  { id: 'active',     label: 'Actives',         clauses: () => ['status=eq.active'] },
  { id: 'expired',    label: 'Expirées',        clauses: () => ['status=eq.expired'] },
  { id: 'cancelled',  label: 'Annulées',        clauses: () => ['status=eq.cancelled'] },
];
const EDITABLE = [
  ['immatriculation', 'Immatriculation', 'text'],
  ['customer_phone', 'Téléphone', 'tel'],
  ['marque', 'Marque', 'text'],
  ['modele', 'Modèle', 'text'],
  ['annee', 'Année', 'number'],
  ['puissance', 'Puissance (CV)', 'number'],
  ['address', 'Adresse', 'text'],
  ['annual_premium', 'Prime annuelle (DH)', 'number'],
];

/* Fiche dossier (slide-over) */
function Detail({ app, caps, onClose, onSaved }) {
  const [tab, setTab] = useState('infos');
  const [form, setForm] = useState({ ...app });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(app.status);
  const [uploading, setUploading] = useState(false);
  const editable = can(caps, 'contract.edit');
  const canUpload = can(caps, 'document.upload');
  const docs = useAsync(() => api.documents(app.id).catch(() => []), [app.id]);

  const handleUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(app, file);
      await api.logAction('upload', 'document', app.id, { name: file.name }).catch(() => {});
      toast('Document déposé', 'ok');
      docs.reload();
    } catch (err) {
      toast('Échec du dépôt : ' + (err.message || ''), 'err');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const fields = {};
      EDITABLE.forEach(([k, , type]) => {
        let v = form[k];
        if (type === 'number') v = v === '' || v == null ? null : Number(v);
        fields[k] = v;
      });
      await api.updateApplication(app.id, fields);
      await api.logAction('update', 'application', app.id, fields).catch(() => {});
      toast('Dossier mis à jour', 'ok');
      onSaved();
    } catch (e) {
      toast('Échec de la mise à jour : ' + (e.message || ''), 'err');
    } finally { setSaving(false); }
  };

  const changeStatus = async () => {
    try {
      await api.updateApplicationStatus(app.id, status);
      await api.logAction('update', 'application', app.id, { status }).catch(() => {});
      toast('Statut mis à jour', 'ok');
      onSaved();
    } catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
  };

  const st = subStatus(app.status);
  const tabs = [
    { id: 'infos', label: 'Informations' },
    { id: 'documents', label: 'Documents' },
  ];

  return html`
    <${SlideOver} open=${true} title=${vehicleLabel(app)}
      subtitle=${html`${app.customer_email} · créé le ${fmtDate(app.created_at)}`}
      tabs=${tabs} activeTab=${tab} onTab=${setTab} onClose=${onClose}>

      ${tab === 'infos' ? html`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <${Badge} tone=${st.tone}>${st.label}<//>
          <${Badge} tone=${app.vehicle_type === 'moto' ? 'amber' : 'blue'}>${vehicleTypeLabel(app.vehicle_type)}<//>
          <span class="muted" style="font-size:12.5px">${app.policy_number || 'Sans n° de police'}</span>
        </div>

        <div class="form-grid">
          ${EDITABLE.map(([k, label, type]) => html`
            <label>${k === 'puissance' && app.vehicle_type === 'moto' ? 'Cylindrée (cm³)' : label}
              <input class="ops-input" type=${type} disabled=${!editable}
                value=${form[k] == null ? '' : form[k]}
                onInput=${(e) => set(k, e.target.value)} />
            </label>`)}
          <label>Couverture
            <select class="ops-input" disabled=${!editable} value=${form.coverage_type || ''}
              onChange=${(e) => set('coverage_type', e.target.value)}>
              <option value="minimal">Minimale (RC)</option>
              <option value="complete">Complète</option>
            </select>
          </label>
        </div>

        ${editable ? html`
          <div style="margin-top:16px;display:flex;gap:10px">
            <button class="btn-o primary" disabled=${saving} onClick=${save}>${saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>

          <div style="margin-top:22px;padding-top:16px;border-top:1px solid var(--color-neutral-200)">
            <div class="k" style="font-size:12px;font-weight:600;color:var(--color-neutral-600);margin-bottom:8px">STATUT DU DOSSIER</div>
            <div style="display:flex;gap:10px">
              <select class="ops-input" style="max-width:200px" value=${status} onChange=${(e) => setStatus(e.target.value)}>
                ${STATUSES.map((s) => html`<option value=${s}>${subStatus(s).label}</option>`)}
              </select>
              <button class="btn-o" onClick=${changeStatus}>Appliquer</button>
            </div>
          </div>
        ` : html`<p class="muted" style="margin-top:16px">Lecture seule (votre rôle ne permet pas l'édition).</p>`}
      ` : null}

      ${tab === 'documents' ? html`
        ${canUpload ? html`
          <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--color-neutral-200)">
            <label class="btn-o primary sm" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
              ${uploading ? 'Envoi…' : 'Déposer un document'}
              <input type="file" style="display:none" disabled=${uploading} onChange=${handleUpload}
                accept="image/*,application/pdf" />
            </label>
          </div>
        ` : null}
        ${docs.loading ? html`<${Spinner}/>` :
          (!docs.data || docs.data.length === 0) ? html`<${Empty}>Aucun document pour ce dossier.<//>` : html`
          <div style="display:flex;flex-direction:column">
            ${docs.data.map((d) => {
              const ds = docStatus(d.status);
              return html`
                <div class="field-row" style="grid-template-columns:1fr auto">
                  <div><div class="v">${d.name}</div><div class="k">${fmtDate(d.created_at)}</div></div>
                  <${Badge} tone=${ds.tone}>${ds.label}<//>
                </div>`;
            })}
          </div>
          <p class="muted" style="margin-top:14px;font-size:12.5px">La validation des pièces KYC (recto/verso) se fait dans le module <a href="#/documents" style="color:var(--color-primary)">Pièces KYC</a>.</p>
        `}
      ` : null}
    <//>
  `;
}

export function Subscriptions({ caps }) {
  const [activeView, setActiveView] = useState('');
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const param = useRouteParam();

  // Pré-requête bornée : application_id ayant un document en attente (vue « docs »).
  const pending = useAsync(() => api.pendingDocAppIds().catch(() => []), [reloadKey]);
  const pendingIds = pending.data || [];
  const ctx = { pendingDocApps: pendingIds };

  // Compteurs par vue (bornés côté serveur). « docs » = taille de l'ensemble (pas de requête).
  const counts = useAsync(async () => {
    const entries = await Promise.all(VIEW_DEFS.map(async (v) => {
      if (v.id === 'docs') return [v.id || 'all', pendingIds.length];
      const c = await api.applicationsCount(v.clauses(ctx)).catch(() => null);
      return [v.id || 'all', c];
    }));
    return Object.fromEntries(entries);
  }, [reloadKey, pendingIds.length]);

  const views = VIEW_DEFS.map((v) => ({
    id: v.id, label: v.label, attn: v.attn,
    count: counts.data ? (counts.data[v.id || 'all'] ?? null) : null,
  }));

  const activeDef = VIEW_DEFS.find((v) => v.id === activeView) || VIEW_DEFS[0];

  // Liste paginée serveur : la vue active fournit ses clauses PostgREST.
  const fetchPage = ({ search, sortKey, sortDir, offset, limit }) =>
    api.applicationsPage({ clauses: activeDef.clauses(ctx), search, sortKey, sortDir, offset, limit });

  // Deep-link : #/subscriptions/<id> → on récupère le dossier par id.
  useEffect(() => {
    if (!param) return undefined;
    let alive = true;
    api.applicationById(param).then((row) => { if (alive && row) setSelected(row); }).catch(() => {});
    return () => { alive = false; };
  }, [param]);

  const closeDetail = () => { setSelected(null); if (param) navigate('subscriptions'); };

  const columns = [
    { key: 'policy_number', label: 'N° / Réf.', render: (a) => a.policy_number || html`<span class="muted">${a.id.slice(0, 8)}…</span>` },
    { key: 'customer_email', label: 'Client', sortable: true },
    { key: 'vehicle_type', label: 'Type', sortable: true, render: (a) => html`<${Badge} tone=${a.vehicle_type === 'moto' ? 'amber' : 'blue'}>${vehicleTypeLabel(a.vehicle_type)}<//>` },
    { key: 'vehicle', label: 'Véhicule', render: (a) => vehicleLabel(a) },
    { key: 'coverage_type', label: 'Couverture', render: (a) => coverageLabel(a.coverage_type) },
    { key: 'annual_premium', label: 'Prime', sortable: true, render: (a) => fmtMoney(a.annual_premium) },
    { key: 'status', label: 'Statut', sortable: true, render: (a) => { const s = subStatus(a.status); return html`<${Badge} tone=${s.tone}>${s.label}<//>`; } },
    { key: 'created_at', label: 'Créée', sortable: true, render: (a) => fmtDate(a.created_at) },
  ];

  return html`
    <div class="page-head">
      <h1>Souscriptions</h1>
      <p>Tous les dossiers de souscription. Cliquez une ligne pour ouvrir le dossier complet.</p>
    </div>

    <div class="card">
      <${SavedViews} views=${views} active=${activeView} onChange=${setActiveView} />
      <${DataTable}
        columns=${columns}
        server=${fetchPage}
        serverKey=${`${activeView}|${pendingIds.length}|${reloadKey}`}
        searchPlaceholder="Rechercher (client, immat, marque…)"
        onRowClick=${(a) => setSelected(a)}
      />
    </div>

    ${selected ? html`<${Detail} app=${selected} caps=${caps}
      onClose=${closeDetail}
      onSaved=${() => { closeDetail(); setReloadKey((k) => k + 1); }} />` : null}
  `;
}
