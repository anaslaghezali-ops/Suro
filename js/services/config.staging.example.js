/* Exemple config staging — copier vers config.staging.local.js (gitignored) ou renseigner via CI.
 * Ne jamais committer de service_role. */
window.SURO_CONFIG_STAGING = {
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  SUPABASE_KEY: 'YOUR_ANON_OR_PUBLISHABLE_KEY',
  API_VERSION: 1,
  ENV: 'staging',
};
