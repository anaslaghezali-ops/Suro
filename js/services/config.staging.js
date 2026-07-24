/* Configuration Supabase STAGING — sans secrets en dur.
 * Charger AVANT config-env.js :
 *   1. config.staging.local.js (gitignored, dev local)
 *   2. ou config.staging.example.js (placeholder)
 * Les clés réelles restent dans le dashboard Supabase / staging/.env */
(function () {
  if (window.SURO_CONFIG_STAGING) return;
  console.warn('[SURO] Staging : définir window.SURO_CONFIG_STAGING via config.staging.local.js');
})();
