# Ordre d'application des migrations SQL (Supabase self-hosted)

Appliquer dans le **SQL Editor** de Supabase Studio ou via `psql`, dans cet ordre :

1. `20260720_ops_phase0_foundations.sql`
2. `20260720_ops_phase3_document_review.sql`
3. `20260720_ops_phase5_staff_management.sql`
4. `20260720_ops_phase6_rls_hardening.sql`
5. `20260720_ops_staff_account_creation.sql`
6. `20260720_ops_privileges_system.sql`
7. `20260721_fix_customer_email_case_insensitive.sql`
8. `20260721_ops_moto_insurance.sql`
9. `20260722_sec_day1_lock_payment_ownership.sql`
10. `20260722_sec_day2_revoke_anon_execute_definer_fns.sql`
11. `20260722_sec_day3_bound_anon_inserts.sql`
12. `20260723_kyc_documents_combined.sql` (ou versions séparées KYC)
13. `20260723_align_privileges_rls.sql`

Migrations doc-only (ne pas exécuter comme SQL) :
- `20260722_doc_insurance_applications_insert_policy.sql`

Vérifier après import : tables `insurance_applications`, `suro_role_privileges`, fonctions `suro_can`, `suro_my_privileges`.
