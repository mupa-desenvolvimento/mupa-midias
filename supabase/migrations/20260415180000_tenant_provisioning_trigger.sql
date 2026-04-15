-- Function to provision default items for a new tenant
CREATE OR REPLACE FUNCTION public.provision_tenant_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_playlist_id UUID;
  v_media1_id UUID := gen_random_uuid();
  v_media2_id UUID := gen_random_uuid();
BEGIN
  -- 1. Create Default Playlist
  INSERT INTO public.playlists (name, description, is_active, tenant_id, priority)
  VALUES (
    'Playlist Padrão',
    'Playlist inicial criada automaticamente',
    true,
    NEW.id,
    1
  )
  RETURNING id INTO v_playlist_id;

  -- 2. Create Default Media Items (from attachment images)
  INSERT INTO public.media_items (id, name, type, file_url, status, tenant_id, duration)
  VALUES 
    (
      v_media1_id,
      'Mupa - Anuncie Aqui',
      'image',
      'https://pub-8963c775ad9a4e9a89db3ef860c4c123.r2.dev/mupa-intro-1.png',
      'active',
      NEW.id,
      10
    ),
    (
      v_media2_id,
      'Mupa - Boas-vindas',
      'image',
      'https://pub-8963c775ad9a4e9a89db3ef860c4c123.r2.dev/mupa-intro-2.png',
      'active',
      NEW.id,
      10
    );

  -- 3. Link Media Items to Playlist
  INSERT INTO public.playlist_items (playlist_id, media_id, position)
  VALUES 
    (v_playlist_id, v_media1_id, 0),
    (v_playlist_id, v_media2_id, 1);

  -- 4. Create Default Group (using the new groups table)
  INSERT INTO public.groups (name, playlist_id, tenant_id)
  VALUES (
    'Grupo Padrão',
    v_playlist_id,
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- Trigger to fire after a new tenant is created
CREATE TRIGGER after_tenant_insert
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.provision_tenant_defaults();
