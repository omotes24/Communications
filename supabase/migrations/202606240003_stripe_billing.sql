create table if not exists public.stripe_checkout_grants (
  stripe_checkout_session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  amount_jpy integer not null check (amount_jpy > 0),
  token_amount bigint not null check (token_amount > 0),
  currency text not null default 'jpy',
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_event_id text,
  livemode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists stripe_checkout_grants_user_created_idx
on public.stripe_checkout_grants(user_id, created_at desc);

alter table public.stripe_checkout_grants enable row level security;

create policy "stripe checkout grants read own rows"
on public.stripe_checkout_grants
for select
using (auth.uid() is not null and auth.uid() = user_id);

create or replace function public.grant_purchased_tokens(
  p_user_id uuid,
  p_amount bigint,
  p_request_id text,
  p_plan_id text,
  p_amount_jpy integer,
  p_currency text,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text default null,
  p_stripe_customer_id text default null,
  p_livemode boolean default false,
  p_event_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.token_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_session_id text;
  wallet public.token_wallets;
begin
  if p_amount <= 0 then
    raise exception 'purchase token amount must be positive';
  end if;

  if p_amount_jpy <= 0 then
    raise exception 'purchase amount must be positive';
  end if;

  insert into public.stripe_checkout_grants(
    stripe_checkout_session_id,
    user_id,
    plan_id,
    amount_jpy,
    token_amount,
    currency,
    stripe_payment_intent_id,
    stripe_customer_id,
    stripe_event_id,
    livemode,
    metadata
  )
  values (
    p_stripe_checkout_session_id,
    p_user_id,
    p_plan_id,
    p_amount_jpy,
    p_amount,
    lower(coalesce(p_currency, 'jpy')),
    p_stripe_payment_intent_id,
    p_stripe_customer_id,
    p_event_id,
    coalesce(p_livemode, false),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (stripe_checkout_session_id) do nothing
  returning stripe_checkout_session_id into inserted_session_id;

  if inserted_session_id is null then
    return public.ensure_token_wallet(p_user_id);
  end if;

  wallet := public.grant_tokens(
    p_user_id,
    p_amount,
    p_request_id,
    'stripe-purchase',
    jsonb_build_object(
      'planId', p_plan_id,
      'amountJpy', p_amount_jpy,
      'currency', lower(coalesce(p_currency, 'jpy')),
      'stripeCheckoutSessionId', p_stripe_checkout_session_id,
      'stripePaymentIntentId', p_stripe_payment_intent_id,
      'stripeCustomerId', p_stripe_customer_id,
      'stripeEventId', p_event_id,
      'livemode', coalesce(p_livemode, false)
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  return wallet;
end;
$$;

revoke execute on function public.grant_purchased_tokens(
  uuid,
  bigint,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  boolean,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.grant_purchased_tokens(
  uuid,
  bigint,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  boolean,
  text,
  jsonb
) to service_role;
