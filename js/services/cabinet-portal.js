/* API portail cabinet partenaire — RPC Supabase dédiées. */
(function () {
  const { request } = window.SURO_HTTP;

  async function rpc(fn, params) {
    return request('POST', '/rest/v1/rpc/' + fn, params || {});
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
  };
})();
