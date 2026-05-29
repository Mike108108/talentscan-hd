-- Universal HR AI reports table (TalentScan MVP)
-- Safe to re-run: policies use DROP IF EXISTS; indexes use IF NOT EXISTS

create extension if not exists "pgcrypto";

create table if not exists public.hr_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.hr_companies(id) on delete cascade,
  candidate_id uuid references public.hr_candidates(id) on delete cascade,
  vacancy_id uuid references public.hr_vacancies(id) on delete set null,
  report_type text not null,
  report_status text not null default 'ready',
  title text,
  summary text,
  fit_score integer,
  content_json jsonb not null default '{}'::jsonb,
  input_snapshot jsonb not null default '{}'::jsonb,
  input_hash text not null,
  model text,
  prompt_version text not null,
  generation_error text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_reports_company_idx
  on public.hr_reports(company_id);

create index if not exists hr_reports_candidate_idx
  on public.hr_reports(candidate_id);

create index if not exists hr_reports_vacancy_idx
  on public.hr_reports(vacancy_id);

create index if not exists hr_reports_type_hash_idx
  on public.hr_reports(report_type, input_hash);

-- One cached report per input fingerprint (vacancy_id null → sentinel uuid)
create unique index if not exists hr_reports_current_uidx
  on public.hr_reports (
    company_id,
    candidate_id,
    coalesce(vacancy_id, '00000000-0000-0000-0000-000000000000'::uuid),
    report_type,
    input_hash
  );

alter table public.hr_reports enable row level security;

drop policy if exists "hr_reports_select_own_company" on public.hr_reports;
create policy "hr_reports_select_own_company"
  on public.hr_reports for select
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_reports.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_reports_insert_own_company" on public.hr_reports;
create policy "hr_reports_insert_own_company"
  on public.hr_reports for insert
  with check (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_reports.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_reports_update_own_company" on public.hr_reports;
create policy "hr_reports_update_own_company"
  on public.hr_reports for update
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_reports.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_reports_delete_own_company" on public.hr_reports;
create policy "hr_reports_delete_own_company"
  on public.hr_reports for delete
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_reports.company_id and c.owner_user_id = auth.uid()
    )
  );

grant select, insert, update, delete
on table public.hr_reports
to authenticated;

NOTIFY pgrst, 'reload schema';
