create table if not exists public.company_research_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (
    status in ('queued', 'running', 'completed', 'failed', 'blocked')
  ),
  company_name text not null default '',
  job_title text not null default '',
  urls text[] not null default '{}',
  interest text not null default '',
  openai_response_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists company_research_jobs_user_created_idx
on public.company_research_jobs(user_id, created_at desc);

create table if not exists public.company_research_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.company_research_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  job_title text not null default '',
  status_summary text not null default '',
  checked_facts jsonb not null default '[]'::jsonb,
  ai_inferences jsonb not null default '[]'::jsonb,
  unknowns jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  comparison_signals jsonb not null default '[]'::jsonb,
  research_limitations jsonb not null default '[]'::jsonb,
  raw_report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_research_reports_user_created_idx
on public.company_research_reports(user_id, created_at desc);

create table if not exists public.company_research_audits (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.company_research_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  safe_to_display boolean not null default false,
  unsupported_claims_count integer not null default 0,
  high_risk_claims_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  blocked_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_research_audits_user_created_idx
on public.company_research_audits(user_id, created_at desc);

alter table public.company_research_jobs enable row level security;
alter table public.company_research_reports enable row level security;
alter table public.company_research_audits enable row level security;

create policy "company research jobs read own rows"
on public.company_research_jobs
for select
using (auth.uid() is not null and auth.uid() = user_id);

create policy "company research reports read own rows"
on public.company_research_reports
for select
using (auth.uid() is not null and auth.uid() = user_id);

create policy "company research audits read own rows"
on public.company_research_audits
for select
using (auth.uid() is not null and auth.uid() = user_id);

grant select, insert, update, delete on table
  public.company_research_jobs,
  public.company_research_reports,
  public.company_research_audits
to service_role;
