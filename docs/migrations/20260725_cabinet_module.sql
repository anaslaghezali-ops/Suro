-- =====================================================================
-- MODULE CABINET PARTENAIRE — 100 % ADDITIF
-- À appliquer UNIQUEMENT sur le projet Supabase STAGING en premier.
-- Prod (eprtmdugiusidtbwzozj) : ne pas appliquer avant validation complète.
--
-- Nouvelles tables uniquement — aucune modification destructive des tables
-- existantes (insurance_applications, insurance_claims, suro_admins…).
-- Les RPC cabinet modifient insurance_applications.policy_number via
-- SECURITY DEFINER (même pattern que le portail Ops existant).
-- =====================================================================

-- ---------- 1. Types ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'suro_cabinet_role') then
    create type public.suro_cabinet_role as enum (
      'admin_cabinet', 'responsable', 'gestionnaire'
    );
  end if;
end $$;

-- ---------- 2. Cabinets ----------
create table if not exists public.suro_cabinets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  is_active     boolean not null default true,
  last_task_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists suro_cabinets_active_idx
  on public.suro_cabinets (is_active) where is_active = true;

-- ---------- 3. Utilisateurs cabinet ----------
create table if not exists public.suro_cabinet_users (
  id               uuid primary key default gen_random_uuid(),
  cabinet_id       uuid not null references public.suro_cabinets(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             public.suro_cabinet_role not null default 'gestionnaire',
  is_active        boolean not null default true,
  last_assigned_at timestamptz,
  display_name     text,
  created_at       timestamptz not null default now(),
  unique (cabinet_id, user_id)
);

create index if not exists suro_cabinet_users_user_idx
  on public.suro_cabinet_users (user_id) where is_active = true;

create index if not exists suro_cabinet_users_cabinet_idx
  on public.suro_cabinet_users (cabinet_id) where is_active = true;

-- ---------- 4. Tâches souscription (post-KYC) ----------
create table if not exists public.suro_broker_tasks (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null unique references public.insurance_applications(id) on delete cascade,
  cabinet_id        uuid not null references public.suro_cabinets(id),
  assigned_to       uuid references auth.users(id),
  status            text not null default 'nouveau',
  priority          text not null default 'normale',
  auto_check_status text,
  auto_check_notes  jsonb,
  anomaly_flag      boolean not null default false,
  anomaly_note      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz,
  constraint suro_broker_tasks_status_check check (
    status in (
      'nouveau', 'en_cours', 'pieces_manquantes', 'valide',
      'refuse', 'police_emise', 'anomalie', 'cloture'
    )
  ),
  constraint suro_broker_tasks_priority_check check (
    priority in ('basse', 'normale', 'haute', 'urgente')
  )
);

create index if not exists suro_broker_tasks_cabinet_status_idx
  on public.suro_broker_tasks (cabinet_id, status, created_at desc);

create index if not exists suro_broker_tasks_assigned_idx
  on public.suro_broker_tasks (assigned_to, status) where assigned_to is not null;

-- ---------- 5. Timeline tâches ----------
create table if not exists public.suro_task_events (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.suro_broker_tasks(id) on delete cascade,
  actor_id        uuid,
  actor_type      text not null default 'system',
  action          text not null,
  details         jsonb,
  client_message  text,
  created_at      timestamptz not null default now(),
  constraint suro_task_events_actor_type_check check (
    actor_type in ('system', 'cabinet_user', 'suro_staff')
  )
);

create index if not exists suro_task_events_task_idx
  on public.suro_task_events (task_id, created_at desc);

-- ---------- 6. Sinistres — workflow cabinet ----------
create table if not exists public.suro_claim_cabinet (
  claim_id        uuid primary key references public.insurance_claims(id) on delete cascade,
  cabinet_id      uuid not null references public.suro_cabinets(id),
  assigned_to     uuid references auth.users(id),
  broker_status   text not null default 'dossier_recu',
  updated_at      timestamptz not null default now(),
  constraint suro_claim_cabinet_status_check check (
    broker_status in (
      'dossier_recu', 'pieces_manquantes', 'transmis_compagnie',
      'expertise_programmee', 'attente_compagnie',
      'indemnisation_en_cours', 'cloture'
    )
  )
);

create table if not exists public.suro_claim_status_events (
  id              uuid primary key default gen_random_uuid(),
  claim_id        uuid not null references public.insurance_claims(id) on delete cascade,
  from_status     text,
  to_status       text not null,
  actor_id        uuid,
  client_message  text,
  created_at      timestamptz not null default now()
);

create index if not exists suro_claim_status_events_claim_idx
  on public.suro_claim_status_events (claim_id, created_at desc);

-- ---------- 7. Notifications cabinet ----------
create table if not exists public.suro_cabinet_notifications (
  id          uuid primary key default gen_random_uuid(),
  cabinet_id  uuid not null references public.suro_cabinets(id) on delete cascade,
  user_id     uuid references auth.users(id),
  type        text not null,
  title       text not null,
  body        text,
  ref_type    text,
  ref_id      uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists suro_cabinet_notif_user_idx
  on public.suro_cabinet_notifications (user_id, read_at, created_at desc);

-- ---------- 8. Helpers identité ----------
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

-- ---------- 9. Round-robin ----------
create or replace function public.suro_cabinet_pick_next(p_cabinet_id uuid)
  returns uuid
  language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid;
begin
  select cu.user_id into v_user
  from public.suro_cabinet_users cu
  where cu.cabinet_id = p_cabinet_id
    and cu.is_active = true
    and cu.role in ('gestionnaire', 'responsable', 'admin_cabinet')
  order by cu.last_assigned_at nulls first, cu.created_at
  limit 1;

  if v_user is not null then
    update public.suro_cabinet_users
      set last_assigned_at = now()
      where cabinet_id = p_cabinet_id and user_id = v_user;
  end if;
  return v_user;
end;
$$;

create or replace function public.suro_cabinet_pick_cabinet()
  returns uuid
  language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  select id into v_id
  from public.suro_cabinets
  where is_active = true
  order by last_task_at nulls first, created_at
  limit 1;

  if v_id is not null then
    update public.suro_cabinets set last_task_at = now(), updated_at = now() where id = v_id;
  end if;
  return v_id;
end;
$$;

-- ---------- 10. Auto-check (sans OCR) ----------
create or replace function public.suro_cabinet_auto_check(p_application_id uuid)
  returns jsonb
  language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_count int;
  v_missing text[];
  v_notes jsonb := '[]'::jsonb;
  v_slot text;
  v_slots text[] := array[
    'cin:recto','cin:verso','permis:recto','permis:verso',
    'carte_grise:recto','carte_grise:verso'
  ];
begin
  foreach v_slot in array v_slots loop
    if not exists (
      select 1 from public.insurance_documents d
      where d.application_id = p_application_id
        and d.document_type = split_part(v_slot, ':', 1)
        and d.document_side = split_part(v_slot, ':', 2)
    ) then
      v_missing := array_append(v_missing, v_slot);
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    return jsonb_build_object(
      'passed', false,
      'reason', 'documents_manquants',
      'missing', to_jsonb(v_missing)
    );
  end if;

  -- Qualité basique : présence storage_path (pas d'OCR)
  if exists (
    select 1 from public.insurance_documents d
    where d.application_id = p_application_id
      and d.document_type is not null
      and (d.storage_path is null or d.storage_path = '')
  ) then
    return jsonb_build_object('passed', false, 'reason', 'fichier_invalide');
  end if;

  return jsonb_build_object('passed', true, 'reason', 'ok', 'checked_at', now());
end;
$$;

-- ---------- 11. Notification client (messages SURO) ----------
create or replace function public.suro_notify_customer(
  p_email text, p_type text, p_title text, p_body text,
  p_ref_type text default null, p_ref_id uuid default null)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.suro_notifications(audience, user_email, type, title, body, ref_type, ref_id)
  values ('customer', lower(trim(p_email)), p_type, p_title, p_body, p_ref_type, p_ref_id);
end;
$$;

create or replace function public.suro_notify_cabinet_users(
  p_cabinet_id uuid, p_type text, p_title text, p_body text,
  p_ref_type text default null, p_ref_id uuid default null,
  p_user_id uuid default null)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.suro_cabinet_notifications(cabinet_id, user_id, type, title, body, ref_type, ref_id)
  select p_cabinet_id,
         case when p_user_id is not null then p_user_id else cu.user_id end,
         p_type, p_title, p_body, p_ref_type, p_ref_id
  from public.suro_cabinet_users cu
  where cu.cabinet_id = p_cabinet_id
    and cu.is_active = true
    and (p_user_id is null or cu.user_id = p_user_id);
end;
$$;

-- ---------- 12. Création tâche ----------
create or replace function public.suro_cabinet_try_create_task(p_application_id uuid)
  returns uuid
  language plpgsql security definer set search_path to 'public' as $$
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
    raise exception 'Aucun cabinet actif';
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

-- Trigger : 6 pièces KYC déposées → création tâche
create or replace function public.suro_trg_kyc_complete_create_task()
  returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.suro_cabinet_try_create_task(new.application_id);
  return new;
end;
$$;

drop trigger if exists suro_trg_kyc_task on public.insurance_documents;
create trigger suro_trg_kyc_task
  after insert on public.insurance_documents
  for each row
  when (new.document_type is not null)
  execute function public.suro_trg_kyc_complete_create_task();

-- ---------- 13. Actions cabinet sur tâche ----------
create or replace function public.suro_cabinet_task_action(
  p_task_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb)
  returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_task record;
  v_app record;
  v_ctx record;
  v_msg text;
  v_new_status text;
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
      v_msg := coalesce(p_payload->>'message',
        'SURO a besoin de documents complémentaires pour finaliser votre dossier.');
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
          p_action, p_payload, v_msg);

  if v_msg is not null and v_app.customer_email is not null then
    perform public.suro_notify_customer(
      v_app.customer_email, 'dossier_' || p_action, 'Mise à jour dossier', v_msg,
      'application', v_task.application_id);
  end if;

  return 'ok';
end;
$$;

-- ---------- 14. Sinistre cabinet ----------
create or replace function public.suro_cabinet_on_claim_created()
  returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_cabinet uuid;
  v_assignee uuid;
  v_app_id uuid;
begin
  select application_id into v_app_id from public.insurance_claims where id = new.id;

  select t.cabinet_id into v_cabinet
  from public.suro_broker_tasks t
  where t.application_id = v_app_id
  order by t.created_at desc limit 1;

  if v_cabinet is null then
    v_cabinet := public.suro_cabinet_pick_cabinet();
  end if;
  if v_cabinet is null then return new; end if;

  v_assignee := public.suro_cabinet_pick_next(v_cabinet);

  insert into public.suro_claim_cabinet(claim_id, cabinet_id, assigned_to, broker_status)
  values (new.id, v_cabinet, v_assignee, 'dossier_recu')
  on conflict (claim_id) do nothing;

  insert into public.suro_claim_status_events(claim_id, to_status, actor_id, client_message)
  values (new.id, 'dossier_recu', null, 'Votre sinistre a bien été enregistré par SURO.');

  perform public.suro_notify_cabinet_users(
    v_cabinet, 'new_claim', 'Nouveau sinistre', 'Un sinistre client nécessite un suivi.',
    'claim', new.id, v_assignee);

  return new;
end;
$$;

drop trigger if exists suro_trg_claim_cabinet on public.insurance_claims;
create trigger suro_trg_claim_cabinet
  after insert on public.insurance_claims
  for each row execute function public.suro_cabinet_on_claim_created();

create or replace function public.suro_cabinet_claim_set_status(
  p_claim_id uuid, p_status text, p_message text default null)
  returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_cc record;
  v_ctx record;
  v_msg text;
  v_app_email text;
begin
  select * into v_ctx from public.suro_cabinet_context();
  select * into v_cc from public.suro_claim_cabinet where claim_id = p_claim_id;
  if v_cc is null then raise exception 'Sinistre non assigné'; end if;
  if not public.is_suro_staff() and v_cc.cabinet_id <> v_ctx.cabinet_id then
    raise exception 'Accès refusé';
  end if;

  v_msg := coalesce(p_message, case p_status
    when 'dossier_recu' then 'Votre sinistre a bien été enregistré par SURO.'
    when 'pieces_manquantes' then 'SURO a besoin de documents complémentaires pour votre sinistre.'
    when 'transmis_compagnie' then 'Votre dossier sinistre est en cours de traitement par SURO.'
    when 'expertise_programmee' then 'Une expertise a été planifiée pour votre sinistre.'
    when 'attente_compagnie' then 'SURO attend la réponse de l''assureur pour votre sinistre.'
    when 'indemnisation_en_cours' then 'Votre indemnisation est en cours de traitement par SURO.'
    when 'cloture' then 'Votre sinistre a été clôturé par SURO.'
    else 'Mise à jour de votre sinistre par SURO.'
  end);

  update public.suro_claim_cabinet
    set broker_status = p_status, updated_at = now()
    where claim_id = p_claim_id;

  insert into public.suro_claim_status_events(claim_id, from_status, to_status, actor_id, client_message)
  values (p_claim_id, v_cc.broker_status, p_status, auth.uid(), v_msg);

  select a.customer_email into v_app_email
  from public.insurance_claims c
  join public.insurance_applications a on a.id = c.application_id
  where c.id = p_claim_id;

  if v_app_email is not null then
    perform public.suro_notify_customer(
      v_app_email, 'sinistre_statut', 'Sinistre — mise à jour', v_msg, 'claim', p_claim_id);
  end if;

  return 'ok';
end;
$$;

-- ---------- 15. Listes (portails) ----------
create or replace function public.suro_cabinet_list_tasks(
  p_status text default null, p_limit int default 50, p_offset int default 0)
  returns table(
    task_id uuid, application_id uuid, status text, priority text,
    assigned_to uuid, created_at timestamptz, updated_at timestamptz,
    customer_name text, customer_email text, immatriculation text,
    marque text, modele text, coverage_type text, annual_premium numeric,
    anomaly_flag boolean
  ) language plpgsql stable security definer set search_path to 'public' as $$
declare v_cabinet uuid;
begin
  select cabinet_id into v_cabinet from public.suro_cabinet_context();
  if v_cabinet is null then raise exception 'Non autorisé'; end if;

  return query
  select t.id, t.application_id, t.status, t.priority, t.assigned_to,
         t.created_at, t.updated_at,
         a.customer_name, a.customer_email, a.immatriculation,
         a.marque, a.modele, a.coverage_type, a.annual_premium,
         t.anomaly_flag
  from public.suro_broker_tasks t
  join public.insurance_applications a on a.id = t.application_id
  where t.cabinet_id = v_cabinet
    and (p_status is null or t.status = p_status)
  order by
    case t.priority when 'urgente' then 0 when 'haute' then 1 when 'normale' then 2 else 3 end,
    t.created_at desc
  limit least(coalesce(p_limit, 50), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.suro_cabinet_list_claims(
  p_status text default null, p_limit int default 50, p_offset int default 0)
  returns table(
    claim_id uuid, application_id uuid, broker_status text,
    claim_type text, claim_date date, created_at timestamptz,
    customer_name text, immatriculation text, assigned_to uuid
  ) language plpgsql stable security definer set search_path to 'public' as $$
declare v_cabinet uuid;
begin
  select cabinet_id into v_cabinet from public.suro_cabinet_context();
  if v_cabinet is null then raise exception 'Non autorisé'; end if;

  return query
  select c.id, c.application_id, cc.broker_status,
         c.claim_type, c.claim_date, c.created_at,
         a.customer_name, a.immatriculation, cc.assigned_to
  from public.suro_claim_cabinet cc
  join public.insurance_claims c on c.id = cc.claim_id
  join public.insurance_applications a on a.id = c.application_id
  where cc.cabinet_id = v_cabinet
    and (p_status is null or cc.broker_status = p_status)
  order by cc.updated_at desc
  limit least(coalesce(p_limit, 50), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Supervision Ops
create or replace function public.suro_ops_cabinet_overview()
  returns table(
    cabinet_id uuid, cabinet_name text, is_active boolean,
    tasks_open bigint, tasks_anomaly bigint, claims_open bigint,
    avg_task_age_hours numeric
  ) language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_suro_staff() then raise exception 'Réservé au staff SURO'; end if;
  return query
  select c.id, c.name, c.is_active,
    (select count(*) from public.suro_broker_tasks t
     where t.cabinet_id = c.id and t.status not in ('police_emise','refuse','cloture')),
    (select count(*) from public.suro_broker_tasks t
     where t.cabinet_id = c.id and t.anomaly_flag = true),
    (select count(*) from public.suro_claim_cabinet cc
     where cc.cabinet_id = c.id and cc.broker_status <> 'cloture'),
    (select round(avg(extract(epoch from (now() - t.created_at)) / 3600)::numeric, 1)
     from public.suro_broker_tasks t
     where t.cabinet_id = c.id and t.status not in ('police_emise','refuse','cloture'))
  from public.suro_cabinets c
  order by c.name;
end;
$$;

create or replace function public.suro_ops_list_cabinet_anomalies(p_limit int default 50)
  returns table(
    task_id uuid, cabinet_name text, status text, anomaly_note text,
    customer_name text, created_at timestamptz
  ) language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_suro_staff() then raise exception 'Réservé au staff SURO'; end if;
  return query
  select t.id, c.name, t.status, t.anomaly_note, a.customer_name, t.created_at
  from public.suro_broker_tasks t
  join public.suro_cabinets c on c.id = t.cabinet_id
  join public.insurance_applications a on a.id = t.application_id
  where t.anomaly_flag = true
  order by t.updated_at desc
  limit least(coalesce(p_limit, 50), 200);
end;
$$;

-- Gestion cabinets (admin SURO + admin cabinet)
create or replace function public.suro_staff_upsert_cabinet(
  p_name text, p_slug text, p_cabinet_id uuid default null)
  returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public.suro_has_role(array['super_admin','admin']::public.suro_role[]) then
    raise exception 'Réservé aux admins SURO';
  end if;
  if p_cabinet_id is null then
    insert into public.suro_cabinets(name, slug) values (p_name, p_slug) returning id into v_id;
  else
    update public.suro_cabinets set name = p_name, slug = p_slug, updated_at = now()
      where id = p_cabinet_id returning id into v_id;
  end if;
  return v_id;
end;
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

-- ---------- 16. RLS ----------
alter table public.suro_cabinets enable row level security;
alter table public.suro_cabinet_users enable row level security;
alter table public.suro_broker_tasks enable row level security;
alter table public.suro_task_events enable row level security;
alter table public.suro_claim_cabinet enable row level security;
alter table public.suro_claim_status_events enable row level security;
alter table public.suro_cabinet_notifications enable row level security;

-- Cabinets : staff voit tout ; cabinet user voit le sien
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

-- Pas d'écriture directe — RPC uniquement (lecture via policy ci-dessus)
drop policy if exists suro_broker_tasks_no_insert on public.suro_broker_tasks;
create policy suro_broker_tasks_no_insert on public.suro_broker_tasks for insert to authenticated with check (false);
drop policy if exists suro_broker_tasks_no_update on public.suro_broker_tasks;
create policy suro_broker_tasks_no_update on public.suro_broker_tasks for update to authenticated using (false);
drop policy if exists suro_broker_tasks_no_delete on public.suro_broker_tasks;
create policy suro_broker_tasks_no_delete on public.suro_broker_tasks for delete to authenticated using (false);

drop policy if exists suro_broker_tasks_no_write on public.suro_broker_tasks;

-- ---------- 17. Grants RPC ----------
revoke all on function public.suro_cabinet_task_action(uuid,text,jsonb) from public;
grant execute on function public.suro_cabinet_task_action(uuid,text,jsonb) to authenticated;
grant execute on function public.suro_cabinet_list_tasks(text,int,int) to authenticated;
grant execute on function public.suro_cabinet_list_claims(text,int,int) to authenticated;
grant execute on function public.suro_cabinet_claim_set_status(uuid,text,text) to authenticated;
grant execute on function public.suro_cabinet_context() to authenticated;
grant execute on function public.suro_is_cabinet_user() to authenticated;
grant execute on function public.suro_ops_cabinet_overview() to authenticated;
grant execute on function public.suro_ops_list_cabinet_anomalies(int) to authenticated;
grant execute on function public.suro_staff_upsert_cabinet(text,text,uuid) to authenticated;
grant execute on function public.suro_cabinet_add_user(text,public.suro_cabinet_role,text,uuid) to authenticated;

-- ---------- 18. Seeds staging (exemple — commenter en prod si besoin) ----------
insert into public.suro_cabinets(name, slug) values
  ('Cabinet AGMA', 'agma'),
  ('Cabinet Atlas Assurances', 'atlas')
on conflict (slug) do nothing;
