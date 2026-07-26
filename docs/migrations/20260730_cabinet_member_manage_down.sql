drop function if exists public.suro_cabinet_remove_member(uuid);
drop function if exists public.suro_cabinet_set_member_active(uuid, boolean);
drop function if exists public.suro_cabinet_member_auth_target(uuid);
drop function if exists public.suro_cabinet_assert_manage_member(uuid);

-- Restaurer list_members sans user_id (version précédente)
drop function if exists public.suro_cabinet_list_members(uuid);

create or replace function public.suro_cabinet_list_members(p_cabinet_id uuid default null)
  returns table (
    member_id uuid,
    cabinet_id uuid,
    cabinet_name text,
    email text,
    display_name text,
    role public.suro_cabinet_role,
    is_active boolean,
    created_at timestamptz
  )
  language plpgsql
  stable
  security definer
  set search_path to 'public', 'auth'
as $$
declare
  v_ctx record;
begin
  select * into v_ctx from public.suro_cabinet_context();

  if public.suro_has_role(array['super_admin','admin']::public.suro_role[]) then
    return query
    select cu.id, cu.cabinet_id, c.name, u.email::text, cu.display_name, cu.role, cu.is_active, cu.created_at
    from public.suro_cabinet_users cu
    join public.suro_cabinets c on c.id = cu.cabinet_id
    join auth.users u on u.id = cu.user_id
    where p_cabinet_id is null or cu.cabinet_id = p_cabinet_id
    order by c.name, cu.created_at desc;
  elsif public.suro_cabinet_can_manage_team() and v_ctx.cabinet_id is not null then
    return query
    select cu.id, cu.cabinet_id, c.name, u.email::text, cu.display_name, cu.role, cu.is_active, cu.created_at
    from public.suro_cabinet_users cu
    join public.suro_cabinets c on c.id = cu.cabinet_id
    join auth.users u on u.id = cu.user_id
    where cu.cabinet_id = v_ctx.cabinet_id
    order by cu.created_at desc;
  else
    raise exception 'Non autorisé';
  end if;
end;
$$;

grant execute on function public.suro_cabinet_list_members(uuid) to authenticated;
