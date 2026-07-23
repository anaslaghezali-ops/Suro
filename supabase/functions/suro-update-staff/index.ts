// Edge Function : suro-update-staff
// Déployée sur le projet Supabase (verify_jwt = true).
//
// Permet au Super Admin de MODIFIER l'email et/ou le mot de passe d'un membre
// de l'équipe existant (Admin / Opérations / Support). Changer l'email/MDP d'un
// AUTRE compte Auth exige la clé service_role, jamais exposée au navigateur.
//
// Sécurité : l'appelant doit être super_admin (vérifié via son JWT et
// suro_current_role()). La cible doit être un membre de l'équipe (présent dans
// suro_admins) — on ne modifie pas un compte client arbitraire.
//
// ⚠️ Note : si le membre est aussi client (a des contrats sous son email),
// changer son email casserait l'accès à ses propres contrats (RLS par email).
// Cas rare pour du staff ; à garder en tête.
//
// Déploiement : supabase functions deploy suro-update-staff
// (ou via le MCP Supabase deploy_edge_function).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const targetEmail = String(body.targetEmail || '').trim().toLowerCase();
    const newEmail = body.newEmail ? String(body.newEmail).trim().toLowerCase() : null;
    const newPassword = body.newPassword ? String(body.newPassword) : null;

    if (!targetEmail) return json({ error: 'Email du collaborateur requis' }, 400);
    if (!newEmail && !newPassword) return json({ error: 'Rien à modifier (email ou mot de passe)' }, 400);
    if (newEmail && !newEmail.includes('@')) return json({ error: 'Nouvel email invalide' }, 400);
    if (newPassword && newPassword.length < 6) return json({ error: 'Mot de passe trop court (6 caractères min.)' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 3. Retrouver le compte cible
    const { data: targetId, error: lookupErr } = await asCaller.rpc('suro_lookup_user_id', { p_email: targetEmail });
    if (lookupErr) return json({ error: lookupErr.message }, 400);
    if (!targetId) return json({ error: 'Compte introuvable' }, 404);

    // 4. La cible doit être un membre de l'équipe (pas un client quelconque)
    const { data: staffRow } = await admin
      .from('suro_admins')
      .select('user_id')
      .eq('user_id', targetId as string)
      .maybeSingle();
    if (!staffRow) return json({ error: "Ce compte n'est pas un membre de l'équipe" }, 400);

    // 5. Appliquer les changements (email confirmé immédiatement, pas d'email de validation)
    const updates: Record<string, unknown> = {};
    if (newEmail) { updates.email = newEmail; updates.email_confirm = true; }
    if (newPassword) { updates.password = newPassword; }

    const { error: updErr } = await admin.auth.admin.updateUserById(targetId as string, updates);
    if (updErr) return json({ error: updErr.message }, 400);

    // 6. Journal d'audit (on ne journalise jamais le mot de passe)
    await admin.from('suro_audit_log').insert({
      actor_id: actorId,
      actor_email: actorEmail,
      action: 'update',
      entity: 'staff',
      entity_id: targetId,
      changes: {
        target_email: targetEmail,
        email_changed: newEmail ? newEmail : false,
        password_changed: !!newPassword,
      },
    });

    return json({ ok: true, user_id: targetId, email_changed: !!newEmail, password_changed: !!newPassword });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
