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
  ('margin-v3', '*', 'classify-question', 0.6, 0.06, 3.6, 3.6, 0, 0, true),
  ('margin-v3', 'gpt-5.4-nano', 'classify-question', 0.024, 0.0024, 0.15, 0.15, 0, 0, true),
  ('margin-v3', '*', 'generate-answer', 0.6, 0.06, 3.6, 3.6, 0, 0, true),
  ('margin-v3', 'gpt-5.4-mini', 'generate-answer', 0.09, 0.009, 0.54, 0.54, 0, 0, true),
  ('margin-v3', '*', 'research-company', 0.6, 0.06, 3.6, 3.6, 0, 1200, true),
  ('margin-v3', '*', 'learn-interview-context', 0.6, 0.06, 3.6, 3.6, 0, 0, true),
  ('margin-v3', '*', 'transcribe-audio', 0, 0, 0, 0, 34, 0, true),
  ('margin-v3', '*', 'import-profile-file', 0.6, 0.06, 3.6, 3.6, 0, 0, true),
  ('margin-v3', '*', 'realtime-session', 0, 0, 0, 0, 34, 0, true),
  ('margin-v3', '*', 'group-discussion', 0.6, 0.06, 3.6, 3.6, 0, 0, true),
  ('margin-v3', '*', 'solve-question', 0.6, 0.06, 3.6, 3.6, 0, 0, true),
  ('margin-v3', '*', 'summarize-interview-experience', 0.6, 0.06, 3.6, 3.6, 0, 0, true),
  ('margin-v3', 'gpt-5.4-mini', 'summarize-interview-experience', 0.09, 0.009, 0.54, 0.54, 0, 0, true)
on conflict (version, model, feature) do update
set
  input_token_multiplier = excluded.input_token_multiplier,
  cached_input_token_multiplier = excluded.cached_input_token_multiplier,
  output_token_multiplier = excluded.output_token_multiplier,
  reasoning_token_multiplier = excluded.reasoning_token_multiplier,
  audio_second_multiplier = excluded.audio_second_multiplier,
  web_search_multiplier = excluded.web_search_multiplier,
  active = excluded.active;

