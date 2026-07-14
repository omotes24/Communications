update public.token_rate_cards
set active = false
where active = true
  and (model, feature) in (
    ('gpt-5.6-luna', 'generate-answer'),
    ('gpt-5.6-terra', 'generate-answer'),
    ('gpt-5.6-sol', 'research-company'),
    ('gpt-5.6-sol', 'learn-interview-context'),
    ('gpt-5.4-nano', 'import-profile-file'),
    ('gpt-5.6-terra', 'group-discussion'),
    ('gpt-5.6-terra', 'solve-question'),
    ('gpt-5.6-terra', 'summarize-interview-experience')
  );

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
  ('margin-v3', 'gpt-5.6-luna', 'generate-answer', 0.12, 0.012, 0.72, 0.72, 0, 0, true),
  ('margin-v3', 'gpt-5.6-terra', 'generate-answer', 0.3, 0.03, 1.8, 1.8, 0, 0, true),
  ('margin-v3', 'gpt-5.6-sol', 'research-company', 0.6, 0.06, 3.6, 3.6, 0, 1200, true),
  ('margin-v3', 'gpt-5.6-sol', 'learn-interview-context', 0.6, 0.06, 3.6, 3.6, 0, 0, true),
  ('margin-v3', 'gpt-5.4-nano', 'import-profile-file', 0.024, 0.0024, 0.15, 0.15, 0, 0, true),
  ('margin-v3', 'gpt-5.6-terra', 'group-discussion', 0.3, 0.03, 1.8, 1.8, 0, 0, true),
  ('margin-v3', 'gpt-5.6-terra', 'solve-question', 0.3, 0.03, 1.8, 1.8, 0, 0, true),
  ('margin-v3', 'gpt-5.6-terra', 'summarize-interview-experience', 0.3, 0.03, 1.8, 1.8, 0, 0, true)
on conflict (version, model, feature) do update
set
  input_token_multiplier = excluded.input_token_multiplier,
  cached_input_token_multiplier = excluded.cached_input_token_multiplier,
  output_token_multiplier = excluded.output_token_multiplier,
  reasoning_token_multiplier = excluded.reasoning_token_multiplier,
  audio_second_multiplier = excluded.audio_second_multiplier,
  web_search_multiplier = excluded.web_search_multiplier,
  active_from = now(),
  active = excluded.active;
