update public.token_rate_cards
set active = false
where active = true;

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
  ('default-v2', '*', 'classify-question', 1, 0.25, 3, 3, 0, 0, true),
  ('default-v2', '*', 'generate-answer', 1, 0.25, 4, 4, 0, 0, true),
  ('default-v2', '*', 'research-company', 1, 0.25, 4, 4, 0, 500, true),
  ('default-v2', '*', 'learn-interview-context', 1, 0.25, 4, 4, 0, 0, true),
  ('default-v2', '*', 'transcribe-audio', 0, 0, 0, 0, 40, 0, true),
  ('default-v2', '*', 'import-profile-file', 1, 0.25, 3, 3, 0, 0, true),
  ('default-v2', '*', 'realtime-session', 0, 0, 0, 0, 40, 0, true)
on conflict (version, model, feature) do update
set
  input_token_multiplier = excluded.input_token_multiplier,
  cached_input_token_multiplier = excluded.cached_input_token_multiplier,
  output_token_multiplier = excluded.output_token_multiplier,
  reasoning_token_multiplier = excluded.reasoning_token_multiplier,
  audio_second_multiplier = excluded.audio_second_multiplier,
  web_search_multiplier = excluded.web_search_multiplier,
  active = excluded.active;
