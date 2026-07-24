-- =====================================================================
-- Catalogue marques / modèles véhicules (tunnel souscription)
-- Lecture publique (anon + authenticated). Saisie libre toujours possible côté front.
-- =====================================================================

create table if not exists public.vehicle_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vehicle_type text not null check (vehicle_type in ('voiture', 'moto')),
  sort_order int not null default 0,
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name, vehicle_type)
);

create table if not exists public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.vehicle_brands(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create index if not exists vehicle_brands_type_sort_idx
  on public.vehicle_brands (vehicle_type, sort_order, name);

create index if not exists vehicle_models_brand_sort_idx
  on public.vehicle_models (brand_id, sort_order, name);

alter table public.vehicle_brands enable row level security;
alter table public.vehicle_models enable row level security;

drop policy if exists vehicle_brands_select on public.vehicle_brands;
create policy vehicle_brands_select on public.vehicle_brands
  for select to anon, authenticated using (true);

drop policy if exists vehicle_models_select on public.vehicle_models;
create policy vehicle_models_select on public.vehicle_models
  for select to anon, authenticated using (true);

revoke all on public.vehicle_brands from anon, authenticated;
revoke all on public.vehicle_models from anon, authenticated;
grant select on public.vehicle_brands to anon, authenticated;
grant select on public.vehicle_models to anon, authenticated;

-- ── Marques voiture (marché Maroc) ──────────────────────────────────
insert into public.vehicle_brands (name, vehicle_type, sort_order, is_premium) values
  ('Dacia', 'voiture', 10, false),
  ('Renault', 'voiture', 20, false),
  ('Peugeot', 'voiture', 30, false),
  ('Citroën', 'voiture', 40, false),
  ('Volkswagen', 'voiture', 50, false),
  ('Toyota', 'voiture', 60, false),
  ('Hyundai', 'voiture', 70, false),
  ('Kia', 'voiture', 80, false),
  ('Ford', 'voiture', 90, false),
  ('Nissan', 'voiture', 100, false),
  ('Fiat', 'voiture', 110, false),
  ('Seat', 'voiture', 120, false),
  ('Skoda', 'voiture', 130, false),
  ('Opel', 'voiture', 140, false),
  ('Suzuki', 'voiture', 150, false),
  ('Mitsubishi', 'voiture', 160, false),
  ('Mercedes-Benz', 'voiture', 200, true),
  ('BMW', 'voiture', 210, true),
  ('Audi', 'voiture', 220, true),
  ('Land Rover', 'voiture', 230, true),
  ('Range Rover', 'voiture', 240, true),
  ('Jaguar', 'voiture', 250, true),
  ('Porsche', 'voiture', 260, true)
on conflict (name, vehicle_type) do update set
  sort_order = excluded.sort_order,
  is_premium = excluded.is_premium;

-- ── Marques moto ─────────────────────────────────────────────────────
insert into public.vehicle_brands (name, vehicle_type, sort_order, is_premium) values
  ('Honda', 'moto', 10, false),
  ('Yamaha', 'moto', 20, false),
  ('Suzuki', 'moto', 30, false),
  ('KTM', 'moto', 40, false),
  ('Bajaj', 'moto', 50, false),
  ('TVS', 'moto', 60, false),
  ('Sym', 'moto', 70, false),
  ('Piaggio', 'moto', 80, false),
  ('Vespa', 'moto', 90, false),
  ('Kawasaki', 'moto', 100, false),
  ('Benelli', 'moto', 110, false),
  ('BMW', 'moto', 120, false),
  ('Ducati', 'moto', 130, false),
  ('Harley-Davidson', 'moto', 140, false)
on conflict (name, vehicle_type) do update set
  sort_order = excluded.sort_order,
  is_premium = excluded.is_premium;

-- ── Modèles voiture ─────────────────────────────────────────────────
insert into public.vehicle_models (brand_id, name, sort_order)
select b.id, m.name, m.sort_order
from (values
  ('Dacia', 'Logan', 10), ('Dacia', 'Sandero', 20), ('Dacia', 'Duster', 30),
  ('Dacia', 'Lodgy', 40), ('Dacia', 'Dokker', 50), ('Dacia', 'Spring', 60),
  ('Renault', 'Clio', 10), ('Renault', 'Megane', 20), ('Renault', 'Captur', 30),
  ('Renault', 'Kadjar', 40), ('Renault', 'Talisman', 50), ('Renault', 'Kangoo', 60),
  ('Renault', 'Twingo', 70), ('Renault', 'Express', 80),
  ('Peugeot', '208', 10), ('Peugeot', '308', 20), ('Peugeot', '301', 30),
  ('Peugeot', '2008', 40), ('Peugeot', '3008', 50), ('Peugeot', '5008', 60),
  ('Peugeot', 'Partner', 70),
  ('Citroën', 'C3', 10), ('Citroën', 'C4', 20), ('Citroën', 'C5 Aircross', 30),
  ('Citroën', 'Berlingo', 40), ('Citroën', 'Ami', 50),
  ('Volkswagen', 'Polo', 10), ('Volkswagen', 'Golf', 20), ('Volkswagen', 'Tiguan', 30),
  ('Volkswagen', 'Passat', 40), ('Volkswagen', 'T-Roc', 50), ('Volkswagen', 'Touareg', 60),
  ('Toyota', 'Yaris', 10), ('Toyota', 'Corolla', 20), ('Toyota', 'C-HR', 30),
  ('Toyota', 'RAV4', 40), ('Toyota', 'Hilux', 50), ('Toyota', 'Land Cruiser', 60),
  ('Hyundai', 'i10', 10), ('Hyundai', 'i20', 20), ('Hyundai', 'Tucson', 30),
  ('Hyundai', 'Santa Fe', 40), ('Hyundai', 'Accent', 50), ('Hyundai', 'Kona', 60),
  ('Kia', 'Picanto', 10), ('Kia', 'Rio', 20), ('Kia', 'Sportage', 30),
  ('Kia', 'Seltos', 40), ('Kia', 'Cerato', 50),
  ('Ford', 'Fiesta', 10), ('Ford', 'Focus', 20), ('Ford', 'Kuga', 30),
  ('Ford', 'Ranger', 40), ('Ford', 'Puma', 50),
  ('Nissan', 'Micra', 10), ('Nissan', 'Qashqai', 20), ('Nissan', 'Juke', 30),
  ('Nissan', 'Navara', 40), ('Nissan', 'X-Trail', 50),
  ('Fiat', '500', 10), ('Fiat', 'Panda', 20), ('Fiat', 'Tipo', 30), ('Fiat', 'Doblo', 40),
  ('Seat', 'Ibiza', 10), ('Seat', 'Leon', 20), ('Seat', 'Arona', 30), ('Seat', 'Ateca', 40),
  ('Skoda', 'Fabia', 10), ('Skoda', 'Octavia', 20), ('Skoda', 'Kamiq', 30), ('Skoda', 'Kodiaq', 40),
  ('Opel', 'Corsa', 10), ('Opel', 'Astra', 20), ('Opel', 'Crossland', 30), ('Opel', 'Grandland', 40),
  ('Suzuki', 'Swift', 10), ('Suzuki', 'Vitara', 20), ('Suzuki', 'Jimny', 30), ('Suzuki', 'S-Cross', 40),
  ('Mitsubishi', 'ASX', 10), ('Mitsubishi', 'L200', 20), ('Mitsubishi', 'Outlander', 30),
  ('Mercedes-Benz', 'Classe A', 10), ('Mercedes-Benz', 'Classe C', 20), ('Mercedes-Benz', 'Classe E', 30),
  ('Mercedes-Benz', 'GLA', 40), ('Mercedes-Benz', 'GLC', 50),
  ('BMW', 'Série 1', 10), ('BMW', 'Série 3', 20), ('BMW', 'X1', 30), ('BMW', 'X3', 40),
  ('Audi', 'A3', 10), ('Audi', 'A4', 20), ('Audi', 'Q3', 30), ('Audi', 'Q5', 40),
  ('Land Rover', 'Discovery', 10), ('Land Rover', 'Defender', 20), ('Land Rover', 'Range Rover Evoque', 30),
  ('Range Rover', 'Sport', 10), ('Range Rover', 'Velar', 20), ('Range Rover', 'Vogue', 30),
  ('Jaguar', 'XE', 10), ('Jaguar', 'XF', 20), ('Jaguar', 'F-Pace', 30),
  ('Porsche', 'Macan', 10), ('Porsche', 'Cayenne', 20), ('Porsche', '911', 30)
) as m(brand_name, name, sort_order)
join public.vehicle_brands b on b.name = m.brand_name and b.vehicle_type = 'voiture'
on conflict (brand_id, name) do update set sort_order = excluded.sort_order;

-- ── Modèles moto ────────────────────────────────────────────────────
insert into public.vehicle_models (brand_id, name, sort_order)
select b.id, m.name, m.sort_order
from (values
  ('Honda', 'PCX', 10), ('Honda', 'CB', 20), ('Honda', 'CBR', 30), ('Honda', 'Africa Twin', 40),
  ('Honda', 'SH', 50), ('Honda', 'Forza', 60), ('Honda', 'Wave', 70),
  ('Yamaha', 'NMAX', 10), ('Yamaha', 'MT-07', 20), ('Yamaha', 'MT-09', 30),
  ('Yamaha', 'YZF-R3', 40), ('Yamaha', 'Tracer', 50), ('Yamaha', 'XMAX', 60),
  ('Suzuki', 'Address', 10), ('Suzuki', 'GSX-R', 20), ('Suzuki', 'V-Strom', 30),
  ('Suzuki', 'Burgman', 40), ('Suzuki', 'Hayabusa', 50),
  ('KTM', 'Duke', 10), ('KTM', 'Adventure', 20), ('KTM', 'RC', 30), ('KTM', 'Enduro', 40),
  ('Bajaj', 'Boxer', 10), ('Bajaj', 'Pulsar', 20), ('Bajaj', 'Dominar', 30),
  ('TVS', 'Apache', 10), ('TVS', 'NTorq', 20), ('TVS', 'Raider', 30),
  ('Sym', 'Crox', 10), ('Sym', 'Joymax', 20), ('Sym', 'Fiddle', 30),
  ('Piaggio', 'Liberty', 10), ('Piaggio', 'Beverly', 20), ('Piaggio', 'MP3', 30),
  ('Vespa', 'Primavera', 10), ('Vespa', 'GTS', 20), ('Vespa', 'Sprint', 30),
  ('Kawasaki', 'Ninja', 10), ('Kawasaki', 'Z650', 20), ('Kawasaki', 'Versys', 30),
  ('Benelli', 'TRK', 10), ('Benelli', 'Leoncino', 20), ('Benelli', 'TNT', 30),
  ('BMW', 'R 1250 GS', 10), ('BMW', 'F 900 R', 20), ('BMW', 'C 400 X', 30),
  ('Ducati', 'Monster', 10), ('Ducati', 'Scrambler', 20), ('Ducati', 'Multistrada', 30),
  ('Harley-Davidson', 'Sportster', 10), ('Harley-Davidson', 'Street', 20), ('Harley-Davidson', 'Softail', 30)
) as m(brand_name, name, sort_order)
join public.vehicle_brands b on b.name = m.brand_name and b.vehicle_type = 'moto'
on conflict (brand_id, name) do update set sort_order = excluded.sort_order;
