-- =====================================================================
-- Alignement RLS / RPC sur la matrice suro_role_privileges (suro_can)
-- À appliquer sur eprtmdugiusidtbwzozj après 20260720_ops_privileges_system.sql
--
-- Avant : plusieurs chemins staff utilisaient suro_has_role(...) ou is_suro_admin()
-- et ignoraient la matrice configurable. Le front masquait déjà via suro_my_privileges.
-- =====================================================================

-- Validation de documents : respecter document.review
create or replace function public.suro_review_document(
  p_id uuid, p_status text, p_reason text default null)
  returns void language plpgsql security definer set search_path to 'public' as $$
declare v_email text;
begin
  if not public.suro_can('document.review') then
    raise exception 'Non autorisé';
  end if;
  if p_status not in ('pending','approved','rejected') then
    raise exception 'Statut invalide';
  end if;

  update public.insurance_documents
    set status = p_status,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        reject_reason = case when p_status = 'rejected' then p_reason else null end
    where id = p_id
    returning customer_email into v_email;

  if v_email is null then raise exception 'Document introuvable'; end if;

  insert into public.suro_audit_log(actor_id, actor_email, action, entity, entity_id, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''),
          case when p_status = 'approved' then 'validate'
               when p_status = 'rejected' then 'reject' else 'update' end,
          'document', p_id, jsonb_build_object('status', p_status, 'reason', p_reason));

  insert into public.suro_notifications(audience, user_email, type, title, body, ref_type, ref_id)
  values ('customer', v_email, 'document',
          case when p_status = 'approved' then 'Document validé'
               when p_status = 'rejected' then 'Document refusé'
               else 'Document mis à jour' end,
          case when p_status = 'rejected' then coalesce('Motif : ' || p_reason, 'Document refusé')
               else 'Un de vos documents a été traité par notre équipe.' end,
          'document', p_id);
end; $$;

-- Contrats : respecter contract.edit
drop policy if exists "suro_applications update staff" on public.insurance_applications;
create policy "suro_applications update staff" on public.insurance_applications
  for update to authenticated
  using (public.suro_can('contract.edit'))
  with check (public.suro_can('contract.edit'));

-- Sinistres : respecter claim.handle
drop policy if exists suro_admin_update_claims on public.insurance_claims;
create policy suro_admin_update_claims on public.insurance_claims
  for update to authenticated
  using (public.suro_can('claim.handle'))
  with check (public.suro_can('claim.handle'));

-- Messages sinistre (réponse équipe) : respecter claim.handle
drop policy if exists suro_admin_insert_claim_messages on public.insurance_claim_messages;
create policy suro_admin_insert_claim_messages on public.insurance_claim_messages
  for insert to authenticated
  with check (
    public.suro_can('claim.handle')
    and sender = 'admin'
  );

-- Dépôt document staff : respecter document.upload
drop policy if exists "suro_documents insert staff" on public.insurance_documents;
create policy "suro_documents insert staff" on public.insurance_documents
  for insert to authenticated
  with check (
    public.suro_can('document.upload')
    and document_type is null
  );

-- Upload storage staff (attestation, carte verte…) : respecter document.upload
drop policy if exists suro_staff_upload_documents on storage.objects;
create policy suro_staff_upload_documents on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'suro-documents'
    and public.suro_can('document.upload')
  );
