-- Adicionar coluna hourly_forecast na tabela weather_locations
ALTER TABLE public.weather_locations 
ADD COLUMN IF NOT EXISTS hourly_forecast jsonb;

-- Comentários nas colunas
COMMENT ON COLUMN public.weather_locations.hourly_forecast IS 'Previsão por hora (JSON array)';
