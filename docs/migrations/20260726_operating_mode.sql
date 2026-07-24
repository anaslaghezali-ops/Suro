-- =====================================================================
-- MODE D'EXPLOITATION — intermediaire | courtier
-- Une plateforme, deux modes métier (flag suro_settings.operating_mode).
-- Dépend de 20260725_cabinet_module.sql (trigger KYC + auto-check).
-- =====================================================================

-- Valeur par défaut : intermédiaire (cabinets partenaires)
insert into public.suro_settings (key, value, updated_at)
values ('operating_mode', 'intermediaire', now())
on conflict (key) do nothing;

-- Lecture du mode (défaut : intermediaire)
create or replace function public.suro_get_operating_mode()
  returns text
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select case coalesce(
    (select value from public.suro_settings where key = 'operating_mode'),
    'intermediaire'
  )
  when 'courtier' then 'courtier'
  else 'intermediaire'
  end;
$$;

-- File Ops interne (mode courtier) : KYC complet → notification staff, pas de cabinet
create or replace function public.suro_courtier_enqueue_kyc_review(p_application_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_app record;
  v_check jsonb;
  v_msg text := 'Votre dossier est en cours de validation par SURO.';
begin
  if exists (
    select 1 from public.suro_notifications
    where audience = 'admin'
      and type = 'kyc_ready_for_ops'
      and ref_type = 'application'
      and ref_id = p_application_id
  ) then
    return;
  end if;

  select * into v_app from public.insurance_applications where id = p_application_id;
  if v_app is null or v_app.paid_at is null or v_app.status <> 'active' then
    return;
  end if;

  v_check := public.suro_cabinet_auto_check(p_application_id);
  if not coalesce((v_check->>'passed')::boolean, false) then
    return;
  end if;

  perform public.suro_notify(
    'admin', null, 'kyc_ready_for_ops',
    'Dossier KYC complet — traitement interne',
    coalesce(v_app.customer_email, '') || ' — ' ||
      coalesce(v_app.marque || ' ' || v_app.modele, 'véhicule') ||
      ' — prêt pour validation Ops',
    'application', p_application_id);

  perform public.suro_notify_customer(
    v_app.customer_email, 'dossier_validation', 'Dossier en cours', v_msg,
    'application', p_application_id);
end;
$$;

-- Trigger KYC : route selon le mode plateforme
create or replace function public.suro_trg_kyc_complete_create_task()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if public.suro_get_operating_mode() = 'courtier' then
    perform public.suro_courtier_enqueue_kyc_review(new.application_id);
  else
    perform public.suro_cabinet_try_create_task(new.application_id);
  end if;
  return new;
end;
$$;
