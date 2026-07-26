// Edge Function : suro-create-cabinet-user
// Crée un compte Auth (email + mot de passe) et le lie à un cabinet.
// Appelants autorisés : super_admin/admin SURO, ou admin_cabinet/responsable (leur cabinet).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STAFF_ROLES = ['gestionnaire', 'responsable', 'admin_cabinet'] as const;
const CABINET_MANAGER_ROLES = ['gestionnaire', 'responsable'] as const;

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

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const wantedRole = String(body.role || '');
    const name = body.name ? String(body.name).trim() : null;
    const cabinetIdParam = body.cabinet_id ? String(body.cabinet_id) : null;

    if (!email || !email.includes('@')) return json({ error: 'Email invalide' }, 400);

    const { data: isStaffAdmin } = await asCaller.rpc('suro_has_role', {
      roles: ['super_admin', 'admin'],
    });

    let targetCabinetId: string;

    if (isStaffAdmin) {
      if (!cabinetIdParam) return json({ error: 'Sélectionnez un cabinet' }, 400);
      if (!STAFF_ROLES.includes(wantedRole as typeof STAFF_ROLES[number])) {
        return json({ error: 'Rôle invalide' }, 400);
      }
      targetCabinetId = cabinetIdParam;
    } else {
      const { data: canManage } = await asCaller.rpc('suro_cabinet_can_manage_team');
      if (!canManage) return json({ error: 'Non autorisé' }, 403);

      const { data: ctxRows, error: ctxErr } = await asCaller.rpc('suro_cabinet_context');
      if (ctxErr) return json({ error: ctxErr.message }, 400);
      const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows;
      if (!ctx?.cabinet_id) return json({ error: 'Non autorisé' }, 403);

      if (!CABINET_MANAGER_ROLES.includes(wantedRole as typeof CABINET_MANAGER_ROLES[number])) {
        return json({ error: 'Rôle invalide — gestionnaire ou responsable uniquement' }, 400);
      }
      targetCabinetId = ctx.cabinet_id;
    }

    const { data: cabinetRow, error: cabErr } = await admin
      .from('suro_cabinets')
      .select('id, is_active')
      .eq('id', targetCabinetId)
      .maybeSingle();
    if (cabErr) return json({ error: cabErr.message }, 400);
    if (!cabinetRow) return json({ error: 'Cabinet introuvable' }, 400);
    if (!cabinetRow.is_active) return json({ error: 'Cabinet inactif' }, 400);

    const { data: existingId, error: lookupErr } = await asCaller.rpc('suro_lookup_user_id', { p_email: email });
    if (lookupErr) return json({ error: lookupErr.message }, 400);

    let userId: string;
    let created = false;

    if (existingId) {
      userId = existingId as string;
      if (password) {
        if (password.length < 6) {
          return json({ error: 'Mot de passe : 6 caractères minimum' }, 400);
        }
        const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
          password,
          user_metadata: name ? { name } : undefined,
        });
        if (pwErr) return json({ error: pwErr.message }, 400);
      }
    } else {
      if (password.length < 6) {
        return json({ error: 'Mot de passe requis (6 caractères minimum)' }, 400);
      }
      const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: name ? { name } : {},
      });
      if (createErr || !createdUser?.user) {
        return json({ error: createErr?.message || 'Échec de création du compte' }, 400);
      }
      userId = createdUser.user.id;
      created = true;
    }

    await admin
      .from('suro_cabinet_users')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('cabinet_id', targetCabinetId);

    const { error: linkErr } = await admin
      .from('suro_cabinet_users')
      .upsert(
        {
          cabinet_id: targetCabinetId,
          user_id: userId,
          role: wantedRole,
          display_name: name,
          is_active: true,
        },
        { onConflict: 'cabinet_id,user_id' },
      );
    if (linkErr) return json({ error: linkErr.message }, 400);

    const { data: caller } = await asCaller.auth.getUser();
    await admin.from('suro_audit_log').insert({
      actor_id: caller?.user?.id ?? null,
      actor_email: caller?.user?.email ?? '',
      action: created ? 'create' : 'update',
      entity: 'cabinet_user',
      entity_id: userId,
      changes: { email, role: wantedRole, cabinet_id: targetCabinetId, provisioned: created },
    });

    return json({ ok: true, user_id: userId, created, attached: !created });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
