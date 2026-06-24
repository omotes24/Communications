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
    if reservation.user_id <> p_user_id then
      raise exception 'duplicate_request_id_for_different_user';
    end if;
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

create or replace function public.release_expired_token_reservations(
  p_limit integer default 100
)
returns table (
  request_id text,
  user_id uuid,
  released_amount bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation public.token_reservations;
  wallet public.token_wallets;
begin
  for reservation in
    select *
    from public.token_reservations
    where status = 'reserved'
      and expires_at < now()
    order by expires_at asc
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
    for update skip locked
  loop
    wallet := public.ensure_token_wallet(reservation.user_id);

    update public.token_wallets
    set
      available_balance = available_balance + reservation.reserved_amount,
      reserved_balance = reserved_balance - reservation.reserved_amount
    where token_wallets.user_id = reservation.user_id
    returning * into wallet;

    update public.token_reservations
    set
      status = 'expired',
      settled_at = now()
    where id = reservation.id
      and status = 'reserved';

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
      '{"reason":"expired_reservation_reconciliation"}'::jsonb
    );

    request_id := reservation.request_id;
    user_id := reservation.user_id;
    released_amount := reservation.reserved_amount;
    return next;
  end loop;
end;
$$;

revoke execute on function public.ensure_token_wallet(uuid) from public, anon, authenticated;
revoke execute on function public.reserve_tokens(uuid, text, uuid, text, text, text, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.settle_tokens(text, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.release_token_reservation(text, jsonb) from public, anon, authenticated;
revoke execute on function public.release_expired_token_reservations(integer) from public, anon, authenticated;
revoke execute on function public.grant_tokens(uuid, bigint, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_adjust_tokens(uuid, bigint, text, jsonb) from public, anon, authenticated;

grant execute on function public.ensure_token_wallet(uuid) to service_role;
grant execute on function public.reserve_tokens(uuid, text, uuid, text, text, text, bigint, jsonb) to service_role;
grant execute on function public.settle_tokens(text, bigint, jsonb) to service_role;
grant execute on function public.release_token_reservation(text, jsonb) to service_role;
grant execute on function public.release_expired_token_reservations(integer) to service_role;
grant execute on function public.grant_tokens(uuid, bigint, text, text, jsonb) to service_role;
grant execute on function public.admin_adjust_tokens(uuid, bigint, text, jsonb) to service_role;
