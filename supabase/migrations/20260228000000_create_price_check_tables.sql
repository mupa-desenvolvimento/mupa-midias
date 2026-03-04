
-- Create price_check_integrations table
CREATE TABLE IF NOT EXISTS public.price_check_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('none', 'api_key', 'bearer_token', 'basic_auth', 'oauth2')),
  auth_config JSONB DEFAULT '{}'::jsonb,
  endpoint_url TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST')),
  barcode_param_type TEXT NOT NULL CHECK (barcode_param_type IN ('query_param', 'path_param', 'body_json', 'form_data')),
  barcode_param_name TEXT,
  headers JSONB DEFAULT '{}'::jsonb,
  mapping_config JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create price_check_logs table
CREATE TABLE IF NOT EXISTS public.price_check_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES public.price_check_integrations(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  barcode TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_price_check_integrations_company_id ON public.price_check_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_integration_id ON public.price_check_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_device_id ON public.price_check_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_created_at ON public.price_check_logs(created_at);

-- Add RLS
ALTER TABLE public.price_check_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_check_logs ENABLE ROW LEVEL SECURITY;

-- Policies for price_check_integrations
DROP POLICY IF EXISTS "Admins can manage price check integrations" ON public.price_check_integrations;
CREATE POLICY "Admins can manage price check integrations"
ON public.price_check_integrations
FOR ALL
USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read price check integrations" ON public.price_check_integrations;
CREATE POLICY "Authenticated can read price check integrations"
ON public.price_check_integrations
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policies for price_check_logs
DROP POLICY IF EXISTS "Admins can view logs" ON public.price_check_logs;
CREATE POLICY "Admins can view logs"
ON public.price_check_logs
FOR SELECT
USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

DROP POLICY IF EXISTS "Devices can insert logs" ON public.price_check_logs;
CREATE POLICY "Devices can insert logs"
ON public.price_check_logs
FOR INSERT
WITH CHECK (true);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_price_check_integrations_updated_at ON public.price_check_integrations;
CREATE TRIGGER update_price_check_integrations_updated_at
BEFORE UPDATE ON public.price_check_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_check_integrations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_check_logs;
