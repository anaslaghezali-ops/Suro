import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../../../ops/src/lib/useAsync.js';
import { toast, SlideOver } from '../components/ui.js';
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
  const [createBusy, setCreateBusy] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);

  const session = api.session();
  const currentEmail = (session?.email || '').toLowerCase();

  const reload = () => members.reload();

  const canManageMember = (m) => {
    if (!m) return false;
    if ((m.email || '').toLowerCase() === currentEmail) return false;
    if (m.role === 'admin_cabinet') return false;
    return true;
  };

  const createMember = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { toast('Email requis', 'err'); return; }
    if (!password || password.length < 6) { toast('Mot de passe : 6 caractères minimum', 'err'); return; }
    setCreateBusy(true);
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
    finally { setCreateBusy(false); }
  };

  const openEdit = (m) => {
    setEditing(m);
    setEditEmail(m.email || '');
    setEditPassword('');
  };

  const saveEdit = async () => {
    if (!editing) return;
    const newEmail = editEmail.trim().toLowerCase();
    const newPassword = editPassword.trim();
    const emailChanged = newEmail && newEmail !== (editing.email || '').toLowerCase();
    if (!emailChanged && !newPassword) { toast('Rien à modifier', 'err'); return; }
    if (newPassword && newPassword.length < 6) { toast('Mot de passe : 6 caractères minimum', 'err'); return; }
    setSaveBusy(true);
    try {
      await api.updateCabinetUser({
        memberId: editing.member_id,
        newEmail: emailChanged ? newEmail : null,
        newPassword: newPassword || null,
      });
      toast('Membre mis à jour', 'ok');
      setEditing(null);
      reload();
    } catch (e) { toast(e.message || 'Erreur', 'err'); }
    finally { setSaveBusy(false); }
  };

  const toggleActive = async (m) => {
    const label = m.display_name || m.email;
    const action = m.is_active ? 'désactiver' : 'activer';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} « ${label} » ?`)) return;
    try {
      await api.setMemberActive(m.member_id, !m.is_active);
      toast(m.is_active ? 'Membre désactivé' : 'Membre activé', 'ok');
      reload();
    } catch (e) { toast(e.message || 'Erreur', 'err'); }
  };

  const removeMember = async (m) => {
    const label = m.display_name || m.email;
    if (!confirm(`Retirer définitivement « ${label} » du cabinet ?\n\nLe compte Auth reste en base mais n'aura plus accès au portail.`)) return;
    try {
      await api.removeMember(m.member_id);
      toast('Membre retiré du cabinet', 'ok');
      reload();
    } catch (e) { toast(e.message || 'Erreur', 'err'); }
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
          <button class="btn-o primary" disabled=${createBusy} onClick=${createMember}>
            ${createBusy ? 'Création…' : '+ Créer le membre'}
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
          canManage=${canManageMember}
          onEdit=${openEdit}
          onToggleActive=${toggleActive}
          onRemove=${removeMember}
          emptyMessage="Aucun membre — invitez votre première personne avec le formulaire ci-dessus."
        />
      </div>
    </div>

    ${editing ? html`<${SlideOver} open=${true}
      title=${'Modifier — ' + (editing.display_name || editing.email)}
      subtitle=${roleLabel(editing.role)}
      onClose=${() => setEditing(null)}>
      <div class="form-grid" style="grid-template-columns:1fr">
        <label>Email
          <input class="ops-input" type="email" value=${editEmail}
            onInput=${(e) => setEditEmail(e.target.value)} autocomplete="off" />
        </label>
        <label>Nouveau mot de passe
          <span class="muted" style="font-weight:400"> (laisser vide pour ne pas changer)</span>
          <input class="ops-input" type="password" placeholder="6 caractères min." value=${editPassword}
            onInput=${(e) => setEditPassword(e.target.value)} autocomplete="new-password" />
        </label>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-o primary" disabled=${saveBusy} onClick=${saveEdit}>
          ${saveBusy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button class="btn-o" onClick=${() => setEditing(null)}>Annuler</button>
      </div>
      <p class="muted" style="margin-top:14px;font-size:12px">
        Changement immédiat — le membre utilisera le nouvel email / mot de passe à sa prochaine connexion.
      </p>
    <//>` : null}
  `;
}
