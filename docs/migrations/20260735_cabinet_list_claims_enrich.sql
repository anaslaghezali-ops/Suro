-- Enrichir liste sinistres cabinet : email client pour affichage
drop function if exists public.suro_cabinet_list_claims(text, integer, integer);

create or replace function public.suro_cabinet_list_claims(
  p_status text default null, p_limit int default 50, p_offset int default 0)
  returns table(
    claim_id uuid,
    application_id uuid,
    broker_status text,
    claim_type text,
    claim_date timestamptz,
    created_at timestamptz,
    customer_name text,
    customer_email text,
    immatriculation text,
    marque text,
    modele text,
    assigned_to uuid
  )
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
declare
  v_cabinet uuid;
begin
  select cabinet_id into v_cabinet from public.suro_cabinet_context();
  if v_cabinet is null then
    raise exception 'Non autorisé';
  end if;

  return query
  select c.id, c.application_id, cc.broker_status,
         c.claim_type, c.claim_date, c.created_at,
         a.customer_name, a.customer_email, a.immatriculation,
         a.marque, a.modele, cc.assigned_to
  from public.suro_claim_cabinet cc
  join public.insurance_claims c on c.id = cc.claim_id
  join public.insurance_applications a on a.id = c.application_id
  where cc.cabinet_id = v_cabinet
    and (p_status is null or cc.broker_status = p_status)
  order by cc.updated_at desc
  limit least(coalesce(p_limit, 50), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.suro_cabinet_list_claims(text, integer, integer) from public;
grant execute on function public.suro_cabinet_list_claims(text, integer, integer) to authenticated;
