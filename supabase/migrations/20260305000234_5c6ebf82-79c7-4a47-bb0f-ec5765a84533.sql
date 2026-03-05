ALTER TABLE public.weather_locations 
  ADD COLUMN IF NOT EXISTS layout_type text DEFAULT 'apple',
  ADD COLUMN IF NOT EXISTS type_view text DEFAULT 'widget',
  ADD COLUMN IF NOT EXISTS display_time integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT 'blue';