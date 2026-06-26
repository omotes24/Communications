grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.personal_slots,
  public.company_slots,
  public.interview_sessions,
  public.interview_messages,
  public.user_settings,
  public.local_storage_imports,
  public.token_wallets,
  public.token_ledger,
  public.token_reservations,
  public.ai_usage_events,
  public.token_rate_cards,
  public.stripe_checkout_grants
to service_role;

grant usage, select on all sequences in schema public to service_role;
