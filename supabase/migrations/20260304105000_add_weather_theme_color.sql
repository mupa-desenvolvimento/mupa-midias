-- Add theme_color column to weather_locations
ALTER TABLE weather_locations ADD COLUMN IF NOT EXISTS theme_color text;
