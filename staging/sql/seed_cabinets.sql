-- Seed cabinets (idempotent) — utilisateurs Auth créés via seed-cabinets.sh
insert into public.suro_cabinets (name, slug) values
  ('Cabinet AGMA', 'agma'),
  ('Cabinet Atlas Assurances', 'atlas')
on conflict (slug) do nothing;

-- IDs stables pour tests inter-tenant (nécessite cabinets existants)
-- Les liaisons user→cabinet sont faites dans seed-cabinets.sh après création Auth.
