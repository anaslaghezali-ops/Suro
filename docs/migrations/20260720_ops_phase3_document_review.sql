-- =====================================================================
-- OPS PORTAL — PHASE 3 : Validation des documents
-- Appliqué le 2026-07-20 sur le projet Supabase eprtmdugiusidtbwzozj.
-- RPC SECURITY DEFINER : contrôle de rôle + audit + notification client.
-- =====================================================================

create or replace function public.suro_review_document(
  p_id uuid, p_status text, p_reason text default null)
  returns void language plpgsql security definer set search_path to 'public' as $$
declare v_email text;
begin
  if not public.suro_has_role(array['super_admin','admin','operations']::public.suro_role[]) then
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

revoke all on function public.suro_review_document(uuid, text, text) from public;
grant execute on function public.suro_review_document(uuid, text, text) to authenticated;
