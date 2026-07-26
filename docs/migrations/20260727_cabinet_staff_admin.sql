-- =====================================================================
-- CABINET — actions admin SURO (activation, UI Ops)
-- =====================================================================

create or replace function public.suro_staff_set_cabinet_active(
  p_cabinet_id uuid,
  p_active boolean)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.suro_has_role(array['super_admin','admin']::public.suro_role[]) then
    raise exception 'Réservé aux admins SURO';
  end if;
  update public.suro_cabinets
  set is_active = p_active, updated_at = now()
  where id = p_cabinet_id;
  if not found then
    raise exception 'Cabinet introuvable';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.suro_staff_set_cabinet_active(uuid, boolean) from public;
grant execute on function public.suro_staff_set_cabinet_active(uuid, boolean) to authenticated;
