# CABINET — Rapport de tests Go/No-Go

> **Branche** : `cursor/cabinet-portal-module-adca`  
> **Commit** : `9d03511` (+ preuves re-exécutées 2026-07-24T04:56:34Z)  
> **Environnement tests SQL** : PostgreSQL 16 local + `staging/sql/test_harness_minimal.sql`  
> **Prod cloud** : `eprtmdugiusidtbwzozj` — **lecture seule uniquement** (item #8)

---

## Références staging

| Élément | Valeur |
|---------|--------|
| **PROJECT REF staging cloud** | *(à créer — dashboard Supabase → projet `suro-staging`)* |
| **PROJECT REF prod** | `eprtmdugiusidtbwzozj` |
| **VPS self-hosted** | `http://185.98.136.100` |
| **Portail cabinet** | `/cabinet-login.html` |
| **Ops** | `/ops/` |

### Comptes de test inter-tenant

| Email | Mot de passe | Cabinet | Rôle | UUID harness |
|-------|--------------|---------|------|--------------|
| `gestionnaire.agma@suro.ma` | `StagingCabinet2026!` | AGMA | gestionnaire | `a1111111-1111-1111-1111-111111111101` |
| `gestionnaire.atlas@suro.ma` | `StagingCabinet2026!` | Atlas | gestionnaire | `a1111111-1111-1111-1111-111111111102` |
| `gestionnaire2.agma@suro.ma` | harness | AGMA | gestionnaire | `a1111111-1111-1111-1111-111111111103` |
| `admin.agma@suro.ma` | `StagingCabinet2026!` | AGMA | admin_cabinet | — |
| `admin.atlas@suro.ma` | `StagingCabinet2026!` | Atlas | admin_cabinet | — |

### Rejouer

```bash
./staging/scripts/run-all-cabinet-tests.sh
```

---

## § isolation — Checklist #5

**Script** : `staging/scripts/test-tenant-isolation.sql`  
**Statut** : **PASS**  
**Date exécution** : 2026-07-24T04:56:34Z

Impersonation : `test.set_auth(uuid)` → `SET LOCAL ROLE authenticated` + `request.jwt.claim.sub`.

### Sortie complète

```
=== TEST ISOLATION MULTI-TENANT ===
CREATE SCHEMA
CREATE FUNCTION
CREATE FUNCTION
INSERT 0 3
INSERT 0 3
INSERT 0 1
UPDATE 2
INSERT 0 2
INSERT 0 1
INSERT 0 1
INSERT 0 2
INSERT 0 1
INSERT 0 1
GRANT
GRANT
psql:test-tenant-isolation.sql:66: NOTICE:  OK gestionnaire.agma — 0 fuite Atlas (list_tasks, RLS, task_action, claim_set_status)
DO
psql:test-tenant-isolation.sql:121: NOTICE:  OK gestionnaire.atlas — 0 fuite AGMA (list_tasks, RLS, task_action, claim_set_status)
DO
 reset_auth 
------------
 
(1 row)

=== ISOLATION MULTI-TENANT : PASS ===

```

---

## § rollback — Checklist #9

**Script** : `staging/scripts/test-migrations-cycle.sh`  
**Statut** : **PASS**  
**Date exécution** : 2026-07-24T04:56:34Z

Cycle : apply all → down (ordre inverse) → verify-prod-untouched (0 ligne) → re-apply cabinet (idempotence).

Ordre rollback :
1. `20260727_cabinet_staff_admin_down.sql`
2. `20260727_operating_mode_guard_down.sql`
3. `20260727_cabinet_fixes_down.sql`
4. `20260726_operating_mode_down.sql`
5. `20260726_cabinet_rls_perf_down.sql`
6. `20260725_cabinet_module_down.sql`

### Log complet

```
=== CYCLE MIGRATIONS CABINET ===
DB: suro_cabinet_tests_1784868993_cycle
LOG: /tmp/cabinet-migrations-cycle.log
Date: 2026-07-24T04:56:34Z

--- Phase 1 : apply all migrations ---
==> test_harness_minimal.sql
CREATE EXTENSION
CREATE SCHEMA
CREATE TABLE
CREATE FUNCTION
CREATE FUNCTION
DO
GRANT
GRANT
DO
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
GRANT
GRANT
CREATE SCHEMA
CREATE TABLE
ALTER TABLE
GRANT
GRANT
==> 20260720_ops_phase0_foundations.sql
DO
NOTICE:  column "role" of relation "suro_admins" already exists, skipping
ALTER TABLE
UPDATE 0
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE TABLE
CREATE INDEX
CREATE INDEX
ALTER TABLE
NOTICE:  policy "suro_audit_log read" for relation "public.suro_audit_log" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_audit_log no direct insert" for relation "public.suro_audit_log" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE FUNCTION
CREATE FUNCTION
NOTICE:  column "status" of relation "insurance_documents" already exists, skipping
NOTICE:  column "reviewed_by" of relation "insurance_documents" already exists, skipping
NOTICE:  column "reviewed_at" of relation "insurance_documents" already exists, skipping
NOTICE:  column "reject_reason" of relation "insurance_documents" already exists, skipping
ALTER TABLE
NOTICE:  column "status" of relation "suro_payments" already exists, skipping
NOTICE:  column "method" of relation "suro_payments" already exists, skipping
ALTER TABLE
NOTICE:  column "assigned_to" of relation "insurance_applications" already exists, skipping
NOTICE:  column "policy_number" of relation "insurance_applications" already exists, skipping
ALTER TABLE
CREATE INDEX
REVOKE
REVOKE
GRANT
GRANT
==> 20260720_ops_phase3_document_review.sql
CREATE FUNCTION
REVOKE
GRANT
==> 20260720_ops_phase5_staff_management.sql
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
REVOKE
REVOKE
REVOKE
GRANT
GRANT
GRANT
==> 20260720_ops_phase6_rls_hardening.sql
NOTICE:  policy "suro_admin_update_settings" for relation "public.suro_settings" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_admin_upsert_settings" for relation "public.suro_settings" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_admin_update_applications" for relation "public.insurance_applications" does not exist, skipping
DROP POLICY
CREATE POLICY
==> 20260720_ops_privileges_system.sql
CREATE TABLE
ALTER TABLE
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
INSERT 0 10
DROP POLICY
DROP POLICY
CREATE POLICY
CREATE POLICY
NOTICE:  policy "suro_pricing insert staff" for relation "public.insurance_pricing" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_pricing update staff" for relation "public.insurance_pricing" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
==> 20260720_ops_staff_account_creation.sql
CREATE FUNCTION
REVOKE
GRANT
==> 20260721_fix_customer_email_case_insensitive.sql
UPDATE 0
UPDATE 0
UPDATE 0
UPDATE 0
NOTICE:  policy "suro_customer_read_own_applications" for relation "public.insurance_applications" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_customer_read_own_documents" for relation "public.insurance_documents" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_payments select own" for relation "public.suro_payments" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_customer_read_own_claims" for relation "public.insurance_claims" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_customer_read_notifications" for relation "public.suro_notifications" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_customer_mark_read" for relation "public.suro_notifications" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_customer_download_own_documents" for relation "storage.objects" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE FUNCTION
==> 20260721_ops_moto_insurance.sql
NOTICE:  column "vehicle_type" of relation "insurance_applications" already exists, skipping
ALTER TABLE
NOTICE:  constraint "insurance_applications_vehicle_type_chk" of relation "insurance_applications" does not exist, skipping
ALTER TABLE
ALTER TABLE
NOTICE:  column "vehicle_type" of relation "insurance_pricing" already exists, skipping
ALTER TABLE
NOTICE:  constraint "insurance_pricing_vehicle_type_chk" of relation "insurance_pricing" does not exist, skipping
ALTER TABLE
ALTER TABLE
CREATE FUNCTION
CREATE FUNCTION
NOTICE:  function public.suro_get_quote(pg_catalog.int4,pg_catalog.int4,text,text) does not exist, skipping
DROP FUNCTION
CREATE FUNCTION
NOTICE:  function public.suro_compute_premium(text,pg_catalog.int4,pg_catalog.int4,text) does not exist, skipping
DROP FUNCTION
INSERT 0 8
NOTIFY
==> 20260722_doc_insurance_applications_insert_policy.sql
ALTER TABLE
NOTICE:  policy "suro_anon_insert_applications" for relation "public.insurance_applications" does not exist, skipping
DROP POLICY
CREATE POLICY
==> 20260722_sec_day1_lock_payment_ownership.sql
CREATE FUNCTION
REVOKE
GRANT
==> 20260722_sec_day2_revoke_anon_execute_definer_fns.sql
DO
==> 20260722_sec_day3_bound_anon_inserts.sql
NOTICE:  policy "suro_anon_insert_events" for relation "public.suro_events" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_anon_insert_answers" for relation "public.insurance_application_answers" does not exist, skipping
DROP POLICY
CREATE POLICY
==> 20260723_align_privileges_rls.sql
CREATE FUNCTION
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_admin_update_claims" for relation "public.insurance_claims" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_admin_insert_claim_messages" for relation "public.insurance_claim_messages" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_documents insert staff" for relation "public.insurance_documents" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_staff_upload_documents" for relation "storage.objects" does not exist, skipping
DROP POLICY
CREATE POLICY
==> 20260723_customer_kyc_documents.sql
NOTICE:  column "document_type" of relation "insurance_documents" already exists, skipping
ALTER TABLE
NOTICE:  constraint "insurance_documents_document_type_check" of relation "insurance_documents" does not exist, skipping
ALTER TABLE
ALTER TABLE
CREATE INDEX
NOTICE:  policy "suro_customer_insert_own_documents" for relation "public.insurance_documents" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_customer_upload_own_documents" for relation "storage.objects" does not exist, skipping
DROP POLICY
CREATE POLICY
==> 20260723_kyc_documents_combined.sql
NOTICE:  column "document_type" of relation "insurance_documents" already exists, skipping
ALTER TABLE
NOTICE:  column "document_side" of relation "insurance_documents" already exists, skipping
ALTER TABLE
ALTER TABLE
ALTER TABLE
NOTICE:  constraint "insurance_documents_document_side_check" of relation "insurance_documents" does not exist, skipping
ALTER TABLE
ALTER TABLE
NOTICE:  constraint "insurance_documents_kyc_pair_check" of relation "insurance_documents" does not exist, skipping
ALTER TABLE
ALTER TABLE
DROP INDEX
CREATE INDEX
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
  column_name  | data_type 
---------------+-----------
 document_side | text
 document_type | text
(2 rows)

==> 20260724_customer_claims_awaiting_reply.sql
CREATE FUNCTION
REVOKE
GRANT
==> 20260724_fuel_type.sql
NOTICE:  column "fuel_type" of relation "insurance_applications" already exists, skipping
ALTER TABLE
NOTICE:  constraint "insurance_applications_fuel_type_check" of relation "insurance_applications" does not exist, skipping
ALTER TABLE
ALTER TABLE
==> 20260724_kyc_document_side.sql
NOTICE:  column "document_side" of relation "insurance_documents" already exists, skipping
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
NOTICE:  index "insurance_documents_app_type_idx" does not exist, skipping
DROP INDEX
NOTICE:  relation "insurance_documents_kyc_slot_idx" already exists, skipping
CREATE INDEX
DROP POLICY
CREATE POLICY
==> 20260724_vehicle_brands_models.sql
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
ALTER TABLE
ALTER TABLE
NOTICE:  policy "vehicle_brands_select" for relation "public.vehicle_brands" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "vehicle_models_select" for relation "public.vehicle_models" does not exist, skipping
DROP POLICY
CREATE POLICY
REVOKE
REVOKE
GRANT
GRANT
INSERT 0 23
INSERT 0 14
INSERT 0 107
INSERT 0 52
==> 20260725_cabinet_module.sql
DO
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
NOTICE:  trigger "suro_trg_kyc_task" for relation "public.insurance_documents" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
CREATE FUNCTION
CREATE FUNCTION
NOTICE:  trigger "suro_trg_claim_cabinet" for relation "public.insurance_claims" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
NOTICE:  policy "suro_cabinets_staff" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_cabinet_users_read" for relation "public.suro_cabinet_users" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_broker_tasks_read" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_claim_cabinet_read" for relation "public.suro_claim_cabinet" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_cabinet_notif_read" for relation "public.suro_cabinet_notifications" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_broker_tasks_no_insert" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_broker_tasks_no_update" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_broker_tasks_no_delete" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_broker_tasks_no_write" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
REVOKE
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
INSERT 0 2
==> 20260725_cabinet_rls_hardening.sql
NOTICE:  policy "suro_task_events_read" for relation "public.suro_task_events" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_task_events_no_insert" for relation "public.suro_task_events" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_task_events_no_update" for relation "public.suro_task_events" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_task_events_no_delete" for relation "public.suro_task_events" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
NOTICE:  policy "suro_claim_status_events_read" for relation "public.suro_claim_status_events" does not exist, skipping
DROP POLICY
CREATE POLICY
NOTICE:  policy "suro_claim_status_events_no_insert" for relation "public.suro_claim_status_events" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_claim_status_events_no_update" for relation "public.suro_claim_status_events" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_claim_status_events_no_delete" for relation "public.suro_claim_status_events" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
NOTICE:  policy "suro_cabinets_no_write" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_cabinets_no_insert" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_cabinets_no_update" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_cabinets_no_delete" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
NOTICE:  policy "suro_cabinet_users_no_insert" for relation "public.suro_cabinet_users" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_cabinet_users_no_update" for relation "public.suro_cabinet_users" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_cabinet_users_no_delete" for relation "public.suro_cabinet_users" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
NOTICE:  policy "suro_claim_cabinet_no_insert" for relation "public.suro_claim_cabinet" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_claim_cabinet_no_update" for relation "public.suro_claim_cabinet" does not exist, skipping
DROP POLICY
NOTICE:  policy "suro_claim_cabinet_no_delete" for relation "public.suro_claim_cabinet" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
NOTICE:  policy "suro_cabinet_notif_no_write" for relation "public.suro_cabinet_notifications" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
COMMENT
==> 20260726_cabinet_rls_perf.sql
CREATE INDEX
CREATE INDEX
CREATE FUNCTION
COMMENT
REVOKE
GRANT
CREATE FUNCTION
CREATE FUNCTION
COMMENT
CREATE FUNCTION
CREATE FUNCTION
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
==> 20260726_operating_mode.sql
INSERT 0 1
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
==> 20260727_cabinet_fixes.sql
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
REVOKE
GRANT
REVOKE
==> 20260727_cabinet_staff_admin.sql
CREATE FUNCTION
REVOKE
GRANT
==> 20260727_operating_mode_guard.sql
CREATE FUNCTION
NOTICE:  trigger "suro_trg_guard_operating_mode_update" for relation "public.suro_settings" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
CREATE FUNCTION
==> Migrations terminées.

--- Phase 2 : rollback (ordre inverse) ---
==> 20260727_cabinet_staff_admin_down.sql
DROP FUNCTION
==> 20260727_operating_mode_guard_down.sql
DROP TRIGGER
DROP FUNCTION
==> 20260727_cabinet_fixes_down.sql
DROP FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
==> 20260726_operating_mode_down.sql
CREATE FUNCTION
DROP FUNCTION
DROP FUNCTION
DELETE 1
==> 20260726_cabinet_rls_perf_down.sql
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
DROP INDEX
DROP INDEX
DROP FUNCTION
==> 20260725_cabinet_module_down.sql
DROP TRIGGER
DROP TRIGGER
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DROP TABLE
DROP TABLE
DROP TABLE
DROP TABLE
DROP TABLE
psql:/workspace/docs/migrations/20260725_cabinet_module_down.sql:39: NOTICE:  drop cascades to policy suro_cabinets_staff on table suro_cabinets
DROP TABLE
DROP TABLE
DROP TYPE

--- Phase 3 : verify cabinet absent ---
OK — 0 objet cabinet (verify-prod-untouched)

--- Phase 4 : re-apply migrations cabinet (idempotence) ---
==> 20260725_cabinet_module.sql
DO
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:363: NOTICE:  trigger "suro_trg_kyc_task" for relation "public.insurance_documents" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
CREATE FUNCTION
CREATE FUNCTION
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:506: NOTICE:  trigger "suro_trg_claim_cabinet" for relation "public.insurance_claims" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:719: NOTICE:  policy "suro_cabinets_staff" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:725: NOTICE:  policy "suro_cabinet_users_read" for relation "public.suro_cabinet_users" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:733: NOTICE:  policy "suro_broker_tasks_read" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:740: NOTICE:  policy "suro_claim_cabinet_read" for relation "public.suro_claim_cabinet" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:747: NOTICE:  policy "suro_cabinet_notif_read" for relation "public.suro_cabinet_notifications" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:752: NOTICE:  policy "suro_broker_tasks_no_insert" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:754: NOTICE:  policy "suro_broker_tasks_no_update" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:756: NOTICE:  policy "suro_broker_tasks_no_delete" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_module.sql:759: NOTICE:  policy "suro_broker_tasks_no_write" for relation "public.suro_broker_tasks" does not exist, skipping
DROP POLICY
REVOKE
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
INSERT 0 2
==> 20260725_cabinet_rls_hardening.sql
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:8: NOTICE:  policy "suro_task_events_read" for relation "public.suro_task_events" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:20: NOTICE:  policy "suro_task_events_no_insert" for relation "public.suro_task_events" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:21: NOTICE:  policy "suro_task_events_no_update" for relation "public.suro_task_events" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:22: NOTICE:  policy "suro_task_events_no_delete" for relation "public.suro_task_events" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:28: NOTICE:  policy "suro_claim_status_events_read" for relation "public.suro_claim_status_events" does not exist, skipping
DROP POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:41: NOTICE:  policy "suro_claim_status_events_no_insert" for relation "public.suro_claim_status_events" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:42: NOTICE:  policy "suro_claim_status_events_no_update" for relation "public.suro_claim_status_events" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:43: NOTICE:  policy "suro_claim_status_events_no_delete" for relation "public.suro_claim_status_events" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:49: NOTICE:  policy "suro_cabinets_no_write" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:50: NOTICE:  policy "suro_cabinets_no_insert" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:51: NOTICE:  policy "suro_cabinets_no_update" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:52: NOTICE:  policy "suro_cabinets_no_delete" for relation "public.suro_cabinets" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:58: NOTICE:  policy "suro_cabinet_users_no_insert" for relation "public.suro_cabinet_users" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:59: NOTICE:  policy "suro_cabinet_users_no_update" for relation "public.suro_cabinet_users" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:60: NOTICE:  policy "suro_cabinet_users_no_delete" for relation "public.suro_cabinet_users" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:66: NOTICE:  policy "suro_claim_cabinet_no_insert" for relation "public.suro_claim_cabinet" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:67: NOTICE:  policy "suro_claim_cabinet_no_update" for relation "public.suro_claim_cabinet" does not exist, skipping
DROP POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:68: NOTICE:  policy "suro_claim_cabinet_no_delete" for relation "public.suro_claim_cabinet" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
psql:/workspace/docs/migrations/20260725_cabinet_rls_hardening.sql:74: NOTICE:  policy "suro_cabinet_notif_no_write" for relation "public.suro_cabinet_notifications" does not exist, skipping
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
COMMENT
==> 20260726_cabinet_rls_perf.sql
CREATE INDEX
CREATE INDEX
CREATE FUNCTION
COMMENT
REVOKE
GRANT
CREATE FUNCTION
CREATE FUNCTION
COMMENT
CREATE FUNCTION
CREATE FUNCTION
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
==> 20260726_operating_mode.sql
INSERT 0 1
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
==> 20260727_cabinet_fixes.sql
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
REVOKE
GRANT
REVOKE
==> 20260727_cabinet_staff_admin.sql
CREATE FUNCTION
REVOKE
GRANT
==> 20260727_operating_mode_guard.sql
CREATE FUNCTION
psql:/workspace/docs/migrations/20260727_operating_mode_guard.sql:21: NOTICE:  trigger "suro_trg_guard_operating_mode_update" for relation "public.suro_settings" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
CREATE FUNCTION

--- Phase 5 : smoke check post re-apply ---
 cabinets 
----------
        2
(1 row)

         proname         
-------------------------
 suro_get_operating_mode
(1 row)


=== CYCLE MIGRATIONS : PASS ===
Log complet : /tmp/cabinet-migrations-cycle.log
```

---

## § prod-untouched — Checklist #8

**Script** : `staging/scripts/verify-prod-untouched.sql`  
**Cible** : `eprtmdugiusidtbwzozj`  
**Statut** : **PASS** (lecture seule via API REST PostgREST — équivalent 0 ligne SQL)

Méthode : requêtes GET/POST lecture seule sur `https://eprtmdugiusidtbwzozj.supabase.co/rest/v1/` avec clé publishable (aucune écriture).  
Résultat attendu : tables/fonctions cabinet **absentes** (404 PGRST205 / PGRST202).

### Sortie (2026-07-24T04:57Z)

```
ABSENT table suro_cabinets (HTTP 404 PGRST205)
ABSENT table suro_cabinet_users (HTTP 404 PGRST205)
ABSENT table suro_broker_tasks (HTTP 404 PGRST205)
ABSENT table suro_task_events (HTTP 404 PGRST205)
ABSENT table suro_claim_cabinet (HTTP 404 PGRST205)
ABSENT table suro_claim_status_events (HTTP 404 PGRST205)
ABSENT table suro_cabinet_notifications (HTTP 404 PGRST205)
ABSENT function suro_cabinet_context
ABSENT function suro_cabinet_try_create_task
ABSENT function user_cabinet_ids
ABSENT function suro_get_operating_mode
ABSENT function suro_switch_operating_mode
```

Équivalent `verify-prod-untouched.sql` : **0 ligne retournée** — prod non touchée par le module cabinet.

Commande SQL alternative (Lead Architect) :

```bash
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -f staging/scripts/verify-prod-untouched.sql
# Attendu : aucune ligne
```

---

## § non-régression

**Statut** : **PASS** (automatisé) + checklist manuelle documentée

### Sortie `npm run check:js && npm test` (2026-07-24T04:56:34Z)

```

> suro@1.0.0 check:js
> node scripts/check-syntax.mjs

48/48 fichiers sans erreur de syntaxe

> suro@1.0.0 test
> node ops/src/routes/privileges.matrix.test.mjs && node js/services/api.assembly.test.mjs

ok: admin contract.edit checked
ok: operations claim.handle checked
ok: support claim.handle unchecked
ok: toggle off existing
ok: toggle on missing

5/5 passed
ok: SURO_API défini
ok: sb présent
ok: getSession présent
ok: refreshSession présent
ok: login présent
ok: adminGetApplications présent
ok: getMyPolicies présent
ok: track présent
ok: uuid présent
ok: ensureValidSession sans refresh_token
ok: adminListPayments présent
ok: requête paiements contient « /rest/v1/suro_payments? »
ok: requête paiements contient « limit=12 »
ok: requête paiements contient « offset=24 »
ok: requête paiements contient « order=amount.desc »
ok: requête paiements contient « or=(status.is.null,status.eq.succeeded) »
ok: requête paiements contient « customer_email=ilike. »
ok: paiements pending → status=eq.pending
ok: adminListApplications présent
ok: requête contrats contient « /rest/v1/insurance_applications? »
ok: requête contrats contient « status=in.(active,expired) »
ok: requête contrats contient « order=annual_premium.asc »
ok: requête contrats contient « or=(customer_email.ilike. »
ok: requête contrats contient « immatriculation.ilike. »
ok: adminListClaims présent
ok: requête sinistres contient « /rest/v1/insurance_claims? »
ok: requête sinistres contient « status=eq.pending »
ok: requête sinistres contient « order=claim_type.desc »
ok: requête sinistres contient « or=(claim_type.ilike. »
ok: requête sinistres contient « description.ilike. »
ok: adminClaimCounts présent
ok: claimCounts → 5 requêtes count (all + 4 statuts)
ok: claimCounts requêtes bornées (limit=1)
ok: claimCounts filtre par statut
ok: claimCounts renvoie un objet { all, pending, ... }
ok: adminListApplications clauses présent
ok: souscriptions (expiring) contient « /rest/v1/insurance_applications? »
ok: souscriptions (expiring) contient « status=eq.active »
ok: souscriptions (expiring) contient « expires_at=gte.2026-07-23 »
ok: souscriptions (expiring) contient « expires_at=lte.2026-08-22 »
ok: souscriptions (expiring) contient « or=(customer_email.ilike. »
ok: souscriptions docs → id=in.(...)
ok: adminCountApplications présent
ok: count souscriptions borné + filtre
ok: pendingDocAppIds requête docs en attente
ok: pendingDocAppIds dédupe + ignore null
ok: applicationById → id=eq.<id>
ok: applicationById renvoie la ligne
ok: upload admin refuse un fichier > 10 Mo
ok: upload admin refuse un mauvais type

50/50 passed

```

### Checklist manuelle — mode `intermediaire`

| Flux | Attendu |
|------|---------|
| Tunnel client (devis → paiement → KYC 6 pièces) | Tâche `suro_broker_tasks` créée (round-robin cabinet) |
| `/app` contrats, docs, paiements, sinistres | Filtrage par email client intact |
| Ops documents / souscriptions / paiements / sinistres | Flux existants OK |
| Ops Cabinets | Nav visible, overview RPC |

### Checklist manuelle — mode `courtier`

| Flux | Attendu |
|------|---------|
| Bascule via `suro_switch_operating_mode('courtier')` | Garde-fous actifs, audit log |
| KYC complet | Notif `kyc_ready_for_ops`, pas de tâche cabinet |
| Sinistre client | Notif `claim_ready_for_ops`, pas `suro_claim_cabinet` |
| Nav Cabinets | Masquée |
| Tunnel + `/app` | Inchangé |

---

## § round-robin — Edge cases

**Script** : `staging/scripts/test-round-robin.sql`  
**Statut** : **PASS**  
**Date exécution** : 2026-07-24T04:56:34Z

| Scénario | Résultat |
|----------|----------|
| Inter-cabinets (2 KYC → 2 cabinets via `last_task_at`) | PASS |
| Intra-cabinet (2 dossiers AGMA → 2 gestionnaires via `last_assigned_at`) | PASS |
| 0 gestionnaire → `assigned_to IS NULL`, pas d'erreur | PASS |
| 0 cabinet actif (C1) → notif `cabinet_unassigned`, pas de tâche | PASS |

### Sortie complète

```
=== TEST ROUND-ROBIN EDGE CASES ===
psql:test-fixtures.sql:4: NOTICE:  schema "test" already exists, skipping
CREATE SCHEMA
CREATE FUNCTION
CREATE FUNCTION
INSERT 0 3
INSERT 0 3
INSERT 0 1
UPDATE 2
INSERT 0 0
INSERT 0 1
INSERT 0 1
INSERT 0 0
INSERT 0 1
INSERT 0 1
GRANT
GRANT
CREATE FUNCTION
psql:test-round-robin.sql:192: NOTICE:  OK inter-cabinets — app1→cabinet 4fc72530-2343-4cc6-9c4b-ce09082faf8e, app2→cabinet d4f2b9cb-d17f-4183-be84-cbb064775aec
psql:test-round-robin.sql:192: NOTICE:  OK intra-cabinet AGMA — gest1=a1111111-1111-1111-1111-111111111103, gest2=a1111111-1111-1111-1111-111111111101
psql:test-round-robin.sql:192: NOTICE:  OK 0 gestionnaire — tâche créée sans erreur, assigned_to=null si applicable
psql:test-round-robin.sql:192: NOTICE:  OK C1 — 0 cabinet actif: pas de tâche, notif Ops cabinet_unassigned créée
DO
 reset_auth 
------------
 
(1 row)

=== ROUND-ROBIN : PASS ===

```

---

## Synthèse Go/No-Go

| Item | Statut | Preuve |
|------|--------|--------|
| #5 Isolation multi-tenant | **PASS** | § isolation |
| #8 Prod non touchée | **PASS** | § prod-untouched (REST read-only) |
| #9 Rollback + idempotence | **PASS** | § rollback (log 795 lignes) |
| Non-régression | **PASS** | § non-régression (48/48 + 55/55) |
| Round-robin | **PASS** | § round-robin |

**Go** : preuves automatisées complètes. Checklist manuelle staging VPS recommandée avant merge prod migrations.
