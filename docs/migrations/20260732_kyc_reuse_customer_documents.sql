-- =====================================================================
-- KYC — CIN / permis partagés par client ; carte grise par véhicule
-- =====================================================================

-- Vérifie la présence d'une face KYC (CIN/permis = niveau client, CG = par contrat)
create or replace function public.suro_kyc_slot_exists(
  p_application_id uuid,
  p_document_type text,
  p_document_side text)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
declare
  v_email text;
begin
  select lower(customer_email) into v_email
  from public.insurance_applications
  where id = p_application_id;

  if v_email is null then
    return false;
  end if;

  if p_document_type = 'carte_grise' then
    return exists (
      select 1
      from public.insurance_documents d
      where d.application_id = p_application_id
        and d.document_type = p_document_type
        and d.document_side = p_document_side
        and coalesce(d.storage_path, '') <> ''
    );
  end if;

  return exists (
    select 1
    from public.insurance_documents d
    where lower(d.customer_email) = v_email
      and d.document_type = p_document_type
      and d.document_side = p_document_side
      and coalesce(d.storage_path, '') <> ''
  );
end;
$$;

revoke all on function public.suro_kyc_slot_exists(uuid, text, text) from public;
grant execute on function public.suro_kyc_slot_exists(uuid, text, text) to authenticated;

-- Auto-check cabinet : 6 faces, CIN/permis réutilisables entre contrats du même client
create or replace function public.suro_cabinet_auto_check(p_application_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
declare
  v_missing text[];
  v_slot text;
  v_slots text[] := array[
    'cin:recto','cin:verso','permis:recto','permis:verso',
    'carte_grise:recto','carte_grise:verso'
  ];
begin
  foreach v_slot in array v_slots loop
    if not public.suro_kyc_slot_exists(
      p_application_id,
      split_part(v_slot, ':', 1),
      split_part(v_slot, ':', 2)
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

  return jsonb_build_object('passed', true, 'reason', 'ok', 'checked_at', now());
end;
$$;

-- Liste documents cabinet : pièces du contrat + CIN/permis hérités du client
create or replace function public.suro_cabinet_list_application_documents(p_application_id uuid)
  returns table(
    id uuid,
    application_id uuid,
    name text,
    storage_path text,
    document_type text,
    document_side text,
    status text,
    created_at timestamptz
  )
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
declare
  v_email text;
begin
  if not public.suro_cabinet_can_access_application(p_application_id) then
    raise exception 'Non autorisé';
  end if;

  select lower(a.customer_email) into v_email
  from public.insurance_applications a
  where a.id = p_application_id;

  return query
  with own as (
    select d.id, d.application_id, d.name, d.storage_path,
           d.document_type, d.document_side, d.status, d.created_at
    from public.insurance_documents d
    where d.application_id = p_application_id
  ),
  inherited as (
    select distinct on (d.document_type, d.document_side)
           d.id, d.application_id, d.name, d.storage_path,
           d.document_type, d.document_side, d.status, d.created_at
    from public.insurance_documents d
    where v_email is not null
      and lower(d.customer_email) = v_email
      and d.document_type in ('cin', 'permis')
      and d.application_id <> p_application_id
    order by d.document_type, d.document_side, d.created_at desc
  ),
  merged as (
    select * from own
    union all
    select i.*
    from inherited i
    where not exists (
      select 1 from own o
      where o.document_type = i.document_type
        and o.document_side is not distinct from i.document_side
    )
  )
  select m.id, m.application_id, m.name, m.storage_path,
         m.document_type, m.document_side, m.status, m.created_at
  from merged m
  order by
    m.document_type nulls last,
    m.document_side nulls last,
    m.created_at desc;
end;
$$;
