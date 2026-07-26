-- =====================================================================
-- CABINET — accès documents souscripteur (liste RPC + téléchargement storage)
-- =====================================================================

-- Vérifie que l'utilisateur cabinet a un dossier (souscription ou sinistre) sur ce contrat
create or replace function public.suro_cabinet_can_access_application(p_application_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1
    from public.suro_broker_tasks t
    join public.suro_cabinet_users cu on cu.cabinet_id = t.cabinet_id
    where t.application_id = p_application_id
      and cu.user_id = (select auth.uid())
      and cu.is_active
  )
  or exists (
    select 1
    from public.insurance_claims c
    join public.suro_claim_cabinet cc on cc.claim_id = c.id
    join public.suro_cabinet_users cu on cu.cabinet_id = cc.cabinet_id
    where c.application_id = p_application_id
      and cu.user_id = (select auth.uid())
      and cu.is_active
  );
$$;

revoke all on function public.suro_cabinet_can_access_application(uuid) from public;
grant execute on function public.suro_cabinet_can_access_application(uuid) to authenticated;

-- Liste des documents d'un contrat assigné au cabinet
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

revoke all on function public.suro_cabinet_list_application_documents(uuid) from public;
grant execute on function public.suro_cabinet_list_application_documents(uuid) to authenticated;

-- Téléchargement storage : pièces KYC / documents du contrat assigné au cabinet
drop policy if exists suro_cabinet_download_documents on storage.objects;
create policy suro_cabinet_download_documents on storage.objects
  for select to authenticated
  using (
    bucket_id = 'suro-documents'
    and exists (
      select 1
      from public.insurance_documents d
      where d.storage_path = objects.name
        and public.suro_cabinet_can_access_application(d.application_id)
    )
  );
