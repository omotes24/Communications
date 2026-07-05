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
  ('default-v2', '*', 'solve-question', 1, 0.25, 6, 6, 0, 0, true)
on conflict (version, model, feature) do update
set
  input_token_multiplier = excluded.input_token_multiplier,
  cached_input_token_multiplier = excluded.cached_input_token_multiplier,
  output_token_multiplier = excluded.output_token_multiplier,
  reasoning_token_multiplier = excluded.reasoning_token_multiplier,
  audio_second_multiplier = excluded.audio_second_multiplier,
  web_search_multiplier = excluded.web_search_multiplier,
  active = excluded.active;
