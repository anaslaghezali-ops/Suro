-- =====================================================================
-- Harness minimal PG16 — remplace 00_base_schema_pre_cabinet.sql (dump PG17)
-- pour tests locaux rejouables (isolation, round-robin, cycle migrations).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Auth shim (Supabase) ----------
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
  returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
  returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;

-- ---------- Types ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'suro_role') then
    create type public.suro_role as enum ('super_admin','admin','operations','support');
  end if;
end $$;

-- ---------- Tables core (pré-migrations) ----------
create table if not exists public.suro_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now(),
  role public.suro_role not null default 'admin'
);

create table if not exists public.suro_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table if not exists public.suro_notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('customer','admin')),
  user_email text,
  type text not null,
  title text not null,
  body text,
  ref_type text,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.insurance_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.insurance_applications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.insurance_products(id),
  customer_name text,
  customer_email text not null,
  customer_phone text,
  coverage_type text,
  immatriculation text,
  marque text,
  modele text,
  annee integer,
  puissance integer,
  address text,
  annual_premium numeric,
  status text not null default 'nouvelle',
  paid_at timestamptz,
  expires_at timestamptz,
  renewed_from uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_to uuid,
  policy_number text,
  vehicle_type text not null default 'voiture',
  fuel_type text
);

create table if not exists public.insurance_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.insurance_applications(id) on delete cascade,
  customer_email text not null,
  name text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  document_type text,
  document_side text
);

create table if not exists public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.insurance_applications(id),
  customer_id uuid,
  claim_type text,
  description text,
  claim_date timestamptz,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insurance_claim_messages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.insurance_claims(id) on delete cascade,
  sender text not null check (sender in ('customer','admin')),
  sender_email text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.insurance_claim_files (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.insurance_claims(id) on delete cascade,
  customer_email text not null,
  name text not null,
  storage_path text not null,
  content_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.suro_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.insurance_applications(id),
  customer_email text not null,
  amount numeric,
  kind text not null default 'initial',
  method text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  status text not null default 'succeeded'
);

create table if not exists public.suro_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  event text not null,
  step text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.insurance_application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.insurance_applications(id) on delete cascade,
  field_key text not null,
  field_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.insurance_pricing (
  id uuid primary key default gen_random_uuid(),
  coverage_type text not null,
  cv_min integer not null,
  cv_max integer not null,
  annual_premium numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  vehicle_type text not null default 'voiture'
);

-- ---------- Helpers legacy (pré-phase0) ----------
create or replace function public.is_suro_admin()
  returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.suro_admins where user_id = auth.uid());
$$;

create or replace function public.is_suro_staff()
  returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.suro_admins where user_id = auth.uid());
$$;

create or replace function public.suro_notify(
  p_audience text, p_email text, p_type text, p_title text, p_body text,
  p_ref_type text default null, p_ref_id uuid default null)
  returns void language sql security definer set search_path to 'public' as $$
  insert into public.suro_notifications(audience, user_email, type, title, body, ref_type, ref_id)
  values (p_audience, p_email, p_type, p_title, p_body, p_ref_type, p_ref_id);
$$;

create or replace function public.suro_notify_customer(
  p_email text, p_type text, p_title text, p_body text,
  p_ref_type text default null, p_ref_id uuid default null)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.suro_notifications(audience, user_email, type, title, body, ref_type, ref_id)
  values ('customer', lower(trim(p_email)), p_type, p_title, p_body, p_ref_type, p_ref_id);
end;
$$;

-- RLS basique (migrations ajoutent les policies)
alter table public.suro_settings enable row level security;
alter table public.insurance_applications enable row level security;
alter table public.insurance_documents enable row level security;
alter table public.insurance_claims enable row level security;
alter table public.suro_notifications enable row level security;
alter table public.suro_payments enable row level security;
alter table public.suro_events enable row level security;
alter table public.insurance_application_answers enable row level security;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- Storage shim (Supabase) ----------
create schema if not exists storage;

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;
