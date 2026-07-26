import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../../../ops/src/lib/useAsync.js';
import { toast } from '../components/ui.js';
import { CabinetMemberList } from '../../../ops/src/components/CabinetMemberList.js';
import { roleLabel } from '../lib/permissions.js';

const TEAM_ROLES = [
  { id: 'gestionnaire', label: 'Gestionnaire' },
  { id: 'responsable', label: 'Responsable' },
];

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

  return html`
    <div class="page-head">
      <h1>Équipe</h1>
      <p>Gérez les accès de votre cabinet — gestionnaires et responsables.</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div class="card-head"><h3>Nouveau membre</h3></div>
      <div class="card-body">
        <p class="muted" style="margin:0 0 14px;font-size:12.5px">
          Définissez email et mot de passe. Connexion sur
          <a href="../cabinet-login.html" target="_blank" rel="noopener">cabinet-login.html</a>.
        </p>
        <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
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

    <div class="card">
      <div class="card-head"><h3>Membres du cabinet</h3></div>
      <div class="card-body">
        <${CabinetMemberList}
          members=${members.data || []}
          loading=${members.loading}
          error=${members.error}
          roleLabel=${roleLabel}
          emptyMessage="Aucun membre — invitez votre première personne avec le formulaire ci-dessus."
        />
      </div>
    </div>
  `;
}
