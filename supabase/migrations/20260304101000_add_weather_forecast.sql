-- Adicionar coluna daily_forecast na tabela weather_locations
ALTER TABLE public.weather_locations 
ADD COLUMN IF NOT EXISTS daily_forecast jsonb;

-- Comentários nas colunas
COMMENT ON COLUMN public.weather_locations.daily_forecast IS 'Previsão diária (JSON array)';
