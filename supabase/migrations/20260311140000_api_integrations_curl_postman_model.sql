ALTER TABLE public.api_integrations
ADD COLUMN IF NOT EXISTS auth_curl text,
ADD COLUMN IF NOT EXISTS request_curl text,
ADD COLUMN IF NOT EXISTS auth_headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS auth_query_params_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS auth_body_text text,
ADD COLUMN IF NOT EXISTS request_query_params_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS request_body_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS request_body_text text,
ADD COLUMN IF NOT EXISTS request_variables_json jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'api_integrations'
      AND constraint_name = 'api_integrations_auth_method_chk'
  ) THEN
    ALTER TABLE public.api_integrations DROP CONSTRAINT api_integrations_auth_method_chk;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'api_integrations'
      AND constraint_name = 'api_integrations_request_method_chk'
  ) THEN
    ALTER TABLE public.api_integrations DROP CONSTRAINT api_integrations_request_method_chk;
  END IF;

  ALTER TABLE public.api_integrations
  ADD CONSTRAINT api_integrations_auth_method_chk
  CHECK (auth_method IS NULL OR upper(auth_method) IN ('GET','POST','PUT','PATCH','DELETE'));

  ALTER TABLE public.api_integrations
  ADD CONSTRAINT api_integrations_request_method_chk
  CHECK (request_method IS NULL OR upper(request_method) IN ('GET','POST','PUT','PATCH','DELETE'));
END $$;

DROP TRIGGER IF EXISTS update_api_integrations_updated_at ON public.api_integrations;
CREATE TRIGGER update_api_integrations_updated_at
BEFORE UPDATE ON public.api_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
