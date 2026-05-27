-- Patch for Supabase environments where 20260527120000_hr_tables.sql was applied
-- before QA stabilization (without charts unique index / idempotent policies).
-- Safe to run on fresh installs too (all statements are idempotent).

create extension if not exists "pgcrypto";

create unique index if not exists hr_candidate_charts_candidate_uidx
  on public.hr_candidate_charts(candidate_id);

create unique index if not exists hr_candidate_talent_maps_candidate_uidx
  on public.hr_candidate_talent_maps(candidate_id);
