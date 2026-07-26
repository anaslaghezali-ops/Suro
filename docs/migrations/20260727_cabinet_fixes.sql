-- =====================================================================
-- CABINET — correctifs audit CTO (C1, M1, M2, M3)
-- À appliquer après 20260726_operating_mode.sql (+ 20260726_cabinet_rls_perf si présent)
-- N'édite PAS les migrations 20260725/20260726 déjà appliquées sur staging.
-- =====================================================================

-- ---------- Helper : journalisation erreurs trigger (ne doit jamais échouer) ----------
create or replace function public.suro_log_cabinet_trigger_error(
  p_entity text,
  p_entity_id uuid,
  p_fn text,
  p_error text)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, entity_id, changes)
  values (
    null, 'system@cabinet-trigger', 'trigger_error', p_entity, p_entity_id,
    jsonb_build_object('function', p_fn, 'error', p_error));
exception when others then
  raise warning 'suro_log_cabinet_trigger_error: %', sqlerrm;
end;
$$;

-- ---------- C1 + M2 : création tâche cabinet (pas de raise si 0 cabinet actif) ----------
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

  return v_task;
end;
$$;

-- ---------- M2 : file courtier KYC (anti double-traitement inter-mode) ----------
create or replace function public.suro_courtier_enqueue_kyc_review(p_application_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_app record;
  v_check jsonb;
  v_msg text := 'Votre dossier est en cours de validation par SURO.';
begin
  if exists (select 1 from public.suro_broker_tasks where application_id = p_application_id) then
    return;
  end if;

  if exists (
    select 1 from public.suro_notifications
    where audience = 'admin'
      and type = 'kyc_ready_for_ops'
      and ref_type = 'application'
      and ref_id = p_application_id
  ) then
    return;
  end if;

  select * into v_app from public.insurance_applications where id = p_application_id;
  if v_app is null or v_app.paid_at is null or v_app.status <> 'active' then
    return;
  end if;

  v_check := public.suro_cabinet_auto_check(p_application_id);
  if not coalesce((v_check->>'passed')::boolean, false) then
    return;
  end if;

  perform public.suro_notify(
    'admin', null, 'kyc_ready_for_ops',
    'Dossier KYC complet — traitement interne',
    coalesce(v_app.customer_email, '') || ' — ' ||
      coalesce(v_app.marque || ' ' || v_app.modele, 'véhicule') ||
      ' — prêt pour validation Ops',
    'application', p_application_id);

  perform public.suro_notify_customer(
    v_app.customer_email, 'dossier_validation', 'Dossier en cours', v_msg,
    'application', p_application_id);
end;
$$;

-- ---------- C1 : trigger KYC — isolation erreurs + routage mode ----------
create or replace function public.suro_trg_kyc_complete_create_task()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  begin
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

-- ---------- M1 : sinistres — assignation cabinet (intermédiaire) ----------
create or replace function public.suro_cabinet_assign_claim_intermediaire(p_claim_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_cabinet uuid;
  v_assignee uuid;
  v_app_id uuid;
  v_msg text := 'Votre sinistre a bien été enregistré par SURO.';
begin
  if exists (select 1 from public.suro_claim_cabinet where claim_id = p_claim_id) then
    return;
  end if;

  select application_id into v_app_id from public.insurance_claims where id = p_claim_id;

  select t.cabinet_id into v_cabinet
  from public.suro_broker_tasks t
  where t.application_id = v_app_id
  order by t.created_at desc
  limit 1;

  if v_cabinet is null then
    v_cabinet := public.suro_cabinet_pick_cabinet();
  end if;

  if v_cabinet is null then
    perform public.suro_notify(
      'admin', null, 'cabinet_unassigned',
      'Sinistre sans cabinet actif',
      'Sinistre ' || p_claim_id::text || ' — en attente d''assignation cabinet',
      'claim', p_claim_id);
    return;
  end if;

  v_assignee := public.suro_cabinet_pick_next(v_cabinet);

  insert into public.suro_claim_cabinet(claim_id, cabinet_id, assigned_to, broker_status)
  values (p_claim_id, v_cabinet, v_assignee, 'dossier_recu')
  on conflict (claim_id) do nothing;

  insert into public.suro_claim_status_events(claim_id, to_status, actor_id, client_message)
  values (p_claim_id, 'dossier_recu', null, v_msg);

  perform public.suro_notify_cabinet_users(
    v_cabinet, 'new_claim', 'Nouveau sinistre', 'Un sinistre client nécessite un suivi.',
    'claim', p_claim_id, v_assignee);
end;
$$;

-- ---------- M1 : sinistres — file Ops (courtier) ----------
create or replace function public.suro_courtier_enqueue_claim_review(p_claim_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_email text;
  v_msg text := 'Votre sinistre a bien été enregistré par SURO. Notre équipe le traite.';
begin
  if exists (select 1 from public.suro_claim_cabinet where claim_id = p_claim_id) then
    return;
  end if;

  if exists (
    select 1 from public.suro_notifications
    where audience = 'admin'
      and type = 'claim_ready_for_ops'
      and ref_type = 'claim'
      and ref_id = p_claim_id
  ) then
    return;
  end if;

  select a.customer_email into v_email
  from public.insurance_claims c
  join public.insurance_applications a on a.id = c.application_id
  where c.id = p_claim_id;

  perform public.suro_notify(
    'admin', null, 'claim_ready_for_ops',
    'Sinistre — traitement interne Ops',
    'Sinistre client — prêt pour traitement Ops',
    'claim', p_claim_id);

  if v_email is not null then
    perform public.suro_notify_customer(
      v_email, 'sinistre_enregistre', 'Sinistre enregistré', v_msg,
      'claim', p_claim_id);
  end if;
end;
$$;

-- ---------- C1 + M1 : trigger sinistre — routage mode + isolation erreurs ----------
create or replace function public.suro_cabinet_on_claim_created()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  begin
    if public.suro_get_operating_mode() = 'courtier' then
      perform public.suro_courtier_enqueue_claim_review(new.id);
    else
      perform public.suro_cabinet_assign_claim_intermediaire(new.id);
    end if;
  exception when others then
    raise warning 'suro_trg_claim_cabinet claim=%: %', new.id, sqlerrm;
    perform public.suro_log_cabinet_trigger_error(
      'insurance_claims', new.id, 'suro_cabinet_on_claim_created', sqlerrm);
  end;
  return new;
end;
$$;

-- ---------- M3 : actions cabinet — templates SURO fixes vers le client ----------
create or replace function public.suro_cabinet_task_action(
  p_task_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_task record;
  v_app record;
  v_ctx record;
  v_msg text;
  v_new_status text;
  v_event_details jsonb;
begin
  select * into v_ctx from public.suro_cabinet_context();
  if v_ctx.cabinet_id is null and not public.is_suro_staff() then
    raise exception 'Non autorisé';
  end if;

  select t.* into v_task from public.suro_broker_tasks t where t.id = p_task_id;
  if v_task is null then raise exception 'Dossier introuvable'; end if;
  if not public.is_suro_staff() and v_task.cabinet_id <> v_ctx.cabinet_id then
    raise exception 'Accès refusé';
  end if;

  select * into v_app from public.insurance_applications where id = v_task.application_id;
  v_event_details := coalesce(p_payload, '{}'::jsonb);

  case p_action
    when 'prendre_en_charge' then
      v_new_status := 'en_cours';
      v_msg := 'Votre dossier est en cours de validation par SURO.';
      update public.suro_broker_tasks
        set status = v_new_status, assigned_to = coalesce(assigned_to, auth.uid()), updated_at = now()
        where id = p_task_id;

    when 'valider' then
      v_new_status := 'valide';
      v_msg := 'Votre dossier a été validé par SURO.';
      update public.suro_broker_tasks set status = v_new_status, updated_at = now() where id = p_task_id;

    when 'demander_pieces' then
      v_new_status := 'pieces_manquantes';
      v_msg := 'SURO a besoin de documents complémentaires pour finaliser votre dossier.';
      v_event_details := v_event_details || jsonb_build_object(
        'cabinet_internal_note', nullif(trim(coalesce(p_payload->>'message', '')), ''));
      update public.suro_broker_tasks set status = v_new_status, updated_at = now() where id = p_task_id;

    when 'refuser' then
      v_new_status := 'refuse';
      v_msg := 'Votre dossier n''a pas pu être traité. L''équipe SURO vous contactera.';
      update public.suro_broker_tasks set status = v_new_status, updated_at = now(), completed_at = now() where id = p_task_id;

    when 'emettre_police' then
      v_new_status := 'police_emise';
      v_msg := 'Votre contrat est prêt. Consultez votre espace client SURO.';
      if coalesce(p_payload->>'policy_number', '') <> '' then
        update public.insurance_applications
          set policy_number = p_payload->>'policy_number'
          where id = v_task.application_id;
      end if;
      update public.suro_broker_tasks set status = v_new_status, updated_at = now(), completed_at = now() where id = p_task_id;

    when 'anomalie' then
      v_new_status := 'anomalie';
      v_msg := null;
      update public.suro_broker_tasks
        set status = v_new_status, anomaly_flag = true,
            anomaly_note = p_payload->>'note', updated_at = now()
        where id = p_task_id;
      insert into public.suro_notifications(audience, user_email, type, title, body, ref_type, ref_id)
      values ('admin', null, 'cabinet_anomaly', 'Anomalie cabinet',
              coalesce(p_payload->>'note', 'Anomalie signalée'), 'broker_task', p_task_id);

    when 'reassigner' then
      if not public.suro_cabinet_can_manage_team() and not public.is_suro_staff() then
        raise exception 'Non autorisé';
      end if;
      update public.suro_broker_tasks
        set assigned_to = (p_payload->>'user_id')::uuid, updated_at = now()
        where id = p_task_id;
      v_new_status := v_task.status;
      v_msg := null;

    else raise exception 'Action inconnue : %', p_action;
  end case;

  insert into public.suro_task_events(task_id, actor_id, actor_type, action, details, client_message)
  values (p_task_id, auth.uid(),
          case when public.is_suro_staff() then 'suro_staff' else 'cabinet_user' end,
          p_action, v_event_details, v_msg);

  if v_msg is not null and v_app.customer_email is not null then
    perform public.suro_notify_customer(
      v_app.customer_email, 'dossier_' || p_action, 'Mise à jour dossier', v_msg,
      'application', v_task.application_id);
  end if;

  return 'ok';
end;
$$;

-- ---------- M3 : statut sinistre — template SURO au client, note libre interne ----------
create or replace function public.suro_cabinet_claim_set_status(
  p_claim_id uuid,
  p_status text,
  p_message text default null)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_cc record;
  v_ctx record;
  v_msg_client text;
  v_msg_internal text;
  v_app_email text;
begin
  select * into v_ctx from public.suro_cabinet_context();
  select * into v_cc from public.suro_claim_cabinet where claim_id = p_claim_id;
  if v_cc is null then raise exception 'Sinistre non assigné'; end if;
  if not public.is_suro_staff() and v_cc.cabinet_id <> v_ctx.cabinet_id then
    raise exception 'Accès refusé';
  end if;

  v_msg_client := case p_status
    when 'dossier_recu' then 'Votre sinistre a bien été enregistré par SURO.'
    when 'pieces_manquantes' then 'SURO a besoin de documents complémentaires pour votre sinistre.'
    when 'transmis_compagnie' then 'Votre dossier sinistre est en cours de traitement par SURO.'
    when 'expertise_programmee' then 'Une expertise a été planifiée pour votre sinistre.'
    when 'attente_compagnie' then 'SURO attend la réponse de l''assureur pour votre sinistre.'
    when 'indemnisation_en_cours' then 'Votre indemnisation est en cours de traitement par SURO.'
    when 'cloture' then 'Votre sinistre a été clôturé par SURO.'
    else 'Mise à jour de votre sinistre par SURO.'
  end;

  v_msg_internal := nullif(trim(coalesce(p_message, '')), '');

  update public.suro_claim_cabinet
    set broker_status = p_status, updated_at = now()
    where claim_id = p_claim_id;

  insert into public.suro_claim_status_events(claim_id, from_status, to_status, actor_id, client_message)
  values (p_claim_id, v_cc.broker_status, p_status, auth.uid(), v_msg_internal);

  select a.customer_email into v_app_email
  from public.insurance_claims c
  join public.insurance_applications a on a.id = c.application_id
  where c.id = p_claim_id;

  if v_app_email is not null then
    perform public.suro_notify_customer(
      v_app_email, 'sinistre_statut', 'Sinistre — mise à jour', v_msg_client, 'claim', p_claim_id);
  end if;

  return 'ok';
end;
$$;

-- ---------- M2 : bascule operating_mode (staff-only, garde-fous) ----------
create or replace function public.suro_switch_operating_mode(p_mode text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_current text;
  v_open_tasks bigint := 0;
  v_open_claims bigint := 0;
  v_pending_kyc bigint := 0;
  v_pending_claims bigint := 0;
begin
  if not public.suro_has_role(array['super_admin', 'admin']::public.suro_role[]) then
    raise exception 'Réservé aux admins SURO';
  end if;

  if p_mode not in ('intermediaire', 'courtier') then
    raise exception 'Mode invalide : %', p_mode;
  end if;

  v_current := public.suro_get_operating_mode();
  if v_current = p_mode then
    return jsonb_build_object('ok', true, 'mode', p_mode, 'unchanged', true);
  end if;

  if p_mode = 'courtier' then
    select count(*) into v_open_tasks
    from public.suro_broker_tasks
    where status not in ('police_emise', 'refuse', 'cloture');

    select count(*) into v_open_claims
    from public.suro_claim_cabinet
    where broker_status <> 'cloture';

    if v_open_tasks > 0 or v_open_claims > 0 then
      return jsonb_build_object(
        'ok', false,
        'error', 'open_intermediaire_work',
        'message', 'Clôturer ou terminer les dossiers/sinistres cabinet avant bascule courtier.',
        'open_tasks', v_open_tasks,
        'open_claims', v_open_claims);
    end if;
  else
    select count(*) into v_pending_kyc
    from public.suro_notifications n
    where n.audience = 'admin'
      and n.type = 'kyc_ready_for_ops'
      and n.ref_type = 'application'
      and not exists (
        select 1 from public.suro_broker_tasks t
        where t.application_id = n.ref_id
          and t.status in ('police_emise', 'refuse', 'cloture')
      );

    select count(*) into v_pending_claims
    from public.suro_notifications n
    where n.audience = 'admin'
      and n.type = 'claim_ready_for_ops'
      and n.ref_type = 'claim'
      and not exists (
        select 1 from public.suro_claim_cabinet cc
        where cc.claim_id = n.ref_id
          and cc.broker_status = 'cloture'
      );

    if v_pending_kyc > 0 or v_pending_claims > 0 then
      return jsonb_build_object(
        'ok', false,
        'error', 'open_courtier_work',
        'message', 'Traiter les dossiers/sinistres Ops en cours avant bascule intermédiaire.',
        'pending_kyc', v_pending_kyc,
        'pending_claims', v_pending_claims);
    end if;
  end if;

  insert into public.suro_settings (key, value, updated_at)
  values ('operating_mode', p_mode, now())
  on conflict (key) do update
    set value = excluded.value, updated_at = excluded.updated_at;

  insert into public.suro_audit_log(actor_id, actor_email, action, entity, changes)
  values (
    auth.uid(), coalesce(auth.jwt() ->> 'email', ''),
    'update', 'settings',
    jsonb_build_object('operating_mode', p_mode, 'previous', v_current));

  return jsonb_build_object('ok', true, 'mode', p_mode, 'previous', v_current);
end;
$$;

revoke all on function public.suro_switch_operating_mode(text) from public;
grant execute on function public.suro_switch_operating_mode(text) to authenticated;

revoke all on function public.suro_log_cabinet_trigger_error(text, uuid, text, text) from public;
