-- =====================================================================
-- ROLLBACK — Module cabinet partenaire
-- Appliquer UNIQUEMENT pour annuler 20260725_cabinet_module.sql
--         (+ 20260725_cabinet_rls_hardening.sql si appliqué)
-- Idempotent autant que possible. NE PAS exécuter sur prod sans validation.
-- =====================================================================

-- Triggers
drop trigger if exists suro_trg_kyc_task on public.insurance_documents;
drop trigger if exists suro_trg_claim_cabinet on public.insurance_claims;

-- Functions (ordre inverse des dépendances)
drop function if exists public.suro_cabinet_add_user(text, public.suro_cabinet_role, text, uuid);
drop function if exists public.suro_staff_upsert_cabinet(text, text, uuid);
drop function if exists public.suro_ops_list_cabinet_anomalies(int);
drop function if exists public.suro_ops_cabinet_overview();
drop function if exists public.suro_cabinet_list_claims(text, int, int);
drop function if exists public.suro_cabinet_list_tasks(text, int, int);
drop function if exists public.suro_cabinet_claim_set_status(uuid, text, text);
drop function if exists public.suro_cabinet_task_action(uuid, text, jsonb);
drop function if exists public.suro_cabinet_on_claim_created();
drop function if exists public.suro_trg_kyc_complete_create_task();
drop function if exists public.suro_cabinet_try_create_task(uuid);
drop function if exists public.suro_notify_cabinet_users(uuid, text, text, text, text, uuid, uuid);
drop function if exists public.suro_notify_customer(text, text, text, text, text, uuid);
drop function if exists public.suro_cabinet_auto_check(uuid);
drop function if exists public.suro_cabinet_pick_cabinet();
drop function if exists public.suro_cabinet_pick_next(uuid);
drop function if exists public.suro_cabinet_can_manage_team();
drop function if exists public.suro_cabinet_context();
drop function if exists public.suro_is_cabinet_user();

-- Tables (cascade supprime indexes/policies)
drop table if exists public.suro_cabinet_notifications cascade;
drop table if exists public.suro_claim_status_events cascade;
drop table if exists public.suro_claim_cabinet cascade;
drop table if exists public.suro_task_events cascade;
drop table if exists public.suro_broker_tasks cascade;
drop table if exists public.suro_cabinet_users cascade;
drop table if exists public.suro_cabinets cascade;

-- Type enum
drop type if exists public.suro_cabinet_role;
