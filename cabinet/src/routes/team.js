import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { toast } from '../components/ui.js';

export function Team() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('gestionnaire');

  const invite = async () => {
    try {
      await api.addUser(email, role, name);
      toast('Utilisateur ajouté au cabinet', 'ok');
      setEmail(''); setName('');
    } catch (e) { toast(e.message || 'Erreur', 'err'); }
  };

  return html`
    <h1 class="ops-h1">Équipe du cabinet</h1>
    <p style="color:var(--color-neutral-600);margin-bottom:16px">Ajoutez un gestionnaire existant (compte Auth créé au préalable).</p>
    <div style="max-width:420px;display:flex;flex-direction:column;gap:10px">
      <input class="ops-input" placeholder="Email" value=${email} onInput=${(e) => setEmail(e.target.value)} />
      <input class="ops-input" placeholder="Nom affiché" value=${name} onInput=${(e) => setName(e.target.value)} />
      <select class="ops-input" value=${role} onChange=${(e) => setRole(e.target.value)}>
        <option value="gestionnaire">Gestionnaire</option>
        <option value="responsable">Responsable</option>
        <option value="admin_cabinet">Admin cabinet</option>
      </select>
      <button class="btn-o primary" onClick=${invite}>Ajouter au cabinet</button>
    </div>
  `;
}
