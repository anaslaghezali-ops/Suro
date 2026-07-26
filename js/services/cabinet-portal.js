/* API portail cabinet partenaire — RPC Supabase dédiées. */
(function () {
  const SUPABASE_URL = window.SURO_CONFIG.SUPABASE_URL;

  function rpc(fn, params) {
    return window.SURO_HTTP.sb('/rest/v1/rpc/' + fn, {
      method: 'POST',
      asUser: true,
      body: JSON.stringify(params || {}),
    });
  }

  async function storageFetch(path) {
    const session = await window.SURO_SESSION.ensureValidSession();
    if (!session) throw new Error('Session expirée');
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/authenticated/${path}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    if (!res.ok) throw new Error('Fichier inaccessible');
    return res.blob();
  }

  window.SURO_CABINET = {
  async context() {
      const rows = await rpc('suro_cabinet_context');
      return rows && rows[0] ? rows[0] : null;
    },

    async listTasks(status, limit, offset) {
      return rpc('suro_cabinet_list_tasks', {
        p_status: status || null,
        p_limit: limit || 50,
        p_offset: offset || 0,
      });
    },

    async listClaims(status, limit, offset) {
      return rpc('suro_cabinet_list_claims', {
        p_status: status || null,
        p_limit: limit || 50,
        p_offset: offset || 0,
      });
    },

    async taskAction(taskId, action, payload) {
      return rpc('suro_cabinet_task_action', {
        p_task_id: taskId,
        p_action: action,
        p_payload: payload || {},
      });
    },

    async claimSetStatus(claimId, status, message) {
      return rpc('suro_cabinet_claim_set_status', {
        p_claim_id: claimId,
        p_status: status,
        p_message: message || null,
      });
    },

    async addUser(email, role, displayName, cabinetId) {
      return rpc('suro_cabinet_add_user', {
        p_email: email,
        p_role: role,
        p_display_name: displayName || null,
        p_cabinet_id: cabinetId || null,
      });
    },

    async createCabinetUser({ email, password, role, name, cabinetId }) {
      return window.SURO_HTTP.sb('/functions/v1/suro-create-cabinet-user', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({
          email,
          password,
          role,
          name: name || null,
          cabinet_id: cabinetId || null,
        }),
      });
    },

    async listMembers(cabinetId) {
      return rpc('suro_cabinet_list_members', {
        p_cabinet_id: cabinetId || null,
      });
    },

    async updateCabinetUser({ memberId, newEmail, newPassword }) {
      return window.SURO_HTTP.sb('/functions/v1/suro-update-cabinet-user', {
        method: 'POST',
        asUser: true,
        body: JSON.stringify({
          member_id: memberId,
          newEmail: newEmail || null,
          newPassword: newPassword || null,
        }),
      });
    },

    async setMemberActive(memberId, active) {
      return rpc('suro_cabinet_set_member_active', {
        p_member_id: memberId,
        p_active: active,
      });
    },

    async removeMember(memberId) {
      return rpc('suro_cabinet_remove_member', { p_member_id: memberId });
    },

    async listApplicationDocuments(applicationId) {
      return rpc('suro_cabinet_list_application_documents', {
        p_application_id: applicationId,
      });
    },

    async getDocumentBlobUrl(storagePath) {
      const blob = await storageFetch(`suro-documents/${storagePath}`);
      return { url: window.URL.createObjectURL(blob), type: blob.type };
    },

    async downloadDocument(storagePath, fileName) {
      const blob = await storageFetch(`suro-documents/${storagePath}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || storagePath.split('/').pop();
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    },

    /* Supervision Ops */
    async opsOverview() {
      return rpc('suro_ops_cabinet_overview');
    },

    async opsAnomalies(limit) {
      return rpc('suro_ops_list_cabinet_anomalies', { p_limit: limit || 50 });
    },

    async staffUpsertCabinet(name, slug, cabinetId) {
      return rpc('suro_staff_upsert_cabinet', {
        p_name: name,
        p_slug: slug,
        p_cabinet_id: cabinetId || null,
      });
    },

    async staffSetCabinetActive(cabinetId, active) {
      return rpc('suro_staff_set_cabinet_active', {
        p_cabinet_id: cabinetId,
        p_active: active,
      });
    },

    async staffDeleteCabinet(cabinetId) {
      return rpc('suro_staff_delete_cabinet', {
        p_cabinet_id: cabinetId,
      });
    },
  };
})();
