
-- Create weather_locations table
CREATE TABLE IF NOT EXISTS public.weather_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  openweather_city_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  last_updated_at TIMESTAMPTZ,
  current_temp NUMERIC,
  weather_description TEXT,
  weather_icon TEXT,
  humidity NUMERIC,
  wind_speed NUMERIC,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_weather_locations_tenant_id ON public.weather_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_weather_locations_active ON public.weather_locations(is_active);

-- Enable RLS
ALTER TABLE public.weather_locations ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Tenant admins can manage weather locations" ON public.weather_locations;
CREATE POLICY "Tenant admins can manage weather locations"
ON public.weather_locations
FOR ALL
USING (is_super_admin(auth.uid()) OR (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id)))
WITH CHECK (is_super_admin(auth.uid()) OR (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id)));

DROP POLICY IF EXISTS "Authenticated users can read weather locations" ON public.weather_locations;
CREATE POLICY "Authenticated users can read weather locations"
ON public.weather_locations
FOR SELECT
USING (is_super_admin(auth.uid()) OR can_access_tenant_data(auth.uid(), tenant_id));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_weather_locations_updated_at ON public.weather_locations;
CREATE TRIGGER update_weather_locations_updated_at
BEFORE UPDATE ON public.weather_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.weather_locations;
