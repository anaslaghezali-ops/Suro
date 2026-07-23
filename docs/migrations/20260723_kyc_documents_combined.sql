-- =====================================================================
-- KYC client — migration combinée (à exécuter en une fois)
-- Projet : eprtmdugiusidtbwzozj
-- Inclut : document_type, document_side, RLS INSERT client, storage INSERT
-- =====================================================================

-- 1. Colonnes KYC
alter table public.insurance_documents
  add column if not exists document_type text;

alter table public.insurance_documents
  add column if not exists document_side text;

alter table public.insurance_documents
  drop constraint if exists insurance_documents_document_type_check;

alter table public.insurance_documents
  add constraint insurance_documents_document_type_check
  check (document_type is null or document_type in ('cin', 'permis', 'carte_grise'));

alter table public.insurance_documents
  drop constraint if exists insurance_documents_document_side_check;

alter table public.insurance_documents
  add constraint insurance_documents_document_side_check
  check (document_side is null or document_side in ('recto', 'verso'));

alter table public.insurance_documents
  drop constraint if exists insurance_documents_kyc_pair_check;

alter table public.insurance_documents
  add constraint insurance_documents_kyc_pair_check
  check (
    (document_type is null and document_side is null)
    or (
      document_type in ('cin', 'permis', 'carte_grise')
      and document_side in ('recto', 'verso')
    )
  );

drop index if exists insurance_documents_app_type_idx;

create index if not exists insurance_documents_kyc_slot_idx
  on public.insurance_documents (application_id, document_type, document_side, created_at desc);

-- 2. INSERT client (pièces KYC recto/verso sur contrat payé)
drop policy if exists suro_customer_insert_own_documents on public.insurance_documents;

create policy suro_customer_insert_own_documents on public.insurance_documents
  for insert to authenticated
  with check (
    document_type in ('cin', 'permis', 'carte_grise')
    and document_side in ('recto', 'verso')
    and lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and exists (
      select 1 from public.insurance_applications a
      where a.id = application_id
        and lower(a.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and a.status = 'active'
        and a.paid_at is not null
    )
  );

-- 3. Upload storage client
drop policy if exists suro_customer_upload_own_documents on storage.objects;

create policy suro_customer_upload_own_documents on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'suro-documents'
    and exists (
      select 1 from public.insurance_applications a
      where objects.name like (a.id::text || '/%')
        and lower(a.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and a.status = 'active'
        and a.paid_at is not null
    )
  );

-- 4. Vérification (doit retourner les 2 colonnes)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'insurance_documents'
  and column_name in ('document_type', 'document_side')
order by column_name;
