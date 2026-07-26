-- =====================================================================
-- ROLLBACK — 20260726_cabinet_rls_perf.sql
-- Restaure les policies de 20260725_cabinet_module + rls_hardening
-- =====================================================================

drop policy if exists suro_cabinets_staff on public.suro_cabinets;
create policy suro_cabinets_staff on public.suro_cabinets for select to authenticated
  using (public.is_suro_staff() or id in (
    select cabinet_id from public.suro_cabinet_users where user_id = auth.uid() and is_active
  ));

drop policy if exists suro_cabinet_users_read on public.suro_cabinet_users;
create policy suro_cabinet_users_read on public.suro_cabinet_users for select to authenticated
  using (
    public.is_suro_staff()
    or cabinet_id in (select cabinet_id from public.suro_cabinet_users cu where cu.user_id = auth.uid() and cu.is_active)
    or user_id = auth.uid()
  );

drop policy if exists suro_broker_tasks_read on public.suro_broker_tasks;
create policy suro_broker_tasks_read on public.suro_broker_tasks for select to authenticated
  using (
    public.is_suro_staff()
    or cabinet_id in (select cabinet_id from public.suro_cabinet_users where user_id = auth.uid() and is_active)
  );

drop policy if exists suro_claim_cabinet_read on public.suro_claim_cabinet;
create policy suro_claim_cabinet_read on public.suro_claim_cabinet for select to authenticated
  using (
    public.is_suro_staff()
    or cabinet_id in (select cabinet_id from public.suro_cabinet_users where user_id = auth.uid() and is_active)
  );

drop policy if exists suro_cabinet_notif_read on public.suro_cabinet_notifications;
create policy suro_cabinet_notif_read on public.suro_cabinet_notifications for select to authenticated
  using (user_id = auth.uid() or public.is_suro_staff());

drop policy if exists suro_task_events_read on public.suro_task_events;
create policy suro_task_events_read on public.suro_task_events
  for select to authenticated
  using (
    public.is_suro_staff()
    or exists (
      select 1 from public.suro_broker_tasks t
      join public.suro_cabinet_users cu on cu.cabinet_id = t.cabinet_id
      where t.id = task_id and cu.user_id = auth.uid() and cu.is_active
    )
  );

drop policy if exists suro_claim_status_events_read on public.suro_claim_status_events;
create policy suro_claim_status_events_read on public.suro_claim_status_events
  for select to authenticated
  using (
    public.is_suro_staff()
    or exists (
      select 1 from public.suro_claim_cabinet cc
      join public.suro_cabinet_users cu on cu.cabinet_id = cc.cabinet_id
      where cc.claim_id = suro_claim_status_events.claim_id
        and cu.user_id = auth.uid() and cu.is_active
    )
  );

-- Restaurer helpers identité (version module d'origine)
create or replace function public.suro_is_cabinet_user()
  returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.suro_cabinet_users
    where user_id = auth.uid() and is_active = true
  );
$$;

create or replace function public.suro_cabinet_context()
  returns table(cabinet_id uuid, cabinet_role public.suro_cabinet_role, cabinet_name text)
  language sql stable security definer set search_path to 'public' as $$
  select cu.cabinet_id, cu.role, c.name
  from public.suro_cabinet_users cu
  join public.suro_cabinets c on c.id = cu.cabinet_id
  where cu.user_id = auth.uid() and cu.is_active = true and c.is_active = true
  limit 1;
$$;

create or replace function public.suro_cabinet_can_manage_team()
  returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.suro_cabinet_users
    where user_id = auth.uid()
      and is_active = true
      and role in ('admin_cabinet', 'responsable')
  ) or public.is_suro_staff();
$$;

create or replace function public.suro_cabinet_add_user(
  p_email text, p_role public.suro_cabinet_role, p_display_name text default null,
  p_cabinet_id uuid default null)
  returns text language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid; v_cabinet uuid; v_ctx record;
begin
  select * into v_ctx from public.suro_cabinet_context();
  v_cabinet := coalesce(p_cabinet_id, v_ctx.cabinet_id);
  if not public.is_suro_staff() and not public.suro_cabinet_can_manage_team() then
    raise exception 'Non autorisé';
  end if;
  if not public.is_suro_staff() and v_cabinet <> v_ctx.cabinet_id then
    raise exception 'Accès refusé';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'Utilisateur introuvable — créer le compte Auth d''abord'; end if;
  insert into public.suro_cabinet_users(cabinet_id, user_id, role, display_name)
  values (v_cabinet, v_uid, p_role, p_display_name)
  on conflict (cabinet_id, user_id) do update
    set role = excluded.role, display_name = excluded.display_name, is_active = true;
  return 'ok';
end;
$$;

drop index if exists public.suro_cabinet_users_one_active_per_user_idx;
drop index if exists public.suro_cabinet_users_user_active_idx;

drop function if exists public.user_cabinet_ids();
