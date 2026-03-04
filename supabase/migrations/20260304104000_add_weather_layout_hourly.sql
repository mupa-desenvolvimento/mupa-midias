-- Adicionar colunas para layout e previsão por hora
ALTER TABLE public.weather_locations 
ADD COLUMN IF NOT EXISTS hourly_forecast jsonb,
ADD COLUMN IF NOT EXISTS layout_type text DEFAULT 'apple';

-- Comentários
COMMENT ON COLUMN public.weather_locations.hourly_forecast IS 'Previsão por hora (JSON array)';
COMMENT ON COLUMN public.weather_locations.layout_type IS 'Tipo de layout: apple, minimal, card, grid';
