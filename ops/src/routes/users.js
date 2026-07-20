import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DataTable } from '../components/DataTable.js';
import { Badge, Spinner, Empty, toast } from '../components/ui.js';
import { roleLabel } from '../lib/permissions.js';
import { fmtDate } from '../lib/format.js';

const ROLES = ['super_admin', 'admin', 'operations', 'support'];
const roleTone = (r) => ({ super_admin: 'blue', admin: 'green', operations: 'amber', support: 'gray' }[r] || 'gray');

export function Users({ caps }) {
  const { data, loading, error, reload } = useAsync(() => api.listStaff().catch((e) => { throw e; }), []);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operations');
  const [busy, setBusy] = useState(false);

  if (loading) return html`<div style="padding:40px"><${Spinner}/></div>`;
  if (error) return html`
    <div class="page-head"><h1>Utilisateurs</h1></div>
    <${Empty}>Accès réservé au Super Admin (${error.message}).<//>`;

  const add = async () => {
    if (!email.trim()) { toast('Renseignez un email', 'err'); return; }
    setBusy(true);
    try {
      await api.setStaff(email.trim(), role);
      toast('Collaborateur enregistré', 'ok');
      setEmail('');
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
          <button class="btn-o danger sm" onClick=${() => remove(s.email)}>Retirer</button>
        </div>`,
    },
  ];

  return html`
    <div class="page-head">
      <h1>Utilisateurs</h1>
      <p>Gérez les collaborateurs et leurs rôles. La personne doit déjà avoir un compte sur le site.</p>
    </div>

    <div class="card">
      <div class="card-head"><h3>Ajouter / mettre à jour un collaborateur</h3></div>
      <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input class="ops-input" style="max-width:280px" type="email" placeholder="email@exemple.com"
          value=${email} onInput=${(e) => setEmail(e.target.value)} />
        <select class="ops-input" style="max-width:180px" value=${role} onChange=${(e) => setRole(e.target.value)}>
          ${ROLES.map((r) => html`<option value=${r}>${roleLabel(r)}</option>`)}
        </select>
        <button class="btn-o primary" disabled=${busy} onClick=${add}>Enregistrer</button>
      </div>
    </div>

    <div class="card">
      <${DataTable} columns=${columns} rows=${data || []} searchKeys=${['name', 'email', 'role']} />
    </div>
  `;
}
