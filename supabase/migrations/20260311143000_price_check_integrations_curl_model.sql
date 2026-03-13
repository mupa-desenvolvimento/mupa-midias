ALTER TABLE public.price_check_integrations
ADD COLUMN IF NOT EXISTS token_cache jsonb,
ADD COLUMN IF NOT EXISTS auth_curl text,
ADD COLUMN IF NOT EXISTS request_curl text,
ADD COLUMN IF NOT EXISTS auth_url text,
ADD COLUMN IF NOT EXISTS auth_method text,
ADD COLUMN IF NOT EXISTS auth_headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS auth_query_params_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS auth_body_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS auth_body_text text,
ADD COLUMN IF NOT EXISTS auth_token_path text,
ADD COLUMN IF NOT EXISTS token_expiration_seconds integer,
ADD COLUMN IF NOT EXISTS request_url text,
ADD COLUMN IF NOT EXISTS request_method text,
ADD COLUMN IF NOT EXISTS request_headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS request_query_params_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS request_body_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS request_body_text text,
ADD COLUMN IF NOT EXISTS request_variables_json jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.price_check_logs
ADD COLUMN IF NOT EXISTS request_payload jsonb,
ADD COLUMN IF NOT EXISTS response_payload jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'price_check_integrations'
      AND constraint_name = 'price_check_integrations_request_method_chk'
  ) THEN
    ALTER TABLE public.price_check_integrations DROP CONSTRAINT price_check_integrations_request_method_chk;
  END IF;

  ALTER TABLE public.price_check_integrations
  ADD CONSTRAINT price_check_integrations_request_method_chk
  CHECK (request_method IS NULL OR upper(request_method) IN ('GET','POST','PUT','PATCH','DELETE'));
END $$;

DROP TRIGGER IF EXISTS update_price_check_integrations_updated_at ON public.price_check_integrations;
CREATE TRIGGER update_price_check_integrations_updated_at
BEFORE UPDATE ON public.price_check_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
