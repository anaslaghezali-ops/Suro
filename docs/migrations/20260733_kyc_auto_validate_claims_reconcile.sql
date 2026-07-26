-- =====================================================================
-- KYC auto-validation identité héritée + réconciliation sinistres cabinet
-- =====================================================================

-- Copie CIN/permis déjà validés vers le contrat courant (statut approved)
create or replace function public.suro_kyc_sync_inherited_identity(p_application_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_email text;
  v_rec record;
begin
  select lower(customer_email) into v_email
  from public.insurance_applications
  where id = p_application_id;

  if v_email is null then
    return;
  end if;

  for v_rec in
    select distinct on (d.document_type, d.document_side)
           d.document_type, d.document_side, d.name, d.storage_path,
           d.reviewed_by, d.reviewed_at
    from public.insurance_documents d
    where lower(d.customer_email) = v_email
      and d.document_type in ('cin', 'permis')
      and d.status = 'approved'
      and coalesce(d.storage_path, '') <> ''
      and d.application_id <> p_application_id
    order by d.document_type, d.document_side,
             d.reviewed_at desc nulls last, d.created_at desc
  loop
    if not exists (
      select 1 from public.insurance_documents d2
      where d2.application_id = p_application_id
        and d2.document_type = v_rec.document_type
        and d2.document_side = v_rec.document_side
    ) then
      insert into public.insurance_documents (
        application_id, customer_email, name, storage_path,
        document_type, document_side, status, reviewed_by, reviewed_at
      ) values (
        p_application_id, v_email, v_rec.name, v_rec.storage_path,
        v_rec.document_type, v_rec.document_side, 'approved',
        v_rec.reviewed_by, v_rec.reviewed_at
      );
    else
      update public.insurance_documents d2
      set status = 'approved',
          storage_path = v_rec.storage_path,
          name = v_rec.name,
          reviewed_by = v_rec.reviewed_by,
          reviewed_at = v_rec.reviewed_at
      where d2.application_id = p_application_id
        and d2.document_type = v_rec.document_type
        and d2.document_side = v_rec.document_side
        and d2.status <> 'approved';
    end if;
  end loop;
end;
$$;

revoke all on function public.suro_kyc_sync_inherited_identity(uuid) from public;
grant execute on function public.suro_kyc_sync_inherited_identity(uuid) to authenticated;

-- Assigne / réaligne les sinistres sur le cabinet de la souscription
create or replace function public.suro_cabinet_reconcile_claims_for_application(p_application_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_cabinet uuid;
  v_assignee uuid;
  v_claim record;
begin
  select t.cabinet_id into v_cabinet
  from public.suro_broker_tasks t
  where t.application_id = p_application_id
  order by t.created_at desc
  limit 1;

  for v_claim in
    select c.id
    from public.insurance_claims c
    left join public.suro_claim_cabinet cc on cc.claim_id = c.id
    where c.application_id = p_application_id
      and cc.claim_id is null
  loop
    perform public.suro_cabinet_assign_claim_intermediaire(v_claim.id);
  end loop;

  if v_cabinet is null then
    return;
  end if;

  v_assignee := public.suro_cabinet_pick_next(v_cabinet);

  update public.suro_claim_cabinet cc
  set cabinet_id = v_cabinet,
      assigned_to = coalesce(cc.assigned_to, v_assignee),
      updated_at = now()
  from public.insurance_claims c
  where c.id = cc.claim_id
    and c.application_id = p_application_id
    and cc.cabinet_id <> v_cabinet;
end;
$$;

revoke all on function public.suro_cabinet_reconcile_claims_for_application(uuid) from public;
grant execute on function public.suro_cabinet_reconcile_claims_for_application(uuid) to authenticated;

-- Trigger KYC : hériter identité validée avant création tâche
create or replace function public.suro_trg_kyc_complete_create_task()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  begin
    perform public.suro_kyc_sync_inherited_identity(new.application_id);

    if public.suro_get_operating_mode() = 'courtier' then
      perform public.suro_courtier_enqueue_kyc_review(new.application_id);
    else
      perform public.suro_cabinet_try_create_task(new.application_id);
    end if;
  exception when others then
    raise warning 'suro_trg_kyc_task application=%: %', new.application_id, sqlerrm;
    perform public.suro_log_cabinet_trigger_error(
      'insurance_documents', new.id, 'suro_trg_kyc_complete_create_task', sqlerrm);
  end;
  return new;
end;
$$;

-- Création tâche : réconcilier sinistres du même contrat
create or replace function public.suro_cabinet_try_create_task(p_application_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_app record;
  v_check jsonb;
  v_cabinet uuid;
  v_assignee uuid;
  v_task uuid;
  v_msg text := 'Votre dossier est en cours de validation par SURO.';
begin
  if exists (select 1 from public.suro_broker_tasks where application_id = p_application_id) then
    perform public.suro_cabinet_reconcile_claims_for_application(p_application_id);
    return null;
  end if;

  select * into v_app from public.insurance_applications where id = p_application_id;
  if v_app is null or v_app.paid_at is null or v_app.status <> 'active' then
    return null;
  end if;

  v_check := public.suro_cabinet_auto_check(p_application_id);
  if not coalesce((v_check->>'passed')::boolean, false) then
    return null;
  end if;

  v_cabinet := public.suro_cabinet_pick_cabinet();
  if v_cabinet is null then
    perform public.suro_notify(
      'admin', null, 'cabinet_unassigned',
      'Dossier sans cabinet actif',
      coalesce(v_app.customer_email, '') || ' — ' ||
        coalesce(v_app.marque || ' ' || v_app.modele, 'véhicule') ||
        ' — KYC complet, en attente d''assignation cabinet',
      'application', p_application_id);
    return null;
  end if;

  v_assignee := public.suro_cabinet_pick_next(v_cabinet);

  insert into public.suro_broker_tasks(
    application_id, cabinet_id, assigned_to, status, priority,
    auto_check_status, auto_check_notes
  ) values (
    p_application_id, v_cabinet, v_assignee, 'nouveau', 'normale',
    'passed', v_check
  ) returning id into v_task;

  insert into public.suro_task_events(task_id, actor_type, action, details, client_message)
  values (v_task, 'system', 'task_created',
          jsonb_build_object('cabinet_id', v_cabinet, 'assigned_to', v_assignee),
          v_msg);

  perform public.suro_notify_customer(
    v_app.customer_email, 'dossier_validation', 'Dossier en cours', v_msg,
    'application', p_application_id);

  perform public.suro_notify_cabinet_users(
    v_cabinet, 'new_task', 'Nouveau dossier',
    'Un dossier client est prêt à traiter.',
    'broker_task', v_task, v_assignee);

  perform public.suro_cabinet_reconcile_claims_for_application(p_application_id);

  return v_task;
end;
$$;

-- Backfill : identité héritée sur contrats actifs
do $$
declare v_app uuid;
begin
  for v_app in
    select id from public.insurance_applications
    where status = 'active' and paid_at is not null
  loop
    perform public.suro_kyc_sync_inherited_identity(v_app);
  end loop;
end;
$$;

-- Backfill : sinistres non assignés
do $$
declare v_claim uuid;
begin
  for v_claim in
    select c.id
    from public.insurance_claims c
    where not exists (
      select 1 from public.suro_claim_cabinet cc where cc.claim_id = c.id
    )
  loop
    perform public.suro_cabinet_assign_claim_intermediaire(v_claim);
  end loop;
end;
$$;

-- Backfill : réaligner sinistres sur cabinet souscription
do $$
declare v_app uuid;
begin
  for v_app in
    select distinct application_id from public.suro_broker_tasks
  loop
    perform public.suro_cabinet_reconcile_claims_for_application(v_app);
  end loop;
end;
$$;
