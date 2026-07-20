import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { CAPABILITIES } from '../lib/permissions.js';
import { Badge, Spinner, Empty, toast } from '../components/ui.js';

const ROLE_ORDER = ['admin', 'operations', 'support'];
const roleTone = (r) => ({ admin: 'green', operations: 'amber', support: 'gray' }[r] || 'gray');

export function Privileges({ caps }) {
  const { data: matrix, loading, error, reload } = useAsync(() => api.listRolePrivileges(), []);
  const [toggling, setToggling] = useState(null);

  if (loading) return html`<div style="padding:40px"><${Spinner}/></div>`;
  if (error) return html`
    <div class="page-head"><h1>Privilèges</h1></div>
    <${Empty}>Accès réservé au Super Admin (${error.message}).<//>`;

  const toggle = async (role, capId) => {
    const current = matrix && matrix.find((row) => row.role === role && row.capability === capId);
    const newAllowed = !current?.allowed;
    setToggling({ role, capId });
    try {
      await api.setPrivilege(role, capId, newAllowed);
      toast(newAllowed ? 'Capacité activée' : 'Capacité désactivée', 'ok');
      reload();
    } catch (e) {
      toast('Erreur : ' + (e.message || ''), 'err');
    } finally {
      setToggling(null);
    }
  };

  // Réorganiser la matrix en grille [role][capability]
  const grid = {};
  ROLE_ORDER.forEach((role) => {
    grid[role] = {};
    CAPABILITIES.forEach((cap) => {
      const row = matrix && matrix.find((m) => m.role === role && m.capability === cap.id);
      grid[role][cap.id] = row?.allowed || false;
    });
  });

  return html`
    <div class="page-head">
      <h1>Privilèges</h1>
      <p>Configurez les capacités délégables pour chaque rôle opérationnel. Ces permissions sont appliquées côté serveur (RLS).</p>
    </div>

    <div class="card">
      <div class="card-head"><h3>Matrice des capacités</h3></div>
      <div class="card-body" style="overflow-x:auto">
        <table class="priv-matrix">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 12px;border-bottom:1px solid var(--border)">Capacité</th>
              ${ROLE_ORDER.map((role) => html`
                <th style="text-align:center;padding:8px 12px;border-bottom:1px solid var(--border)">
                  <${Badge} tone=${roleTone(role)}>${role === 'admin' ? 'Admin' : role === 'operations' ? 'Opérations' : 'Support'}<//>
                </th>
              `)}
            </tr>
          </thead>
          <tbody>
            ${CAPABILITIES.map((cap) => html`
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:12px;text-align:left">
                  <div style="font-weight:500">${cap.label}</div>
                  <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:2px">${cap.hint}</div>
                </td>
                ${ROLE_ORDER.map((role) => html`
                  <td style="text-align:center;padding:12px">
                    <input type="checkbox"
                      checked=${grid[role][cap.id]}
                      disabled=${toggling?.role === role && toggling?.capId === cap.id}
                      onChange=${() => toggle(role, cap.id)}
                      style="cursor:pointer;width:18px;height:18px" />
                  </td>
                `)}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:24px">
      <div class="card-head"><h3>Capacités réservées au Super Admin</h3></div>
      <div class="card-body">
        <ul style="margin:0;padding-left:20px;line-height:1.6">
          <li><strong>Supprimer un client</strong> — Retrait d'un compte (danger = données perdues)</li>
          <li><strong>Gérer les collaborateurs</strong> — Ajouter/retirer/changer rôles</li>
          <li><strong>Gérer les privilèges</strong> — Configurer cette matrice</li>
        </ul>
      </div>
    </div>
  `;
}
