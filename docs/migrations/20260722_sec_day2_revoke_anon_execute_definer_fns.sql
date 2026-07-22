-- =====================================================================
-- SÉCURITÉ — Jour 2 : réduire la surface des fonctions SECURITY DEFINER
-- Appliqué sur le projet Supabase eprtmdugiusidtbwzozj.
--
-- Avant : quasiment toutes les fonctions SECURITY DEFINER étaient exécutables
-- par anon (via le grant PUBLIC par défaut de PostgreSQL). Elles ont des gardes
-- internes (is_suro_admin(), suro_current_role()…), mais on retire l'accès à
-- qui n'en a pas besoin (défense en profondeur).
--
-- Règles :
--   • suro_get_quote : reste PUBLIC (appelé par le tunnel anonyme).
--   • Triggers + fonctions purement internes : definer-only (aucun grant) —
--     suro_compute_premium, suro_notify, suro_set_premium, suro_trg_*.
--   • Tout le reste : révoquer public/anon, conserver authenticated
--     (RPC staff/clients + helpers utilisés dans les policies RLS :
--      is_suro_admin, suro_can, suro_has_role, suro_owns_claim…).
--
-- Pré-vérifié : aucune policy anon n'appelle de fonction → retirer l'exécution
-- anon ne casse aucun accès public.
-- Post-vérifié (base) : anon ne peut plus appeler les fonctions staff (42501) ;
-- authenticated les exécute toujours (stoppé par la garde interne) ;
-- anon obtient toujours un devis via suro_get_quote.
-- =====================================================================

do $$
declare
  r record;
  keep_public text[] := array['suro_get_quote'];
  definer_only text[] := array[
    'suro_compute_premium','suro_notify','suro_set_premium',
    'suro_trg_application_created','suro_trg_application_updated',
    'suro_trg_claim_created','suro_trg_claim_message','suro_trg_claim_status'
  ];
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    if r.proname = any(keep_public) then
      continue;
    elsif r.proname = any(definer_only) then
      execute format('revoke execute on function public.%I(%s) from public, anon, authenticated;', r.proname, r.args);
    else
      execute format('revoke execute on function public.%I(%s) from public, anon;', r.proname, r.args);
      execute format('grant execute on function public.%I(%s) to authenticated;', r.proname, r.args);
    end if;
  end loop;
end $$;
