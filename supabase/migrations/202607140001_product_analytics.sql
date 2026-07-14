create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_hash text not null,
  event_name text not null check (
    event_name in (
      'page_view',
      'feature_open',
      'feature_complete',
      'feature_error',
      'checkout_started',
      'checkout_completed'
    )
  ),
  feature text not null default '',
  path_group text not null default '',
  outcome text check (outcome is null or outcome in ('success', 'failed', 'cancelled')),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 86400000),
  value_numeric numeric(18, 6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (char_length(feature) <= 64),
  check (char_length(path_group) <= 160),
  check (octet_length(metadata::text) <= 4096)
);

create index if not exists analytics_events_user_created_idx
on public.analytics_events(user_id, created_at desc);

create index if not exists analytics_events_name_created_idx
on public.analytics_events(event_name, created_at desc);

create index if not exists analytics_events_feature_created_idx
on public.analytics_events(feature, created_at desc);

alter table public.analytics_events enable row level security;

-- Product analytics is written through the validated server route only.
-- It is intentionally not readable or writable directly by browser roles.
revoke all on table public.analytics_events from anon, authenticated;
grant select, insert, delete on table public.analytics_events to service_role;
