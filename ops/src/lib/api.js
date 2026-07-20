/* Couche d'accès Operations — s'appuie sur window.SURO_API (déjà éprouvé)
   et ajoute les appels RBAC / audit propres au back-office. */

const SB = () => window.SURO_API;

function rpc(name, body) {
  return SB().sb(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    asUser: true,
    body: JSON.stringify(body || {}),
  });
}

export const api = {
  // --- session / auth ---
  session: () => SB().getSession(),
  logout: () => SB().logout(),
  currentRole: () => rpc('suro_current_role'),
  isStaff: () => rpc('is_suro_staff'),

  // --- audit ---
  logAction: (action, entity, entityId, changes) =>
    rpc('suro_log_action', { p_action: action, p_entity: entity || null, p_entity_id: entityId || null, p_changes: changes || null }),
  auditRecent: (limit = 50) => rpc('suro_audit_recent', { p_limit: limit }),

  // --- données métier (réutilise l'API existante) ---
  applications: () => SB().adminGetApplications(),
  claims: () => SB().adminGetClaims(),
  payments: () => SB().adminGetPayments(),
  customers: () => SB().adminListCustomers(),
  documents: (appId) => SB().adminGetDocuments(appId),

  // --- mutations souscriptions ---
  updateApplication: (id, fields) => SB().adminUpdateApplication(id, fields),
  updateApplicationStatus: (id, status) => SB().adminUpdateApplicationStatus(id, status),

  // --- staff (super_admin) ---
  listStaff: () => rpc('suro_list_staff'),
  setStaff: (email, role) => rpc('suro_set_staff', { p_email: email, p_role: role }),
  removeStaff: (email) => rpc('suro_remove_staff', { p_email: email }),

  // --- documents ---
  allDocuments: () => SB().adminGetDocuments(),
  reviewDocument: (id, status, reason) =>
    rpc('suro_review_document', { p_id: id, p_status: status, p_reason: reason || null }),
  documentBlobUrl: (storagePath) => SB().getDocumentBlobUrl(storagePath),
  downloadDocument: (storagePath, name) => SB().downloadDocument(storagePath, name),
};
