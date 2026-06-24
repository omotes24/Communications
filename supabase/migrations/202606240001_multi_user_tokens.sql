create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.personal_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  content jsonb not null default '{}'::jsonb,
  excluded_content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null default '',
  website_url text not null default '',
  recruitment_url text not null default '',
  course_name text not null default '',
  source_content text not null default '',
  research_summary text not null default '',
  detailed_notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_slot_id uuid references public.company_slots(id) on delete set null,
  title text not null default '',
  started_at timestamptz,
  ended_at timestamptz,
  explicitly_saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message_type text not null default 'answer' check (message_type in ('question', 'answer', 'note', 'transcript')),
  content text not null,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.local_storage_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_id text not null,
  migration_version text not null,
  created_at timestamptz not null default now(),
  unique (user_id, import_id),
  unique (user_id, migration_version)
);

create table if not exists public.token_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available_balance bigint not null default 0 check (available_balance >= 0),
  reserved_balance bigint not null default 0 check (reserved_balance >= 0),
  lifetime_granted bigint not null default 0 check (lifetime_granted >= 0),
  lifetime_consumed bigint not null default 0 check (lifetime_consumed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('reserve', 'settle', 'release', 'grant', 'admin_adjust')),
  amount bigint not null,
  available_balance_after bigint not null,
  reserved_balance_after bigint not null,
  request_id text,
  operation_id uuid,
  feature text,
  model text,
  rate_card_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.token_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  operation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reserved_amount bigint not null check (reserved_amount >= 0),
  actual_amount bigint check (actual_amount is null or actual_amount >= 0),
  status text not null check (status in ('reserved', 'settled', 'released', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  operation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  provider text not null,
  model text not null,
  input_tokens bigint not null default 0,
  cached_input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  reasoning_tokens bigint not null default 0,
  audio_seconds numeric(12, 3) not null default 0,
  web_search_calls integer not null default 0,
  calculated_app_tokens bigint not null default 0,
  status text not null check (status in ('reserved', 'success', 'failed', 'released')),
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.token_rate_cards (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  model text not null,
  feature text not null,
  input_token_multiplier numeric(12, 4) not null default 1,
  cached_input_token_multiplier numeric(12, 4) not null default 0.25,
  output_token_multiplier numeric(12, 4) not null default 4,
  reasoning_token_multiplier numeric(12, 4) not null default 4,
  audio_second_multiplier numeric(12, 4) not null default 20,
  web_search_multiplier numeric(12, 4) not null default 250,
  active_from timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (version, model, feature)
);

create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists personal_slots_user_id_idx on public.personal_slots(user_id);
create index if not exists company_slots_user_id_idx on public.company_slots(user_id);
create index if not exists interview_sessions_user_id_idx on public.interview_sessions(user_id);
create index if not exists interview_messages_user_id_idx on public.interview_messages(user_id);
create index if not exists token_ledger_user_created_idx on public.token_ledger(user_id, created_at desc);
create index if not exists token_reservations_user_status_idx on public.token_reservations(user_id, status);
create index if not exists ai_usage_events_user_created_idx on public.ai_usage_events(user_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists personal_slots_set_updated_at on public.personal_slots;
create trigger personal_slots_set_updated_at
before update on public.personal_slots
for each row execute function public.set_updated_at();

drop trigger if exists company_slots_set_updated_at on public.company_slots;
create trigger company_slots_set_updated_at
before update on public.company_slots
for each row execute function public.set_updated_at();

drop trigger if exists interview_sessions_set_updated_at on public.interview_sessions;
create trigger interview_sessions_set_updated_at
before update on public.interview_sessions
for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists token_wallets_set_updated_at on public.token_wallets;
create trigger token_wallets_set_updated_at
before update on public.token_wallets
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.personal_slots enable row level security;
alter table public.company_slots enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_messages enable row level security;
alter table public.user_settings enable row level security;
alter table public.local_storage_imports enable row level security;
alter table public.token_wallets enable row level security;
alter table public.token_ledger enable row level security;
alter table public.token_reservations enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.token_rate_cards enable row level security;

create policy "profiles own rows"
on public.profiles
for all
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "personal slots own rows"
on public.personal_slots
for all
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "company slots own rows"
on public.company_slots
for all
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "interview sessions own rows"
on public.interview_sessions
for all
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "interview messages own rows"
on public.interview_messages
for all
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "user settings own rows"
on public.user_settings
for all
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "local storage imports own rows"
on public.local_storage_imports
for all
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "token wallets read own rows"
on public.token_wallets
for select
using (auth.uid() is not null and auth.uid() = user_id);

create policy "token ledger read own rows"
on public.token_ledger
for select
using (auth.uid() is not null and auth.uid() = user_id);

create policy "token reservations read own rows"
on public.token_reservations
for select
using (auth.uid() is not null and auth.uid() = user_id);

create policy "ai usage read own rows"
on public.ai_usage_events
for select
using (auth.uid() is not null and auth.uid() = user_id);

create policy "rate cards are readable"
on public.token_rate_cards
for select
using (true);

create or replace function public.prevent_token_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'token_ledger is append-only';
end;
$$;

drop trigger if exists token_ledger_no_update on public.token_ledger;
create trigger token_ledger_no_update
before update or delete on public.token_ledger
for each row execute function public.prevent_token_ledger_mutation();

create or replace function public.ensure_token_wallet(p_user_id uuid)
returns public.token_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.token_wallets;
begin
  insert into public.token_wallets(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into wallet
  from public.token_wallets
  where user_id = p_user_id
  for update;

  return wallet;
end;
$$;

create or replace function public.reserve_tokens(
  p_user_id uuid,
  p_request_id text,
  p_operation_id uuid,
  p_feature text,
  p_model text,
  p_rate_card_version text,
  p_amount bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns public.token_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.token_wallets;
  reservation public.token_reservations;
begin
  if p_amount < 0 then
    raise exception 'reservation amount must be non-negative';
  end if;

  select * into reservation
  from public.token_reservations
  where request_id = p_request_id;

  if found then
    return reservation;
  end if;

  wallet := public.ensure_token_wallet(p_user_id);

  if wallet.available_balance < p_amount then
    raise exception 'insufficient_token_balance';
  end if;

  update public.token_wallets
  set
    available_balance = available_balance - p_amount,
    reserved_balance = reserved_balance + p_amount
  where user_id = p_user_id
  returning * into wallet;

  insert into public.token_reservations(
    request_id,
    operation_id,
    user_id,
    reserved_amount,
    status,
    expires_at
  )
  values (
    p_request_id,
    p_operation_id,
    p_user_id,
    p_amount,
    'reserved',
    now() + interval '15 minutes'
  )
  returning * into reservation;

  insert into public.token_ledger(
    user_id,
    event_type,
    amount,
    available_balance_after,
    reserved_balance_after,
    request_id,
    operation_id,
    feature,
    model,
    rate_card_version,
    metadata
  )
  values (
    p_user_id,
    'reserve',
    -p_amount,
    wallet.available_balance,
    wallet.reserved_balance,
    p_request_id,
    p_operation_id,
    p_feature,
    p_model,
    p_rate_card_version,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return reservation;
end;
$$;

create or replace function public.settle_tokens(
  p_request_id text,
  p_actual_amount bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns public.token_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation public.token_reservations;
  wallet public.token_wallets;
  refund bigint;
begin
  if p_actual_amount < 0 then
    raise exception 'actual amount must be non-negative';
  end if;

  select * into reservation
  from public.token_reservations
  where request_id = p_request_id
  for update;

  if not found then
    raise exception 'reservation not found';
  end if;

  if reservation.status <> 'reserved' then
    return reservation;
  end if;

  wallet := public.ensure_token_wallet(reservation.user_id);
  refund := greatest(reservation.reserved_amount - p_actual_amount, 0);

  update public.token_wallets
  set
    available_balance = available_balance + refund,
    reserved_balance = reserved_balance - reservation.reserved_amount,
    lifetime_consumed = lifetime_consumed + p_actual_amount
  where user_id = reservation.user_id
  returning * into wallet;

  update public.token_reservations
  set
    actual_amount = p_actual_amount,
    status = 'settled',
    settled_at = now()
  where id = reservation.id
  returning * into reservation;

  insert into public.token_ledger(
    user_id,
    event_type,
    amount,
    available_balance_after,
    reserved_balance_after,
    request_id,
    operation_id,
    metadata
  )
  values (
    reservation.user_id,
    'settle',
    -p_actual_amount,
    wallet.available_balance,
    wallet.reserved_balance,
    reservation.request_id,
    reservation.operation_id,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return reservation;
end;
$$;

create or replace function public.release_token_reservation(
  p_request_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.token_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation public.token_reservations;
  wallet public.token_wallets;
begin
  select * into reservation
  from public.token_reservations
  where request_id = p_request_id
  for update;

  if not found then
    raise exception 'reservation not found';
  end if;

  if reservation.status <> 'reserved' then
    return reservation;
  end if;

  wallet := public.ensure_token_wallet(reservation.user_id);

  update public.token_wallets
  set
    available_balance = available_balance + reservation.reserved_amount,
    reserved_balance = reserved_balance - reservation.reserved_amount
  where user_id = reservation.user_id
  returning * into wallet;

  update public.token_reservations
  set
    status = 'released',
    settled_at = now()
  where id = reservation.id
  returning * into reservation;

  insert into public.token_ledger(
    user_id,
    event_type,
    amount,
    available_balance_after,
    reserved_balance_after,
    request_id,
    operation_id,
    metadata
  )
  values (
    reservation.user_id,
    'release',
    reservation.reserved_amount,
    wallet.available_balance,
    wallet.reserved_balance,
    reservation.request_id,
    reservation.operation_id,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return reservation;
end;
$$;

create or replace function public.grant_tokens(
  p_user_id uuid,
  p_amount bigint,
  p_request_id text,
  p_feature text default 'grant',
  p_metadata jsonb default '{}'::jsonb
)
returns public.token_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.token_wallets;
begin
  if p_amount <= 0 then
    raise exception 'grant amount must be positive';
  end if;

  wallet := public.ensure_token_wallet(p_user_id);

  update public.token_wallets
  set
    available_balance = available_balance + p_amount,
    lifetime_granted = lifetime_granted + p_amount
  where user_id = p_user_id
  returning * into wallet;

  insert into public.token_ledger(
    user_id,
    event_type,
    amount,
    available_balance_after,
    reserved_balance_after,
    request_id,
    feature,
    metadata
  )
  values (
    p_user_id,
    'grant',
    p_amount,
    wallet.available_balance,
    wallet.reserved_balance,
    p_request_id,
    p_feature,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return wallet;
end;
$$;

create or replace function public.admin_adjust_tokens(
  p_user_id uuid,
  p_amount bigint,
  p_request_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.token_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.token_wallets;
begin
  wallet := public.ensure_token_wallet(p_user_id);

  if wallet.available_balance + p_amount < 0 then
    raise exception 'insufficient_token_balance';
  end if;

  update public.token_wallets
  set
    available_balance = available_balance + p_amount,
    lifetime_granted = lifetime_granted + greatest(p_amount, 0),
    lifetime_consumed = lifetime_consumed + greatest(-p_amount, 0)
  where user_id = p_user_id
  returning * into wallet;

  insert into public.token_ledger(
    user_id,
    event_type,
    amount,
    available_balance_after,
    reserved_balance_after,
    request_id,
    feature,
    metadata
  )
  values (
    p_user_id,
    'admin_adjust',
    p_amount,
    wallet.available_balance,
    wallet.reserved_balance,
    p_request_id,
    'admin',
    coalesce(p_metadata, '{}'::jsonb)
  );

  return wallet;
end;
$$;

insert into public.token_rate_cards (
  version,
  model,
  feature,
  input_token_multiplier,
  cached_input_token_multiplier,
  output_token_multiplier,
  reasoning_token_multiplier,
  audio_second_multiplier,
  web_search_multiplier,
  active
)
values
  ('default-v1', '*', 'classify-question', 1, 0.25, 3, 3, 0, 0, true),
  ('default-v1', '*', 'generate-answer', 1, 0.25, 4, 4, 0, 0, true),
  ('default-v1', '*', 'research-company', 1, 0.25, 4, 4, 0, 250, true),
  ('default-v1', '*', 'learn-interview-context', 1, 0.25, 4, 4, 0, 0, true),
  ('default-v1', '*', 'transcribe-audio', 0, 0, 0, 0, 20, 0, true),
  ('default-v1', '*', 'import-profile-file', 1, 0.25, 3, 3, 0, 0, true),
  ('default-v1', '*', 'realtime-session', 0, 0, 0, 0, 20, 0, true)
on conflict (version, model, feature) do nothing;
