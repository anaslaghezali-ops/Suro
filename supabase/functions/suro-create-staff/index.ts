// Edge Function : suro-create-staff
// Déployée sur le projet Supabase eprtmdugiusidtbwzozj (verify_jwt = true).
//
// Permet au Super Admin de CRÉER un collaborateur (Admin / Opérations / Support)
// à partir d'un email + mot de passe, même si la personne n'a pas encore de compte.
// Si le compte existe déjà, il est simplement rattaché (mot de passe inchangé).
//
// Sécurité : l'appelant doit être super_admin (vérifié via son JWT et
// suro_current_role()). La création du compte auth utilise la clé service_role,
// jamais exposée au navigateur.
//
// Redéploiement : supabase functions deploy suro-create-staff
// (ou via le MCP Supabase deploy_edge_function).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_ROLES = ['super_admin', 'admin', 'operations', 'support'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Non authentifié' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client agissant au nom de l'appelant (pour vérifier son rôle et son identité)
    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // 1. L'appelant doit être Super Admin
    const { data: role, error: roleErr } = await asCaller.rpc('suro_current_role');
    if (roleErr) return json({ error: roleErr.message }, 400);
    if (role !== 'super_admin') return json({ error: 'Réservé au Super Admin' }, 403);

    const { data: caller } = await asCaller.auth.getUser();
    const actorId = caller?.user?.id ?? null;
    const actorEmail = caller?.user?.email ?? '';

    // 2. Payload
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const wantedRole = String(body.role || '');
    const name = body.name ? String(body.name).trim() : null;

    if (!email || !email.includes('@')) return json({ error: 'Email invalide' }, 400);
    if (!VALID_ROLES.includes(wantedRole)) return json({ error: 'Rôle invalide' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 3. Le compte existe-t-il déjà ?
    const { data: existingId, error: lookupErr } = await asCaller.rpc('suro_lookup_user_id', { p_email: email });
    if (lookupErr) return json({ error: lookupErr.message }, 400);

    let userId: string;
    let created = false;

    if (existingId) {
      // Compte existant → on rattache seulement le rôle (mot de passe inchangé)
      userId = existingId as string;
    } else {
      // Nouveau compte → mot de passe requis
      if (password.length < 6) {
        return json({ error: 'Mot de passe requis (6 caractères minimum) pour créer un nouveau compte' }, 400);
      }
      const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        // clé « name » : cohérente avec suro_list_staff et l'inscription client
        user_metadata: name ? { name } : {},
      });
      if (createErr || !createdUser?.user) {
        return json({ error: createErr?.message || 'Échec de création du compte' }, 400);
      }
      userId = createdUser.user.id;
      created = true;
    }

    // 4. Assigner le rôle staff
    const { error: upsertErr } = await admin
      .from('suro_admins')
      .upsert({ user_id: userId, role: wantedRole }, { onConflict: 'user_id' });
    if (upsertErr) return json({ error: upsertErr.message }, 400);

    // 5. Journal d'audit
    await admin.from('suro_audit_log').insert({
      actor_id: actorId,
      actor_email: actorEmail,
      action: created ? 'create' : 'update',
      entity: 'staff',
      entity_id: userId,
      changes: { email, role: wantedRole, provisioned: created },
    });

    return json({ ok: true, user_id: userId, created, attached: !created });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
