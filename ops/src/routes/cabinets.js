import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Spinner, Badge, Empty, toast } from '../components/ui.js';
import { fmtDate } from '../lib/format.js';
import { OPERATING_MODES } from '../lib/permissions.js';
import { readOperatingMode, operatingModeMeta, applyOperatingMode } from '../lib/operatingMode.js';

const CABINET_ROLES = [
  { id: 'gestionnaire', label: 'Gestionnaire' },
  { id: 'responsable', label: 'Responsable' },
  { id: 'admin_cabinet', label: 'Admin cabinet' },
];

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function cabinetApi() {
  if (!window.SURO_CABINET) throw new Error('Module cabinet non chargé — rechargez la page (Ctrl+Shift+R)');
  return window.SURO_CABINET;
}

function OperatingModePanel() {
  const settings = useAsync(() => api.getSettings().catch(() => []), []);
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);

  const current = mode || readOperatingMode(settings.data);
  const meta = operatingModeMeta(current);

  const save = async () => {
    setBusy(true);
    try {
      const outcome = await applyOperatingMode(current);
      if (!outcome.ok) return;
      toast('Mode enregistré : ' + meta.label, 'ok');
      settings.reload();
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
    <div class="card" style="margin-bottom:20px">
      <div class="card-head"><h3>Mode d'exploitation</h3></div>
      <div class="card-body">
        ${settings.loading ? html`<${Spinner}/>` : html`
          <p class="muted" style="margin:0 0 14px;font-size:12.5px">${meta.hint}</p>
          <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
            <label style="flex:1;min-width:220px">Mode actif
              <select class="ops-input" value=${current} onChange=${(e) => setMode(e.target.value)}>
                ${Object.entries(OPERATING_MODES).map(([id, m]) => html`
                  <option value=${id}>${m.label}</option>`)}
              </select>
            </label>
            <button class="btn-o primary" disabled=${busy} onClick=${save}>
              ${busy ? 'Enregistrement…' : 'Appliquer le mode'}
            </button>
          </div>
          <p class="muted" style="margin:12px 0 0;font-size:11px">
            Mode <strong>courtier</strong> : traitement interne Ops, menu Cabinets masqué.
            Mode <strong>intermédiaire</strong> : assignation aux cabinets partenaires.
          </p>`}
      </div>
    </div>
  `;
}

export function Cabinets({ role }) {
  const canManage = ['super_admin', 'admin'].includes(role);
  const overview = useAsync(() => {
    try { return cabinetApi().opsOverview(); }
    catch (e) { return Promise.reject(e); }
  }, []);
  const anomalies = useAsync(() => {
    try { return cabinetApi().opsAnomalies(30); }
    catch (e) { return Promise.reject(e); }
  }, []);

  const [showCreate, setShowCreate] = useState(true);
  const [cabName, setCabName] = useState('');
  const [cabSlug, setCabSlug] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('gestionnaire');
  const [memberCabinet, setMemberCabinet] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);

  const reload = () => { overview.reload(); anomalies.reload(); };
  const cabinets = overview.data || [];

  const createCabinet = async () => {
    const name = cabName.trim();
    const slug = (cabSlug.trim() || slugify(name));
    if (!name) { toast('Nom du cabinet requis', 'err'); return; }
    if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      toast('Slug invalide (a-z, 0-9, tirets)', 'err'); return;
    }
    setCreateBusy(true);
    try {
      await cabinetApi().staffUpsertCabinet(name, slug);
      toast('Cabinet créé', 'ok');
      setCabName(''); setCabSlug('');
      reload();
    } catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
    finally { setCreateBusy(false); }
  };

  const toggleActive = async (cabinetId, current) => {
    try {
      await cabinetApi().staffSetCabinetActive(cabinetId, !current);
      toast(current ? 'Cabinet désactivé' : 'Cabinet activé', 'ok');
      reload();
    } catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
  };

  const addMember = async () => {
    const email = memberEmail.trim();
    if (!email) { toast('Email requis', 'err'); return; }
    if (!memberCabinet) { toast('Sélectionnez un cabinet', 'err'); return; }
    setMemberBusy(true);
    try {
      await cabinetApi().addUser(email, memberRole, memberName.trim() || null, memberCabinet);
      toast('Membre ajouté au cabinet', 'ok');
      setMemberEmail(''); setMemberName('');
      reload();
    } catch (e) {
      const msg = (e.message || '');
      if (msg.includes('introuvable')) {
        toast("Compte Auth introuvable — créez d'abord l'utilisateur dans Supabase Auth", 'err');
      } else {
        toast('Échec : ' + msg, 'err');
      }
    }
    finally { setMemberBusy(false); }
  };

  return html`
    <div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
      <div>
        <h1>Cabinets partenaires</h1>
        <p>Configuration et supervision des cabinets — dossiers, anomalies et sinistres.</p>
      </div>
    </div>

    ${!window.SURO_CABINET ? html`
      <div class="card" style="margin-bottom:20px;border-color:#fecaca">
        <div class="card-body">
          <strong>Module cabinet non chargé</strong>
          <p class="muted" style="margin:8px 0 0">Rechargez la page avec Ctrl+Shift+R. Si le problème persiste, déployez la dernière version du front Ops.</p>
        </div>
      </div>` : null}

    ${canManage ? html`<${OperatingModePanel}/>` : null}

    ${canManage ? html`
      <div class="card" style="margin-bottom:20px">
        <div class="card-head" style="display:flex;justify-content:space-between;align-items:center">
          <h3>Créer un cabinet</h3>
          <button class="btn-o sm" onClick=${() => setShowCreate((v) => !v)}>
            ${showCreate ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        ${showCreate ? html`
        <div class="card-body">
          <div class="form-grid">
            <label>Nom du cabinet
              <input class="ops-input" value=${cabName}
                onInput=${(e) => { setCabName(e.target.value); if (!cabSlug) setCabSlug(slugify(e.target.value)); }}
                placeholder="Cabinet Exemple Assurances" />
            </label>
            <label>Slug (identifiant unique)
              <input class="ops-input" value=${cabSlug} onInput=${(e) => setCabSlug(e.target.value)}
                placeholder="exemple-assurances" />
            </label>
          </div>
          <div style="margin-top:14px">
            <button class="btn-o primary" disabled=${createBusy} onClick=${createCabinet}>
              ${createBusy ? 'Création…' : '+ Créer le cabinet'}
            </button>
          </div>
        </div>` : null}
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-head"><h3>Ajouter un membre à un cabinet</h3></div>
        <div class="card-body">
          <p class="muted" style="margin:0 0 14px;font-size:12.5px">
            L'utilisateur doit exister dans Supabase Auth (Authentication → Users).
          </p>
          <div class="form-grid">
            <label>Cabinet
              <select class="ops-input" value=${memberCabinet} onChange=${(e) => setMemberCabinet(e.target.value)}>
                <option value="">— Choisir —</option>
                ${cabinets.map((c) => html`
                  <option key=${c.cabinet_id} value=${c.cabinet_id}>${c.cabinet_name}</option>`)}
              </select>
            </label>
            <label>Email
              <input class="ops-input" type="email" value=${memberEmail}
                onInput=${(e) => setMemberEmail(e.target.value)} placeholder="gestionnaire@cabinet.ma" />
            </label>
            <label>Nom affiché
              <input class="ops-input" value=${memberName}
                onInput=${(e) => setMemberName(e.target.value)} placeholder="Prénom Nom" />
            </label>
            <label>Rôle
              <select class="ops-input" value=${memberRole} onChange=${(e) => setMemberRole(e.target.value)}>
                ${CABINET_ROLES.map((r) => html`<option value=${r.id}>${r.label}</option>`)}
              </select>
            </label>
          </div>
          <div style="margin-top:14px">
            <button class="btn-o primary" disabled=${memberBusy} onClick=${addMember}>
              ${memberBusy ? 'Ajout…' : 'Ajouter le membre'}
            </button>
          </div>
        </div>
      </div>` : null}

    ${overview.error ? html`
      <div class="card" style="margin-bottom:20px;border-color:#fecaca">
        <div class="card-body">
          <strong>Vue d'ensemble indisponible</strong>
          <p class="muted" style="margin:8px 0 0">${overview.error.message}</p>
          <p class="muted" style="margin:8px 0 0;font-size:12px">
            Vérifiez les RPC : <code>psql "$DATABASE_URL" -f staging/scripts/verify-cabinet-rpcs.sql</code>
            puis <code>./staging/scripts/apply-migrations.sh</code>
          </p>
        </div>
      </div>` : null}

    <h2 style="font-size:16px;margin-bottom:12px">Vue d'ensemble</h2>
    ${overview.loading ? html`<${Spinner}/>` :
      cabinets.length === 0 && !overview.error ? html`
      <${Empty}>Aucun cabinet en base. Utilisez le formulaire « Créer un cabinet » ci-dessus.<//>
    ` : html`
    <table class="ops-table" style="margin-bottom:28px">
      <thead><tr>
        <th>Cabinet</th><th>Actif</th><th>Dossiers ouverts</th><th>Anomalies</th><th>Sinistres</th><th>Âge moy. (h)</th>
        ${canManage ? html`<th></th>` : null}
      </tr></thead>
      <tbody>
        ${cabinets.map((c) => html`<tr key=${c.cabinet_id}>
          <td><strong>${c.cabinet_name}</strong></td>
          <td>${c.is_active ? html`<${Badge} tone="green">Oui<//>` : html`<${Badge} tone="gray">Non<//>`}</td>
          <td>${c.tasks_open}</td>
          <td>${c.tasks_anomaly > 0 ? html`<${Badge} tone="red">${c.tasks_anomaly}<//>` : '0'}</td>
          <td>${c.claims_open}</td>
          <td>${c.avg_task_age_hours ?? '—'}</td>
          ${canManage ? html`<td>
            <button class="btn-o sm" onClick=${() => toggleActive(c.cabinet_id, c.is_active)}>
              ${c.is_active ? 'Désactiver' : 'Activer'}
            </button>
          </td>` : null}
        </tr>`)}
      </tbody>
    </table>`}

    <h2 style="font-size:16px;margin-bottom:12px">Anomalies signalées</h2>
    ${anomalies.loading ? html`<${Spinner}/>` :
      (anomalies.data || []).length === 0 ? html`<p style="color:var(--color-neutral-500)">Aucune anomalie.</p>` : html`
      <table class="ops-table">
        <thead><tr><th>Date</th><th>Cabinet</th><th>Client</th><th>Statut</th><th>Note</th></tr></thead>
        <tbody>
          ${anomalies.data.map((a) => html`<tr key=${a.task_id}>
            <td>${fmtDate(a.created_at)}</td>
            <td>${a.cabinet_name}</td>
            <td>${a.customer_name}</td>
            <td>${a.status}</td>
            <td>${a.anomaly_note || '—'}</td>
          </tr>`)}
        </tbody>
      </table>`}
  `;
}
