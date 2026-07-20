/* RBAC front — reflète la matrice §5.3 de la proposition.
   Rappel : la sécurité RÉELLE est appliquée par RLS côté Supabase.
   Ce module ne fait que piloter l'affichage (menus, boutons). */

export const ALL = ['super_admin', 'admin', 'operations', 'support'];

// Menu latéral (ordre = ordre d'affichage), filtré par rôle.
export const NAV = [
  { id: 'dashboard',     label: 'Dashboard',     icon: '▦', roles: ALL },
  { id: 'subscriptions', label: 'Souscriptions', icon: '▤', roles: ALL },
  { id: 'clients',       label: 'Clients',       icon: '☺', roles: ALL },
  { id: 'contracts',     label: 'Contrats',      icon: '❏', roles: ALL },
  { id: 'documents',     label: 'Documents',     icon: '⎙', roles: ALL },
  { id: 'payments',      label: 'Paiements',     icon: '⛁', roles: ALL },
  { id: 'claims',        label: 'Sinistres',     icon: '⚠', roles: ALL },
  { id: 'users',         label: 'Utilisateurs',  icon: '⚑', roles: ['super_admin'] },
  { id: 'settings',      label: 'Paramètres',    icon: '⚙', roles: ['super_admin', 'admin'] },
  { id: 'audit',         label: "Journal d'activité", icon: '☷', roles: ['super_admin', 'admin', 'operations'] },
];

// Capacités d'action (pour afficher/masquer les boutons d'écriture).
const CAP = {
  'subscription.edit':   ['super_admin', 'admin', 'operations'],
  'document.review':     ['super_admin', 'admin', 'operations'],
  'payment.action':      ['super_admin', 'admin'],
  'claim.handle':        ['super_admin', 'admin', 'operations', 'support'],
  'staff.manage':        ['super_admin'],
  'settings.edit':       ['super_admin', 'admin'],
  'audit.view':          ['super_admin', 'admin', 'operations'],
};

export function navFor(role) {
  return NAV.filter((n) => n.roles.includes(role));
}

export function can(role, capability) {
  const allowed = CAP[capability];
  return !!allowed && allowed.includes(role);
}

export function roleLabel(role) {
  return {
    super_admin: 'Super Admin',
    admin: 'Admin',
    operations: 'Opérations',
    support: 'Support',
  }[role] || role;
}
