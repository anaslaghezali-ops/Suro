-- =====================================================================
-- operating_mode — interdiction de PATCH direct sur suro_settings
-- La bascule passe UNIQUEMENT par suro_switch_operating_mode() (garde-fous M2).
-- =====================================================================

create or replace function public.suro_trg_guard_operating_mode_update()
  returns trigger
  language plpgsql
  set search_path to 'public'
as $$
begin
  if old.key = 'operating_mode'
     and new.value is distinct from old.value
     and coalesce(current_setting('suro.switch_operating_mode', true), '') <> '1' then
    raise exception 'operating_mode : utiliser la RPC suro_switch_operating_mode()';
  end if;
  return new;
end;
$$;

drop trigger if exists suro_trg_guard_operating_mode_update on public.suro_settings;
create trigger suro_trg_guard_operating_mode_update
  before update on public.suro_settings
  for each row execute function public.suro_trg_guard_operating_mode_update();

-- Autoriser la RPC à écrire operating_mode
create or replace function public.suro_switch_operating_mode(p_mode text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_current text;
  v_open_tasks bigint := 0;
  v_open_claims bigint := 0;
  v_pending_kyc bigint := 0;
  v_pending_claims bigint := 0;
begin
  if not public.suro_has_role(array['super_admin', 'admin']::public.suro_role[]) then
    raise exception 'Réservé aux admins SURO';
  end if;

  if p_mode not in ('intermediaire', 'courtier') then
    raise exception 'Mode invalide : %', p_mode;
  end if;

  v_current := public.suro_get_operating_mode();
  if v_current = p_mode then
    return jsonb_build_object('ok', true, 'mode', p_mode, 'unchanged', true);
  end if;

  if p_mode = 'courtier' then
    select count(*) into v_open_tasks
    from public.suro_broker_tasks
    where status not in ('police_emise', 'refuse', 'cloture');

    select count(*) into v_open_claims
    from public.suro_claim_cabinet
    where broker_status <> 'cloture';

    if v_open_tasks > 0 or v_open_claims > 0 then
      return jsonb_build_object(
        'ok', false,
        'error', 'open_intermediaire_work',
        'message', 'Clôturer ou terminer les dossiers/sinistres cabinet avant bascule courtier.',
        'open_tasks', v_open_tasks,
        'open_claims', v_open_claims);
    end if;
  else
    select count(*) into v_pending_kyc
    from public.suro_notifications n
    where n.audience = 'admin'
      and n.type = 'kyc_ready_for_ops'
      and n.ref_type = 'application'
      and not exists (
        select 1 from public.suro_broker_tasks t
        where t.application_id = n.ref_id
          and t.status in ('police_emise', 'refuse', 'cloture')
      );

    select count(*) into v_pending_claims
    from public.suro_notifications n
    where n.audience = 'admin'
      and n.type = 'claim_ready_for_ops'
      and n.ref_type = 'claim'
      and not exists (
        select 1 from public.suro_claim_cabinet cc
        where cc.claim_id = n.ref_id
          and cc.broker_status = 'cloture'
      );

    if v_pending_kyc > 0 or v_pending_claims > 0 then
      return jsonb_build_object(
        'ok', false,
        'error', 'open_courtier_work',
        'message', 'Traiter les dossiers/sinistres Ops en cours avant bascule intermédiaire.',
        'pending_kyc', v_pending_kyc,
        'pending_claims', v_pending_claims);
    end if;
  end if;

  perform set_config('suro.switch_operating_mode', '1', true);

  insert into public.suro_settings (key, value, updated_at)
  values ('operating_mode', p_mode, now())
  on conflict (key) do update
    set value = excluded.value, updated_at = excluded.updated_at;

  insert into public.suro_audit_log(actor_id, actor_email, action, entity, changes)
  values (
    auth.uid(), coalesce(auth.jwt() ->> 'email', ''),
    'update', 'settings',
    jsonb_build_object('operating_mode', p_mode, 'previous', v_current));

  return jsonb_build_object('ok', true, 'mode', p_mode, 'previous', v_current);
end;
$$;
