create table if not exists public.external_account_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('jobtrack')),
  external_account_ref text not null,
  link_status text not null default 'pending' check (
    link_status in ('pending', 'verified', 'revoked')
  ),
  verification_method text not null default 'host_assertion' check (
    verification_method in ('host_assertion', 'shared_auth', 'manual_admin')
  ),
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_account_ref),
  unique (user_id, provider),
  check (char_length(external_account_ref) between 8 and 160)
);

create index if not exists external_account_links_user_idx
on public.external_account_links(user_id, link_status);

drop trigger if exists external_account_links_set_updated_at
on public.external_account_links;
create trigger external_account_links_set_updated_at
before update on public.external_account_links
for each row execute function public.set_updated_at();

alter table public.external_account_links enable row level security;

create policy "external account links own read"
on public.external_account_links
for select
using (auth.uid() is not null and auth.uid() = user_id);

-- Link creation and verification must pass through a future server-side
-- JobTrack assertion flow. Browser roles cannot forge account links.
revoke insert, update, delete on table public.external_account_links
from anon, authenticated;
grant select, insert, update, delete on table public.external_account_links
to service_role;
