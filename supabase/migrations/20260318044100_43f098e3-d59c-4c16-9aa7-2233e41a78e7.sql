
CREATE TABLE public.tts_audio_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash text NOT NULL,
  text_content text NOT NULL,
  voice_id text NOT NULL DEFAULT 'lrhwWp6pK3DjVVsi4Pkv',
  audio_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  use_count integer DEFAULT 1,
  UNIQUE(text_hash, voice_id)
);

ALTER TABLE public.tts_audio_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for tts cache"
  ON public.tts_audio_cache FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role full access for tts cache"
  ON public.tts_audio_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
