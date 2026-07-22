-- =====================================================================
-- SÉCURITÉ — Jour 1 : verrouiller le paiement
-- Appliqué sur le projet Supabase eprtmdugiusidtbwzozj.
--
-- Avant : suro_mark_application_paid(app_id) passait N'IMPORTE quel devis
-- 'nouvelle' à 'active' par id, sans vérifier le propriétaire ni exiger
-- d'authentification (appelable en anon). N'importe qui pouvait activer le
-- contrat d'autrui.
--
-- Après : authentification obligatoire + le devis doit appartenir à
-- l'appelant (email du JWT, insensible à la casse). Idempotent si déjà payé
-- par le même propriétaire. Exécution retirée à anon/public.
-- Côté front : submitPayment envoie désormais le JWT (asUser:true).
--
-- NB : le paiement reste SIMULÉ (pas de vrai encaissement) — assumé en
-- pré-prod. Avec un vrai prestataire, l'activation devra passer par un
-- webhook serveur, pas par un appel client.
-- =====================================================================

create or replace function public.suro_mark_application_paid(app_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_caller text; v_status text; v_owner text; v_amount numeric;
begin
  v_caller := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_caller = '' then
    raise exception 'Authentification requise pour le paiement';
  end if;

  select status, lower(customer_email), annual_premium
    into v_status, v_owner, v_amount
    from public.insurance_applications
    where id = app_id;

  if not found or v_owner is distinct from v_caller then
    raise exception 'Devis introuvable ou non autorisé';
  end if;

  -- Idempotent : si déjà actif et possédé par l'appelant, on ne fait rien.
  if v_status = 'nouvelle' then
    update public.insurance_applications
      set status = 'active', paid_at = now(),
          expires_at = now() + interval '1 year', updated_at = now()
      where id = app_id;

    insert into public.suro_payments(application_id, customer_email, amount, kind)
    values (app_id, v_owner, v_amount, 'initial');
  end if;
end; $function$;

revoke execute on function public.suro_mark_application_paid(uuid) from anon, public;
grant execute on function public.suro_mark_application_paid(uuid) to authenticated;
