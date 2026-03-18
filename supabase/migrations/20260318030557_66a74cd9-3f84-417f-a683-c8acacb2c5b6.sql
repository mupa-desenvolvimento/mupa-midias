
CREATE OR REPLACE FUNCTION public.seed_tenant_defaults(p_tenant_id uuid, p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_media_ids uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_playlist_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_default_city_id uuid;
  v_device_codes text[] := ARRAY[
    'POLVO-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    'POLVO-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    'POLVO-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  ];
  v_image_urls text[] := ARRAY[
    '/default-media/paisagem-1.jpg',
    '/default-media/paisagem-2.jpg',
    '/default-media/paisagem-3.jpg'
  ];
  v_image_names text[] := ARRAY['Paisagem Praia', 'Paisagem Montanha', 'Paisagem Cachoeira'];
  i integer;
  v_device_id uuid;
BEGIN
  -- Get a default city (first available)
  SELECT id INTO v_default_city_id FROM public.cities LIMIT 1;

  -- 1. Create 3 default media items using landscape images
  FOR i IN 1..3 LOOP
    INSERT INTO public.media_items (id, name, type, file_url, status, tenant_id, duration)
    VALUES (
      v_media_ids[i],
      v_image_names[i],
      'image',
      v_image_urls[i],
      'active',
      p_tenant_id,
      10
    );
  END LOOP;

  -- 2. Create 1 default playlist
  INSERT INTO public.playlists (id, name, description, is_active, tenant_id, priority)
  VALUES (
    v_playlist_id,
    'Playlist Padrão',
    'Playlist criada automaticamente',
    true,
    p_tenant_id,
    1
  );

  -- Add all 3 media items to the playlist
  FOR i IN 1..3 LOOP
    INSERT INTO public.playlist_items (playlist_id, media_id, position)
    VALUES (v_playlist_id, v_media_ids[i], i - 1);
  END LOOP;

  -- 3. Create 1 default device group
  INSERT INTO public.device_groups (id, name, description, tenant_id)
  VALUES (
    v_group_id,
    'Grupo Padrão',
    'Grupo criado automaticamente',
    p_tenant_id
  );

  -- 4. Create 3 default devices linked to group and playlist
  FOR i IN 1..3 LOOP
    v_device_id := gen_random_uuid();
    INSERT INTO public.devices (id, device_code, name, status, is_active, company_id, current_playlist_id, group_id)
    VALUES (
      v_device_id,
      v_device_codes[i],
      'Polvo ' || i,
      'pending',
      true,
      p_company_id,
      v_playlist_id,
      v_group_id
    );
    -- Add to group members
    INSERT INTO public.device_group_members (device_id, group_id)
    VALUES (v_device_id, v_group_id);
  END LOOP;

  -- 5. Create 3 default stores
  IF v_default_city_id IS NOT NULL THEN
    FOR i IN 1..3 LOOP
      INSERT INTO public.stores (name, code, city_id, tenant_id, is_active)
      VALUES (
        'Loja ' || i,
        'LOJA-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
        v_default_city_id,
        p_tenant_id,
        true
      );
    END LOOP;
  END IF;
END;
$$;
