/* Sélecteur d'environnement — chargé AVANT config.js sur les portails cabinet/staging.
 * ?env=staging  ou  localStorage.suro_env = 'staging'  → projet Supabase staging.
 * VPS lab (185.98.136.100) → staging automatique. */
(function () {
  var staging =
    /[?&]env=staging\b/.test(location.search) ||
    localStorage.getItem('suro_env') === 'staging' ||
    location.hostname === '185.98.136.100';
  if (staging && window.SURO_CONFIG_STAGING) {
    window.SURO_CONFIG = Object.assign({}, window.SURO_CONFIG_STAGING);
    window.SURO_ENV = 'staging';
  }
})();
