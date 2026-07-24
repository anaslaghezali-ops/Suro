-- Vérification PROD — aucune table cabinet ne doit exister
-- Exécuter sur le projet eprtmdugiusidtbwzozj (lecture seule, safe)
-- Résultat attendu : 0 ligne pour chaque requête

select 'suro_cabinets' as tbl where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_cabinets'
);

select 'suro_broker_tasks' as tbl where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_broker_tasks'
);

select 'suro_cabinet_users' as tbl where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'suro_cabinet_users'
);

-- Si aucune ligne retournée → prod non touchée par le module cabinet ✓
