-- =====================================================================
-- OPS PORTAL — CRÉATION DE COLLABORATEURS AVEC COMPTE (email + mot de passe)
-- Appliqué sur le projet Supabase eprtmdugiusidtbwzozj.
--
-- Contexte : suro_set_staff exige un compte auth existant. Pour permettre
-- au Super Admin de créer un collaborateur qui n'a PAS encore de compte,
-- l'Edge Function « suro-create-staff » provisionne le compte auth
-- (service_role) puis lui attribue un rôle staff.
--
-- Cette fonction SQL est le seul complément nécessaire côté base : elle
-- permet à l'Edge Function de détecter, avec le JWT de l'appelant, si un
-- compte existe déjà pour cet email (afin de simplement le rattacher au
-- lieu d'échouer). Source de l'Edge Function :
--   supabase/functions/suro-create-staff/index.ts
-- =====================================================================

-- Retrouve l'id d'un compte auth par email. Réservé au Super Admin.
create or replace function public.suro_lookup_user_id(p_email text)
 returns uuid
 language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_id uuid;
begin
  if public.suro_current_role() <> 'super_admin' then
    raise exception 'Réservé au Super Admin';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  return v_id;
end;
$function$;

revoke all on function public.suro_lookup_user_id(text) from public, anon;
grant execute on function public.suro_lookup_user_id(text) to authenticated;
