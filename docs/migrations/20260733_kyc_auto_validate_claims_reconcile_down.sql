-- Rollback partiel : fonctions ajoutées (les backfills ne sont pas annulés)

drop function if exists public.suro_cabinet_reconcile_claims_for_application(uuid);
drop function if exists public.suro_kyc_sync_inherited_identity(uuid);

-- Restaurer trigger KYC sans sync (état 20260732)
create or replace function public.suro_trg_kyc_complete_create_task()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  begin
    if public.suro_get_operating_mode() = 'courtier' then
      perform public.suro_courtier_enqueue_kyc_review(new.application_id);
    else
      perform public.suro_cabinet_try_create_task(new.application_id);
    end if;
  exception when others then
    raise warning 'suro_trg_kyc_task application=%: %', new.application_id, sqlerrm;
    perform public.suro_log_cabinet_trigger_error(
      'insurance_documents', new.id, 'suro_trg_kyc_complete_create_task', sqlerrm);
  end;
  return new;
end;
$$;
