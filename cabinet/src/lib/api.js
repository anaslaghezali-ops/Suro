const LOGIN = '../cabinet-login.html';

export const api = {
  session() {
    try {
      const raw = localStorage.getItem('suro_auth_session') || localStorage.getItem('suro_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  logout() {
    localStorage.removeItem('suro_session');
    if (window.SURO_AUTH && window.SURO_AUTH.logout) window.SURO_AUTH.logout();
  },
  async context() { return window.SURO_CABINET.context(); },
  async listTasks(s, l, o) { return window.SURO_CABINET.listTasks(s, l, o); },
  async listClaims(s, l, o) { return window.SURO_CABINET.listClaims(s, l, o); },
  async taskAction(id, action, payload) { return window.SURO_CABINET.taskAction(id, action, payload); },
  async claimSetStatus(id, status, msg) { return window.SURO_CABINET.claimSetStatus(id, status, msg); },
  async addUser(email, role, name) { return window.SURO_CABINET.addUser(email, role, name); },
  login: (...a) => window.SURO_AUTH.login(...a),
};

export { LOGIN };
