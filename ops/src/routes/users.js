import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DataTable } from '../components/DataTable.js';
import { Badge, Spinner, Empty, SlideOver, toast } from '../components/ui.js';
import { roleLabel } from '../lib/permissions.js';
import { fmtDate } from '../lib/format.js';

const ROLES = ['super_admin', 'admin', 'operations', 'support'];
const roleTone = (r) => ({ super_admin: 'blue', admin: 'green', operations: 'amber', support: 'gray' }[r] || 'gray');

export function Users({ caps }) {
  const { data, loading, error, reload } = useAsync(() => api.listStaff().catch((e) => { throw e; }), []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operations');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  if (loading) return html`<div style="padding:40px"><${Spinner}/></div>`;
  if (error) return html`
    <div class="page-head"><h1>Utilisateurs</h1></div>
    <${Empty}>Accès réservé au Super Admin (${error.message}).<//>`;

  const add = async () => {
    if (!email.trim()) { toast('Renseignez un email', 'err'); return; }
    setBusy(true);
    try {
      const res = await api.createStaff({
        email: email.trim(),
        password: password.trim(),
        role,
        name: name.trim() || null,
      });
      toast(res && res.attached ? 'Compte existant rattaché' : 'Collaborateur créé', 'ok');
      setName(''); setEmail(''); setPassword('');
      reload();
    } catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
    finally { setBusy(false); }
  };

  const changeRole = async (staffEmail, newRole) => {
    try { await api.setStaff(staffEmail, newRole); toast('Rôle mis à jour', 'ok'); reload(); }
    catch (e) { toast('Échec : ' + (e.message || ''), 'err'); reload(); }
  };

  const remove = async (staffEmail) => {
    if (!confirm(`Retirer ${staffEmail} de l'équipe ?`)) return;
    try { await api.removeStaff(staffEmail); toast('Collaborateur retiré', 'ok'); reload(); }
    catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
  };

  const openEdit = (s) => { setEditing(s); setEditEmail(s.email || ''); setEditPassword(''); };

  const saveEdit = async () => {
    const newEmail = editEmail.trim().toLowerCase();
    const changedEmail = newEmail && newEmail !== (editing.email || '').toLowerCase();
    const newPassword = editPassword.trim();
    if (!changedEmail && !newPassword) { toast('Rien à modifier', 'err'); return; }
    if (newPassword && newPassword.length < 6) { toast('Mot de passe : 6 caractères minimum', 'err'); return; }
    setSavingEdit(true);
    try {
      await api.updateStaff({
        targetEmail: editing.email,
        newEmail: changedEmail ? newEmail : null,
        newPassword: newPassword || null,
      });
      toast('Collaborateur mis à jour', 'ok');
      setEditing(null);
      reload();
    } catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
    finally { setSavingEdit(false); }
  };

  const columns = [
    { key: 'name', label: 'Nom', sortable: true, render: (s) => s.name || html`<span class="muted">—</span>` },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Rôle', sortable: true, render: (s) => html`<${Badge} tone=${roleTone(s.role)}>${roleLabel(s.role)}<//>` },
    { key: 'added_at', label: 'Depuis', sortable: true, render: (s) => fmtDate(s.added_at) },
    {
      key: 'actions', label: '', render: (s) => html`
        <div style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
          <select class="ops-input" style="width:auto;padding:5px 8px" value=${s.role}
            onChange=${(e) => changeRole(s.email, e.target.value)}>
            ${ROLES.map((r) => html`<option value=${r}>${roleLabel(r)}</option>`)}
          </select>
          <button class="btn-o sm" onClick=${() => openEdit(s)}>Éditer</button>
          <button class="btn-o danger sm" onClick=${() => remove(s.email)}>Retirer</button>
        </div>`,
    },
  ];

  return html`
    <div class="page-head">
      <h1>Utilisateurs</h1>
      <p>Créez les collaborateurs (Admin, Opérations, Support) et gérez leurs rôles. Réservé au Super Admin.</p>
    </div>

    <div class="card">
      <div class="card-head"><h3>Créer un collaborateur</h3></div>
      <div class="card-body">
        <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr 1fr">
          <label>Nom (optionnel)
            <input class="ops-input" type="text" placeholder="Nom complet"
              value=${name} onInput=${(e) => setName(e.target.value)} />
          </label>
          <label>Email
            <input class="ops-input" type="email" placeholder="email@exemple.com"
              value=${email} onInput=${(e) => setEmail(e.target.value)} />
          </label>
          <label>Mot de passe
            <input class="ops-input" type="password" placeholder="6 caractères min."
              value=${password} onInput=${(e) => setPassword(e.target.value)} autocomplete="new-password" />
          </label>
          <label>Rôle
            <select class="ops-input" value=${role} onChange=${(e) => setRole(e.target.value)}>
              ${ROLES.map((r) => html`<option value=${r}>${roleLabel(r)}</option>`)}
            </select>
          </label>
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;align-items:center">
          <button class="btn-o primary" disabled=${busy} onClick=${add}>${busy ? 'Création…' : 'Créer le collaborateur'}</button>
          <span class="muted" style="font-size:12px">Le mot de passe est requis pour un nouveau compte. Si l'email existe déjà, le compte est simplement rattaché (mot de passe inchangé).</span>
        </div>
      </div>
    </div>

    <div class="card">
      <${DataTable} columns=${columns} rows=${data || []} searchKeys=${['name', 'email', 'role']} />
    </div>

    ${editing ? html`<${SlideOver} open=${true}
      title=${'Modifier — ' + (editing.name || editing.email)}
      subtitle=${roleLabel(editing.role)} onClose=${() => setEditing(null)}>
      <div class="form-grid" style="grid-template-columns:1fr">
        <label>Email
          <input class="ops-input" type="email" value=${editEmail}
            onInput=${(e) => setEditEmail(e.target.value)} autocomplete="off" />
        </label>
        <label>Nouveau mot de passe <span class="muted" style="font-weight:400">(laisser vide pour ne pas changer)</span>
          <input class="ops-input" type="password" placeholder="6 caractères min." value=${editPassword}
            onInput=${(e) => setEditPassword(e.target.value)} autocomplete="new-password" />
        </label>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px">
        <button class="btn-o primary" disabled=${savingEdit} onClick=${saveEdit}>${savingEdit ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button class="btn-o" onClick=${() => setEditing(null)}>Annuler</button>
      </div>
      <p class="muted" style="margin-top:14px;font-size:12px">Changement immédiat (pas d'email de confirmation). Le collaborateur utilisera le nouvel email / mot de passe à sa prochaine connexion.</p>
    <//>` : null}
  `;
}
