import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Spinner, Empty, toast } from '../components/ui.js';
import { can, OPERATING_MODES } from '../lib/permissions.js';
import { readOperatingMode, operatingModeMeta, applyOperatingMode } from '../lib/operatingMode.js';

// Contacts support éditables (clés dans suro_settings)
const CONTACT_FIELDS = [
  { key: 'support_phone', label: 'Téléphone support', hint: 'Format international, ex : +212600000000' },
  { key: 'support_whatsapp', label: 'WhatsApp support', hint: 'Sans le +, ex : 212600000000' },
];

function ContactSettings({ editable }) {
  const { data, loading, error, reload } = useAsync(() => api.getSettings().catch(() => []), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return html`<div style="padding:20px"><${Spinner}/></div>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;

  const values = form || (() => {
    const by = {}; (data || []).forEach((s) => { by[s.key] = s.value; });
    return by;
  })();
  const set = (k, v) => setForm({ ...values, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      for (const f of CONTACT_FIELDS) {
        await api.updateSetting(f.key, values[f.key] != null ? values[f.key] : '');
      }
      await api.logAction('update', 'settings', null, { keys: CONTACT_FIELDS.map((f) => f.key) }).catch(() => {});
      toast('Contacts enregistrés', 'ok');
      setForm(null); reload();
    } catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
    finally { setBusy(false); }
  };

  return html`
    <div class="card-body">
      <div class="form-grid">
        ${CONTACT_FIELDS.map((f) => html`
          <label>${f.label}
            <input class="ops-input" disabled=${!editable}
              value=${values[f.key] || ''} onInput=${(e) => set(f.key, e.target.value)} />
            <span class="muted" style="font-weight:400;font-size:11px">${f.hint}</span>
          </label>`)}
      </div>
      ${editable ? html`
        <div style="margin-top:14px">
          <button class="btn-o primary" disabled=${busy} onClick=${save}>${busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>` : html`<p class="muted" style="margin-top:12px">Lecture seule.</p>`}
    </div>
  `;
}

function OperatingModeSettings({ editable }) {
  const { data, loading, error, reload } = useAsync(() => api.getSettings().catch(() => []), []);
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return html`<div style="padding:20px"><${Spinner}/></div>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;

  const current = mode || readOperatingMode(data);
  const meta = operatingModeMeta(current);

  const save = async () => {
    setBusy(true);
    try {
      const outcome = await applyOperatingMode(current);
      if (!outcome.ok) return;
      await api.logAction('update', 'settings', null, { operating_mode: current }).catch(() => {});
      toast('Mode d’exploitation enregistré', 'ok');
      setMode(null); reload();
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('suro_switch_operating_mode') || msg.includes('Could not find the function')) {
        toast('Migrations cabinet requises — exécutez ./staging/scripts/apply-migrations.sh sur la base', 'err');
      } else {
        toast('Échec : ' + msg, 'err');
      }
    }
    finally { setBusy(false); }
  };

  return html`
    <div class="card-body">
      <p class="muted" style="margin:0 0 14px;font-size:12.5px">
        Une seule plateforme — bascule entre distribution via cabinets partenaires et traitement courtier interne.
      </p>
      <label>Mode actif
        <select class="ops-input" disabled=${!editable} value=${current}
          onChange=${(e) => setMode(e.target.value)}>
          ${Object.entries(OPERATING_MODES).map(([id, m]) => html`
            <option value=${id}>${m.label}</option>`)}
        </select>
        <span class="muted" style="font-weight:400;font-size:11px">${meta.hint}</span>
      </label>
      ${editable ? html`
        <div style="margin-top:14px">
          <button class="btn-o primary" disabled=${busy} onClick=${save}>${busy ? 'Enregistrement…' : 'Enregistrer le mode'}</button>
        </div>` : html`<p class="muted" style="margin-top:12px">Lecture seule.</p>`}
    </div>
  `;
}

export function Settings({ caps, role }) {
  const editable = ['super_admin', 'admin'].includes(role) || can(caps, 'settings.edit');
  return html`
    <div class="page-head">
      <h1>Paramètres</h1>
      <p>Configuration de la plateforme.</p>
    </div>

    <div class="card">
      <div class="card-head"><h3>Informations plateforme</h3></div>
      <div class="card-body">
        <div class="field-row"><div class="k">Nom</div><div class="v">SURO</div></div>
        <div class="field-row"><div class="k">Environnement</div><div class="v">Production (Supabase + hébergement statique)</div></div>
        <div class="field-row" style="border:none"><div class="k">Portails</div><div class="v">Client (/app) · Operations (/ops)</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Mode d’exploitation</h3></div>
      <${OperatingModeSettings} editable=${editable} />
    </div>

    <div class="card">
      <div class="card-head"><h3>Contacts support / urgence</h3></div>
      <${ContactSettings} editable=${editable} />
    </div>

    <div class="card">
      <div class="card-head"><h3>✉️ Modèles de communication</h3></div>
      <div class="card-body">
        <p class="muted">Emails et notifications transactionnels — module à venir. Les notifications in-app (statuts, documents, échéances) sont déjà actives automatiquement.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Tarification</h3></div>
      <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div class="muted" style="font-size:12.5px">Conservée dans l'admin existant, inchangée (hors périmètre de refonte).</div>
        <a class="btn-o" href="../backoffice/#settings" target="_blank" rel="noopener">Ouvrir la config tarifaire ↗</a>
      </div>
    </div>
  `;
}
