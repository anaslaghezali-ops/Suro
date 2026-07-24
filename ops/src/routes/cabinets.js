import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { useAsync } from '../lib/useAsync.js';
import { Spinner, Badge, Empty, toast } from '../components/ui.js';
import { fmtDate } from '../lib/format.js';

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
  if (!window.SURO_CABINET) throw new Error('Module cabinet non chargé — recharger la page');
  return window.SURO_CABINET;
}

export function Cabinets({ role }) {
  const canManage = ['super_admin', 'admin'].includes(role);
  const overview = useAsync(() => cabinetApi().opsOverview(), []);
  const anomalies = useAsync(() => cabinetApi().opsAnomalies(30), []);

  const [showCreate, setShowCreate] = useState(false);
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
      setCabName(''); setCabSlug(''); setShowCreate(false);
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
        toast('Compte Auth introuvable — créez d’abord l’utilisateur dans Supabase Auth', 'err');
      } else {
        toast('Échec : ' + msg, 'err');
      }
    }
    finally { setMemberBusy(false); }
  };

  if (overview.loading) return html`<div style="padding:40px"><${Spinner}/></div>`;

  return html`
    <div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
      <div>
        <h1>Cabinets partenaires</h1>
        <p>Supervision des cabinets — dossiers ouverts, anomalies et sinistres.</p>
      </div>
      ${canManage ? html`
        <button class="btn-o primary" onClick=${() => setShowCreate((v) => !v)}>
          ${showCreate ? 'Annuler' : '+ Nouveau cabinet'}
        </button>` : null}
    </div>

    ${overview.error ? html`
      <div class="card" style="margin-bottom:20px;border-color:var(--color-error-200,#fecaca)">
        <div class="card-body">
          <strong>Impossible de charger les cabinets</strong>
          <p class="muted" style="margin:8px 0 0">${overview.error.message}</p>
          <p class="muted" style="margin:8px 0 0;font-size:12px">
            Vérifiez que les migrations cabinet sont appliquées sur cet environnement
            (<code>20260725_cabinet_module.sql</code> et suivantes).
          </p>
        </div>
      </div>` : null}

    ${canManage && showCreate ? html`
      <div class="card" style="margin-bottom:20px">
        <div class="card-head"><h3>Créer un cabinet</h3></div>
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
              <span class="muted" style="font-weight:400;font-size:11px">Minuscules, chiffres et tirets — utilisé en interne</span>
            </label>
          </div>
          <div style="margin-top:14px">
            <button class="btn-o primary" disabled=${createBusy} onClick=${createCabinet}>
              ${createBusy ? 'Création…' : 'Créer le cabinet'}
            </button>
          </div>
        </div>
      </div>` : null}

    ${canManage ? html`
      <div class="card" style="margin-bottom:20px">
        <div class="card-head"><h3>Ajouter un membre à un cabinet</h3></div>
        <div class="card-body">
          <p class="muted" style="margin:0 0 14px;font-size:12.5px">
            L’utilisateur doit déjà exister dans Supabase Auth (Authentication → Users).
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
            <button class="btn-o primary" disabled=${memberBusy || cabinets.length === 0} onClick=${addMember}>
              ${memberBusy ? 'Ajout…' : 'Ajouter le membre'}
            </button>
          </div>
        </div>
      </div>` : null}

    <h2 style="font-size:16px;margin-bottom:12px">Vue d'ensemble</h2>
    ${cabinets.length === 0 && !overview.error ? html`
      <${Empty}>Aucun cabinet. ${canManage ? 'Cliquez sur « + Nouveau cabinet » pour commencer.' : 'Contactez un admin SURO.'}<//>
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
