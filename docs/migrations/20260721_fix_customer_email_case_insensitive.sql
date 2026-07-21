-- =====================================================================
-- CORRECTIF : correspondance email client insensible à la casse
-- Appliqué sur le projet Supabase eprtmdugiusidtbwzozj.
--
-- Bug : Supabase Auth stocke l'email du compte en minuscules, mais les
-- demandes étaient enregistrées avec l'email tel que saisi (ex:
-- « ae@gmail.Com »). La comparaison RLS étant sensible à la casse
-- (customer_email = auth.jwt()->>'email'), un client ayant tapé une
-- majuscule ne voyait AUCUN de ses contrats/paiements/documents/sinistres.
--
-- Correctif : comparaisons RLS insensibles à la casse + normalisation des
-- données existantes. Le front normalise aussi l'email en minuscules à
-- l'inscription / connexion / création de demande (js/services/api.js).
-- =====================================================================

-- 1. Normaliser les emails déjà enregistrés (aligne sur auth.users en minuscules)
update public.insurance_applications set customer_email = lower(customer_email)
  where customer_email is not null and customer_email <> lower(customer_email);
update public.insurance_documents set customer_email = lower(customer_email)
  where customer_email is not null and customer_email <> lower(customer_email);
update public.suro_payments set customer_email = lower(customer_email)
  where customer_email is not null and customer_email <> lower(customer_email);
update public.suro_notifications set user_email = lower(user_email)
  where user_email is not null and user_email <> lower(user_email);

-- 2. Politiques RLS de lecture client → insensibles à la casse
drop policy if exists suro_customer_read_own_applications on public.insurance_applications;
create policy suro_customer_read_own_applications on public.insurance_applications
  for select to authenticated
  using (lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email','')));

drop policy if exists suro_customer_read_own_documents on public.insurance_documents;
create policy suro_customer_read_own_documents on public.insurance_documents
  for select to authenticated
  using (lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email','')));

drop policy if exists "suro_payments select own" on public.suro_payments;
create policy "suro_payments select own" on public.suro_payments
  for select to authenticated
  using (lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email','')));

drop policy if exists suro_customer_read_own_claims on public.insurance_claims;
create policy suro_customer_read_own_claims on public.insurance_claims
  for select to authenticated
  using (exists (
    select 1 from public.insurance_applications a
    where a.id = insurance_claims.application_id
      and lower(a.customer_email) = lower(coalesce(auth.jwt() ->> 'email',''))));

drop policy if exists suro_customer_read_notifications on public.suro_notifications;
create policy suro_customer_read_notifications on public.suro_notifications
  for select to authenticated
  using (audience = 'customer' and lower(user_email) = lower(coalesce(auth.jwt() ->> 'email','')));

drop policy if exists suro_customer_mark_read on public.suro_notifications;
create policy suro_customer_mark_read on public.suro_notifications
  for update to authenticated
  using (audience = 'customer' and lower(user_email) = lower(coalesce(auth.jwt() ->> 'email','')));

-- 3. Téléchargement des documents depuis le storage → insensible à la casse
drop policy if exists suro_customer_download_own_documents on storage.objects;
create policy suro_customer_download_own_documents on storage.objects
  for select to authenticated
  using (bucket_id = 'suro-documents' and exists (
    select 1 from public.insurance_documents d
    where d.storage_path = objects.name
      and lower(d.customer_email) = lower(coalesce(auth.jwt() ->> 'email',''))));

-- 4. Renouvellement : correspondance email insensible à la casse
create or replace function public.suro_renew_application(app_id uuid)
 returns timestamptz language plpgsql security definer set search_path to 'public'
as $function$
declare v_email text; v_current timestamptz; v_new timestamptz; v_amount numeric;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select expires_at, annual_premium into v_current, v_amount
    from public.insurance_applications
    where id = app_id and lower(customer_email) = v_email;
  if not found then raise exception 'Contrat introuvable ou non autorisé'; end if;

  v_new := greatest(coalesce(v_current, now()), now()) + interval '1 year';
  update public.insurance_applications
    set status = 'active', expires_at = v_new, paid_at = now(), updated_at = now()
    where id = app_id and lower(customer_email) = v_email;

  insert into public.suro_payments(application_id, customer_email, amount, kind)
  values (app_id, v_email, v_amount, 'renewal');

  return v_new;
end; $function$;
