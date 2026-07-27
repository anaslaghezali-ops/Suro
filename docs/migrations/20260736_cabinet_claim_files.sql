-- =====================================================================
-- CABINET — photos / pièces jointes sinistre (liste RPC + téléchargement storage)
-- =====================================================================

create or replace function public.suro_cabinet_can_access_claim(p_claim_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1
    from public.suro_claim_cabinet cc
    join public.suro_cabinet_users cu on cu.cabinet_id = cc.cabinet_id
    where cc.claim_id = p_claim_id
      and cu.user_id = (select auth.uid())
      and cu.is_active
  );
$$;

revoke all on function public.suro_cabinet_can_access_claim(uuid) from public;
grant execute on function public.suro_cabinet_can_access_claim(uuid) to authenticated;

create or replace function public.suro_cabinet_list_claim_files(p_claim_id uuid)
  returns table(
    id uuid,
    claim_id uuid,
    name text,
    storage_path text,
    content_type text,
    created_at timestamptz
  )
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
begin
  if not public.suro_cabinet_can_access_claim(p_claim_id) then
    raise exception 'Non autorisé';
  end if;

  return query
  select f.id, f.claim_id, f.name, f.storage_path, f.content_type, f.created_at
  from public.insurance_claim_files f
  where f.claim_id = p_claim_id
  order by f.created_at asc;
end;
$$;

revoke all on function public.suro_cabinet_list_claim_files(uuid) from public;
grant execute on function public.suro_cabinet_list_claim_files(uuid) to authenticated;

drop policy if exists suro_cabinet_download_claim_files on storage.objects;
create policy suro_cabinet_download_claim_files on storage.objects
  for select to authenticated
  using (
    bucket_id = 'suro-claims'
    and exists (
      select 1
      from public.insurance_claim_files f
      where f.storage_path = objects.name
        and public.suro_cabinet_can_access_claim(f.claim_id)
    )
  );
