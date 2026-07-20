-- =====================================================================
-- OPS PORTAL — PHASE 5 : Gestion des collaborateurs (staff) avec rôles
-- Appliqué le 2026-07-20 sur le projet Supabase eprtmdugiusidtbwzozj.
-- RPC réservés au super_admin. Garde anti-verrouillage (dernier super_admin).
-- Les anciennes fonctions suro_add_admin/remove_admin/list_admins sont
-- conservées pour l'admin legacy (inchangées).
-- =====================================================================

create or replace function public.suro_list_staff()
  returns table(email text, name text, role public.suro_role, added_at timestamptz)
  language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.suro_has_role(array['super_admin']::public.suro_role[]) then
    raise exception 'Réservé au Super Admin';
  end if;
  return query
    select u.email::text, (u.raw_user_meta_data ->> 'name')::text, a.role, a.created_at
    from public.suro_admins a join auth.users u on u.id = a.user_id
    order by a.created_at;
end; $$;

create or replace function public.suro_set_staff(p_email text, p_role public.suro_role)
  returns text language plpgsql security definer set search_path to 'public' as $$
declare v_user_id uuid; v_current public.suro_role; v_supers int;
begin
  if not public.suro_has_role(array['super_admin']::public.suro_role[]) then
    raise exception 'Réservé au Super Admin';
  end if;
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Aucun compte avec cet email — la personne doit d''abord créer un compte sur le site';
  end if;
  select role into v_current from public.suro_admins where user_id = v_user_id;
  if v_current = 'super_admin' and p_role <> 'super_admin' then
    select count(*) into v_supers from public.suro_admins where role = 'super_admin';
    if v_supers <= 1 then raise exception 'Impossible de rétrograder le dernier Super Admin'; end if;
  end if;
  insert into public.suro_admins (user_id, role) values (v_user_id, p_role)
    on conflict (user_id) do update set role = excluded.role;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''),
          case when v_current is null then 'create' else 'update' end,
          'staff', jsonb_build_object('email', p_email, 'role', p_role));
  return 'ok';
end; $$;

create or replace function public.suro_remove_staff(p_email text)
  returns text language plpgsql security definer set search_path to 'public' as $$
declare v_user_id uuid; v_current public.suro_role; v_supers int;
begin
  if not public.suro_has_role(array['super_admin']::public.suro_role[]) then
    raise exception 'Réservé au Super Admin';
  end if;
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then raise exception 'Compte introuvable'; end if;
  select role into v_current from public.suro_admins where user_id = v_user_id;
  if v_current = 'super_admin' then
    select count(*) into v_supers from public.suro_admins where role = 'super_admin';
    if v_supers <= 1 then raise exception 'Impossible de retirer le dernier Super Admin'; end if;
  end if;
  delete from public.suro_admins where user_id = v_user_id;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''), 'delete', 'staff',
          jsonb_build_object('email', p_email));
  return 'ok';
end; $$;

revoke all on function public.suro_list_staff() from public;
revoke all on function public.suro_set_staff(text, public.suro_role) from public;
revoke all on function public.suro_remove_staff(text) from public;
grant execute on function public.suro_list_staff() to authenticated;
grant execute on function public.suro_set_staff(text, public.suro_role) to authenticated;
grant execute on function public.suro_remove_staff(text) to authenticated;
