import { fmtDate, fmtMoney } from '../../../ops/src/lib/format.js';

export { fmtDate, fmtMoney };

const CLAIM_TYPES = {
  accident: 'Accident',
  damage: 'Dégâts',
  theft: 'Vol',
  fire: 'Incendie',
  glass: 'Bris de glace',
  other: 'Autre',
};

export function claimTypeLabel(type) {
  return CLAIM_TYPES[type] || type || 'Sinistre';
}

export function customerCell(row) {
  const name = (row.customer_name || '').trim();
  const email = (row.customer_email || '').trim();
  if (name) return { title: name, meta: email || '' };
  if (email) return { title: email, meta: '' };
  return { title: 'Client', meta: '' };
}

export function vehicleCell(row) {
  const label = [row.marque, row.modele].filter(Boolean).join(' ').trim();
  const plate = (row.immatriculation || '').trim();
  return {
    label: label || 'Véhicule',
    plate,
  };
}

export function matchesSearch(row, q, fields) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => String(row[f] || '').toLowerCase().includes(needle));
}
