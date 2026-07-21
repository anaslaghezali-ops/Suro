-- =====================================================================
-- OPS PORTAL — SYSTÈME DE PRIVILÈGES CONFIGURABLES
-- Appliqué sur le projet Supabase eprtmdugiusidtbwzozj.
--
-- Le Super Admin a TOUS les droits (implicite, jamais stocké).
-- Pour Admin / Opérations / Support, les capacités délégables sont
-- stockées dans suro_role_privileges et configurables via l'écran
-- « Privilèges ». Trois capacités restent réservées au Super Admin et
-- ne sont jamais délégables : client.delete, staff.manage, privileges.manage.
--
-- La sécurité RÉELLE est appliquée ici (RLS + fonctions SECURITY DEFINER) ;
-- le front ne fait que masquer les boutons non autorisés.
-- =====================================================================

-- ---------- Table des privilèges (matrice rôle × capacité) ----------
create table if not exists public.suro_role_privileges (
  role       public.suro_role not null,
  capability text not null,
  primary key (role, capability)
);

-- RLS activée SANS policy : la table n'est jamais lue/écrite directement
-- par les clients — uniquement via les fonctions SECURITY DEFINER ci-dessous.
alter table public.suro_role_privileges enable row level security;

-- ---------- Capacité effective de l'utilisateur courant ----------
create or replace function public.suro_can(p_cap text)
 returns boolean
 language sql stable security definer set search_path to 'public'
as $function$
  select case
    when public.suro_current_role() = 'super_admin' then true
    when p_cap = any (array['client.delete','staff.manage','privileges.manage']) then false
    else exists (select 1 from public.suro_role_privileges
                 where role = public.suro_current_role() and capability = p_cap)
  end;
$function$;

-- ---------- Liste des capacités de l'utilisateur courant (front) ----------
create or replace function public.suro_my_privileges()
 returns text[]
 language sql stable security definer set search_path to 'public'
as $function$
  select case
    when public.suro_current_role() = 'super_admin' then
      array['contract.edit','client.edit','document.review','document.upload',
            'claim.handle','settings.edit','client.delete','staff.manage','privileges.manage']
    when public.suro_current_role() is null then array[]::text[]
    else coalesce((select array_agg(capability) from public.suro_role_privileges
                   where role = public.suro_current_role()), array[]::text[])
  end;
$function$;

-- ---------- Matrice complète (écran Privilèges, super_admin) ----------
create or replace function public.suro_list_role_privileges()
 returns table(role public.suro_role, capability text)
 language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if public.suro_current_role() <> 'super_admin' then raise exception 'Réservé au Super Admin'; end if;
  return query select rp.role, rp.capability from public.suro_role_privileges rp;
end; $function$;

-- ---------- Activer / désactiver une capacité pour un rôle ----------
create or replace function public.suro_set_privilege(p_role public.suro_role, p_cap text, p_allowed boolean)
 returns text
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if public.suro_current_role() <> 'super_admin' then raise exception 'Réservé au Super Admin'; end if;
  if p_role = 'super_admin' then raise exception 'Le Super Admin a tous les droits'; end if;
  if p_cap = any (array['client.delete','staff.manage','privileges.manage']) then
    raise exception 'Capacité réservée au Super Admin'; end if;
  if p_allowed then
    insert into public.suro_role_privileges(role, capability) values (p_role, p_cap) on conflict do nothing;
  else
    delete from public.suro_role_privileges where role = p_role and capability = p_cap;
  end if;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''), 'update', 'privileges',
          jsonb_build_object('role', p_role, 'capability', p_cap, 'allowed', p_allowed));
  return 'ok';
end; $function$;

-- ---------- Édition d'un client (nom / téléphone) — capacité client.edit ----------
create or replace function public.suro_update_customer(p_email text, p_name text, p_phone text)
 returns text
 language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid;
begin
  if not public.suro_can('client.edit') then raise exception 'Non autorisé'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'Client introuvable'; end if;
  update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb)
        || jsonb_build_object('name', p_name, 'phone', p_phone)
    where id = v_id;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, entity_id, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''), 'update', 'customer', v_id,
          jsonb_build_object('email', p_email, 'name', p_name, 'phone', p_phone));
  return 'ok';
end; $function$;

-- ---------- Suppression d'un client — SUPER ADMIN uniquement ----------
create or replace function public.suro_delete_customer(p_email text)
 returns text
 language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid;
begin
  if public.suro_current_role() <> 'super_admin' then raise exception 'Réservé au Super Admin'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'Client introuvable'; end if;
  if exists (select 1 from public.suro_admins where user_id = v_id) then
    raise exception 'Ce compte fait partie de l''équipe — retirez-le d''abord des Utilisateurs';
  end if;
  delete from auth.users where id = v_id;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''), 'delete', 'customer',
          jsonb_build_object('email', p_email));
  return 'ok';
end; $function$;

-- ---------- Sinistres en attente de réponse (dernier message = client) ----------
create or replace function public.suro_claims_needing_reply()
 returns table(claim_id uuid, last_at timestamptz)
 language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_suro_staff() then raise exception 'Réservé au staff'; end if;
  return query
    with last as (
      select distinct on (m.claim_id) m.claim_id, m.sender, m.created_at
      from public.insurance_claim_messages m
      order by m.claim_id, m.created_at desc
    )
    select l.claim_id, l.created_at from last l where l.sender <> 'admin';
end; $function$;

-- ---------- Seeds par défaut (idempotents) ----------
-- Admin : toutes les capacités délégables.
-- Opérations : traitement sinistres + documents (review + dépôt).
-- Support : sinistres / messages uniquement.
insert into public.suro_role_privileges(role, capability) values
  ('admin','contract.edit'), ('admin','client.edit'), ('admin','document.review'),
  ('admin','document.upload'), ('admin','claim.handle'), ('admin','settings.edit'),
  ('operations','document.review'), ('operations','document.upload'), ('operations','claim.handle'),
  ('support','claim.handle')
on conflict do nothing;

-- ---------- Durcissement RLS aligné sur la matrice ----------
-- Contacts support (suro_settings) : capacité settings.edit.
drop policy if exists "suro_settings insert staff" on public.suro_settings;
drop policy if exists "suro_settings update staff" on public.suro_settings;
create policy "suro_settings insert staff" on public.suro_settings
  for insert to authenticated with check (public.suro_can('settings.edit'));
create policy "suro_settings update staff" on public.suro_settings
  for update to authenticated using (public.suro_can('settings.edit')) with check (public.suro_can('settings.edit'));

-- Tarification (insurance_pricing) : réservée super_admin / admin (rôle, non délégable).
drop policy if exists "suro_pricing insert staff" on public.insurance_pricing;
drop policy if exists "suro_pricing update staff" on public.insurance_pricing;
create policy "suro_pricing insert staff" on public.insurance_pricing
  for insert to authenticated with check (public.suro_has_role(array['super_admin','admin']::public.suro_role[]));
create policy "suro_pricing update staff" on public.insurance_pricing
  for update to authenticated using (public.suro_has_role(array['super_admin','admin']::public.suro_role[]))
  with check (public.suro_has_role(array['super_admin','admin']::public.suro_role[]));
