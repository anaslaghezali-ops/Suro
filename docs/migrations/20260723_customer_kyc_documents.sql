-- =====================================================================
-- Dépôt client des pièces KYC (CIN, permis, carte grise) après paiement
-- À appliquer sur le projet Supabase eprtmdugiusidtbwzozj.
-- =====================================================================

-- 1. Type de document (nullable pour les docs ops existants : attestation, etc.)
alter table public.insurance_documents
  add column if not exists document_type text;

alter table public.insurance_documents
  drop constraint if exists insurance_documents_document_type_check;

alter table public.insurance_documents
  add constraint insurance_documents_document_type_check
  check (document_type is null or document_type in ('cin', 'permis', 'carte_grise'));

create index if not exists insurance_documents_app_type_idx
  on public.insurance_documents (application_id, document_type, created_at desc);

-- 2. INSERT client : uniquement pièces KYC sur contrat payé (active + paid_at)
drop policy if exists suro_customer_insert_own_documents on public.insurance_documents;

create policy suro_customer_insert_own_documents on public.insurance_documents
  for insert to authenticated
  with check (
    document_type in ('cin', 'permis', 'carte_grise')
    and lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and exists (
      select 1 from public.insurance_applications a
      where a.id = application_id
        and lower(a.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and a.status = 'active'
        and a.paid_at is not null
    )
  );

-- 3. Upload storage : chemin doit commencer par l'id du contrat du client
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
