ALTER TABLE public.weather_locations 
  ADD COLUMN IF NOT EXISTS daily_forecast JSONB,
  ADD COLUMN IF NOT EXISTS hourly_forecast JSONB;