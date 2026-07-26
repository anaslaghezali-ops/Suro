-- =====================================================================
-- CABINET — suppression définitive (Ops super_admin / admin)
-- Refus si le cabinet a des dossiers ou sinistres liés.
-- =====================================================================

create or replace function public.suro_staff_delete_cabinet(p_cabinet_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_name text;
  v_tasks int;
  v_claims int;
begin
  if not public.suro_has_role(array['super_admin','admin']::public.suro_role[]) then
    raise exception 'Réservé aux admins SURO';
  end if;

  select name into v_name
  from public.suro_cabinets
  where id = p_cabinet_id;

  if v_name is null then
    raise exception 'Cabinet introuvable';
  end if;

  select count(*)::int into v_tasks
  from public.suro_broker_tasks
  where cabinet_id = p_cabinet_id;

  select count(*)::int into v_claims
  from public.suro_claim_cabinet
  where cabinet_id = p_cabinet_id;

  if v_tasks > 0 or v_claims > 0 then
    raise exception
      'Impossible de supprimer « % » : % dossier(s) et % sinistre(s) liés. Désactivez le cabinet à la place.',
      v_name, v_tasks, v_claims;
  end if;

  delete from public.suro_cabinets where id = p_cabinet_id;

  return 'ok';
end;
$$;

revoke all on function public.suro_staff_delete_cabinet(uuid) from public;
grant execute on function public.suro_staff_delete_cabinet(uuid) to authenticated;
