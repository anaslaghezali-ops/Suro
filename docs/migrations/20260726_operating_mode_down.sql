-- =====================================================================
-- ROLLBACK — Mode d'exploitation (operating_mode)
-- =====================================================================

-- Restaurer le trigger cabinet-only (si module cabinet encore présent)
create or replace function public.suro_trg_kyc_complete_create_task()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  perform public.suro_cabinet_try_create_task(new.application_id);
  return new;
end;
$$;

drop function if exists public.suro_courtier_enqueue_kyc_review(uuid);
drop function if exists public.suro_get_operating_mode();

delete from public.suro_settings where key = 'operating_mode';
