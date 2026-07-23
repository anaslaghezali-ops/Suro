-- =====================================================================
-- Recto / verso pour les pièces KYC (6 fichiers par dossier)
-- À appliquer après 20260723_customer_kyc_documents.sql
-- =====================================================================

alter table public.insurance_documents
  add column if not exists document_side text;

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

-- Recréer la policy INSERT client (document_side obligatoire pour KYC)
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
