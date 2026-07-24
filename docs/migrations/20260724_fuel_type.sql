-- =====================================================================
-- Type de carburant sur les contrats (tunnel souscription)
-- =====================================================================

alter table public.insurance_applications
  add column if not exists fuel_type text;

alter table public.insurance_applications
  drop constraint if exists insurance_applications_fuel_type_check;

alter table public.insurance_applications
  add constraint insurance_applications_fuel_type_check
  check (
    fuel_type is null
    or fuel_type in ('essence', 'diesel', 'hybride', 'electrique', 'gpl')
  );
