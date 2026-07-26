import { html } from 'htm/preact';
import { Badge, Spinner, Empty } from './ui.js';
import { fmtDate } from '../lib/format.js';

const ROLE_TONE = {
  admin_cabinet: 'blue',
  responsable: 'amber',
  gestionnaire: 'gray',
};

const AVATAR_BG = {
  admin_cabinet: '#dbeafe',
  responsable: '#fef3c7',
  gestionnaire: '#f3f4f6',
};

const AVATAR_FG = {
  admin_cabinet: '#1d4ed8',
  responsable: '#b45309',
  gestionnaire: '#4b5563',
};

function initials(displayName, email) {
  const name = (displayName || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase();
  }
  return (email?.[0] || '?').toUpperCase();
}

function MemberCard({
  member,
  roleLabel,
  showCabinet,
  canManage,
  onEdit,
  onToggleActive,
  onRemove,
}) {
  const role = member.role || 'gestionnaire';
  const tone = ROLE_TONE[role] || 'gray';
  const label = roleLabel ? roleLabel(role) : role;
  const title = member.display_name || member.email;
  const manageable = canManage ? canManage(member) : false;

  return html`
    <article class="cabinet-member-card ${member.is_active ? '' : 'is-inactive'}">
      <div class="cabinet-member-card-top">
        <div class="cabinet-member-avatar" style=${`background:${AVATAR_BG[role] || '#f3f4f6'};color:${AVATAR_FG[role] || '#4b5563'}`}
          aria-hidden="true">
          ${initials(member.display_name, member.email)}
        </div>
        <div class="cabinet-member-info">
          <div class="cabinet-member-name">${title}</div>
          <div class="cabinet-member-email">${member.email}</div>
          ${showCabinet && member.cabinet_name ? html`
            <div class="cabinet-member-cabinet">${member.cabinet_name}</div>` : null}
        </div>
        <div class="cabinet-member-status">
          ${member.is_active
            ? html`<span class="cabinet-member-dot" title="Actif"></span>`
            : html`<${Badge} tone="gray">Inactif<//>`}
        </div>
      </div>
      <div class="cabinet-member-card-foot">
        <${Badge} tone=${tone}>${label}<//>
        <span class="cabinet-member-since">Depuis ${fmtDate(member.created_at)}</span>
      </div>
      ${manageable ? html`
        <div class="cabinet-member-actions">
          <button type="button" class="btn-o sm" onClick=${() => onEdit(member)}>Éditer</button>
          <button type="button" class="btn-o sm" onClick=${() => onToggleActive(member)}>
            ${member.is_active ? 'Désactiver' : 'Activer'}
          </button>
          <button type="button" class="btn-o sm danger" onClick=${() => onRemove(member)}>Supprimer</button>
        </div>` : null}
    </article>
  `;
}

export function CabinetMemberList({
  members = [],
  loading = false,
  error = null,
  roleLabel,
  showCabinet = false,
  emptyMessage = 'Aucun membre pour le moment.',
  canManage = null,
  onEdit = null,
  onToggleActive = null,
  onRemove = null,
}) {
  if (loading) {
    return html`<div class="cabinet-member-loading"><${Spinner}/></div>`;
  }
  if (error) {
    return html`<div class="cabinet-member-error">${error.message || String(error)}</div>`;
  }
  if (!members.length) {
    return html`<${Empty}>${emptyMessage}<//>`;
  }

  const active = members.filter((m) => m.is_active).length;

  return html`
    <div class="cabinet-member-summary">
      <span><strong>${members.length}</strong> membre${members.length > 1 ? 's' : ''}</span>
      <span class="muted">· ${active} actif${active > 1 ? 's' : ''}</span>
    </div>
    <div class="cabinet-member-grid">
      ${members.map((m) => html`
        <${MemberCard}
          key=${m.member_id}
          member=${m}
          roleLabel=${roleLabel}
          showCabinet=${showCabinet}
          canManage=${canManage}
          onEdit=${onEdit}
          onToggleActive=${onToggleActive}
          onRemove=${onRemove}
        />`)}
    </div>
  `;
}
