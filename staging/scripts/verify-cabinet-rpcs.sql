-- Vérifie que les RPC cabinet + operating_mode sont présentes (staging / prod post-migration).
-- Résultat attendu : une ligne par objet, status = OK
-- Usage : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f staging/scripts/verify-cabinet-rpcs.sql

select 'suro_get_operating_mode' as rpc,
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'suro_get_operating_mode'
  ) then 'OK' else 'MANQUANT' end as status;

select 'suro_switch_operating_mode' as rpc,
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'suro_switch_operating_mode'
  ) then 'OK' else 'MANQUANT' end as status;

select 'suro_ops_cabinet_overview' as rpc,
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'suro_ops_cabinet_overview'
  ) then 'OK' else 'MANQUANT' end as status;

select 'suro_staff_set_cabinet_active' as rpc,
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'suro_staff_set_cabinet_active'
  ) then 'OK' else 'MANQUANT' end as status;

select 'operating_mode_setting' as rpc,
  case when exists (
    select 1 from public.suro_settings where key = 'operating_mode'
  ) then 'OK' else 'MANQUANT' end as status;

select 'guard_trigger' as rpc,
  case when exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'suro_settings'
      and t.tgname = 'suro_trg_guard_operating_mode_update'
  ) then 'OK' else 'MANQUANT' end as status;
