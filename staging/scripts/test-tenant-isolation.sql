-- =====================================================================
-- Checklist #5 — Isolation multi-tenant (AGMA ↔ Atlas)
-- Usage : psql ... -v ON_ERROR_STOP=1 -f staging/scripts/test-tenant-isolation.sql
-- Prérequis : migrations cabinet + test-fixtures.sql
-- =====================================================================

\echo '=== TEST ISOLATION MULTI-TENANT ==='

\ir test-fixtures.sql

do $agma$
declare
  v_atlas_cabinet uuid;
  v_agma_cabinet uuid;
  v_atlas_task uuid := 'c1111111-1111-1111-1111-111111111102';
  v_atlas_claim uuid := 'd1111111-1111-1111-1111-111111111102';
  v_leak_list int;
  v_leak_count int;
  v_err text;
begin
  select id into v_agma_cabinet from public.suro_cabinets where slug = 'agma';
  select id into v_atlas_cabinet from public.suro_cabinets where slug = 'atlas';

  -- ---------- Contexte gestionnaire.agma ----------
  perform test.set_auth('a1111111-1111-1111-1111-111111111101'::uuid);

  select count(*) into v_leak_list
  from public.suro_cabinet_list_tasks() lst
  join public.suro_broker_tasks t on t.id = lst.task_id
  where t.cabinet_id = v_atlas_cabinet;

  if v_leak_list > 0 then
    raise exception 'FUITE: gestionnaire.agma voit % dossier(s) Atlas via suro_cabinet_list_tasks', v_leak_list;
  end if;

  select count(*) into v_leak_count
  from public.suro_broker_tasks
  where cabinet_id = v_atlas_cabinet;

  if v_leak_count > 0 then
    raise exception 'FUITE: gestionnaire.agma voit % ligne(s) Atlas via SELECT RLS', v_leak_count;
  end if;

  begin
    perform public.suro_cabinet_task_action(v_atlas_task, 'valider');
    raise exception 'FUITE: suro_cabinet_task_action Atlas autorisé pour gestionnaire.agma';
  exception when others then
    v_err := sqlerrm;
    if v_err not like '%Accès refusé%' then
      raise exception 'FUITE: task_action Atlas — exception attendue Accès refusé, reçu: %', v_err;
    end if;
  end;

  begin
    perform public.suro_cabinet_claim_set_status(v_atlas_claim, 'cloture');
    raise exception 'FUITE: suro_cabinet_claim_set_status Atlas autorisé pour gestionnaire.agma';
  exception when others then
    v_err := sqlerrm;
    if v_err not like '%Accès refusé%' then
      raise exception 'FUITE: claim_set_status Atlas — exception attendue Accès refusé, reçu: %', v_err;
    end if;
  end;

  raise notice 'OK gestionnaire.agma — 0 fuite Atlas (list_tasks, RLS, task_action, claim_set_status)';
end;
$agma$;

do $atlas$
declare
  v_atlas_cabinet uuid;
  v_agma_cabinet uuid;
  v_leak_list int;
  v_leak_count int;
  v_err text;
begin
  select id into v_agma_cabinet from public.suro_cabinets where slug = 'agma';
  select id into v_atlas_cabinet from public.suro_cabinets where slug = 'atlas';

  -- ---------- Contexte gestionnaire.atlas (miroir) ----------
  perform test.set_auth('a1111111-1111-1111-1111-111111111102'::uuid);

  select count(*) into v_leak_list
  from public.suro_cabinet_list_tasks() lst
  join public.suro_broker_tasks t on t.id = lst.task_id
  where t.cabinet_id = v_agma_cabinet;

  if v_leak_list > 0 then
    raise exception 'FUITE: gestionnaire.atlas voit % dossier(s) AGMA via suro_cabinet_list_tasks', v_leak_list;
  end if;

  select count(*) into v_leak_count
  from public.suro_broker_tasks
  where cabinet_id = v_agma_cabinet;

  if v_leak_count > 0 then
    raise exception 'FUITE: gestionnaire.atlas voit % ligne(s) AGMA via SELECT RLS', v_leak_count;
  end if;

  begin
    perform public.suro_cabinet_task_action('c1111111-1111-1111-1111-111111111101', 'valider');
    raise exception 'FUITE: suro_cabinet_task_action AGMA autorisé pour gestionnaire.atlas';
  exception when others then
    v_err := sqlerrm;
    if v_err not like '%Accès refusé%' then
      raise exception 'FUITE: task_action AGMA — exception attendue Accès refusé, reçu: %', v_err;
    end if;
  end;

  begin
    perform public.suro_cabinet_claim_set_status('d1111111-1111-1111-1111-111111111101', 'cloture');
    raise exception 'FUITE: claim_set_status AGMA autorisé pour gestionnaire.atlas';
  exception when others then
    v_err := sqlerrm;
    if v_err not like '%Accès refusé%' then
      raise exception 'FUITE: claim_set_status AGMA — exception attendue Accès refusé, reçu: %', v_err;
    end if;
  end;

  raise notice 'OK gestionnaire.atlas — 0 fuite AGMA (list_tasks, RLS, task_action, claim_set_status)';
end;
$atlas$;

select test.reset_auth();

\echo '=== ISOLATION MULTI-TENANT : PASS ==='
