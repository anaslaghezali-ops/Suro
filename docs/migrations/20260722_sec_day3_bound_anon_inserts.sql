-- =====================================================================
-- SÉCURITÉ — Jour 3 : borner les inserts anon « always true »
-- Appliqué sur le projet Supabase eprtmdugiusidtbwzozj.
--
-- suro_events et insurance_application_answers avaient with_check = true
-- (anon pouvait insérer n'importe quoi : payloads énormes, contenu piégé).
-- On borne la forme/taille sans retirer l'usage légitime :
--   • le tunnel track des events (noms en snake_case minuscule) ;
--   • les answers ne sont insérées que par le backend en service_role
--     (qui contourne RLS), donc ces bornes ne cassent rien côté front.
--
-- Déjà sains / laissés tels quels :
--   • insurance_applications INSERT : déjà borné (status='nouvelle').
--   • suro_settings SELECT public : ne contient que support_phone/whatsapp (public).
--   • insurance_pricing_factors / insurance_pricing / insurance_products SELECT
--     public : tarifs publics (nécessaires au tunnel).
-- Le vrai anti-flood (rate-limit par IP) viendra au Jour 8 (reverse-proxy).
-- =====================================================================

-- 1) suro_events : nom d'event bien formé + tailles bornées
drop policy if exists suro_anon_insert_events on public.suro_events;
create policy suro_anon_insert_events on public.suro_events
  for insert to anon, authenticated
  with check (
    event is not null and event ~ '^[a-z][a-z0-9_]{0,63}$'
    and (step is null or length(step) <= 64)
    and (session_id is null or length(session_id) <= 64)
    and (meta is null or length(meta::text) <= 4000)
  );

-- 2) insurance_application_answers : rattaché à une application + tailles bornées
drop policy if exists suro_anon_insert_answers on public.insurance_application_answers;
create policy suro_anon_insert_answers on public.insurance_application_answers
  for insert to anon, authenticated
  with check (
    application_id is not null
    and field_key is not null and length(field_key) <= 64
    and length(coalesce(field_value, '')) <= 2000
  );
