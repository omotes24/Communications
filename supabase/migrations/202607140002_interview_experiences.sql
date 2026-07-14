alter table public.company_slots
add column if not exists jobtrack_catalog_ref text;

alter table public.company_slots
drop constraint if exists company_slots_jobtrack_catalog_ref_format;

alter table public.company_slots
add constraint company_slots_jobtrack_catalog_ref_format
check (jobtrack_catalog_ref is null or jobtrack_catalog_ref ~ '^JT[0-9]{6}$');

create index if not exists company_slots_jobtrack_catalog_ref_idx
on public.company_slots(jobtrack_catalog_ref)
where jobtrack_catalog_ref is not null;

create table if not exists public.interview_experience_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interview_session_id uuid not null references public.interview_sessions(id) on delete cascade,
  company_slot_id uuid references public.company_slots(id) on delete set null,
  jobtrack_catalog_ref text,
  company_name_snapshot text not null default '',
  interview_month text,
  selection_stage text not null default 'other' check (
    selection_stage in ('screening', 'first', 'second', 'final', 'casual', 'intern', 'other')
  ),
  employment_type text not null default 'other' check (
    employment_type in ('new_grad', 'mid_career', 'intern', 'part_time', 'other')
  ),
  interview_format text not null default 'other' check (
    interview_format in ('one_on_one', 'panel', 'group', 'video', 'phone', 'other')
  ),
  role_category text not null default '',
  summary text not null,
  overall_impression text not null default '',
  difficulty smallint check (difficulty is null or difficulty between 1 and 5),
  questions jsonb not null default '[]'::jsonb,
  insights jsonb not null default '[]'::jsonb,
  source_message_count integer not null default 0 check (source_message_count >= 0),
  source_transcript_sha256 text not null,
  normalization_version text not null default 'yfy-interview-experience-v1',
  review_status text not null default 'reviewed' check (
    review_status in ('draft', 'reviewed', 'withdrawn')
  ),
  research_consent boolean not null default false,
  consent_version text,
  contributed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, interview_session_id),
  check (jobtrack_catalog_ref is null or jobtrack_catalog_ref ~ '^JT[0-9]{6}$'),
  check (interview_month is null or interview_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  check (char_length(company_name_snapshot) <= 240),
  check (char_length(role_category) <= 120),
  check (char_length(summary) <= 4000),
  check (char_length(overall_impression) <= 1000),
  check (source_transcript_sha256 ~ '^[0-9a-f]{64}$'),
  check (jsonb_typeof(questions) = 'array' and octet_length(questions::text) <= 65536),
  check (jsonb_typeof(insights) = 'array' and octet_length(insights::text) <= 16384)
);

create index if not exists interview_experience_reports_company_idx
on public.interview_experience_reports(jobtrack_catalog_ref, selection_stage, interview_month)
where jobtrack_catalog_ref is not null and research_consent = true and review_status = 'reviewed';

create index if not exists interview_experience_reports_user_idx
on public.interview_experience_reports(user_id, updated_at desc);

drop trigger if exists interview_experience_reports_set_updated_at
on public.interview_experience_reports;
create trigger interview_experience_reports_set_updated_at
before update on public.interview_experience_reports
for each row execute function public.set_updated_at();

alter table public.interview_experience_reports enable row level security;

create policy "interview experience own rows"
on public.interview_experience_reports
for all
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

-- ブラウザからは直接操作させず、機能フラグを確認するサーバーAPIだけが扱う。
revoke all on table public.interview_experience_reports from anon, authenticated;
grant select, insert, update, delete on table public.interview_experience_reports
to service_role;
