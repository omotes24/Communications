-- 将来の JobTrack Pro 面接アーカイブ用メタデータ契約。
-- この migration は音声/文字起こし保存を開始しない。private Storage の
-- object path と同意・保持期限だけを管理し、アップロードAPIは別途実装する。
create table if not exists public.interview_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interview_session_id uuid not null references public.interview_sessions(id) on delete cascade,
  company_slot_id uuid references public.company_slots(id) on delete set null,
  jobtrack_catalog_ref text,
  host_system text not null default 'yell' check (host_system in ('yell', 'jobtrack')),
  access_tier text not null default 'owner' check (access_tier in ('owner', 'jobtrack_pro')),
  audio_storage_path text,
  transcript_storage_path text,
  audio_mime_type text,
  audio_duration_seconds numeric(12, 3),
  transcript_language text,
  consent_version text not null,
  storage_consented_at timestamptz not null,
  retention_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, interview_session_id),
  check (jobtrack_catalog_ref is null or jobtrack_catalog_ref ~ '^JT[0-9]{6}$'),
  check (audio_storage_path is null or audio_storage_path like user_id::text || '/%'),
  check (transcript_storage_path is null or transcript_storage_path like user_id::text || '/%'),
  check (audio_duration_seconds is null or audio_duration_seconds >= 0)
);

create index if not exists interview_archives_user_idx
on public.interview_archives(user_id, created_at desc)
where deleted_at is null;

create index if not exists interview_archives_company_idx
on public.interview_archives(jobtrack_catalog_ref, created_at desc)
where jobtrack_catalog_ref is not null and deleted_at is null;

drop trigger if exists interview_archives_set_updated_at on public.interview_archives;
create trigger interview_archives_set_updated_at
before update on public.interview_archives
for each row execute function public.set_updated_at();

alter table public.interview_archives enable row level security;

create policy "interview archives own rows"
on public.interview_archives
for select
using (auth.uid() is not null and auth.uid() = user_id);

revoke all on table public.interview_archives from anon, authenticated;
grant select, insert, update, delete on table public.interview_archives to service_role;
