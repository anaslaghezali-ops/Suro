// Edge Function : suro-update-cabinet-user
// Modifie email et/ou mot de passe d'un membre cabinet.
// Appelants : super_admin/admin SURO, ou admin_cabinet/responsable (leur équipe).

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

    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const memberId = body.member_id ? String(body.member_id) : null;
    const newEmail = body.newEmail ? String(body.newEmail).trim().toLowerCase() : null;
    const newPassword = body.newPassword ? String(body.newPassword) : null;

    if (!memberId) return json({ error: 'Membre requis' }, 400);
    if (!newEmail && !newPassword) return json({ error: 'Rien à modifier (email ou mot de passe)' }, 400);
    if (newEmail && !newEmail.includes('@')) return json({ error: 'Nouvel email invalide' }, 400);
    if (newPassword && newPassword.length < 6) return json({ error: 'Mot de passe trop court (6 caractères min.)' }, 400);

    const { data: targetRows, error: targetErr } = await asCaller.rpc('suro_cabinet_member_auth_target', {
      p_member_id: memberId,
    });
    if (targetErr) return json({ error: targetErr.message }, 400);
    const target = Array.isArray(targetRows) ? targetRows[0] : targetRows;
    if (!target?.user_id) return json({ error: 'Membre introuvable ou non autorisé' }, 403);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const updates: Record<string, unknown> = {};
    if (newEmail) {
      updates.email = newEmail;
      updates.email_confirm = true;
    }
    if (newPassword) updates.password = newPassword;

    const { error: updErr } = await admin.auth.admin.updateUserById(target.user_id as string, updates);
    if (updErr) return json({ error: updErr.message }, 400);

    const { data: caller } = await asCaller.auth.getUser();
    await admin.from('suro_audit_log').insert({
      actor_id: caller?.user?.id ?? null,
      actor_email: caller?.user?.email ?? '',
      action: 'update',
      entity: 'cabinet_user',
      entity_id: target.user_id,
      changes: {
        member_id: memberId,
        previous_email: target.email,
        email_changed: newEmail ? newEmail : false,
        password_changed: !!newPassword,
      },
    });

    return json({
      ok: true,
      user_id: target.user_id,
      email_changed: !!newEmail,
      password_changed: !!newPassword,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
