/**
 * Snippet HTML à inclure avant les autres scripts SURO.
 * Version centralisée : js/services/config.js → API_VERSION
 *
 * Préfixe relatif : "" (racine) ou "../" (app/, ops/, backoffice/)
 */
function suroApiScripts(prefix) {
  const v = 42;
  const base = `${prefix}js/services/`;
  const files = [
    'config.js',
    'session.js',
    'http.js',
    'analytics.js',
    'onboarding.js',
    'auth.js',
    'customer-portal.js',
    'admin.js',
    'api-notifications.js',
    'api.js',
  ];
  return files.map((f) => `<script src="${base}${f}?v=${v}"></script>`).join('\n  ');
}

module.exports = { suroApiScripts };
