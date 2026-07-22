-- =====================================================================
-- DOCUMENTATION : policy INSERT sur insurance_applications
-- Projet Supabase eprtmdugiusidtbwzozj.
--
-- Contexte : le tunnel de souscription (landing + /app/) appelle
-- createApplication() dans js/services/api.js SANS asUser: true.
-- La requête part donc avec la clé publishable (rôle anon), pas le JWT
-- client. C'est intentionnel et fonctionne grâce à la policy ci-dessous.
--
-- Comportement attendu :
--   - anon / authenticated peuvent insérer une demande tant que
--     status = 'nouvelle' (valeur par défaut de la colonne).
--   - Le front n'a pas besoin d'asUser: true pour createApplication().
--   - La visibilité côté client repose sur les policies SELECT
--     (email insensible à la casse — voir migration 20260721).
--
-- Durcissement prévu au go-live (paiement réel) :
--   - Retirer anon de cette policy (authenticated uniquement).
--   - Ajouter with_check : lower(customer_email) = lower(auth.jwt()->>'email').
--   - Fermer suro_mark_application_paid côté anon (webhook CMI / Edge Function).
--
-- Cette migration est idempotente : elle recrée la policy telle qu'en prod
-- pour traçabilité dans le dépôt (schéma initial non versionné).
-- =====================================================================

-- S'assurer que RLS est activée (no-op si déjà le cas)
alter table public.insurance_applications enable row level security;

-- Policy INSERT tunnel : brouillon « nouvelle » uniquement
drop policy if exists suro_anon_insert_applications on public.insurance_applications;
create policy suro_anon_insert_applications on public.insurance_applications
  for insert
  to anon, authenticated
  with check (status = 'nouvelle');
