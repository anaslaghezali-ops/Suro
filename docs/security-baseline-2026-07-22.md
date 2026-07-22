# SURO — Baseline de sécurité (référence figée)

Date : **2026-07-22** · Projet Supabase `eprtmdugiusidtbwzozj`

But : **point de référence** de l'état sécurité de la base **avant** le gros du
durcissement. Si une étape casse un accès, on diff contre ce document pour comprendre
le « avant ». À regénérer après chaque phase pour mesurer les progrès.

> Filet de sécurité **données** = backups Supabase (voir § Backups). Ce document
> couvre la **configuration** (RLS, policies, droits d'exécution), pas les données.

---

## 1. RLS par table (schéma `public`)

Toutes les tables ont **RLS activé** ✓. Deux tables sans policy = **deny-all volontaire**
(accès uniquement via fonctions `SECURITY DEFINER`) : `suro_admins`, `suro_role_privileges`.

| Table | RLS | Nb policies |
|---|---|---|
| insurance_application_answers | ON | 2 |
| insurance_applications | ON | 4 |
| insurance_claim_files | ON | 4 |
| insurance_claim_messages | ON | 4 |
| insurance_claims | ON | 4 |
| insurance_documents | ON | 4 |
| insurance_pricing | ON | 3 |
| insurance_pricing_factors | ON | 2 |
| insurance_products | ON | 1 |
| suro_admins | ON | 0 *(deny-all)* |
| suro_audit_log | ON | 2 |
| suro_events | ON | 1 |
| suro_notifications | ON | 4 |
| suro_payments | ON | 2 |
| suro_role_privileges | ON | 0 *(deny-all)* |
| suro_settings | ON | 3 |

---

## 2. Policies RLS

Accès **anon** (public, non connecté) — à surveiller : `insurance_applications` INSERT,
`insurance_application_answers` INSERT, `suro_events` INSERT, et les SELECT publics
`insurance_pricing` / `insurance_pricing_factors` / `insurance_products` / `suro_settings`.

| Table | Policy | Cmd | Rôles |
|---|---|---|---|
| insurance_application_answers | suro_anon_insert_answers | INSERT | anon, authenticated |
| insurance_application_answers | suro_admin_read_answers | SELECT | authenticated |
| insurance_applications | suro_anon_insert_applications | INSERT | anon, authenticated |
| insurance_applications | suro_admin_read_applications | SELECT | authenticated |
| insurance_applications | suro_customer_read_own_applications | SELECT | authenticated |
| insurance_applications | suro_applications update staff | UPDATE | authenticated |
| insurance_claim_files | suro_admin_delete_claim_files | DELETE | authenticated |
| insurance_claim_files | suro_customer_insert_claim_files | INSERT | authenticated |
| insurance_claim_files | suro_admin_read_claim_files | SELECT | authenticated |
| insurance_claim_files | suro_customer_read_claim_files | SELECT | authenticated |
| insurance_claim_messages | suro_admin_insert_claim_messages | INSERT | authenticated |
| insurance_claim_messages | suro_customer_insert_claim_messages | INSERT | authenticated |
| insurance_claim_messages | suro_admin_read_claim_messages | SELECT | authenticated |
| insurance_claim_messages | suro_customer_read_claim_messages | SELECT | authenticated |
| insurance_claims | suro_customer_insert_own_claims | INSERT | authenticated |
| insurance_claims | suro_admin_read_claims | SELECT | authenticated |
| insurance_claims | suro_customer_read_own_claims | SELECT | authenticated |
| insurance_claims | suro_admin_update_claims | UPDATE | authenticated |
| insurance_documents | suro_admin_delete_documents | DELETE | authenticated |
| insurance_documents | suro_documents insert staff | INSERT | authenticated |
| insurance_documents | suro_admin_read_documents | SELECT | authenticated |
| insurance_documents | suro_customer_read_own_documents | SELECT | authenticated |
| insurance_pricing | suro_pricing insert staff | INSERT | authenticated |
| insurance_pricing | suro_anon_read_pricing | SELECT | anon, authenticated |
| insurance_pricing | suro_pricing update staff | UPDATE | authenticated |
| insurance_pricing_factors | suro_anon_read_pricing_factors | SELECT | anon, authenticated |
| insurance_pricing_factors | suro_admin_update_factors | UPDATE | authenticated |
| insurance_products | suro_anon_read_products | SELECT | anon, authenticated |
| suro_audit_log | suro_audit_log no direct insert | INSERT | authenticated |
| suro_audit_log | suro_audit_log read | SELECT | authenticated |
| suro_events | suro_anon_insert_events | INSERT | anon, authenticated |
| suro_notifications | suro_admin_read_notifications | SELECT | authenticated |
| suro_notifications | suro_customer_read_notifications | SELECT | authenticated |
| suro_notifications | suro_admin_mark_read | UPDATE | authenticated |
| suro_notifications | suro_customer_mark_read | UPDATE | authenticated |
| suro_payments | suro_payments select admin | SELECT | authenticated |
| suro_payments | suro_payments select own | SELECT | authenticated |
| suro_settings | suro_settings insert staff | INSERT | authenticated |
| suro_settings | suro_read_settings | SELECT | anon, authenticated |
| suro_settings | suro_settings update staff | UPDATE | authenticated |

---

## 3. Fonctions `SECURITY DEFINER` — droits d'exécution

⚠️ **Cible du Jour 2** : la plupart sont exécutables par **anon** alors qu'elles sont
staff-only (gardes internes présentes, mais surface à réduire → `revoke ... from anon`).
Déjà verrouillées : `suro_lookup_user_id`, `suro_mark_application_paid` (Jour 1).
Les `suro_trg_*` et `suro_set_premium` sont des **fonctions trigger** (non appelables en RPC) — le grant y est sans effet.

| Fonction | anon | authenticated |
|---|---|---|
| is_suro_admin | ✅ | ✅ |
| is_suro_staff | ✅ | ✅ |
| suro_add_admin | ✅ | ✅ |
| suro_audit_recent | ✅ | ✅ |
| suro_can | ✅ | ✅ |
| suro_claims_needing_reply | ✅ | ✅ |
| suro_compute_premium | ✅ | ✅ |
| suro_current_role | ✅ | ✅ |
| suro_delete_customer | ✅ | ✅ |
| suro_funnel_stats | ✅ | ✅ |
| suro_get_quote | ✅ *(public nécessaire — tunnel)* | ✅ |
| suro_has_role | ✅ | ✅ |
| suro_list_admins | ✅ | ✅ |
| suro_list_customers | ✅ | ✅ |
| suro_list_role_privileges | ✅ | ✅ |
| suro_list_staff | ✅ | ✅ |
| suro_log_action | ✅ | ✅ |
| suro_lookup_user_id | — | ✅ |
| suro_mark_application_paid | — | ✅ *(verrouillé Jour 1)* |
| suro_my_privileges | ✅ | ✅ |
| suro_notify | ✅ | ✅ |
| suro_owns_claim | ✅ | ✅ |
| suro_recent_events | ✅ | ✅ |
| suro_remove_admin | ✅ | ✅ |
| suro_remove_staff | ✅ | ✅ |
| suro_renew_application | ✅ | ✅ |
| suro_review_document | ✅ | ✅ |
| suro_send_expiry_reminders | ✅ | ✅ |
| suro_set_premium | ✅ *(trigger)* | ✅ |
| suro_set_privilege | ✅ | ✅ |
| suro_set_staff | ✅ | ✅ |
| suro_trg_application_created | ✅ *(trigger)* | ✅ |
| suro_trg_application_updated | ✅ *(trigger)* | ✅ |
| suro_trg_claim_created | ✅ *(trigger)* | ✅ |
| suro_trg_claim_message | ✅ *(trigger)* | ✅ |
| suro_trg_claim_status | ✅ *(trigger)* | ✅ |
| suro_update_customer | ✅ | ✅ |

---

## 4. Alertes de l'analyseur Supabase (2026-07-22)

Total : **78 alertes**.

| Niveau | Alerte | Nb |
|---|---|---|
| WARN | `authenticated_security_definer_function_executable` | 37 |
| WARN | `anon_security_definer_function_executable` | 36 |
| WARN | `rls_policy_always_true` | 2 |
| WARN | `auth_leaked_password_protection` (désactivé) | 1 |
| INFO | `rls_enabled_no_policy` (deny-all volontaire) | 2 |

---

## 5. Backups (filet de sécurité DONNÉES) — action à confirmer

- [ ] Vérifier dans **Supabase → Database → Backups** que les **sauvegardes automatiques**
  sont activées (fréquence selon le plan). Sur un petit plan, prévoir un **export SQL manuel**
  avant chaque phase de durcissement.
- [ ] Avant toute étape « base » risquée : refaire un export/snapshot rapide.
- Restauration testée : ___ (à cocher au Jour 12).

---

## 6. Comment utiliser cette baseline
- Après chaque phase base, **regénérer** les 3 tableaux (mêmes requêtes) et **diff** contre ce fichier.
- Toute policy/fonction qui apparaît/disparaît doit être **intentionnelle** et tracée par une migration.
- Objectif de fin de programme : colonne **anon** des fonctions staff-only passée à « — ».
