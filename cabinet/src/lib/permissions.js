export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦', roles: ['admin_cabinet', 'responsable', 'gestionnaire'] },
  { id: 'subscriptions', label: 'Souscriptions', icon: '▤', roles: ['admin_cabinet', 'responsable', 'gestionnaire'] },
  { id: 'claims', label: 'Sinistres', icon: '⚠', roles: ['admin_cabinet', 'responsable', 'gestionnaire'] },
  { id: 'notifications', label: 'Notifications', icon: '🔔', roles: ['admin_cabinet', 'responsable', 'gestionnaire'] },
  { id: 'team', label: 'Équipe', icon: '👥', roles: ['admin_cabinet', 'responsable'] },
];

export function navFor(role) {
  return NAV.filter((n) => n.roles.includes(role));
}

export function roleLabel(role) {
  return {
    admin_cabinet: 'Admin cabinet',
    responsable: 'Responsable',
    gestionnaire: 'Gestionnaire',
  }[role] || role;
}

export const TASK_STATUS = {
  nouveau: { label: 'Nouveau', tone: 'blue' },
  en_cours: { label: 'En cours', tone: 'amber' },
  pieces_manquantes: { label: 'Pièces manquantes', tone: 'amber' },
  valide: { label: 'Validé', tone: 'green' },
  refuse: { label: 'Refusé', tone: 'red' },
  police_emise: { label: 'Police émise', tone: 'green' },
  anomalie: { label: 'Anomalie', tone: 'red' },
};

export const CLAIM_STATUS = {
  dossier_recu: 'Dossier reçu',
  pieces_manquantes: 'Pièces manquantes',
  transmis_compagnie: 'Transmis compagnie',
  expertise_programmee: 'Expertise programmée',
  attente_compagnie: 'En attente compagnie',
  indemnisation_en_cours: 'Indemnisation en cours',
  cloture: 'Clôturé',
};
