create extension if not exists "pgcrypto";

-- HR vacancies: full vacancy / role entity
create table if not exists public.hr_vacancies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.hr_companies(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,

  title text not null,
  status text not null default 'draft',
  source text not null default 'manual',

  department text,
  employment_format text,
  work_format text,
  location text,
  schedule text,
  salary_range text,

  role_description text,
  responsibilities text,
  kpi text,
  must_have text,
  nice_to_have text,
  working_conditions text,
  manager_context text,
  team_context text,
  hiring_priorities text,
  risks_to_check text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_vacancies_company_idx
  on public.hr_vacancies(company_id);

create index if not exists hr_vacancies_status_idx
  on public.hr_vacancies(status);

create index if not exists hr_vacancies_created_by_idx
  on public.hr_vacancies(created_by_user_id);

alter table public.hr_vacancies enable row level security;

drop policy if exists "hr_vacancies_select_own_company" on public.hr_vacancies;
create policy "hr_vacancies_select_own_company"
  on public.hr_vacancies for select
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancies.company_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_vacancies_insert_own_company" on public.hr_vacancies;
create policy "hr_vacancies_insert_own_company"
  on public.hr_vacancies for insert
  with check (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancies.company_id
        and c.owner_user_id = auth.uid()
    )
    and (
      created_by_user_id is null
      or created_by_user_id = auth.uid()
    )
  );

drop policy if exists "hr_vacancies_update_own_company" on public.hr_vacancies;
create policy "hr_vacancies_update_own_company"
  on public.hr_vacancies for update
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancies.company_id
        and c.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancies.company_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_vacancies_delete_own_company" on public.hr_vacancies;
create policy "hr_vacancies_delete_own_company"
  on public.hr_vacancies for delete
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancies.company_id
        and c.owner_user_id = auth.uid()
    )
  );

-- Vacancy ↔ candidate link table
create table if not exists public.hr_vacancy_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.hr_companies(id) on delete cascade,
  vacancy_id uuid not null references public.hr_vacancies(id) on delete cascade,
  candidate_id uuid not null references public.hr_candidates(id) on delete cascade,

  stage text not null default 'new',
  status text not null default 'active',
  source text not null default 'manual',
  recruiter_comment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hr_vacancy_candidates_unique unique (vacancy_id, candidate_id)
);

create index if not exists hr_vacancy_candidates_company_idx
  on public.hr_vacancy_candidates(company_id);

create index if not exists hr_vacancy_candidates_vacancy_idx
  on public.hr_vacancy_candidates(vacancy_id);

create index if not exists hr_vacancy_candidates_candidate_idx
  on public.hr_vacancy_candidates(candidate_id);

alter table public.hr_vacancy_candidates enable row level security;

drop policy if exists "hr_vacancy_candidates_select_own_company" on public.hr_vacancy_candidates;
create policy "hr_vacancy_candidates_select_own_company"
  on public.hr_vacancy_candidates for select
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancy_candidates.company_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "hr_vacancy_candidates_insert_own_company" on public.hr_vacancy_candidates;
create policy "hr_vacancy_candidates_insert_own_company"
  on public.hr_vacancy_candidates for insert
  with check (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancy_candidates.company_id
        and c.owner_user_id = auth.uid()
    )
    and exists (
      select 1 from public.hr_vacancies v
      where v.id = hr_vacancy_candidates.vacancy_id
        and v.company_id = hr_vacancy_candidates.company_id
    )
    and exists (
      select 1 from public.hr_candidates cand
      where cand.id = hr_vacancy_candidates.candidate_id
        and cand.company_id = hr_vacancy_candidates.company_id
    )
  );

drop policy if exists "hr_vacancy_candidates_update_own_company" on public.hr_vacancy_candidates;
create policy "hr_vacancy_candidates_update_own_company"
  on public.hr_vacancy_candidates for update
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancy_candidates.company_id
        and c.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancy_candidates.company_id
        and c.owner_user_id = auth.uid()
    )
    and exists (
      select 1 from public.hr_vacancies v
      where v.id = hr_vacancy_candidates.vacancy_id
        and v.company_id = hr_vacancy_candidates.company_id
    )
    and exists (
      select 1 from public.hr_candidates cand
      where cand.id = hr_vacancy_candidates.candidate_id
        and cand.company_id = hr_vacancy_candidates.company_id
    )
  );

drop policy if exists "hr_vacancy_candidates_delete_own_company" on public.hr_vacancy_candidates;
create policy "hr_vacancy_candidates_delete_own_company"
  on public.hr_vacancy_candidates for delete
  using (
    exists (
      select 1 from public.hr_companies c
      where c.id = hr_vacancy_candidates.company_id
        and c.owner_user_id = auth.uid()
    )
  );

-- Grants for Supabase authenticated role. RLS still controls row access.
grant usage on schema public to authenticated;

grant select, insert, update, delete
on table public.hr_vacancies
to authenticated;

grant select, insert, update, delete
on table public.hr_vacancy_candidates
to authenticated;

-- Optional safe backfill from legacy hr_candidates.vacancy_title.
-- This preserves old data without deleting or changing vacancy_title.
with legacy_titles as (
  select distinct
    cand.company_id,
    c.owner_user_id,
    trim(cand.vacancy_title) as title
  from public.hr_candidates cand
  join public.hr_companies c on c.id = cand.company_id
  where cand.vacancy_title is not null
    and trim(cand.vacancy_title) <> ''
)
insert into public.hr_vacancies (
  company_id,
  created_by_user_id,
  title,
  status,
  source,
  role_description
)
select
  lt.company_id,
  lt.owner_user_id,
  lt.title,
  'active',
  'legacy_vacancy_title',
  'Создано автоматически из старого поля vacancy_title при миграции HR Vacancies Foundation v0.1.'
from legacy_titles lt
where not exists (
  select 1 from public.hr_vacancies v
  where v.company_id = lt.company_id
    and lower(trim(v.title)) = lower(lt.title)
);

insert into public.hr_vacancy_candidates (
  company_id,
  vacancy_id,
  candidate_id,
  stage,
  status,
  source
)
select
  cand.company_id,
  v.id,
  cand.id,
  'new',
  'active',
  'legacy_vacancy_title'
from public.hr_candidates cand
join public.hr_vacancies v
  on v.company_id = cand.company_id
 and lower(trim(v.title)) = lower(trim(cand.vacancy_title))
where cand.vacancy_title is not null
  and trim(cand.vacancy_title) <> ''
on conflict (vacancy_id, candidate_id) do nothing;

NOTIFY pgrst, 'reload schema';
