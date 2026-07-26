const LOGIN = '../cabinet-login.html';

/** Même clé que js/services/session.js (suroSession). */
function sessionStore() {
  return window.SURO_SESSION || null;
}

export const api = {
  session() {
    const store = sessionStore();
    if (store) return store.getSession();
    try {
      const raw = localStorage.getItem('suroSession');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  logout() {
    const store = sessionStore();
    if (store) store.setSession(null);
    else localStorage.removeItem('suroSession');
  },

  async context() { return window.SURO_CABINET.context(); },
  async listTasks(s, l, o) { return window.SURO_CABINET.listTasks(s, l, o); },
  async listClaims(s, l, o) { return window.SURO_CABINET.listClaims(s, l, o); },
  async taskAction(id, action, payload) { return window.SURO_CABINET.taskAction(id, action, payload); },
  async claimSetStatus(id, status, msg) { return window.SURO_CABINET.claimSetStatus(id, status, msg); },
  async addUser(email, role, name) { return window.SURO_CABINET.addUser(email, role, name); },
  async createCabinetUser(payload) { return window.SURO_CABINET.createCabinetUser(payload); },
  async listMembers(cabinetId) { return window.SURO_CABINET.listMembers(cabinetId); },

  login(email, password) {
    const client = window.SURO_API
      || Object.assign({}, window.SURO_HTTP, window.SURO_SESSION, window.SURO_AUTH);
    return client.login.call(client, email, password);
  },
};

export { LOGIN };
