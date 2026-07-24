-- Vérification PROD — module cabinet absent
-- Exécuter sur le projet eprtmdugiusidtbwzozj (lecture seule, safe)
-- Résultat attendu : 0 ligne pour TOUTES les requêtes

-- ---------- 7 tables cabinet ----------
select 'suro_cabinets' as object_type, 'table' as kind where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_cabinets'
);

select 'suro_cabinet_users' as object_type, 'table' as kind where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_cabinet_users'
);

select 'suro_broker_tasks' as object_type, 'table' as kind where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_broker_tasks'
);

select 'suro_task_events' as object_type, 'table' as kind where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_task_events'
);

select 'suro_claim_cabinet' as object_type, 'table' as kind where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_claim_cabinet'
);

select 'suro_claim_status_events' as object_type, 'table' as kind where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_claim_status_events'
);

select 'suro_cabinet_notifications' as object_type, 'table' as kind where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_cabinet_notifications'
);

-- ---------- Fonctions clés cabinet ----------
select 'suro_cabinet_context' as object_type, 'function' as kind where exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'suro_cabinet_context'
);

select 'suro_broker_tasks_fn' as object_type, 'function' as kind where exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'suro_cabinet_try_create_task'
);

select 'user_cabinet_ids' as object_type, 'function' as kind where exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'user_cabinet_ids'
);

select 'suro_get_operating_mode' as object_type, 'function' as kind where exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'suro_get_operating_mode'
);

select 'suro_switch_operating_mode' as object_type, 'function' as kind where exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'suro_switch_operating_mode'
);

-- Si aucune ligne retournée → prod non touchée par le module cabinet ✓
