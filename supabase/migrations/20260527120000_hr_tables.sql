-- HR branch tables (TalentScan investor MVP)
-- Apply in Supabase SQL editor or via supabase db push
-- Safe to re-run: policies use DROP IF EXISTS; indexes use IF NOT EXISTS

-- gen_random_uuid() is built-in on PostgreSQL 13+ (Supabase). Enable pgcrypto if your project requires it:
create extension if not exists "pgcrypto";

-- hr_profiles
create table if not exists public.hr_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role_title text,
  demo_access boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hr_profiles enable row level security;

drop policy if exists "hr_profiles_select_own" on public.hr_profiles;
create policy "hr_profiles_select_own"
  on public.hr_profiles for select
  using (auth.uid() = id);

drop policy if exists "hr_profiles_insert_own" on public.hr_profiles;
create policy "hr_profiles_insert_own"
  on public.hr_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "hr_profiles_update_own" on public.hr_profiles;
create policy "hr_profiles_update_own"
  on public.hr_profiles for update
  using (auth.uid() = id);

-- hr_companies
create table if not exists public.hr_companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  industry text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_companies_owner_idx on public.hr_companies(owner_user_id);

alter table public.hr_companies enable row level security;

drop policy if exists "hr_companies_select_own" on public.hr_companies;
create policy "hr_companies_select_own"
  on public.hr_companies for select
  using (auth.uid() = owner_user_id);

drop policy if exists "hr_companies_insert_own" on public.hr_companies;
create policy "hr_companies_insert_own"
  on public.hr_companies for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "hr_companies_update_own" on public.hr_companies;
create policy "hr_companies_update_own"
  on public.hr_companies for update
  using (auth.uid() = owner_user_id);

drop policy if exists "hr_companies_delete_own" on public.hr_companies;
create policy "hr_companies_delete_own"
  on public.hr_companies for delete
  using (auth.uid() = owner_user_id);

-- hr_candidates
create table if not exists public.hr_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.hr_companies(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  vacancy_title text,
  status text not null default 'draft',
  hr_comment text,
  birth_date date,
  birth_time time,
  birth_place_text text,
  birth_place_lat double precision,
  birth_place_lon double precision,
  birth_timezone text,
  chart_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_candidates_company_idx on public.hr_candidates(company_id);

alter table public.hr_candidates enable row level security;

drop policy if exists "hr_candidates_select_own_company" on public.hr_candidates;
create policy "hr_candidates_select_own_company"
  on public.hr_candidates for select
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidates.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_candidates_insert_own_company" on public.hr_candidates;
create policy "hr_candidates_insert_own_company"
  on public.hr_candidates for insert
  with check (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidates.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_candidates_update_own_company" on public.hr_candidates;
create policy "hr_candidates_update_own_company"
  on public.hr_candidates for update
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidates.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_candidates_delete_own_company" on public.hr_candidates;
create policy "hr_candidates_delete_own_company"
  on public.hr_candidates for delete
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidates.company_id and c.owner_user_id = auth.uid()
    )
  );

-- hr_candidate_charts
create table if not exists public.hr_candidate_charts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.hr_candidates(id) on delete cascade,
  company_id uuid not null references public.hr_companies(id) on delete cascade,
  calculation_status text not null default 'pending',
  raw_chart_data jsonb,
  normalized_chart_data jsonb,
  birth_data_snapshot jsonb,
  calculated_at timestamptz,
  calculation_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_candidate_charts_candidate_idx on public.hr_candidate_charts(candidate_id);
create unique index if not exists hr_candidate_charts_candidate_uidx
  on public.hr_candidate_charts(candidate_id);

alter table public.hr_candidate_charts enable row level security;

drop policy if exists "hr_candidate_charts_select_own_company" on public.hr_candidate_charts;
create policy "hr_candidate_charts_select_own_company"
  on public.hr_candidate_charts for select
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidate_charts.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_candidate_charts_insert_own_company" on public.hr_candidate_charts;
create policy "hr_candidate_charts_insert_own_company"
  on public.hr_candidate_charts for insert
  with check (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidate_charts.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_candidate_charts_update_own_company" on public.hr_candidate_charts;
create policy "hr_candidate_charts_update_own_company"
  on public.hr_candidate_charts for update
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidate_charts.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_candidate_charts_delete_own_company" on public.hr_candidate_charts;
create policy "hr_candidate_charts_delete_own_company"
  on public.hr_candidate_charts for delete
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidate_charts.company_id and c.owner_user_id = auth.uid()
    )
  );

-- hr_candidate_talent_maps
create table if not exists public.hr_candidate_talent_maps (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.hr_candidates(id) on delete cascade,
  company_id uuid not null references public.hr_companies(id) on delete cascade,
  candidate_chart_id uuid references public.hr_candidate_charts(id) on delete set null,
  report_status text not null default 'draft',
  summary text,
  best_work_format text,
  key_talent text,
  main_risk text,
  formula text,
  metrics jsonb,
  talents jsonb,
  strengths jsonb,
  risks jsonb,
  directions jsonb,
  not_fit_directions jsonb,
  roles jsonb,
  conditions jsonb,
  tests jsonb,
  final_recommendation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hr_candidate_talent_maps_candidate_uidx
  on public.hr_candidate_talent_maps(candidate_id);

alter table public.hr_candidate_talent_maps enable row level security;

drop policy if exists "hr_candidate_talent_maps_select_own_company" on public.hr_candidate_talent_maps;
create policy "hr_candidate_talent_maps_select_own_company"
  on public.hr_candidate_talent_maps for select
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidate_talent_maps.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_candidate_talent_maps_insert_own_company" on public.hr_candidate_talent_maps;
create policy "hr_candidate_talent_maps_insert_own_company"
  on public.hr_candidate_talent_maps for insert
  with check (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidate_talent_maps.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_candidate_talent_maps_update_own_company" on public.hr_candidate_talent_maps;
create policy "hr_candidate_talent_maps_update_own_company"
  on public.hr_candidate_talent_maps for update
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidate_talent_maps.company_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_candidate_talent_maps_delete_own_company" on public.hr_candidate_talent_maps;
create policy "hr_candidate_talent_maps_delete_own_company"
  on public.hr_candidate_talent_maps for delete
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_candidate_talent_maps.company_id and c.owner_user_id = auth.uid()
    )
  );
