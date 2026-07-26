drop function if exists public.suro_kyc_slot_exists(uuid, text, text);

-- Restaurer auto_check strictement par application_id (état 20260731)
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

-- Restaurer liste documents sans héritage (état 20260731)
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
begin
  if not public.suro_cabinet_can_access_application(p_application_id) then
    raise exception 'Non autorisé';
  end if;

  return query
  select d.id, d.application_id, d.name, d.storage_path,
         d.document_type, d.document_side, d.status, d.created_at
  from public.insurance_documents d
  where d.application_id = p_application_id
  order by
    d.document_type nulls last,
    d.document_side nulls last,
    d.created_at desc;
end;
$$;
