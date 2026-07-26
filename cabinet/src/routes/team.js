import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../../../ops/src/lib/useAsync.js';
import { Badge, Spinner, toast } from '../components/ui.js';
import { roleLabel } from '../lib/permissions.js';
import { fmtDate } from '../../../ops/src/lib/format.js';

const TEAM_ROLES = [
  { id: 'gestionnaire', label: 'Gestionnaire' },
  { id: 'responsable', label: 'Responsable' },
];

const roleTone = (r) => ({ admin_cabinet: 'blue', responsable: 'amber', gestionnaire: 'gray' }[r] || 'gray');

export function Team() {
  const members = useAsync(() => api.listMembers(), []);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('gestionnaire');
  const [busy, setBusy] = useState(false);

  const reload = () => members.reload();

  const createMember = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { toast('Email requis', 'err'); return; }
    if (!password || password.length < 6) { toast('Mot de passe : 6 caractères minimum', 'err'); return; }
    setBusy(true);
    try {
      const res = await api.createCabinetUser({
        email: trimmedEmail,
        password,
        role,
        name: name.trim() || null,
      });
      toast(res && res.attached ? 'Compte existant rattaché' : 'Membre créé', 'ok');
      setEmail(''); setName(''); setPassword('');
      reload();
    } catch (e) { toast(e.message || 'Erreur', 'err'); }
    finally { setBusy(false); }
  };

  const rows = members.data || [];

  return html`
    <h1 class="ops-h1">Équipe du cabinet</h1>
    <p style="color:var(--color-neutral-600);margin-bottom:20px">
      Créez des gestionnaires et responsables avec email et mot de passe.
      Ils se connectent sur <a href="../cabinet-login.html">cabinet-login.html</a>.
    </p>

    <div class="card" style="margin-bottom:24px">
      <div class="card-head"><h3>Créer un membre</h3></div>
      <div class="card-body">
        <div class="form-grid" style="grid-template-columns:1fr 1fr">
          <label>Email
            <input class="ops-input" type="email" placeholder="gestionnaire@cabinet.ma"
              value=${email} onInput=${(e) => setEmail(e.target.value)} />
          </label>
          <label>Mot de passe
            <input class="ops-input" type="password" placeholder="6 caractères min."
              value=${password} onInput=${(e) => setPassword(e.target.value)} autocomplete="new-password" />
          </label>
          <label>Nom affiché
            <input class="ops-input" placeholder="Prénom Nom"
              value=${name} onInput=${(e) => setName(e.target.value)} />
          </label>
          <label>Rôle
            <select class="ops-input" value=${role} onChange=${(e) => setRole(e.target.value)}>
              ${TEAM_ROLES.map((r) => html`<option value=${r.id}>${r.label}</option>`)}
            </select>
          </label>
        </div>
        <div style="margin-top:14px">
          <button class="btn-o primary" disabled=${busy} onClick=${createMember}>
            ${busy ? 'Création…' : '+ Créer le membre'}
          </button>
        </div>
      </div>
    </div>

    <h2 style="font-size:16px;margin-bottom:12px">Membres du cabinet</h2>
    ${members.loading ? html`<${Spinner}/>` :
      members.error ? html`<p style="color:#b91c1c">${members.error.message}</p>` :
      rows.length === 0 ? html`<p style="color:var(--color-neutral-500)">Aucun membre.</p>` : html`
      <table class="ops-table">
        <thead><tr>
          <th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Depuis</th>
        </tr></thead>
        <tbody>
          ${rows.map((m) => html`<tr key=${m.member_id}>
            <td>${m.display_name || html`<span class="muted">—</span>`}</td>
            <td>${m.email}</td>
            <td><${Badge} tone=${roleTone(m.role)}>${roleLabel(m.role)}<//></td>
            <td>${m.is_active ? html`<${Badge} tone="green">Actif<//>` : html`<${Badge} tone="gray">Inactif<//>`}</td>
            <td>${fmtDate(m.created_at)}</td>
          </tr>`)}
        </tbody>
      </table>`}
  `;
}
