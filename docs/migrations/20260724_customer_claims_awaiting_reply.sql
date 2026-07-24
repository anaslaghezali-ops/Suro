-- =====================================================================
-- Sinistres : messages SURO en attente de réponse client
-- Miroir de suro_claims_needing_reply (côté staff).
--
-- Retourne les sinistres du client connecté dont le dernier message
-- a été envoyé par l'équipe (sender = admin).
-- =====================================================================

create or replace function public.suro_claims_awaiting_customer_reply()
 returns table(claim_id uuid, last_at timestamptz, last_body text, claim_type text)
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
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
$function$;

revoke execute on function public.suro_claims_awaiting_customer_reply() from anon, public;
grant execute on function public.suro_claims_awaiting_customer_reply() to authenticated;
