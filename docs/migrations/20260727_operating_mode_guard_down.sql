-- Rollback — 20260727_operating_mode_guard.sql
drop trigger if exists suro_trg_guard_operating_mode_update on public.suro_settings;
drop function if exists public.suro_trg_guard_operating_mode_update();
