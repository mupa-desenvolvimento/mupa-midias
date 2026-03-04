
-- Create price_check_integrations table
CREATE TABLE IF NOT EXISTS public.price_check_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('none', 'api_key', 'bearer_token', 'basic_auth', 'oauth2')),
  auth_config JSONB DEFAULT '{}'::jsonb, -- Stores specific auth details like client_id, secret, token_url
  endpoint_url TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST')),
  barcode_param_type TEXT NOT NULL CHECK (barcode_param_type IN ('query_param', 'path_param', 'body_json', 'form_data')),
  barcode_param_name TEXT, -- e.g., 'barcode' for ?barcode=123
  headers JSONB DEFAULT '{}'::jsonb,
  mapping_config JSONB DEFAULT '{}'::jsonb, -- Stores the response mapping rules
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging')),
  token_cache JSONB, -- Stores current valid token and expiration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create price_check_logs table
CREATE TABLE IF NOT EXISTS public.price_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.price_check_integrations(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  barcode TEXT,
  request_payload JSONB,
  response_payload JSONB,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add price_integration_id to devices if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'price_integration_id') THEN
        ALTER TABLE public.devices ADD COLUMN price_integration_id UUID REFERENCES public.price_check_integrations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_price_check_integrations_company_id ON public.price_check_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_integration_id ON public.price_check_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_device_id ON public.price_check_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_created_at ON public.price_check_logs(created_at);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_price_check_integrations_updated_at ON public.price_check_integrations;
CREATE TRIGGER update_price_check_integrations_updated_at
  BEFORE UPDATE ON public.price_check_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.price_check_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_check_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.price_check_integrations;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.price_check_integrations;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.price_check_integrations;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.price_check_integrations;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.price_check_logs;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.price_check_logs;

CREATE POLICY "Enable read access for authenticated users" ON public.price_check_integrations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.price_check_integrations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.price_check_integrations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.price_check_integrations
  FOR DELETE USING (auth.role() = 'authenticated');

-- Logs policies
CREATE POLICY "Enable read access for authenticated users" ON public.price_check_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.price_check_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
