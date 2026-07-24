-- Fixtures rejouables — isolation inter-tenant + round-robin
-- Exécuter après apply-migrations.sh (harness ou staging)

create schema if not exists test;

create or replace function test.set_auth(p_user uuid)
  returns void language plpgsql as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = p_user;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'email', coalesce(v_email, ''))::text,
    true);
end;
$$;

create or replace function test.reset_auth()
  returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

-- UUIDs stables (documentés dans CABINET_TEST_REPORT.md)
-- gestionnaire.agma@suro.ma
-- gestionnaire.atlas@suro.ma
-- gestionnaire2.agma@suro.ma (intra-cabinet)

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111101', 'gestionnaire.agma@suro.ma', '{"name":"Ahmed AGMA"}'),
  ('a1111111-1111-1111-1111-111111111102', 'gestionnaire.atlas@suro.ma', '{"name":"Fatima Atlas"}'),
  ('a1111111-1111-1111-1111-111111111103', 'gestionnaire2.agma@suro.ma', '{"name":"Youssef AGMA"}')
on conflict (id) do update set email = excluded.email;

insert into public.suro_cabinet_users (cabinet_id, user_id, role, display_name, is_active)
select c.id, u.id, u.role::public.suro_cabinet_role, u.display_name, true
from (values
  ('agma', 'a1111111-1111-1111-1111-111111111101'::uuid, 'gestionnaire', 'Ahmed AGMA'),
  ('atlas', 'a1111111-1111-1111-1111-111111111102'::uuid, 'gestionnaire', 'Fatima Atlas'),
  ('agma', 'a1111111-1111-1111-1111-111111111103'::uuid, 'gestionnaire', 'Youssef AGMA')
) as u(slug, id, role, display_name)
join public.suro_cabinets c on c.slug = u.slug
on conflict (cabinet_id, user_id) do update
  set role = excluded.role, display_name = excluded.display_name, is_active = true;

-- Mode intermédiaire (cabinets actifs)
insert into public.suro_settings (key, value, updated_at)
values ('operating_mode', 'intermediaire', now())
on conflict (key) do update set value = 'intermediaire', updated_at = now();

update public.suro_cabinets set is_active = true, last_task_at = null;

-- Applications + tâches + sinistres (AGMA vs Atlas)
insert into public.insurance_applications (
  id, customer_name, customer_email, status, paid_at, marque, modele, immatriculation
) values
  ('b1111111-1111-1111-1111-111111111101', 'Client AGMA', 'client.agma@test.local', 'active', now(), 'Dacia', 'Logan', 'A-12345'),
  ('b1111111-1111-1111-1111-111111111102', 'Client Atlas', 'client.atlas@test.local', 'active', now(), 'Renault', 'Clio', 'B-67890')
on conflict (id) do nothing;

insert into public.suro_broker_tasks (id, application_id, cabinet_id, assigned_to, status)
select
  'c1111111-1111-1111-1111-111111111101'::uuid,
  'b1111111-1111-1111-1111-111111111101'::uuid,
  c.id,
  'a1111111-1111-1111-1111-111111111101'::uuid,
  'nouveau'
from public.suro_cabinets c where c.slug = 'agma'
on conflict (application_id) do update
  set cabinet_id = excluded.cabinet_id, assigned_to = excluded.assigned_to;

insert into public.suro_broker_tasks (id, application_id, cabinet_id, assigned_to, status)
select
  'c1111111-1111-1111-1111-111111111102'::uuid,
  'b1111111-1111-1111-1111-111111111102'::uuid,
  c.id,
  'a1111111-1111-1111-1111-111111111102'::uuid,
  'nouveau'
from public.suro_cabinets c where c.slug = 'atlas'
on conflict (application_id) do update
  set cabinet_id = excluded.cabinet_id, assigned_to = excluded.assigned_to;

insert into public.insurance_claims (id, application_id, claim_type, status)
values
  ('d1111111-1111-1111-1111-111111111101', 'b1111111-1111-1111-1111-111111111101', 'collision', 'pending'),
  ('d1111111-1111-1111-1111-111111111102', 'b1111111-1111-1111-1111-111111111102', 'collision', 'pending')
on conflict (id) do nothing;

insert into public.suro_claim_cabinet (claim_id, cabinet_id, assigned_to, broker_status)
select
  'd1111111-1111-1111-1111-111111111101'::uuid,
  c.id,
  'a1111111-1111-1111-1111-111111111101'::uuid,
  'dossier_recu'
from public.suro_cabinets c where c.slug = 'agma'
on conflict (claim_id) do update
  set cabinet_id = excluded.cabinet_id, broker_status = excluded.broker_status;

insert into public.suro_claim_cabinet (claim_id, cabinet_id, assigned_to, broker_status)
select
  'd1111111-1111-1111-1111-111111111102'::uuid,
  c.id,
  'a1111111-1111-1111-1111-111111111102'::uuid,
  'dossier_recu'
from public.suro_cabinets c where c.slug = 'atlas'
on conflict (claim_id) do update
  set cabinet_id = excluded.cabinet_id, broker_status = excluded.broker_status;

-- Grants tables post-migrations (miroir Supabase — requis pour tests RLS)
grant select on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
