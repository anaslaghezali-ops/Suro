/* SURO API — point d'entrée unique (assemble les modules js/services/*.js).
 *
 * Chargement (dans l'ordre) :
 *   config → session → http → analytics → onboarding → auth →
 *   customer-portal → admin → notifications → vehicles → api.js (ce fichier)
 *
 * Le site est statique (GitHub Pages) ; Supabase REST + Auth + RLS.
 */
class API {}

Object.assign(
  API,
  window.SURO_HTTP,
  window.SURO_SESSION,
  window.SURO_ANALYTICS,
  window.SURO_ONBOARDING,
  window.SURO_AUTH,
  window.SURO_CUSTOMER,
  window.SURO_ADMIN,
  window.SURO_API_NOTIFICATIONS,
  window.SURO_VEHICLES,
  window.SURO_CABINET || {}
);

if (typeof window !== 'undefined') {
  window.SURO_API = API;
}
