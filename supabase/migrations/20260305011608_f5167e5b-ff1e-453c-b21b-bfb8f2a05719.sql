
ALTER TABLE public.news_articles 
ADD COLUMN IF NOT EXISTS image_cached boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS image_r2_key text DEFAULT null;
