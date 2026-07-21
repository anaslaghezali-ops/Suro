-- =====================================================================
-- ASSURANCE MOTO — ajoute le type de véhicule (voiture | moto)
-- Appliqué sur le projet Supabase eprtmdugiusidtbwzozj.
--
-- Les voitures sont tarifées par PUISSANCE FISCALE (CV) ; les motos par
-- CYLINDRÉE (cm³). La colonne « puissance » d'une demande porte la valeur de
-- tarification : CV pour une voiture, cm³ pour une moto. La grille
-- insurance_pricing gagne une dimension vehicle_type ; cv_min/cv_max y
-- représentent la tranche (CV pour voiture, cm³ pour moto).
--
-- Les montants moto sont PROVISOIRES et ajustables dans l'écran Tarification
-- (comme pour les voitures).
-- =====================================================================

-- 1. Colonne type de véhicule sur les demandes
alter table public.insurance_applications
  add column if not exists vehicle_type text not null default 'voiture';
alter table public.insurance_applications
  drop constraint if exists insurance_applications_vehicle_type_chk;
alter table public.insurance_applications
  add constraint insurance_applications_vehicle_type_chk
  check (vehicle_type in ('voiture','moto'));

-- 2. Colonne type de véhicule sur la grille tarifaire
alter table public.insurance_pricing
  add column if not exists vehicle_type text not null default 'voiture';
alter table public.insurance_pricing
  drop constraint if exists insurance_pricing_vehicle_type_chk;
alter table public.insurance_pricing
  add constraint insurance_pricing_vehicle_type_chk
  check (vehicle_type in ('voiture','moto'));

-- 3. Moteur de calcul : ajoute le type de véhicule (5e paramètre)
--    Les facteurs (âge, marque premium) restent réservés aux voitures.
create or replace function public.suro_compute_premium(
  p_coverage text, p_annee integer, p_puissance integer, p_marque text,
  p_vehicle_type text default 'voiture')
 returns numeric
 language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_premium numeric; v_factor numeric; v_age integer;
begin
  select annual_premium into v_premium from insurance_pricing
  where coverage_type = p_coverage and active
    and coalesce(vehicle_type,'voiture') = coalesce(p_vehicle_type,'voiture')
    and p_puissance between cv_min and cv_max
  order by cv_min limit 1;
  if v_premium is null then return null; end if;
  if coalesce(p_vehicle_type,'voiture') = 'voiture' and p_coverage = 'complete' then
    v_age := extract(year from now())::int - coalesce(p_annee, extract(year from now())::int);
    if v_age > 10 then
      select factor into v_factor from insurance_pricing_factors where key = 'complete_age_gt10';
      v_premium := v_premium * coalesce(v_factor, 1);
    end if;
    if lower(coalesce(p_marque, '')) ~ '(mercedes|bmw|audi|porsche|land rover|range rover|jaguar)' then
      select factor into v_factor from insurance_pricing_factors where key = 'premium_brand';
      v_premium := v_premium * coalesce(v_factor, 1);
    end if;
  end if;
  return round(v_premium);
end; $function$;

-- 4. Trigger de prime : transmet le type de véhicule
create or replace function public.suro_set_premium()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  new.annual_premium := public.suro_compute_premium(
    new.coverage_type, new.annee, new.puissance, new.marque, new.vehicle_type);
  return new;
end; $function$;

-- 5. Devis : ajoute le type de véhicule (remplace l'ancienne signature 4-args)
drop function if exists public.suro_get_quote(integer, integer, text, text);
create or replace function public.suro_get_quote(
  p_annee integer, p_puissance integer,
  p_marque text default null, p_modele text default null,
  p_vehicle_type text default 'voiture')
 returns table(coverage_type text, annual_premium numeric)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.coverage, public.suro_compute_premium(c.coverage, p_annee, p_puissance, p_marque, p_vehicle_type)
  from (values ('minimal'), ('complete')) as c(coverage);
$function$;

-- 6. Nettoyage de l'ancien moteur 4-paramètres (plus référencé)
drop function if exists public.suro_compute_premium(text, integer, integer, text);

-- 7. Grille tarifaire moto (PROVISOIRE — ajustable dans Tarification).
--    Tranches par cylindrée (cm³) : ≤125, 126-500, 501-1000, >1000.
insert into public.insurance_pricing(coverage_type, cv_min, cv_max, annual_premium, active, vehicle_type) values
  ('minimal',    1,  125,  800, true, 'moto'),
  ('minimal',  126,  500, 1100, true, 'moto'),
  ('minimal',  501, 1000, 1500, true, 'moto'),
  ('minimal', 1001, 9999, 2200, true, 'moto'),
  ('complete',    1,  125, 1800, true, 'moto'),
  ('complete',  126,  500, 2600, true, 'moto'),
  ('complete',  501, 1000, 3600, true, 'moto'),
  ('complete', 1001, 9999, 5200, true, 'moto');

-- Recharge le cache de schéma PostgREST (nouvelle signature d'RPC)
notify pgrst, 'reload schema';
