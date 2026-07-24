-- =====================================================================
-- Round-robin — edge cases inter/intra cabinet + C1
-- Usage : psql ... -v ON_ERROR_STOP=1 -f staging/scripts/test-round-robin.sql
-- =====================================================================

\echo '=== TEST ROUND-ROBIN EDGE CASES ==='

\ir test-fixtures.sql

create or replace function test.seed_kyc_docs(p_app uuid, p_email text)
  returns void language plpgsql as $$
declare v_slot text;
  v_slots text[] := array[
    'cin:recto','cin:verso','permis:recto','permis:verso',
    'carte_grise:recto','carte_grise:verso'
  ];
begin
  foreach v_slot in array v_slots loop
    insert into public.insurance_documents (
      application_id, customer_email, name, storage_path,
      document_type, document_side
    ) values (
      p_app, p_email, split_part(v_slot, ':', 1) || '_' || split_part(v_slot, ':', 2),
      p_app::text || '/' || v_slot,
      split_part(v_slot, ':', 1), split_part(v_slot, ':', 2)
    );
  end loop;
end;
$$;

do $rr$
declare
  v_agma uuid;
  v_atlas uuid;
  v_app1 uuid := 'e1111111-1111-1111-1111-111111111101';
  v_app2 uuid := 'e1111111-1111-1111-1111-111111111102';
  v_app3 uuid := 'e1111111-1111-1111-1111-111111111103';
  v_app4 uuid := 'e1111111-1111-1111-1111-111111111104';
  v_app5 uuid := 'e1111111-1111-1111-1111-111111111105';
  v_cab1 uuid;
  v_cab2 uuid;
  v_task1 uuid;
  v_task2 uuid;
  v_assign1 uuid;
  v_assign2 uuid;
  v_notif_count int;
