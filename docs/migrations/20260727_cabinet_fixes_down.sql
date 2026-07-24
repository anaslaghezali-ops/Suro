-- =====================================================================
-- ROLLBACK — 20260727_cabinet_fixes.sql
-- Restaure l'état post-20260726_operating_mode (pré-correctifs audit)
-- =====================================================================

drop function if exists public.suro_switch_operating_mode(text);

-- Restaurer suro_cabinet_try_create_task (raise si 0 cabinet)
create or replace function public.suro_cabinet_try_create_task(p_application_id uuid)
  returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_app record; v_check jsonb; v_cabinet uuid; v_assignee uuid; v_task uuid;
  v_msg text := 'Votre dossier est en cours de validation par SURO.';
begin
  if exists (select 1 from public.suro_broker_tasks where application_id = p_application_id) then return null; end if;
  select * into v_app from public.insurance_applications where id = p_application_id;
  if v_app is null or v_app.paid_at is null or v_app.status <> 'active' then return null; end if;
  v_check := public.suro_cabinet_auto_check(p_application_id);
  if not coalesce((v_check->>'passed')::boolean, false) then return null; end if;
  v_cabinet := public.suro_cabinet_pick_cabinet();
  if v_cabinet is null then raise exception 'Aucun cabinet actif'; end if;
  v_assignee := public.suro_cabinet_pick_next(v_cabinet);
  insert into public.suro_broker_tasks(application_id, cabinet_id, assigned_to, status, priority, auto_check_status, auto_check_notes)
  values (p_application_id, v_cabinet, v_assignee, 'nouveau', 'normale', 'passed', v_check) returning id into v_task;
  insert into public.suro_task_events(task_id, actor_type, action, details, client_message)
  values (v_task, 'system', 'task_created', jsonb_build_object('cabinet_id', v_cabinet, 'assigned_to', v_assignee), v_msg);
  perform public.suro_notify_customer(v_app.customer_email, 'dossier_validation', 'Dossier en cours', v_msg, 'application', p_application_id);
  perform public.suro_notify_cabinet_users(v_cabinet, 'new_task', 'Nouveau dossier', 'Un dossier client est prêt à traiter.', 'broker_task', v_task, v_assignee);
  return v_task;
end; $$;

-- Restaurer suro_courtier_enqueue_kyc_review (20260726)
create or replace function public.suro_courtier_enqueue_kyc_review(p_application_id uuid)
  returns void language plpgsql security definer set search_path to 'public' as $$
declare v_app record; v_check jsonb;
  v_msg text := 'Votre dossier est en cours de validation par SURO.';
begin
  if exists (select 1 from public.suro_notifications where audience = 'admin' and type = 'kyc_ready_for_ops'
    and ref_type = 'application' and ref_id = p_application_id) then return; end if;
  select * into v_app from public.insurance_applications where id = p_application_id;
  if v_app is null or v_app.paid_at is null or v_app.status <> 'active' then return; end if;
  v_check := public.suro_cabinet_auto_check(p_application_id);
  if not coalesce((v_check->>'passed')::boolean, false) then return; end if;
  perform public.suro_notify('admin', null, 'kyc_ready_for_ops', 'Dossier KYC complet — traitement interne',
    coalesce(v_app.customer_email, '') || ' — ' || coalesce(v_app.marque || ' ' || v_app.modele, 'véhicule') || ' — prêt pour validation Ops',
    'application', p_application_id);
  perform public.suro_notify_customer(v_app.customer_email, 'dossier_validation', 'Dossier en cours', v_msg, 'application', p_application_id);
end; $$;

-- Restaurer trigger KYC sans exception wrapper (20260726)
create or replace function public.suro_trg_kyc_complete_create_task()
  returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if public.suro_get_operating_mode() = 'courtier' then
    perform public.suro_courtier_enqueue_kyc_review(new.application_id);
  else
    perform public.suro_cabinet_try_create_task(new.application_id);
  end if;
  return new;
end; $$;

-- Restaurer trigger sinistre (20260725, sans gating mode)
create or replace function public.suro_cabinet_on_claim_created()
  returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_cabinet uuid; v_assignee uuid; v_app_id uuid;
begin
  select application_id into v_app_id from public.insurance_claims where id = new.id;
  select t.cabinet_id into v_cabinet from public.suro_broker_tasks t
    where t.application_id = v_app_id order by t.created_at desc limit 1;
  if v_cabinet is null then v_cabinet := public.suro_cabinet_pick_cabinet(); end if;
  if v_cabinet is null then return new; end if;
  v_assignee := public.suro_cabinet_pick_next(v_cabinet);
  insert into public.suro_claim_cabinet(claim_id, cabinet_id, assigned_to, broker_status)
  values (new.id, v_cabinet, v_assignee, 'dossier_recu') on conflict (claim_id) do nothing;
  insert into public.suro_claim_status_events(claim_id, to_status, actor_id, client_message)
  values (new.id, 'dossier_recu', null, 'Votre sinistre a bien été enregistré par SURO.');
  perform public.suro_notify_cabinet_users(v_cabinet, 'new_claim', 'Nouveau sinistre', 'Un sinistre client nécessite un suivi.', 'claim', new.id, v_assignee);
  return new;
end; $$;

drop function if exists public.suro_cabinet_assign_claim_intermediaire(uuid);
drop function if exists public.suro_courtier_enqueue_claim_review(uuid);
drop function if exists public.suro_log_cabinet_trigger_error(text, uuid, text, text);

-- Note : suro_cabinet_task_action et suro_cabinet_claim_set_status non restaurés ici —
-- ré-appliquer 20260725_cabinet_module.sql section 13/14 si rollback complet nécessaire.
