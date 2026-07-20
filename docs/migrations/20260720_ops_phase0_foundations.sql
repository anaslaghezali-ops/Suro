-- =====================================================================
-- OPS PORTAL — PHASE 0 : Fondations (RBAC, Audit, statuts, workflow)
-- Appliqué le 2026-07-20 sur le projet Supabase eprtmdugiusidtbwzozj.
-- 100% additif et idempotent. NE TOUCHE PAS à la tarification.
-- Conservé ici pour traçabilité/versioning (pas de CLI Supabase dans le repo).
-- =====================================================================

-- ---------- 1. RBAC : rôles ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'suro_role') then
    create type public.suro_role as enum ('super_admin','admin','operations','support');
  end if;
end $$;

alter table public.suro_admins
  add column if not exists role public.suro_role not null default 'admin';

-- Le(s) membre(s) existant(s) = propriétaire → super_admin
update public.suro_admins set role = 'super_admin' where role = 'admin';

-- Helpers (is_suro_admin conservé tel quel = membre ; non redéfini pour éviter toute régression RLS)
create or replace function public.is_suro_staff()
  returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.suro_admins where user_id = auth.uid());
$$;

create or replace function public.suro_current_role()
  returns public.suro_role language sql stable security definer set search_path to 'public' as $$
  select role from public.suro_admins where user_id = auth.uid();
$$;

create or replace function public.suro_has_role(roles public.suro_role[])
  returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.suro_admins
    where user_id = auth.uid() and role = any(roles)
  );
$$;

-- ---------- 2. Audit log (actions staff) ----------
create table if not exists public.suro_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,          -- login | create | update | validate | reject | delete | assign ...
  entity text,                   -- application | document | payment | claim | staff ...
  entity_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index if not exists suro_audit_log_created_idx on public.suro_audit_log(created_at desc);
create index if not exists suro_audit_log_entity_idx  on public.suro_audit_log(entity, entity_id);

alter table public.suro_audit_log enable row level security;

drop policy if exists "suro_audit_log read" on public.suro_audit_log;
create policy "suro_audit_log read" on public.suro_audit_log
  for select to authenticated
  using (public.suro_has_role(array['super_admin','admin','operations']::public.suro_role[]));

drop policy if exists "suro_audit_log no direct insert" on public.suro_audit_log;
create policy "suro_audit_log no direct insert" on public.suro_audit_log
  for insert to authenticated with check (false);

create or replace function public.suro_log_action(
  p_action text, p_entity text default null,
  p_entity_id uuid default null, p_changes jsonb default null)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_suro_staff() then
    raise exception 'Réservé au staff';
  end if;
  insert into public.suro_audit_log(actor_id, actor_email, action, entity, entity_id, changes)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email',''), p_action, p_entity, p_entity_id, p_changes);
end; $$;

create or replace function public.suro_audit_recent(p_limit integer default 50)
  returns setof public.suro_audit_log language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.suro_has_role(array['super_admin','admin','operations']::public.suro_role[]) then
    raise exception 'Réservé au staff autorisé';
  end if;
  return query
    select * from public.suro_audit_log order by created_at desc
    limit least(coalesce(p_limit,50), 200);
end; $$;

-- ---------- 3. Documents : statut de validation ----------
alter table public.insurance_documents
  add column if not exists status text not null default 'pending',   -- pending | approved | rejected
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reject_reason text;

-- ---------- 4. Paiements : statut ----------
alter table public.suro_payments
  add column if not exists status text not null default 'succeeded',  -- succeeded | pending | failed
  add column if not exists method text;

-- ---------- 5. Workflow opérations sur les souscriptions ----------
alter table public.insurance_applications
  add column if not exists assigned_to uuid,
  add column if not exists policy_number text;

create unique index if not exists insurance_applications_policy_number_uidx
  on public.insurance_applications(policy_number) where policy_number is not null;

-- ---------- 6. Durcissement : RPC staff non appelables par anon ----------
revoke all on function public.suro_log_action(text,text,uuid,jsonb) from public;
revoke all on function public.suro_audit_recent(integer) from public;
grant execute on function public.suro_log_action(text,text,uuid,jsonb) to authenticated;
grant execute on function public.suro_audit_recent(integer) to authenticated;
