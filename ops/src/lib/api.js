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
  myPrivileges: () => rpc('suro_my_privileges'),

  // --- privilèges (super_admin) ---
  listRolePrivileges: () => rpc('suro_list_role_privileges'),
  setPrivilege: (role, cap, allowed) => rpc('suro_set_privilege', { p_role: role, p_cap: cap, p_allowed: allowed }),

  // --- clients (édition / suppression) ---
  updateCustomer: (email, name, phone) => rpc('suro_update_customer', { p_email: email, p_name: name, p_phone: phone }),
  deleteCustomer: (email) => rpc('suro_delete_customer', { p_email: email }),

  // --- dashboard : sinistres en attente de réponse ---
  claimsNeedingReply: () => rpc('suro_claims_needing_reply'),

  // --- upload de document (attestation…) rattaché à un contrat ---
  uploadDocument: (application, file) => SB().adminUploadDocument(application, file),

  // --- audit ---
  logAction: (action, entity, entityId, changes) =>
    rpc('suro_log_action', { p_action: action, p_entity: entity || null, p_entity_id: entityId || null, p_changes: changes || null }),
  auditRecent: (limit = 50) => rpc('suro_audit_recent', { p_limit: limit }),

  // --- funnel / analytics (sessions uniques par événement sur N jours) ---
  funnelStats: (days = 7) => SB().adminGetFunnelStats(days),
  recentEvents: (limit = 50) => SB().adminRecentEvents(limit),

  // --- données métier (réutilise l'API existante) ---
  applications: () => SB().adminGetApplications(),
  claims: () => SB().adminGetClaims(),
  payments: () => SB().adminGetPayments(),
  customers: () => SB().adminListCustomers(),
  documents: (appId) => SB().adminGetDocuments(appId),

  // --- mutations souscriptions ---
  updateApplication: (id, fields) => SB().adminUpdateApplication(id, fields),
  updateApplicationStatus: (id, status) => SB().adminUpdateApplicationStatus(id, status),

  // --- paramètres ---
  getSettings: () => SB().getSettings(),
  updateSetting: (key, value) => SB().adminUpdateSetting(key, value),

  // --- staff (super_admin) ---
  listStaff: () => rpc('suro_list_staff'),
  setStaff: (email, role) => rpc('suro_set_staff', { p_email: email, p_role: role }),
  createStaff: (payload) => SB().adminCreateStaff(payload),
  removeStaff: (email) => rpc('suro_remove_staff', { p_email: email }),

  // --- sinistres ---
  claimFiles: (claimId) => SB().getClaimFiles(claimId),
  downloadClaimFile: (path, name) => SB().downloadClaimFile(path, name),
  claimMessages: (claimId) => SB().getClaimMessages(claimId),
  sendClaimMessage: (claimId, body) => SB().sendClaimMessage(claimId, body, 'admin'),
  async updateClaimStatus(claimId, status) {
    await SB().adminUpdateClaimStatus(claimId, status);
    return rpc('suro_log_action', { p_action: 'update', p_entity: 'claim', p_entity_id: claimId, p_changes: { status } }).catch(() => {});
  },

  // --- documents ---
  allDocuments: () => SB().adminGetDocuments(),
  reviewDocument: (id, status, reason) =>
    rpc('suro_review_document', { p_id: id, p_status: status, p_reason: reason || null }),
  documentBlobUrl: (storagePath) => SB().getDocumentBlobUrl(storagePath),
  downloadDocument: (storagePath, name) => SB().downloadDocument(storagePath, name),
};
