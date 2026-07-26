-- =====================================================================
-- CABINET — gestion membres (désactivation, suppression, cible auth)
-- =====================================================================

-- Vérifie que l'appelant peut gérer ce membre (retourne cabinet_id, user_id, role).
create or replace function public.suro_cabinet_assert_manage_member(p_member_id uuid)
  returns table(cabinet_id uuid, user_id uuid, member_role public.suro_cabinet_role)
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_ctx record;
  v_cabinet_id uuid;
  v_user_id uuid;
  v_role public.suro_cabinet_role;
begin
  select cu.cabinet_id, cu.user_id, cu.role
  into v_cabinet_id, v_user_id, v_role
  from public.suro_cabinet_users cu
  where cu.id = p_member_id;

  if v_user_id is null then
    raise exception 'Membre introuvable';
  end if;

  if v_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier votre propre accès';
  end if;

  if public.suro_has_role(array['super_admin','admin']::public.suro_role[]) then
    cabinet_id := v_cabinet_id;
    user_id := v_user_id;
    member_role := v_role;
    return next;
    return;
  end if;

  if not public.suro_cabinet_can_manage_team() then
    raise exception 'Non autorisé';
  end if;

  select * into v_ctx from public.suro_cabinet_context();
  if v_ctx.cabinet_id is null or v_ctx.cabinet_id <> v_cabinet_id then
    raise exception 'Accès refusé';
  end if;

  if v_role = 'admin_cabinet' then
    raise exception 'Seul SURO peut gérer un admin cabinet';
  end if;

  cabinet_id := v_cabinet_id;
  user_id := v_user_id;
  member_role := v_role;
  return next;
end;
$$;

-- Cible Auth pour mise à jour email/mot de passe (Edge Function).
create or replace function public.suro_cabinet_member_auth_target(p_member_id uuid)
  returns table(user_id uuid, email text)
  language plpgsql
  security definer
  set search_path to 'public', 'auth'
as $$
declare
  v_uid uuid;
begin
  select m.user_id into v_uid
  from public.suro_cabinet_assert_manage_member(p_member_id) m
  limit 1;

  return query
  select u.id, u.email::text
  from auth.users u
  where u.id = v_uid;
end;
$$;

create or replace function public.suro_cabinet_set_member_active(
  p_member_id uuid,
  p_active boolean)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  perform 1 from public.suro_cabinet_assert_manage_member(p_member_id);

  update public.suro_cabinet_users
  set is_active = p_active
  where id = p_member_id;

  if not found then
    raise exception 'Membre introuvable';
  end if;

  return 'ok';
end;
$$;

create or replace function public.suro_cabinet_remove_member(p_member_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  perform 1 from public.suro_cabinet_assert_manage_member(p_member_id);

  delete from public.suro_cabinet_users where id = p_member_id;

  if not found then
    raise exception 'Membre introuvable';
  end if;

  return 'ok';
end;
$$;

-- Liste membres : ajout user_id pour l'UI
drop function if exists public.suro_cabinet_list_members(uuid);

create or replace function public.suro_cabinet_list_members(p_cabinet_id uuid default null)
  returns table (
    member_id uuid,
    user_id uuid,
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
    select
      cu.id,
      cu.user_id,
      cu.cabinet_id,
      c.name,
      u.email::text,
      cu.display_name,
      cu.role,
      cu.is_active,
      cu.created_at
    from public.suro_cabinet_users cu
    join public.suro_cabinets c on c.id = cu.cabinet_id
    join auth.users u on u.id = cu.user_id
    where p_cabinet_id is null or cu.cabinet_id = p_cabinet_id
    order by c.name, cu.created_at desc;

  elsif public.suro_cabinet_can_manage_team() and v_ctx.cabinet_id is not null then
    return query
    select
      cu.id,
      cu.user_id,
      cu.cabinet_id,
      c.name,
      u.email::text,
      cu.display_name,
      cu.role,
      cu.is_active,
      cu.created_at
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

revoke all on function public.suro_cabinet_assert_manage_member(uuid) from public;
revoke all on function public.suro_cabinet_member_auth_target(uuid) from public;
revoke all on function public.suro_cabinet_set_member_active(uuid, boolean) from public;
revoke all on function public.suro_cabinet_remove_member(uuid) from public;
revoke all on function public.suro_cabinet_list_members(uuid) from public;

grant execute on function public.suro_cabinet_assert_manage_member(uuid) to authenticated;
grant execute on function public.suro_cabinet_member_auth_target(uuid) to authenticated;
grant execute on function public.suro_cabinet_set_member_active(uuid, boolean) to authenticated;
grant execute on function public.suro_cabinet_remove_member(uuid) to authenticated;
grant execute on function public.suro_cabinet_list_members(uuid) to authenticated;
