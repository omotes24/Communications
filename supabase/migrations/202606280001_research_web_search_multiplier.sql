update public.token_rate_cards
set
  web_search_multiplier = 550
where
  active = true
  and feature = 'research-company'
  and model = '*'
  and web_search_multiplier = 500;
