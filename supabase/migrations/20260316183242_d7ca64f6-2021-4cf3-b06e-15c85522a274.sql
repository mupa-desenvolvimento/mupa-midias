
-- Create price_check_integrations table
CREATE TABLE public.price_check_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Original CURL texts for reference
  auth_curl text,
  request_curl text,
  
  -- Parsed auth config
  auth_type text NOT NULL DEFAULT 'none',
  auth_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_url text,
  auth_method text,
  auth_headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_query_params_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_body_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_body_text text,
  auth_token_path text,
  token_expiration_seconds integer DEFAULT 3600,
  token_cache jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Parsed request config
  request_url text,
  request_method text DEFAULT 'GET',
  request_headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_query_params_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_body_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_body_text text,
  request_variables_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Legacy fields (kept for backward compat)
  endpoint_url text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT 'GET',
  barcode_param_type text NOT NULL DEFAULT 'query_param',
  barcode_param_name text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Response mapping
  mapping_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Status
  status text NOT NULL DEFAULT 'active',
  environment text NOT NULL DEFAULT 'production',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_check_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage price check integrations"
  ON public.price_check_integrations
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

CREATE POLICY "Authenticated can read price check integrations"
  ON public.price_check_integrations
  FOR SELECT
  TO public
  USING (true);

-- Create price_check_logs table for execution history
CREATE TABLE public.price_check_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES public.price_check_integrations(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  barcode text NOT NULL,
  store_code text,
  status_code integer,
  response_time_ms integer,
  request_snapshot jsonb DEFAULT '{}'::jsonb,
  response_snapshot jsonb DEFAULT '{}'::jsonb,
  mapped_product jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read price check logs"
  ON public.price_check_logs
  FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

CREATE POLICY "Anyone can insert price check logs"
  ON public.price_check_logs
  FOR INSERT
  TO public
  WITH CHECK (true);
