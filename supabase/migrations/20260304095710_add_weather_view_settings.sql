-- Adicionar colunas type_view e display_time na tabela weather_locations
ALTER TABLE public.weather_locations 
ADD COLUMN IF NOT EXISTS type_view text DEFAULT 'widget' CHECK (type_view IN ('widget', 'slide')),
ADD COLUMN IF NOT EXISTS display_time integer DEFAULT 10;

-- Comentários nas colunas
COMMENT ON COLUMN public.weather_locations.type_view IS 'Define como o clima será exibido: widget (fixo) ou slide (conteúdo)';
COMMENT ON COLUMN public.weather_locations.display_time IS 'Tempo de exibição em segundos quando type_view for slide';
