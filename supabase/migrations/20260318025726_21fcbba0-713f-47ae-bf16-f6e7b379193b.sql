
CREATE OR REPLACE FUNCTION public.seed_tenant_defaults(p_tenant_id uuid, p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_media_ids uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_playlist_ids uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_device_codes text[] := ARRAY[
    'POLVO-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    'POLVO-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    'POLVO-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  ];
  i integer;
BEGIN
  -- Create 3 default media items (placeholder images)
  FOR i IN 1..3 LOOP
    INSERT INTO public.media_items (id, name, type, file_url, status, tenant_id, duration)
    VALUES (
      v_media_ids[i],
      'Imagem Padrão ' || i,
      'image',
      'https://placehold.co/1920x1080/1a1a2e/e94560?text=POLVO+' || i,
      'active',
      p_tenant_id,
      10
    );
  END LOOP;

  -- Create 3 default playlists
  FOR i IN 1..3 LOOP
    INSERT INTO public.playlists (id, name, description, is_active, tenant_id, priority)
    VALUES (
      v_playlist_ids[i],
      'Playlist Padrão ' || i,
      'Playlist criada automaticamente',
      true,
      p_tenant_id,
      i
    );

    -- Add corresponding media item to playlist
    INSERT INTO public.playlist_items (playlist_id, media_id, position)
    VALUES (v_playlist_ids[i], v_media_ids[i], 0);
  END LOOP;

  -- Create 3 default devices ("Polvo 1", "Polvo 2", "Polvo 3")
  FOR i IN 1..3 LOOP
    INSERT INTO public.devices (device_code, name, status, is_active, company_id, current_playlist_id)
    VALUES (
      v_device_codes[i],
      'Polvo ' || i,
      'pending',
      true,
      p_company_id,
      v_playlist_ids[i]
    );
  END LOOP;
END;
$$;
