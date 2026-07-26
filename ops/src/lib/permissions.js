/* RBAC front — piloté par les privilèges configurables (table suro_role_privileges,
   lus via l'RPC suro_my_privileges). La sécurité RÉELLE est appliquée par RLS/RPC. */

export const ALL = ['super_admin', 'admin', 'operations', 'support'];

// Menu latéral (ordre d'affichage), filtré par rôle.
export const NAV = [
  { id: 'dashboard',     label: 'Dashboard',     icon: '▦', roles: ALL },
  { id: 'subscriptions', label: 'Souscriptions', icon: '▤', roles: ALL },
  { id: 'clients',       label: 'Clients',       icon: '☺', roles: ALL },
  { id: 'contracts',     label: 'Contrats',      icon: '❏', roles: ALL },
  { id: 'documents',     label: 'Pièces KYC',    icon: '⎙', roles: ALL },
  { id: 'payments',      label: 'Paiements',     icon: '⛁', roles: ALL },
  { id: 'claims',        label: 'Sinistres',     icon: '⚠', roles: ALL },
  { id: 'cabinets',      label: 'Cabinets',      icon: '🏢', roles: ['super_admin', 'admin', 'operations'] },
  { id: 'analytics',     label: 'Funnel',        icon: '▽', roles: ['super_admin'] },
  { id: 'users',         label: 'Utilisateurs',  icon: '⚑', roles: ['super_admin'] },
  { id: 'privileges',    label: 'Privilèges',    icon: '⚿', roles: ['super_admin'] },
  { id: 'settings',      label: 'Paramètres',    icon: '⚙', roles: ['super_admin', 'admin'] },
  { id: 'audit',         label: "Journal d'activité", icon: '☷', roles: ['super_admin', 'admin', 'operations'] },
];

// Capacités configurables par le Super Admin (pour Admin / Opérations / Support).
export const CAPABILITIES = [
  { id: 'contract.edit',   label: 'Modifier les contrats',            hint: 'Véhicule, prime, couverture, statut…' },
  { id: 'client.edit',     label: 'Modifier les clients',             hint: 'Nom, téléphone du compte client' },
  { id: 'document.review', label: 'Valider / refuser les documents',  hint: 'Traiter les pièces reçues' },
  { id: 'document.upload', label: 'Déposer des documents',            hint: 'Envoyer attestation, carte verte…' },
  { id: 'claim.handle',    label: 'Traiter les sinistres & messages', hint: 'Statuts, réponses au client' },
  { id: 'settings.edit',   label: 'Modifier les paramètres',          hint: 'Contacts support, plateforme' },
];

// Capacités réservées au Super Admin (non délégables) — informationnel.
export const SUPERADMIN_ONLY = [
  { id: 'client.delete', label: 'Supprimer un client' },
  { id: 'staff.manage',  label: 'Gérer les collaborateurs' },
  { id: 'privileges.manage', label: 'Gérer les privilèges' },
];

export const OPERATING_MODES = {
  intermediaire: {
    label: 'SURO-intermédiaire',
    hint: 'Dossiers assignés aux cabinets partenaires (round-robin).',
  },
  courtier: {
    label: 'SURO-courtier',
    hint: 'Traitement interne par l’équipe Ops — pas de cabinet externe.',
  },
};

export function navFor(role, operatingMode = 'intermediaire') {
  const items = NAV.filter((n) => n.roles.includes(role));
  if (operatingMode === 'courtier') {
    return items.filter((n) => n.id !== 'cabinets');
  }
  return items;
}

// caps = tableau de capacités de l'utilisateur (renvoyé par suro_my_privileges).
export function can(caps, capability) {
  return Array.isArray(caps) && caps.includes(capability);
}

export function roleLabel(role) {
  return {
    super_admin: 'Super Admin',
    admin: 'Admin',
    operations: 'Opérations',
    support: 'Support',
  }[role] || role;
}
