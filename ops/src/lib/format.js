/* Helpers d'affichage partagés (dates, montants, libellés, statuts). */

export function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR');
}

export function fmtDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtMoney(v) {
  if (v == null || v === '') return '—';
  return `${Number(v).toLocaleString('fr-FR')} DH`;
}

export function timeAgo(v) {
  if (!v) return '';
  const s = Math.floor((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`;
  return fmtDate(v);
}

export function coverageLabel(t) {
  return t === 'complete' ? 'Complète' : t === 'minimal' ? 'Minimale' : (t || '—');
}

export function vehicleLabel(a) {
  const parts = [a.marque, a.modele].filter(Boolean).join(' ');
  return parts ? `${parts}${a.annee ? ` (${a.annee})` : ''}` : 'Contrat auto';
}

// Statut souscription/contrat → { label, tone }
export function subStatus(s) {
  return {
    nouvelle:  { label: 'Nouvelle',  tone: 'blue' },
    active:    { label: 'Active',    tone: 'green' },
    expired:   { label: 'Expirée',   tone: 'amber' },
    cancelled: { label: 'Annulée',   tone: 'red' },
  }[s] || { label: s || '—', tone: 'gray' };
}

export function paymentStatus(s) {
  return {
    succeeded: { label: 'Réussi',     tone: 'green' },
    pending:   { label: 'En attente', tone: 'amber' },
    failed:    { label: 'Échoué',     tone: 'red' },
  }[s] || { label: s || '—', tone: 'gray' };
}

export function docStatus(s) {
  return {
    pending:  { label: 'À vérifier', tone: 'amber' },
    approved: { label: 'Validé',     tone: 'green' },
    rejected: { label: 'Refusé',     tone: 'red' },
  }[s] || { label: s || '—', tone: 'gray' };
}

export function initials(nameOrEmail) {
  const s = (nameOrEmail || '?').trim();
  const parts = s.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
