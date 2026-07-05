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
  (
    'default-v2',
    'gpt-5.4-mini',
    'generate-answer',
    0.3333,
    0.0833,
    1.3333,
    1.3333,
    0,
    0,
    true
  )
on conflict (version, model, feature) do update
set
  input_token_multiplier = excluded.input_token_multiplier,
  cached_input_token_multiplier = excluded.cached_input_token_multiplier,
  output_token_multiplier = excluded.output_token_multiplier,
  reasoning_token_multiplier = excluded.reasoning_token_multiplier,
  audio_second_multiplier = excluded.audio_second_multiplier,
  web_search_multiplier = excluded.web_search_multiplier,
  active = excluded.active;
