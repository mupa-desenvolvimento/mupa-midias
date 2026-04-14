
ALTER TABLE public.api_integrations
  ADD COLUMN IF NOT EXISTS auth_curl text,
  ADD COLUMN IF NOT EXISTS auth_headers_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auth_query_params_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auth_body_text text,
  ADD COLUMN IF NOT EXISTS request_curl text,
  ADD COLUMN IF NOT EXISTS request_query_params_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS request_body_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS request_body_text text,
  ADD COLUMN IF NOT EXISTS request_variables_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS response_data_path text;
