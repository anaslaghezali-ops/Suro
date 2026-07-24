/* Sélecteur d'environnement — chargé AVANT config.js sur les portails cabinet/staging.
 * ?env=staging  ou  localStorage.suro_env = 'staging'  → projet Supabase staging. */
(function () {
  var staging =
    /[?&]env=staging\b/.test(location.search) ||
    localStorage.getItem('suro_env') === 'staging';
  if (staging && window.SURO_CONFIG_STAGING) {
    window.SURO_CONFIG = Object.assign({}, window.SURO_CONFIG_STAGING);
    window.SURO_ENV = 'staging';
  }
})();
