-- =====================================================================
-- OPS PORTAL — Durcissement RLS (alignement matrice de rôles §5.3)
-- Appliqué le 2026-07-20 sur le projet Supabase eprtmdugiusidtbwzozj.
-- Avant : écritures gardées par is_suro_admin() (= tout membre du staff).
-- Après : gardées par rôle. Flux client (RPC SECURITY DEFINER) non impactés.
-- =====================================================================

-- suro_settings : écriture réservée super_admin / admin
drop policy if exists "suro_admin_update_settings" on public.suro_settings;
create policy "suro_settings update staff" on public.suro_settings
  for update to authenticated
  using (public.suro_has_role(array['super_admin','admin']::public.suro_role[]))
  with check (public.suro_has_role(array['super_admin','admin']::public.suro_role[]));

drop policy if exists "suro_admin_upsert_settings" on public.suro_settings;
create policy "suro_settings insert staff" on public.suro_settings
  for insert to authenticated
  with check (public.suro_has_role(array['super_admin','admin']::public.suro_role[]));

-- insurance_applications : édition réservée super_admin / admin / operations (pas support)
drop policy if exists "suro_admin_update_applications" on public.insurance_applications;
create policy "suro_applications update staff" on public.insurance_applications
  for update to authenticated
  using (public.suro_has_role(array['super_admin','admin','operations']::public.suro_role[]))
  with check (public.suro_has_role(array['super_admin','admin','operations']::public.suro_role[]));
