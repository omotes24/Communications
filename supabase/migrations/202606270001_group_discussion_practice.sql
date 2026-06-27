create table if not exists public.group_discussion_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('solo', 'ai-participants')),
  status text not null check (status in ('setup', 'active', 'completed')),
  topic text not null,
  topic_category text not null default '',
  duration_minutes integer not null check (duration_minutes between 5 and 90),
  user_role text not null default '',
  participants jsonb not null default '[]'::jsonb,
  discussion_map jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  metrics jsonb,
  final_evaluation jsonb,
  save_transcript boolean not null default true,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_discussion_utterances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.group_discussion_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  speaker_id text not null,
  speaker_name text not null,
  speaker_type text not null check (speaker_type in ('user', 'ai', 'observer')),
  source text not null check (source in ('text', 'microphone', 'tab-audio', 'ai')),
  content text not null,
  duration_seconds integer not null default 1,
  analysis jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists group_discussion_sessions_user_created_idx
  on public.group_discussion_sessions(user_id, created_at desc);

create index if not exists group_discussion_utterances_session_created_idx
  on public.group_discussion_utterances(session_id, created_at asc);

alter table public.group_discussion_sessions enable row level security;
alter table public.group_discussion_utterances enable row level security;

drop policy if exists "group_discussion_sessions_select_own" on public.group_discussion_sessions;
create policy "group_discussion_sessions_select_own"
  on public.group_discussion_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "group_discussion_sessions_insert_own" on public.group_discussion_sessions;
create policy "group_discussion_sessions_insert_own"
  on public.group_discussion_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "group_discussion_sessions_update_own" on public.group_discussion_sessions;
create policy "group_discussion_sessions_update_own"
  on public.group_discussion_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "group_discussion_sessions_delete_own" on public.group_discussion_sessions;
create policy "group_discussion_sessions_delete_own"
  on public.group_discussion_sessions
  for delete
  using (auth.uid() = user_id);

drop policy if exists "group_discussion_utterances_select_own" on public.group_discussion_utterances;
create policy "group_discussion_utterances_select_own"
  on public.group_discussion_utterances
  for select
  using (auth.uid() = user_id);

drop policy if exists "group_discussion_utterances_insert_own" on public.group_discussion_utterances;
create policy "group_discussion_utterances_insert_own"
  on public.group_discussion_utterances
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "group_discussion_utterances_update_own" on public.group_discussion_utterances;
create policy "group_discussion_utterances_update_own"
  on public.group_discussion_utterances
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "group_discussion_utterances_delete_own" on public.group_discussion_utterances;
create policy "group_discussion_utterances_delete_own"
  on public.group_discussion_utterances
  for delete
  using (auth.uid() = user_id);
