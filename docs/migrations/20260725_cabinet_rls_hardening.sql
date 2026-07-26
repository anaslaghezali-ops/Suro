-- =====================================================================
-- CABINET MODULE — durcissement RLS multi-tenant (audit CTO)
-- À appliquer après 20260725_cabinet_module.sql
-- Deny-by-default explicite + policies SELECT tenant-scoped manquantes
-- =====================================================================

-- ---------- suro_task_events : lecture limitée au cabinet de la tâche ----------
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

drop policy if exists suro_task_events_no_insert on public.suro_task_events;
drop policy if exists suro_task_events_no_update on public.suro_task_events;
drop policy if exists suro_task_events_no_delete on public.suro_task_events;
create policy suro_task_events_no_insert on public.suro_task_events for insert to authenticated with check (false);
create policy suro_task_events_no_update on public.suro_task_events for update to authenticated using (false);
create policy suro_task_events_no_delete on public.suro_task_events for delete to authenticated using (false);

-- ---------- suro_claim_status_events : lecture limitée au cabinet du sinistre ----------
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

drop policy if exists suro_claim_status_events_no_insert on public.suro_claim_status_events;
drop policy if exists suro_claim_status_events_no_update on public.suro_claim_status_events;
drop policy if exists suro_claim_status_events_no_delete on public.suro_claim_status_events;
create policy suro_claim_status_events_no_insert on public.suro_claim_status_events for insert to authenticated with check (false);
create policy suro_claim_status_events_no_update on public.suro_claim_status_events for update to authenticated using (false);
create policy suro_claim_status_events_no_delete on public.suro_claim_status_events for delete to authenticated using (false);

-- ---------- suro_cabinets : pas d'écriture directe ----------
drop policy if exists suro_cabinets_no_write on public.suro_cabinets;
drop policy if exists suro_cabinets_no_insert on public.suro_cabinets;
drop policy if exists suro_cabinets_no_update on public.suro_cabinets;
drop policy if exists suro_cabinets_no_delete on public.suro_cabinets;
create policy suro_cabinets_no_insert on public.suro_cabinets for insert to authenticated with check (false);
create policy suro_cabinets_no_update on public.suro_cabinets for update to authenticated using (false);
create policy suro_cabinets_no_delete on public.suro_cabinets for delete to authenticated using (false);

-- ---------- suro_cabinet_users : pas d'écriture directe ----------
drop policy if exists suro_cabinet_users_no_insert on public.suro_cabinet_users;
drop policy if exists suro_cabinet_users_no_update on public.suro_cabinet_users;
drop policy if exists suro_cabinet_users_no_delete on public.suro_cabinet_users;
create policy suro_cabinet_users_no_insert on public.suro_cabinet_users for insert to authenticated with check (false);
create policy suro_cabinet_users_no_update on public.suro_cabinet_users for update to authenticated using (false);
create policy suro_cabinet_users_no_delete on public.suro_cabinet_users for delete to authenticated using (false);

-- ---------- suro_claim_cabinet : pas d'écriture directe ----------
drop policy if exists suro_claim_cabinet_no_insert on public.suro_claim_cabinet;
drop policy if exists suro_claim_cabinet_no_update on public.suro_claim_cabinet;
drop policy if exists suro_claim_cabinet_no_delete on public.suro_claim_cabinet;
create policy suro_claim_cabinet_no_insert on public.suro_claim_cabinet for insert to authenticated with check (false);
create policy suro_claim_cabinet_no_update on public.suro_claim_cabinet for update to authenticated using (false);
create policy suro_claim_cabinet_no_delete on public.suro_claim_cabinet for delete to authenticated using (false);

-- ---------- suro_cabinet_notifications : pas d'écriture directe ----------
drop policy if exists suro_cabinet_notif_no_write on public.suro_cabinet_notifications;
create policy suro_cabinet_notif_no_insert on public.suro_cabinet_notifications for insert to authenticated with check (false);
create policy suro_cabinet_notif_no_update on public.suro_cabinet_notifications for update to authenticated using (false);
create policy suro_cabinet_notif_no_delete on public.suro_cabinet_notifications for delete to authenticated using (false);

-- ---------- Helper audit : cabinet courant via JWT uid (documenté) ----------
comment on function public.suro_cabinet_context() is
  'Résout le cabinet de l''appelant via auth.uid() → suro_cabinet_users (pas via JWT claims).';
