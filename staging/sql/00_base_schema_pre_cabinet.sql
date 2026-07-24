--
-- PostgreSQL database dump
--

\restrict MLhjVPvqFMWbMK6xhF7CCIYdUyFVImTVTBbvLJjNKYouakCBRlDkk8Wpd4euHqn

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
--

    'admin_cabinet',
    'responsable',
    'gestionnaire'
);


--
-- Name: suro_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suro_role AS ENUM (
    'super_admin',
    'admin',
    'operations',
    'support'
);


--
-- Name: is_suro_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_suro_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.suro_admins where user_id = auth.uid());
$$;


--
-- Name: is_suro_staff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_suro_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.suro_admins where user_id = auth.uid());
$$;


--
-- Name: suro_add_admin(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_add_admin(p_email text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid;
begin
  if not public.is_suro_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Aucun compte avec cet email — la personne doit d''abord créer un compte sur le site';
  end if;

  insert into public.suro_admins (user_id) values (v_user_id)
  on conflict (user_id) do nothing;

  return 'ok';
end; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: suro_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suro_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_email text,
    action text NOT NULL,
    entity text,
    entity_id uuid,
    changes jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suro_audit_recent(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_audit_recent(p_limit integer DEFAULT 50) RETURNS SETOF public.suro_audit_log
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.suro_has_role(array['super_admin','admin','operations']::public.suro_role[]) then
    raise exception 'Réservé au staff autorisé';
  end if;
  return query
    select * from public.suro_audit_log order by created_at desc
    limit least(coalesce(p_limit,50), 200);
end; $$;


--
--

    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_cabinet uuid; v_ctx record;
begin
  v_cabinet := coalesce(p_cabinet_id, v_ctx.cabinet_id);

    raise exception 'Non autorisé';
  end if;
  if not public.is_suro_staff() and v_cabinet <> v_ctx.cabinet_id then
    raise exception 'Accès refusé';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'Utilisateur introuvable — créer le compte Auth d''abord'; end if;

  values (v_cabinet, v_uid, p_role, p_display_name)
  on conflict (cabinet_id, user_id) do update
    set role = excluded.role, display_name = excluded.display_name, is_active = true;

  return 'ok';
end;
$$;


--
--

    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
--

    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    where user_id = auth.uid()
      and is_active = true
      and role in ('admin_cabinet', 'responsable')
  ) or public.is_suro_staff();
$$;


--
--

    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cc record;
  v_ctx record;
  v_msg text;
  v_app_email text;
begin
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

    set broker_status = p_status, updated_at = now()
    where claim_id = p_claim_id;

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


--
--

    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select cu.cabinet_id, cu.role, c.name
  where cu.user_id = auth.uid() and cu.is_active = true and c.is_active = true
  limit 1;
$$;


--
--

    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_cabinet uuid;
begin
  if v_cabinet is null then raise exception 'Non autorisé'; end if;

  return query
  select c.id, c.application_id, cc.broker_status,
         c.claim_type, c.claim_date, c.created_at,
         a.customer_name, a.immatriculation, cc.assigned_to
  join public.insurance_claims c on c.id = cc.claim_id
  join public.insurance_applications a on a.id = c.application_id
  where cc.cabinet_id = v_cabinet
    and (p_status is null or cc.broker_status = p_status)
  order by cc.updated_at desc
  limit least(coalesce(p_limit, 50), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;


--
--

    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_cabinet uuid;
begin
  if v_cabinet is null then raise exception 'Non autorisé'; end if;

  return query
  select t.id, t.application_id, t.status, t.priority, t.assigned_to,
         t.created_at, t.updated_at,
         a.customer_name, a.customer_email, a.immatriculation,
         a.marque, a.modele, a.coverage_type, a.annual_premium,
         t.anomaly_flag
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


--
--

    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cabinet uuid;
  v_assignee uuid;
  v_app_id uuid;
begin
  select application_id into v_app_id from public.insurance_claims where id = new.id;

  select t.cabinet_id into v_cabinet
  where t.application_id = v_app_id
  order by t.created_at desc limit 1;

  if v_cabinet is null then
  end if;
  if v_cabinet is null then return new; end if;


  values (new.id, v_cabinet, v_assignee, 'dossier_recu')
  on conflict (claim_id) do nothing;

  values (new.id, 'dossier_recu', null, 'Votre sinistre a bien été enregistré par SURO.');

  perform public.suro_notify_cabinet_users(
    v_cabinet, 'new_claim', 'Nouveau sinistre', 'Un sinistre client nécessite un suivi.',
    'claim', new.id, v_assignee);

  return new;
end;
$$;


--
--

    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  select id into v_id
  where is_active = true
  order by last_task_at nulls first, created_at
  limit 1;

  if v_id is not null then
  end if;
  return v_id;
end;
$$;


--
--

    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_user uuid;
begin
  select cu.user_id into v_user
  where cu.cabinet_id = p_cabinet_id
    and cu.is_active = true
    and cu.role in ('gestionnaire', 'responsable', 'admin_cabinet')
  order by cu.last_assigned_at nulls first, cu.created_at
  limit 1;

  if v_user is not null then
      set last_assigned_at = now()
      where cabinet_id = p_cabinet_id and user_id = v_user;
  end if;
  return v_user;
end;
$$;


--
--

    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_task record;
  v_app record;
  v_ctx record;
  v_msg text;
  v_new_status text;
begin
  if v_ctx.cabinet_id is null and not public.is_suro_staff() then
    raise exception 'Non autorisé';
  end if;

  if v_task is null then raise exception 'Dossier introuvable'; end if;
  if not public.is_suro_staff() and v_task.cabinet_id <> v_ctx.cabinet_id then
    raise exception 'Accès refusé';
  end if;

  select * into v_app from public.insurance_applications where id = v_task.application_id;

  case p_action
    when 'prendre_en_charge' then
      v_new_status := 'en_cours';
      v_msg := 'Votre dossier est en cours de validation par SURO.';
        set status = v_new_status, assigned_to = coalesce(assigned_to, auth.uid()), updated_at = now()
        where id = p_task_id;

    when 'valider' then
      v_new_status := 'valide';
      v_msg := 'Votre dossier a été validé par SURO.';

    when 'demander_pieces' then
      v_new_status := 'pieces_manquantes';
      v_msg := coalesce(p_payload->>'message',
        'SURO a besoin de documents complémentaires pour finaliser votre dossier.');

    when 'refuser' then
      v_new_status := 'refuse';
      v_msg := 'Votre dossier n''a pas pu être traité. L''équipe SURO vous contactera.';

    when 'emettre_police' then
      v_new_status := 'police_emise';
      v_msg := 'Votre contrat est prêt. Consultez votre espace client SURO.';
      if coalesce(p_payload->>'policy_number', '') <> '' then
        update public.insurance_applications
          set policy_number = p_payload->>'policy_number'
          where id = v_task.application_id;
      end if;

    when 'anomalie' then
      v_new_status := 'anomalie';
      v_msg := null;
        set status = v_new_status, anomaly_flag = true,
            anomaly_note = p_payload->>'note', updated_at = now()
        where id = p_task_id;
      insert into public.suro_notifications(audience, user_email, type, title, body, ref_type, ref_id)
      values ('admin', null, 'cabinet_anomaly', 'Anomalie cabinet',
              coalesce(p_payload->>'note', 'Anomalie signalée'), 'broker_task', p_task_id);

    when 'reassigner' then
        raise exception 'Non autorisé';
      end if;
        set assigned_to = (p_payload->>'user_id')::uuid, updated_at = now()
        where id = p_task_id;
      v_new_status := v_task.status;
      v_msg := null;

    else raise exception 'Action inconnue : %', p_action;
  end case;

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


--
--

    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_app record;
  v_check jsonb;
  v_cabinet uuid;
  v_assignee uuid;
  v_task uuid;
  v_msg text := 'Votre dossier est en cours de validation par SURO.';
begin
    return null;
  end if;

  select * into v_app from public.insurance_applications where id = p_application_id;
  if v_app is null or v_app.paid_at is null or v_app.status <> 'active' then
    return null;
  end if;

  if not coalesce((v_check->>'passed')::boolean, false) then
    return null;
  end if;

  if v_cabinet is null then
    raise exception 'Aucun cabinet actif';
  end if;


    application_id, cabinet_id, assigned_to, status, priority,
    auto_check_status, auto_check_notes
  ) values (
    p_application_id, v_cabinet, v_assignee, 'nouveau', 'normale',
    'passed', v_check
  ) returning id into v_task;

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


--
-- Name: suro_can(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_can(p_cap text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when public.suro_current_role() = 'super_admin' then true
    when p_cap = any (array['client.delete','staff.manage','privileges.manage']) then false
    else exists (select 1 from public.suro_role_privileges
                 where role = public.suro_current_role() and capability = p_cap)
  end;
$$;


--
-- Name: suro_claims_awaiting_customer_reply(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_claims_awaiting_customer_reply() RETURNS TABLE(claim_id uuid, last_at timestamp with time zone, last_body text, claim_type text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'Authentification requise';
  end if;

  return query
    with last as (
      select distinct on (m.claim_id)
        m.claim_id,
        m.sender,
        m.created_at,
        m.body
      from public.insurance_claim_messages m
      order by m.claim_id, m.created_at desc
    )
    select l.claim_id, l.created_at, l.body, c.claim_type
    from last l
    join public.insurance_claims c on c.id = l.claim_id
    join public.insurance_applications a on a.id = c.application_id
    where l.sender = 'admin'
      and lower(a.customer_email) = v_email;
end;
$$;


--
-- Name: suro_claims_needing_reply(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_claims_needing_reply() RETURNS TABLE(claim_id uuid, last_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_suro_staff() then raise exception 'Réservé au staff'; end if;
  return query
    with last as (
      select distinct on (m.claim_id) m.claim_id, m.sender, m.created_at
      from public.insurance_claim_messages m
      order by m.claim_id, m.created_at desc
    )
    select l.claim_id, l.created_at from last l where l.sender <> 'admin';
end; $$;


--
-- Name: suro_compute_premium(text, integer, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_compute_premium(p_coverage text, p_annee integer, p_puissance integer, p_marque text, p_vehicle_type text DEFAULT 'voiture'::text) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_premium numeric; v_factor numeric; v_age integer;
begin
  select annual_premium into v_premium from insurance_pricing
  where coverage_type = p_coverage and active
    and coalesce(vehicle_type,'voiture') = coalesce(p_vehicle_type,'voiture')
    and p_puissance between cv_min and cv_max
  order by cv_min limit 1;
  if v_premium is null then return null; end if;
  if coalesce(p_vehicle_type,'voiture') = 'voiture' and p_coverage = 'complete' then
    v_age := extract(year from now())::int - coalesce(p_annee, extract(year from now())::int);
    if v_age > 10 then
      select factor into v_factor from insurance_pricing_factors where key = 'complete_age_gt10';
      v_premium := v_premium * coalesce(v_factor, 1);
    end if;
    if lower(coalesce(p_marque, '')) ~ '(mercedes|bmw|audi|porsche|land rover|range rover|jaguar)' then
      select factor into v_factor from insurance_pricing_factors where key = 'premium_brand';
      v_premium := v_premium * coalesce(v_factor, 1);
    end if;
  end if;
  return round(v_premium);
end; $$;


--
-- Name: suro_current_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_current_role() RETURNS public.suro_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role from public.suro_admins where user_id = auth.uid();
$$;


--
-- Name: suro_delete_customer(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_delete_customer(p_email text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if public.suro_current_role() <> 'super_admin' then raise exception 'Réservé au Super Admin'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'Client introuvable'; end if;
  if exists (select 1 from public.suro_admins where user_id = v_id) then
    raise exception 'Ce compte fait partie de l''équipe — retirez-le d''abord des Utilisateurs';
  end if;
  delete from auth.users where id = v_id;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''), 'delete', 'customer',
          jsonb_build_object('email', p_email));
  return 'ok';
end; $$;


--
-- Name: suro_funnel_stats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_funnel_stats(p_days integer DEFAULT 7) RETURNS TABLE(event text, sessions bigint, total bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_suro_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query
    select e.event, count(distinct e.session_id)::bigint, count(*)::bigint
    from public.suro_events e
    where e.created_at > now() - make_interval(days => p_days)
    group by e.event;
end; $$;


--
-- Name: suro_get_quote(integer, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_get_quote(p_annee integer, p_puissance integer, p_marque text DEFAULT NULL::text, p_modele text DEFAULT NULL::text, p_vehicle_type text DEFAULT 'voiture'::text) RETURNS TABLE(coverage_type text, annual_premium numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.coverage, public.suro_compute_premium(c.coverage, p_annee, p_puissance, p_marque, p_vehicle_type)
  from (values ('minimal'), ('complete')) as c(coverage);
$$;


--
-- Name: suro_has_role(public.suro_role[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_has_role(roles public.suro_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.suro_admins
    where user_id = auth.uid() and role = any(roles)
  );
$$;


--
-- Name: suro_is_cabinet_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_is_cabinet_user() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    where user_id = auth.uid() and is_active = true
  );
$$;


--
-- Name: suro_list_admins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_list_admins() RETURNS TABLE(email text, admin_since timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_suro_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query
    select u.email::text, a.created_at
    from public.suro_admins a
    join auth.users u on u.id = a.user_id
    order by a.created_at;
end; $$;


--
-- Name: suro_list_customers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_list_customers() RETURNS TABLE(email text, name text, phone text, registered_at timestamp with time zone, last_login timestamp with time zone, contracts bigint, is_admin boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_suro_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query
    select
      u.email::text,
      (u.raw_user_meta_data ->> 'name')::text,
      (u.raw_user_meta_data ->> 'phone')::text,
      u.created_at,
      u.last_sign_in_at,
      (select count(*) from public.insurance_applications a where a.customer_email = u.email),
      exists (select 1 from public.suro_admins sa where sa.user_id = u.id)
    from auth.users u
    order by u.created_at desc;
end; $$;


--
-- Name: suro_list_role_privileges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_list_role_privileges() RETURNS TABLE(role public.suro_role, capability text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if public.suro_current_role() <> 'super_admin' then raise exception 'Réservé au Super Admin'; end if;
  return query select rp.role, rp.capability from public.suro_role_privileges rp;
end; $$;


--
-- Name: suro_list_staff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_list_staff() RETURNS TABLE(email text, name text, role public.suro_role, added_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.suro_has_role(array['super_admin']::public.suro_role[]) then
    raise exception 'Réservé au Super Admin';
  end if;
  return query
    select u.email::text, (u.raw_user_meta_data ->> 'name')::text, a.role, a.created_at
    from public.suro_admins a join auth.users u on u.id = a.user_id
    order by a.created_at;
end; $$;


--
-- Name: suro_log_action(text, text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_log_action(p_action text, p_entity text DEFAULT NULL::text, p_entity_id uuid DEFAULT NULL::uuid, p_changes jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_suro_staff() then
    raise exception 'Réservé au staff';
  end if;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, entity_id, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''), p_action, p_entity, p_entity_id, p_changes);
end; $$;


--
-- Name: suro_lookup_user_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_lookup_user_id(p_email text) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if public.suro_current_role() <> 'super_admin' then
    raise exception 'Réservé au Super Admin';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  return v_id;
end;
$$;


--
-- Name: suro_mark_application_paid(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_mark_application_paid(app_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_caller text; v_status text; v_owner text; v_amount numeric;
begin
  v_caller := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_caller = '' then
    raise exception 'Authentification requise pour le paiement';
  end if;

  select status, lower(customer_email), annual_premium
    into v_status, v_owner, v_amount
    from public.insurance_applications
    where id = app_id;

  if not found or v_owner is distinct from v_caller then
    raise exception 'Devis introuvable ou non autorisé';
  end if;

  -- Idempotent : si déjà actif et possédé par l'appelant, on ne fait rien.
  if v_status = 'nouvelle' then
    update public.insurance_applications
      set status = 'active', paid_at = now(),
          expires_at = now() + interval '1 year', updated_at = now()
      where id = app_id;

    insert into public.suro_payments(application_id, customer_email, amount, kind)
    values (app_id, v_owner, v_amount, 'initial');
  end if;
end; $$;


--
-- Name: suro_my_privileges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_my_privileges() RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when public.suro_current_role() = 'super_admin' then
      array['contract.edit','client.edit','document.review','document.upload',
            'claim.handle','settings.edit','client.delete','staff.manage','privileges.manage']
    when public.suro_current_role() is null then array[]::text[]
    else coalesce((select array_agg(capability) from public.suro_role_privileges
                   where role = public.suro_current_role()), array[]::text[])
  end;
$$;


--
-- Name: suro_notify(text, text, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_notify(p_audience text, p_email text, p_type text, p_title text, p_body text, p_ref_type text DEFAULT NULL::text, p_ref_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into public.suro_notifications (audience, user_email, type, title, body, ref_type, ref_id)
  values (p_audience, p_email, p_type, p_title, p_body, p_ref_type, p_ref_id);
$$;


--
-- Name: suro_notify_cabinet_users(uuid, text, text, text, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_notify_cabinet_users(p_cabinet_id uuid, p_type text, p_title text, p_body text, p_ref_type text DEFAULT NULL::text, p_ref_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  select p_cabinet_id,
         case when p_user_id is not null then p_user_id else cu.user_id end,
         p_type, p_title, p_body, p_ref_type, p_ref_id
  where cu.cabinet_id = p_cabinet_id
    and cu.is_active = true
    and (p_user_id is null or cu.user_id = p_user_id);
end;
$$;


--
-- Name: suro_notify_customer(text, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_notify_customer(p_email text, p_type text, p_title text, p_body text, p_ref_type text DEFAULT NULL::text, p_ref_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.suro_notifications(audience, user_email, type, title, body, ref_type, ref_id)
  values ('customer', lower(trim(p_email)), p_type, p_title, p_body, p_ref_type, p_ref_id);
end;
$$;


--
-- Name: suro_ops_cabinet_overview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_ops_cabinet_overview() RETURNS TABLE(cabinet_id uuid, cabinet_name text, is_active boolean, tasks_open bigint, tasks_anomaly bigint, claims_open bigint, avg_task_age_hours numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_suro_staff() then raise exception 'Réservé au staff SURO'; end if;
  return query
  select c.id, c.name, c.is_active,
     where t.cabinet_id = c.id and t.status not in ('police_emise','refuse','cloture')),
     where t.cabinet_id = c.id and t.anomaly_flag = true),
     where cc.cabinet_id = c.id and cc.broker_status <> 'cloture'),
    (select round(avg(extract(epoch from (now() - t.created_at)) / 3600)::numeric, 1)
     where t.cabinet_id = c.id and t.status not in ('police_emise','refuse','cloture'))
  order by c.name;
end;
$$;


--
-- Name: suro_ops_list_cabinet_anomalies(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_ops_list_cabinet_anomalies(p_limit integer DEFAULT 50) RETURNS TABLE(task_id uuid, cabinet_name text, status text, anomaly_note text, customer_name text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_suro_staff() then raise exception 'Réservé au staff SURO'; end if;
  return query
  select t.id, c.name, t.status, t.anomaly_note, a.customer_name, t.created_at
  join public.insurance_applications a on a.id = t.application_id
  where t.anomaly_flag = true
  order by t.updated_at desc
  limit least(coalesce(p_limit, 50), 200);
end;
$$;


--
-- Name: suro_owns_claim(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_owns_claim(p_claim_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.insurance_claims c
    join public.insurance_applications a on a.id = c.application_id
    where c.id = p_claim_id
      and a.customer_email = coalesce(auth.jwt() ->> 'email', '')
  );
$$;


--
-- Name: suro_recent_events(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_recent_events(p_limit integer DEFAULT 50) RETURNS TABLE(created_at timestamp with time zone, event text, step text, meta jsonb, session_id text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_suro_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query
    select e.created_at, e.event, e.step, e.meta, e.session_id
    from public.suro_events e
    order by e.created_at desc
    limit least(coalesce(p_limit, 50), 200);
end; $$;


--
-- Name: suro_remove_admin(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_remove_admin(p_email text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_count int;
begin
  if not public.is_suro_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Compte introuvable';
  end if;

  select count(*) into v_count from public.suro_admins;
  if v_count <= 1 then
    raise exception 'Impossible de retirer le dernier administrateur';
  end if;

  delete from public.suro_admins where user_id = v_user_id;
  return 'ok';
end; $$;


--
-- Name: suro_remove_staff(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_remove_staff(p_email text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: suro_renew_application(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_renew_application(app_id uuid) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_email text; v_current timestamptz; v_new timestamptz; v_amount numeric;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select expires_at, annual_premium into v_current, v_amount
    from public.insurance_applications
    where id = app_id and lower(customer_email) = v_email;
  if not found then raise exception 'Contrat introuvable ou non autorisé'; end if;

  v_new := greatest(coalesce(v_current, now()), now()) + interval '1 year';
  update public.insurance_applications
    set status = 'active', expires_at = v_new, paid_at = now(), updated_at = now()
    where id = app_id and lower(customer_email) = v_email;

  insert into public.suro_payments(application_id, customer_email, amount, kind)
  values (app_id, v_email, v_amount, 'renewal');

  return v_new;
end; $$;


--
-- Name: suro_review_document(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_review_document(p_id uuid, p_status text, p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_email text;
begin
  if not public.suro_can('document.review') then raise exception 'Non autorisé'; end if;
  if p_status not in ('pending','approved','rejected') then raise exception 'Statut invalide'; end if;
  update public.insurance_documents
    set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(),
        reject_reason = case when p_status = 'rejected' then p_reason else null end
    where id = p_id returning customer_email into v_email;
  if v_email is null then raise exception 'Document introuvable'; end if;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, entity_id, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''),
          case when p_status='approved' then 'validate' when p_status='rejected' then 'reject' else 'update' end,
          'document', p_id, jsonb_build_object('status', p_status, 'reason', p_reason));
  insert into public.suro_notifications(audience, user_email, type, title, body, ref_type, ref_id)
  values ('customer', v_email, 'document',
          case when p_status='approved' then 'Document validé' when p_status='rejected' then 'Document refusé' else 'Document mis à jour' end,
          case when p_status='rejected' then coalesce('Motif : ' || p_reason, 'Document refusé') else 'Un de vos documents a été traité par notre équipe.' end,
          'document', p_id);
end; $$;


--
-- Name: suro_send_expiry_reminders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_send_expiry_reminders() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.suro_notifications (audience, user_email, type, title, body, ref_type, ref_id)
  select 'customer', a.customer_email, 'expiry_j' || m.d,
         '⏰ Ton assurance expire dans ' || m.d || ' jours',
         'Contrat ' || coalesce(a.marque || ' ' || a.modele, '') || ' — échéance le ' ||
         to_char(a.expires_at, 'DD/MM/YYYY') || '. Renouvelle en un clic depuis ton espace.',
         'application', a.id
  from public.insurance_applications a
  join (values (15),(7),(3)) as m(d) on (a.expires_at::date - current_date) = m.d
  where a.status = 'active'
    and not exists (
      select 1 from public.suro_notifications n
      where n.ref_id = a.id and n.type = 'expiry_j' || m.d
    );

  update public.insurance_applications
  set status = 'expired', updated_at = now()
  where status = 'active' and expires_at < now();
end; $$;


--
-- Name: suro_set_premium(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_set_premium() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  new.annual_premium := public.suro_compute_premium(
    new.coverage_type, new.annee, new.puissance, new.marque, new.vehicle_type);
  return new;
end; $$;


--
-- Name: suro_set_privilege(public.suro_role, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_set_privilege(p_role public.suro_role, p_cap text, p_allowed boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if public.suro_current_role() <> 'super_admin' then raise exception 'Réservé au Super Admin'; end if;
  if p_role = 'super_admin' then raise exception 'Le Super Admin a tous les droits'; end if;
  if p_cap = any (array['client.delete','staff.manage','privileges.manage']) then
    raise exception 'Capacité réservée au Super Admin'; end if;
  if p_allowed then
    insert into public.suro_role_privileges(role, capability) values (p_role, p_cap) on conflict do nothing;
  else
    delete from public.suro_role_privileges where role = p_role and capability = p_cap;
  end if;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''), 'update', 'privileges',
          jsonb_build_object('role', p_role, 'capability', p_cap, 'allowed', p_allowed));
  return 'ok';
end; $$;


--
-- Name: suro_set_staff(text, public.suro_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_set_staff(p_email text, p_role public.suro_role) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: suro_staff_upsert_cabinet(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_staff_upsert_cabinet(p_name text, p_slug text, p_cabinet_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if not public.suro_has_role(array['super_admin','admin']::public.suro_role[]) then
    raise exception 'Réservé aux admins SURO';
  end if;
  if p_cabinet_id is null then
  else
      where id = p_cabinet_id returning id into v_id;
  end if;
  return v_id;
end;
$$;


--
-- Name: suro_trg_application_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_trg_application_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform suro_notify('admin', null, 'application_new',
    '📋 Nouvelle demande de souscription',
    coalesce(new.customer_email, '') || ' — ' || coalesce(new.marque || ' ' || new.modele, 'véhicule'),
    'application', new.id);
  return new;
end; $$;


--
-- Name: suro_trg_application_updated(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_trg_application_updated() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.status is distinct from old.status then
    if new.status = 'active' and old.status = 'nouvelle' then
      perform suro_notify('customer', new.customer_email, 'contract_active',
        '🎉 Ton contrat est actif',
        'Couverture ' || coalesce(new.marque || ' ' || new.modele, '') || ' valable jusqu''au ' || to_char(new.expires_at, 'DD/MM/YYYY') || '.',
        'application', new.id);
    elsif new.status = 'expired' then
      perform suro_notify('customer', new.customer_email, 'contract_expired',
        '⚠️ Ton assurance a expiré',
        'Ton contrat ' || coalesce(new.marque || ' ' || new.modele, '') || ' n''est plus valide. Renouvelle-le depuis ton espace.',
        'application', new.id);
    elsif new.status = 'cancelled' then
      perform suro_notify('customer', new.customer_email, 'contract_cancelled',
        'Ton contrat a été annulé',
        'Contacte le support si ce n''est pas attendu.',
        'application', new.id);
    end if;
  elsif new.expires_at is distinct from old.expires_at and new.expires_at > coalesce(old.expires_at, new.expires_at - interval '1 second') then
    perform suro_notify('customer', new.customer_email, 'contract_renewed',
      '🔄 Contrat renouvelé',
      'Nouvelle échéance : ' || to_char(new.expires_at, 'DD/MM/YYYY') || '.',
      'application', new.id);
  elsif (new.immatriculation, new.marque, new.modele, new.annee, new.puissance, new.address,
         new.customer_phone, new.coverage_type, new.annual_premium)
        is distinct from
        (old.immatriculation, old.marque, old.modele, old.annee, old.puissance, old.address,
         old.customer_phone, old.coverage_type, old.annual_premium) then
    perform suro_notify('customer', new.customer_email, 'contract_updated',
      '📋 Ton contrat a été mis à jour',
      'Nos équipes ont modifié les informations de ton contrat. Vérifie les détails dans ton espace.',
      'application', new.id);
  end if;
  return new;
end; $$;


--
-- Name: suro_trg_claim_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_trg_claim_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_email text;
begin
  select customer_email into v_email from insurance_applications where id = new.application_id;
  perform suro_notify('admin', null, 'claim_new',
    '🚨 Nouveau sinistre déclaré',
    coalesce(v_email, 'Client') || ' — ' || coalesce(new.claim_type, 'sinistre'),
    'claim', new.id);
  return new;
end; $$;


--
-- Name: suro_trg_claim_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_trg_claim_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_email text;
begin
  select a.customer_email into v_email
  from insurance_claims c join insurance_applications a on a.id = c.application_id
  where c.id = new.claim_id;

  if new.sender = 'customer' then
    perform suro_notify('admin', null, 'claim_message',
      '💬 Nouveau message client',
      coalesce(v_email, 'Client') || ' : ' || left(new.body, 80),
      'claim', new.claim_id);
  else
    perform suro_notify('customer', v_email, 'claim_message',
      '💬 Nouveau message de SURO',
      'Réponse sur ton sinistre : ' || left(new.body, 80),
      'claim', new.claim_id);
  end if;
  return new;
end; $$;


--
-- Name: suro_trg_claim_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_trg_claim_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_email text; v_label text;
begin
  if new.status is distinct from old.status then
    select customer_email into v_email from insurance_applications where id = new.application_id;
    v_label := case new.status
      when 'approved' then 'approuvé ✓' when 'rejected' then 'rejeté'
      when 'paid' then 'indemnisé 🎉' else 'mis à jour' end;
    perform suro_notify('customer', v_email, 'claim_status',
      'Ton sinistre a été ' || v_label,
      'Sinistre ' || coalesce(new.claim_type, '') || ' — consulte le suivi dans ton espace.',
      'claim', new.id);
  end if;
  return new;
end; $$;


--
-- Name: suro_trg_kyc_complete_create_task(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_trg_kyc_complete_create_task() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return new;
end;
$$;


--
-- Name: suro_update_customer(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suro_update_customer(p_email text, p_name text, p_phone text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if not public.suro_can('client.edit') then raise exception 'Non autorisé'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'Client introuvable'; end if;
  update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb)
        || jsonb_build_object('name', p_name, 'phone', p_phone)
    where id = v_id;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, entity_id, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''), 'update', 'customer', v_id,
          jsonb_build_object('email', p_email, 'name', p_name, 'phone', p_phone));
  return 'ok';
end; $$;


--
-- Name: insurance_application_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_application_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    field_key text NOT NULL,
    field_value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insurance_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    customer_name text,
    customer_email text NOT NULL,
    customer_phone text,
    coverage_type text,
    immatriculation text,
    marque text,
    modele text,
    annee integer,
    puissance integer,
    address text,
    annual_premium numeric,
    status text DEFAULT 'nouvelle'::text NOT NULL,
    paid_at timestamp with time zone,
    expires_at timestamp with time zone,
    renewed_from uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_to uuid,
    policy_number text,
    vehicle_type text DEFAULT 'voiture'::text NOT NULL,
    fuel_type text,
    CONSTRAINT insurance_applications_fuel_type_check CHECK (((fuel_type IS NULL) OR (fuel_type = ANY (ARRAY['essence'::text, 'diesel'::text, 'hybride'::text, 'electrique'::text, 'gpl'::text])))),
    CONSTRAINT insurance_applications_vehicle_type_chk CHECK ((vehicle_type = ANY (ARRAY['voiture'::text, 'moto'::text])))
);


--
-- Name: insurance_claim_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_claim_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    customer_email text NOT NULL,
    name text NOT NULL,
    storage_path text NOT NULL,
    content_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insurance_claim_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_claim_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    sender text NOT NULL,
    sender_email text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT insurance_claim_messages_sender_check CHECK ((sender = ANY (ARRAY['customer'::text, 'admin'::text])))
);


--
-- Name: insurance_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid,
    customer_id uuid,
    claim_type text,
    description text,
    claim_date timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insurance_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid,
    customer_email text NOT NULL,
    name text NOT NULL,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    reject_reason text,
    document_type text,
    document_side text,
    CONSTRAINT insurance_documents_document_side_check CHECK (((document_side IS NULL) OR (document_side = ANY (ARRAY['recto'::text, 'verso'::text])))),
    CONSTRAINT insurance_documents_document_type_check CHECK (((document_type IS NULL) OR (document_type = ANY (ARRAY['cin'::text, 'permis'::text, 'carte_grise'::text])))),
    CONSTRAINT insurance_documents_kyc_pair_check CHECK ((((document_type IS NULL) AND (document_side IS NULL)) OR ((document_type = ANY (ARRAY['cin'::text, 'permis'::text, 'carte_grise'::text])) AND (document_side = ANY (ARRAY['recto'::text, 'verso'::text])))))
);


--
-- Name: insurance_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coverage_type text NOT NULL,
    cv_min integer NOT NULL,
    cv_max integer NOT NULL,
    annual_premium numeric NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    vehicle_type text DEFAULT 'voiture'::text NOT NULL,
    CONSTRAINT insurance_pricing_vehicle_type_chk CHECK ((vehicle_type = ANY (ARRAY['voiture'::text, 'moto'::text])))
);


--
-- Name: insurance_pricing_factors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_pricing_factors (
    key text NOT NULL,
    factor numeric NOT NULL,
    description text
);


--
-- Name: insurance_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suro_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suro_admins (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    role public.suro_role DEFAULT 'admin'::public.suro_role NOT NULL
);


--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    cabinet_id uuid NOT NULL,
    assigned_to uuid,
    status text DEFAULT 'nouveau'::text NOT NULL,
    priority text DEFAULT 'normale'::text NOT NULL,
    auto_check_status text,
    auto_check_notes jsonb,
    anomaly_flag boolean DEFAULT false NOT NULL,
    anomaly_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
);


--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cabinet_id uuid NOT NULL,
    user_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    ref_type text,
    ref_id uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cabinet_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_assigned_at timestamp with time zone,
    display_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_task_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
--

    claim_id uuid NOT NULL,
    cabinet_id uuid NOT NULL,
    assigned_to uuid,
    broker_status text DEFAULT 'dossier_recu'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
);


--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    from_status text,
    to_status text NOT NULL,
    actor_id uuid,
    client_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suro_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suro_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    event text NOT NULL,
    step text,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suro_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suro_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audience text NOT NULL,
    user_email text,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    ref_type text,
    ref_id uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suro_notifications_audience_check CHECK ((audience = ANY (ARRAY['customer'::text, 'admin'::text])))
);


--
-- Name: suro_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suro_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    customer_email text NOT NULL,
    amount numeric,
    kind text DEFAULT 'initial'::text NOT NULL,
    method text,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'succeeded'::text NOT NULL
);


--
-- Name: suro_role_privileges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suro_role_privileges (
    role public.suro_role NOT NULL,
    capability text NOT NULL
);


--
-- Name: suro_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suro_settings (
    key text NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    actor_id uuid,
    actor_type text DEFAULT 'system'::text NOT NULL,
    action text NOT NULL,
    details jsonb,
    client_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
);


--
-- Name: vehicle_brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    vehicle_type text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_premium boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vehicle_brands_vehicle_type_check CHECK ((vehicle_type = ANY (ARRAY['voiture'::text, 'moto'::text])))
);


--
-- Name: vehicle_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insurance_application_answers insurance_application_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_application_answers
    ADD CONSTRAINT insurance_application_answers_pkey PRIMARY KEY (id);


--
-- Name: insurance_applications insurance_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_applications
    ADD CONSTRAINT insurance_applications_pkey PRIMARY KEY (id);


--
-- Name: insurance_claim_files insurance_claim_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claim_files
    ADD CONSTRAINT insurance_claim_files_pkey PRIMARY KEY (id);


--
-- Name: insurance_claim_messages insurance_claim_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claim_messages
    ADD CONSTRAINT insurance_claim_messages_pkey PRIMARY KEY (id);


--
-- Name: insurance_claims insurance_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_pkey PRIMARY KEY (id);


--
-- Name: insurance_documents insurance_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_documents
    ADD CONSTRAINT insurance_documents_pkey PRIMARY KEY (id);


--
-- Name: insurance_pricing_factors insurance_pricing_factors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_pricing_factors
    ADD CONSTRAINT insurance_pricing_factors_pkey PRIMARY KEY (key);


--
-- Name: insurance_pricing insurance_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_pricing
    ADD CONSTRAINT insurance_pricing_pkey PRIMARY KEY (id);


--
-- Name: insurance_products insurance_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_products
    ADD CONSTRAINT insurance_products_pkey PRIMARY KEY (id);


--
-- Name: insurance_products insurance_products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_products
    ADD CONSTRAINT insurance_products_slug_key UNIQUE (slug);


--
-- Name: suro_admins suro_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suro_admins
    ADD CONSTRAINT suro_admins_pkey PRIMARY KEY (user_id);


--
-- Name: suro_audit_log suro_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suro_audit_log
    ADD CONSTRAINT suro_audit_log_pkey PRIMARY KEY (id);


--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
-- Name: suro_events suro_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suro_events
    ADD CONSTRAINT suro_events_pkey PRIMARY KEY (id);


--
-- Name: suro_notifications suro_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suro_notifications
    ADD CONSTRAINT suro_notifications_pkey PRIMARY KEY (id);


--
-- Name: suro_payments suro_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suro_payments
    ADD CONSTRAINT suro_payments_pkey PRIMARY KEY (id);


--
-- Name: suro_role_privileges suro_role_privileges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suro_role_privileges
    ADD CONSTRAINT suro_role_privileges_pkey PRIMARY KEY (role, capability);


--
-- Name: suro_settings suro_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suro_settings
    ADD CONSTRAINT suro_settings_pkey PRIMARY KEY (key);


--
--



--
-- Name: vehicle_brands vehicle_brands_name_vehicle_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_brands
    ADD CONSTRAINT vehicle_brands_name_vehicle_type_key UNIQUE (name, vehicle_type);


--
-- Name: vehicle_brands vehicle_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_brands
    ADD CONSTRAINT vehicle_brands_pkey PRIMARY KEY (id);


--
-- Name: vehicle_models vehicle_models_brand_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_models
    ADD CONSTRAINT vehicle_models_brand_id_name_key UNIQUE (brand_id, name);


--
-- Name: vehicle_models vehicle_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_models
    ADD CONSTRAINT vehicle_models_pkey PRIMARY KEY (id);


--
-- Name: insurance_applications_policy_number_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX insurance_applications_policy_number_uidx ON public.insurance_applications USING btree (policy_number) WHERE (policy_number IS NOT NULL);


--
-- Name: insurance_documents_kyc_slot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insurance_documents_kyc_slot_idx ON public.insurance_documents USING btree (application_id, document_type, document_side, created_at DESC);


--
-- Name: suro_audit_log_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suro_audit_log_created_idx ON public.suro_audit_log USING btree (created_at DESC);


--
-- Name: suro_audit_log_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suro_audit_log_entity_idx ON public.suro_audit_log USING btree (entity, entity_id);


--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
-- Name: suro_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suro_events_created_idx ON public.suro_events USING btree (created_at);


--
-- Name: suro_events_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suro_events_event_idx ON public.suro_events USING btree (event);


--
-- Name: suro_notif_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suro_notif_customer_idx ON public.suro_notifications USING btree (audience, user_email, created_at DESC);


--
-- Name: suro_notif_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suro_notif_unread_idx ON public.suro_notifications USING btree (audience, read_at);


--
-- Name: suro_payments_app_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suro_payments_app_idx ON public.suro_payments USING btree (application_id);


--
-- Name: suro_payments_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suro_payments_email_idx ON public.suro_payments USING btree (customer_email);


--
--



--
-- Name: vehicle_brands_type_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_brands_type_sort_idx ON public.vehicle_brands USING btree (vehicle_type, sort_order, name);


--
-- Name: vehicle_models_brand_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_models_brand_sort_idx ON public.vehicle_models USING btree (brand_id, sort_order, name);


--
-- Name: insurance_claims suro_trg_claim_cabinet; Type: TRIGGER; Schema: public; Owner: -
--



--
-- Name: insurance_documents suro_trg_kyc_task; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER suro_trg_kyc_task AFTER INSERT ON public.insurance_documents FOR EACH ROW WHEN ((new.document_type IS NOT NULL)) EXECUTE FUNCTION public.suro_trg_kyc_complete_create_task();


--
-- Name: insurance_applications trg_suro_application_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suro_application_created AFTER INSERT ON public.insurance_applications FOR EACH ROW EXECUTE FUNCTION public.suro_trg_application_created();


--
-- Name: insurance_applications trg_suro_application_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suro_application_updated AFTER UPDATE ON public.insurance_applications FOR EACH ROW EXECUTE FUNCTION public.suro_trg_application_updated();


--
-- Name: insurance_claims trg_suro_claim_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suro_claim_created AFTER INSERT ON public.insurance_claims FOR EACH ROW EXECUTE FUNCTION public.suro_trg_claim_created();


--
-- Name: insurance_claim_messages trg_suro_claim_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suro_claim_message AFTER INSERT ON public.insurance_claim_messages FOR EACH ROW EXECUTE FUNCTION public.suro_trg_claim_message();


--
--



--
-- Name: insurance_applications trg_suro_set_premium; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suro_set_premium BEFORE INSERT ON public.insurance_applications FOR EACH ROW EXECUTE FUNCTION public.suro_set_premium();


--
-- Name: insurance_application_answers insurance_application_answers_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_application_answers
    ADD CONSTRAINT insurance_application_answers_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.insurance_applications(id) ON DELETE CASCADE;


--
-- Name: insurance_applications insurance_applications_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_applications
    ADD CONSTRAINT insurance_applications_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.insurance_products(id);


--
-- Name: insurance_claim_files insurance_claim_files_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claim_files
    ADD CONSTRAINT insurance_claim_files_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.insurance_claims(id) ON DELETE CASCADE;


--
-- Name: insurance_claim_messages insurance_claim_messages_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claim_messages
    ADD CONSTRAINT insurance_claim_messages_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.insurance_claims(id) ON DELETE CASCADE;


--
-- Name: insurance_claims insurance_claims_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.insurance_applications(id) ON DELETE CASCADE;


--
-- Name: insurance_documents insurance_documents_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_documents
    ADD CONSTRAINT insurance_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.insurance_applications(id) ON DELETE CASCADE;


--
-- Name: suro_admins suro_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suro_admins
    ADD CONSTRAINT suro_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
-- Name: suro_payments suro_payments_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suro_payments
    ADD CONSTRAINT suro_payments_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.insurance_applications(id) ON DELETE CASCADE;


--
--



--
-- Name: vehicle_models vehicle_models_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_models
    ADD CONSTRAINT vehicle_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.vehicle_brands(id) ON DELETE CASCADE;


--
-- Name: insurance_application_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_application_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_claim_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_claim_files ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_claim_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_claim_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_pricing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_pricing ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_pricing_factors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_pricing_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_products ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_claim_files suro_admin_delete_claim_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_delete_claim_files ON public.insurance_claim_files FOR DELETE TO authenticated USING (public.is_suro_admin());


--
-- Name: insurance_documents suro_admin_delete_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_delete_documents ON public.insurance_documents FOR DELETE TO authenticated USING (public.is_suro_admin());


--
-- Name: insurance_claim_messages suro_admin_insert_claim_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_insert_claim_messages ON public.insurance_claim_messages FOR INSERT TO authenticated WITH CHECK (((sender = 'admin'::text) AND public.is_suro_admin()));


--
-- Name: suro_notifications suro_admin_mark_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_mark_read ON public.suro_notifications FOR UPDATE TO authenticated USING (((audience = 'admin'::text) AND public.is_suro_admin())) WITH CHECK (((audience = 'admin'::text) AND public.is_suro_admin()));


--
-- Name: insurance_application_answers suro_admin_read_answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_read_answers ON public.insurance_application_answers FOR SELECT TO authenticated USING (public.is_suro_admin());


--
-- Name: insurance_applications suro_admin_read_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_read_applications ON public.insurance_applications FOR SELECT TO authenticated USING (public.is_suro_admin());


--
-- Name: insurance_claim_files suro_admin_read_claim_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_read_claim_files ON public.insurance_claim_files FOR SELECT TO authenticated USING (public.is_suro_admin());


--
-- Name: insurance_claim_messages suro_admin_read_claim_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_read_claim_messages ON public.insurance_claim_messages FOR SELECT TO authenticated USING (public.is_suro_admin());


--
-- Name: insurance_claims suro_admin_read_claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_read_claims ON public.insurance_claims FOR SELECT TO authenticated USING (public.is_suro_admin());


--
-- Name: insurance_documents suro_admin_read_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_read_documents ON public.insurance_documents FOR SELECT TO authenticated USING (public.is_suro_admin());


--
-- Name: suro_notifications suro_admin_read_notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_read_notifications ON public.suro_notifications FOR SELECT TO authenticated USING (((audience = 'admin'::text) AND public.is_suro_admin()));


--
-- Name: insurance_claims suro_admin_update_claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_update_claims ON public.insurance_claims FOR UPDATE TO authenticated USING (public.is_suro_admin()) WITH CHECK (public.is_suro_admin());


--
-- Name: insurance_pricing_factors suro_admin_update_factors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_admin_update_factors ON public.insurance_pricing_factors FOR UPDATE TO authenticated USING (public.is_suro_admin()) WITH CHECK (public.is_suro_admin());


--
-- Name: suro_admins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suro_admins ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_application_answers suro_anon_insert_answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_anon_insert_answers ON public.insurance_application_answers FOR INSERT TO authenticated, anon WITH CHECK (((application_id IS NOT NULL) AND (field_key IS NOT NULL) AND (length(field_key) <= 64) AND (length(COALESCE(field_value, ''::text)) <= 2000)));


--
-- Name: insurance_applications suro_anon_insert_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_anon_insert_applications ON public.insurance_applications FOR INSERT TO authenticated, anon WITH CHECK ((status = 'nouvelle'::text));


--
-- Name: suro_events suro_anon_insert_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_anon_insert_events ON public.suro_events FOR INSERT TO authenticated, anon WITH CHECK (((event IS NOT NULL) AND (event ~ '^[a-z][a-z0-9_]{0,63}$'::text) AND ((step IS NULL) OR (length(step) <= 64)) AND ((session_id IS NULL) OR (length(session_id) <= 64)) AND ((meta IS NULL) OR (length((meta)::text) <= 4000))));


--
-- Name: insurance_pricing suro_anon_read_pricing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_anon_read_pricing ON public.insurance_pricing FOR SELECT TO authenticated, anon USING ((active = true));


--
-- Name: insurance_pricing_factors suro_anon_read_pricing_factors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_anon_read_pricing_factors ON public.insurance_pricing_factors FOR SELECT TO authenticated, anon USING (true);


--
-- Name: insurance_products suro_anon_read_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_anon_read_products ON public.insurance_products FOR SELECT TO authenticated, anon USING ((active = true));


--
-- Name: insurance_applications suro_applications update staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_applications update staff" ON public.insurance_applications FOR UPDATE TO authenticated USING (public.suro_can('contract.edit'::text)) WITH CHECK (public.suro_can('contract.edit'::text));


--
-- Name: suro_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suro_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: suro_audit_log suro_audit_log no direct insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_audit_log no direct insert" ON public.suro_audit_log FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: suro_audit_log suro_audit_log read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_audit_log read" ON public.suro_audit_log FOR SELECT TO authenticated USING (public.suro_has_role(ARRAY['super_admin'::public.suro_role, 'admin'::public.suro_role, 'operations'::public.suro_role]));


--
--


--
--



--
--



--
--



--
--



--
--



--
--


--
--


--
--

  WHERE ((cu.user_id = auth.uid()) AND cu.is_active))) OR (user_id = auth.uid())));


--
--


--
--



--
--


--
--



--
--


--
-- Name: insurance_claim_files suro_customer_insert_claim_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_insert_claim_files ON public.insurance_claim_files FOR INSERT TO authenticated WITH CHECK ((public.suro_owns_claim(claim_id) AND (customer_email = COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: insurance_claim_messages suro_customer_insert_claim_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_insert_claim_messages ON public.insurance_claim_messages FOR INSERT TO authenticated WITH CHECK (((sender = 'customer'::text) AND public.suro_owns_claim(claim_id)));


--
-- Name: insurance_claims suro_customer_insert_own_claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_insert_own_claims ON public.insurance_claims FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.insurance_applications a
  WHERE ((a.id = insurance_claims.application_id) AND (a.customer_email = COALESCE((auth.jwt() ->> 'email'::text), ''::text))))));


--
-- Name: insurance_documents suro_customer_insert_own_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_insert_own_documents ON public.insurance_documents FOR INSERT TO authenticated WITH CHECK (((document_type = ANY (ARRAY['cin'::text, 'permis'::text, 'carte_grise'::text])) AND (document_side = ANY (ARRAY['recto'::text, 'verso'::text])) AND (lower(customer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (EXISTS ( SELECT 1
   FROM public.insurance_applications a
  WHERE ((a.id = insurance_documents.application_id) AND (lower(a.customer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (a.status = 'active'::text) AND (a.paid_at IS NOT NULL))))));


--
-- Name: suro_notifications suro_customer_mark_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_mark_read ON public.suro_notifications FOR UPDATE TO authenticated USING (((audience = 'customer'::text) AND (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));


--
-- Name: insurance_claim_files suro_customer_read_claim_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_read_claim_files ON public.insurance_claim_files FOR SELECT TO authenticated USING (public.suro_owns_claim(claim_id));


--
-- Name: insurance_claim_messages suro_customer_read_claim_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_read_claim_messages ON public.insurance_claim_messages FOR SELECT TO authenticated USING (public.suro_owns_claim(claim_id));


--
-- Name: suro_notifications suro_customer_read_notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_read_notifications ON public.suro_notifications FOR SELECT TO authenticated USING (((audience = 'customer'::text) AND (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));


--
-- Name: insurance_applications suro_customer_read_own_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_read_own_applications ON public.insurance_applications FOR SELECT TO authenticated USING ((lower(customer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: insurance_claims suro_customer_read_own_claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_read_own_claims ON public.insurance_claims FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.insurance_applications a
  WHERE ((a.id = insurance_claims.application_id) AND (lower(a.customer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))))));


--
-- Name: insurance_documents suro_customer_read_own_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_customer_read_own_documents ON public.insurance_documents FOR SELECT TO authenticated USING ((lower(customer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: insurance_documents suro_documents insert staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_documents insert staff" ON public.insurance_documents FOR INSERT TO authenticated WITH CHECK (public.suro_can('document.upload'::text));


--
-- Name: suro_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suro_events ENABLE ROW LEVEL SECURITY;

--
-- Name: suro_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suro_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: suro_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suro_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: suro_payments suro_payments select admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_payments select admin" ON public.suro_payments FOR SELECT TO authenticated USING (public.is_suro_admin());


--
-- Name: suro_payments suro_payments select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_payments select own" ON public.suro_payments FOR SELECT TO authenticated USING ((lower(customer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: insurance_pricing suro_pricing insert staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_pricing insert staff" ON public.insurance_pricing FOR INSERT TO authenticated WITH CHECK (public.suro_has_role(ARRAY['super_admin'::public.suro_role, 'admin'::public.suro_role]));


--
-- Name: insurance_pricing suro_pricing update staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_pricing update staff" ON public.insurance_pricing FOR UPDATE TO authenticated USING (public.suro_has_role(ARRAY['super_admin'::public.suro_role, 'admin'::public.suro_role])) WITH CHECK (public.suro_has_role(ARRAY['super_admin'::public.suro_role, 'admin'::public.suro_role]));


--
-- Name: suro_settings suro_read_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suro_read_settings ON public.suro_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: suro_role_privileges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suro_role_privileges ENABLE ROW LEVEL SECURITY;

--
-- Name: suro_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suro_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: suro_settings suro_settings insert staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_settings insert staff" ON public.suro_settings FOR INSERT TO authenticated WITH CHECK (public.suro_can('settings.edit'::text));


--
-- Name: suro_settings suro_settings update staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suro_settings update staff" ON public.suro_settings FOR UPDATE TO authenticated USING (public.suro_can('settings.edit'::text)) WITH CHECK (public.suro_can('settings.edit'::text));


--
--


--
-- Name: vehicle_brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_brands ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_brands vehicle_brands_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicle_brands_select ON public.vehicle_brands FOR SELECT TO authenticated, anon USING (true);


--
-- Name: vehicle_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_models vehicle_models_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicle_models_select ON public.vehicle_models FOR SELECT TO authenticated, anon USING (true);


--
-- PostgreSQL database dump complete
--

\unrestrict MLhjVPvqFMWbMK6xhF7CCIYdUyFVImTVTBbvLJjNKYouakCBRlDkk8Wpd4euHqn