begin
  perform test.reset_auth();

  select id into v_agma from public.suro_cabinets where slug = 'agma';
  select id into v_atlas from public.suro_cabinets where slug = 'atlas';

  update public.suro_cabinets set is_active = true, last_task_at = null;
  update public.suro_cabinet_users set last_assigned_at = null
    where cabinet_id in (v_agma, v_atlas) and is_active = true;

  -- ---------- 1. Inter-cabinets : 2 dossiers KYC → 2 cabinets (last_task_at) ----------
  delete from public.suro_broker_tasks where application_id in (v_app1, v_app2);
  delete from public.insurance_documents where application_id in (v_app1, v_app2);
  delete from public.insurance_applications where id in (v_app1, v_app2);

  insert into public.insurance_applications (
    id, customer_name, customer_email, status, paid_at, marque, modele
  ) values
    (v_app1, 'RR Inter 1', 'rr.inter1@test.local', 'active', now(), 'Peugeot', '208'),
    (v_app2, 'RR Inter 2', 'rr.inter2@test.local', 'active', now(), 'Toyota', 'Yaris');

  perform test.seed_kyc_docs(v_app1, 'rr.inter1@test.local');
  perform test.seed_kyc_docs(v_app2, 'rr.inter2@test.local');

  select t.id, t.cabinet_id into v_task1, v_cab1
  from public.suro_broker_tasks t where t.application_id = v_app1;
  select t.id, t.cabinet_id into v_task2, v_cab2
  from public.suro_broker_tasks t where t.application_id = v_app2;

  if v_task1 is null or v_task2 is null then
    raise exception 'FUITE round-robin inter: tâches non créées (%, %)', v_task1, v_task2;
  end if;
  if v_cab1 = v_cab2 then
    raise exception 'FUITE round-robin inter: même cabinet % pour 2 dossiers consécutifs', v_cab1;
  end if;

  raise notice 'OK inter-cabinets — app1→cabinet %, app2→cabinet %', v_cab1, v_cab2;

  -- ---------- 2. Intra-cabinet : 2 dossiers même cabinet → 2 gestionnaires ----------
  delete from public.suro_broker_tasks where application_id in (v_app3, v_app4);
  delete from public.insurance_documents where application_id in (v_app3, v_app4);
  delete from public.insurance_applications where id in (v_app3, v_app4);

  update public.suro_cabinets set is_active = true, last_task_at = null;
  update public.suro_cabinets set is_active = false where slug = 'atlas';
  update public.suro_cabinet_users set last_assigned_at = null where cabinet_id = v_agma;

  insert into public.insurance_applications (
    id, customer_name, customer_email, status, paid_at, marque, modele
  ) values
    (v_app3, 'RR Intra 1', 'rr.intra1@test.local', 'active', now(), 'Ford', 'Fiesta'),
    (v_app4, 'RR Intra 2', 'rr.intra2@test.local', 'active', now(), 'Hyundai', 'i20');

  perform test.seed_kyc_docs(v_app3, 'rr.intra1@test.local');
  perform test.seed_kyc_docs(v_app4, 'rr.intra2@test.local');

  select t.assigned_to into v_assign1 from public.suro_broker_tasks t where t.application_id = v_app3;
  select t.assigned_to into v_assign2 from public.suro_broker_tasks t where t.application_id = v_app4;

  if v_assign1 is null or v_assign2 is null then
    raise exception 'FUITE round-robin intra: assigned_to null (%, %)', v_assign1, v_assign2;
  end if;
  if v_assign1 = v_assign2 then
    raise exception 'FUITE round-robin intra: même gestionnaire % pour 2 dossiers AGMA', v_assign1;
  end if;

  update public.suro_cabinets set is_active = true where slug = 'atlas';

  raise notice 'OK intra-cabinet AGMA — gest1=%, gest2=%', v_assign1, v_assign2;

  -- ---------- 3. 0 gestionnaire dans le cabinet → assigned_to null, pas d''erreur ----------
  delete from public.suro_broker_tasks where application_id = v_app5;
  delete from public.insurance_documents where application_id = v_app5;
  delete from public.insurance_applications where id = v_app5;

  update public.suro_cabinets set last_task_at = now() where id = v_agma;
  update public.suro_cabinets set last_task_at = null where id = v_atlas;
  update public.suro_cabinet_users set is_active = true;
  update public.suro_cabinet_users set is_active = false where cabinet_id = v_atlas;

  insert into public.insurance_applications (
    id, customer_name, customer_email, status, paid_at, marque, modele
  ) values (
    v_app5, 'RR No Gest', 'rr.nogest@test.local', 'active', now(), 'Citroen', 'C3'
  );

  begin
    perform test.seed_kyc_docs(v_app5, 'rr.nogest@test.local');
  exception when others then
    raise exception 'FUITE: erreur avec 0 gestionnaire Atlas: %', sqlerrm;
  end;

  if not exists (
    select 1 from public.suro_broker_tasks
    where application_id = v_app5 and cabinet_id = v_atlas and assigned_to is null
  ) then
    raise exception 'FUITE: assigned_to devrait être null avec 0 gestionnaire actif dans Atlas';
  end if;

  update public.suro_cabinet_users set is_active = true where cabinet_id = v_atlas;
  raise notice 'OK 0 gestionnaire — tâche créée sans erreur, assigned_to=null si applicable';

  -- ---------- 4. 0 cabinet actif → notif Ops, pas d''échec (C1) ----------
  update public.suro_cabinets set is_active = false;

  delete from public.suro_broker_tasks where application_id = 'f1111111-1111-1111-1111-111111111101';
  delete from public.insurance_documents where application_id = 'f1111111-1111-1111-1111-111111111101';
  delete from public.insurance_applications where id = 'f1111111-1111-1111-1111-111111111101';
  delete from public.suro_notifications
    where ref_id = 'f1111111-1111-1111-1111-111111111101' and type = 'cabinet_unassigned';

  insert into public.insurance_applications (
    id, customer_name, customer_email, status, paid_at, marque, modele
  ) values (
    'f1111111-1111-1111-1111-111111111101',
    'RR Unassigned', 'rr.unassigned@test.local', 'active', now(), 'Kia', 'Rio'
  );

  begin
    perform test.seed_kyc_docs('f1111111-1111-1111-1111-111111111101', 'rr.unassigned@test.local');
  exception when others then
    raise exception 'FUITE C1: trigger KYC a échoué avec 0 cabinet actif: %', sqlerrm;
  end;

  if exists (
    select 1 from public.suro_broker_tasks
    where application_id = 'f1111111-1111-1111-1111-111111111101'
  ) then
    raise exception 'FUITE C1: tâche créée sans cabinet actif';
  end if;

  select count(*) into v_notif_count
  from public.suro_notifications
  where audience = 'admin'
    and type = 'cabinet_unassigned'
    and ref_type = 'application'
    and ref_id = 'f1111111-1111-1111-1111-111111111101';

  if v_notif_count < 1 then
    raise exception 'FUITE C1: notification cabinet_unassigned absente';
  end if;

  update public.suro_cabinets set is_active = true;
  raise notice 'OK C1 — 0 cabinet actif: pas de tâche, notif Ops cabinet_unassigned créée';
end;
$rr$;

select test.reset_auth();

\echo '=== ROUND-ROBIN : PASS ==='
