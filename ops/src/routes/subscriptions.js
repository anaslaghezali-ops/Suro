import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useRouteParam, navigate } from '../router.js';
import { DataTable } from '../components/DataTable.js';
import { SavedViews } from '../components/SavedViews.js';
import { SlideOver, Badge, Spinner, Empty, toast } from '../components/ui.js';
import { can } from '../lib/permissions.js';
import { fmtDate, fmtMoney, coverageLabel, vehicleLabel, subStatus, docStatus } from '../lib/format.js';

const STATUSES = ['nouvelle', 'active', 'expired', 'cancelled'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// Définition des vues sauvegardées : chacune est une fonction de correspondance.
// pendingDocApps = Set des application_id ayant au moins un document 'pending'.
const VIEW_DEFS = [
  { id: '',          label: 'Toutes',            match: () => true },
  { id: 'docs',       label: 'Docs à vérifier',   attn: true, match: (a, ctx) => ctx.pendingDocApps.has(a.id) },
  { id: 'expiring',   label: 'Expire < 30j',      attn: true, match: (a) => {
      if (a.status !== 'active') return false;
      const d = daysUntil(a.expires_at);
      return d != null && d >= 0 && d <= 30;
    } },
  { id: 'nouvelle',   label: 'Nouvelles',         match: (a) => a.status === 'nouvelle' },
  { id: 'active',     label: 'Actives',           match: (a) => a.status === 'active' },
  { id: 'expired',    label: 'Expirées',          match: (a) => a.status === 'expired' },
  { id: 'cancelled',  label: 'Annulées',          match: (a) => a.status === 'cancelled' },
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
  const editable = can(caps, 'contract.edit');
  const docs = useAsync(() => api.documents(app.id).catch(() => []), [app.id]);

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
          <span class="muted" style="font-size:12.5px">${app.policy_number || 'Sans n° de police'}</span>
        </div>

        <div class="form-grid">
          ${EDITABLE.map(([k, label, type]) => html`
            <label>${label}
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
            <button class="btn-o primary" disabled=${saving} onClick=${save}>${saving ? 'Enregistrement…' : '💾 Enregistrer'}</button>
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
        ${docs.loading ? html`<${Spinner}/>` :
          (!docs.data || docs.data.length === 0) ? html`<${Empty}>Aucun document pour ce dossier.<//>` : html`
          <div style="display:flex;flex-direction:column">
            ${docs.data.map((d) => {
              const ds = docStatus(d.status);
              return html`
                <div class="field-row" style="grid-template-columns:1fr auto">
                  <div><div class="v">📄 ${d.name}</div><div class="k">${fmtDate(d.created_at)}</div></div>
                  <${Badge} tone=${ds.tone}>${ds.label}<//>
                </div>`;
            })}
          </div>
          <p class="muted" style="margin-top:14px;font-size:12.5px">La validation/refus des documents arrive dans le module Documents (Phase 3).</p>
        `}
      ` : null}
    <//>
  `;
}

export function Subscriptions({ caps }) {
  const { data, loading, error, reload } = useAsync(async () => {
    const [apps, docs] = await Promise.all([
      api.applications().catch(() => []),
      api.allDocuments().catch(() => []),
    ]);
    return { apps: apps || [], docs: docs || [] };
  }, []);
  const [activeView, setActiveView] = useState('');
  const [selected, setSelected] = useState(null);
  const param = useRouteParam();

  const apps = data ? data.apps : null;

  // Deep-link : #/subscriptions/<id> ouvre directement le dossier
  useEffect(() => {
    if (param && apps) {
      const found = apps.find((a) => a.id === param || a.id.startsWith(param));
      if (found) setSelected(found);
    }
  }, [param, apps]);

  const closeDetail = () => { setSelected(null); if (param) navigate('subscriptions'); };

  // Contexte partagé par les vues (docs en attente par dossier)
  const ctx = useMemo(() => {
    const pendingDocApps = new Set(
      (data ? data.docs : []).filter((d) => (d.status || 'pending') === 'pending').map((d) => d.application_id)
    );
    return { pendingDocApps };
  }, [data]);

  const views = useMemo(() => VIEW_DEFS.map((v) => ({
    id: v.id, label: v.label, attn: v.attn,
    count: (apps || []).filter((a) => v.match(a, ctx)).length,
  })), [apps, ctx]);

  if (loading) return html`<div style="padding:40px"><${Spinner}/></div>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;

  const activeDef = VIEW_DEFS.find((v) => v.id === activeView) || VIEW_DEFS[0];
  const rows = (apps || []).filter((a) => activeDef.match(a, ctx));

  const columns = [
    { key: 'policy_number', label: 'N° / Réf.', render: (a) => a.policy_number || html`<span class="muted">${a.id.slice(0, 8)}…</span>` },
    { key: 'customer_email', label: 'Client', sortable: true },
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
        key=${activeView}
        columns=${columns}
        rows=${rows}
        searchKeys=${['customer_email', 'immatriculation', 'marque', 'modele', 'customer_phone', 'policy_number']}
        onRowClick=${(a) => setSelected(a)}
      />
    </div>

    ${selected ? html`<${Detail} app=${selected} caps=${caps}
      onClose=${closeDetail}
      onSaved=${() => { closeDetail(); reload(); }} />` : null}
  `;
}
