
-- Add is_default column to playlists
ALTER TABLE public.playlists ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Function to ensure only one default playlist per tenant
CREATE OR REPLACE FUNCTION public.ensure_single_default_playlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE playlists
    SET is_default = false
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_single_default_playlist
BEFORE INSERT OR UPDATE ON public.playlists
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_playlist();

-- Update register_device to fallback to tenant default playlist
CREATE OR REPLACE FUNCTION public.register_device(
  p_device_code text,
  p_name text,
  p_store_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_store_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_device_id UUID;
  v_device_token TEXT;
  v_existing_token TEXT;
  v_tenant_id UUID;
  v_resolved_group_id UUID;
  v_default_playlist_id UUID;
BEGIN
  -- Resolve tenant and company default playlist
  SELECT tenant_id, default_playlist_id
  INTO v_tenant_id, v_default_playlist_id
  FROM companies WHERE id = p_company_id;

  -- Fallback: if company has no default, check tenant default playlist
  IF v_default_playlist_id IS NULL AND v_tenant_id IS NOT NULL THEN
    SELECT id INTO v_default_playlist_id
    FROM playlists
    WHERE tenant_id = v_tenant_id AND is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  -- Resolve group
  v_resolved_group_id := p_group_id;
  IF v_resolved_group_id IS NULL AND v_tenant_id IS NOT NULL THEN
    SELECT id INTO v_resolved_group_id
    FROM device_groups
    WHERE tenant_id = v_tenant_id AND is_default = true
    LIMIT 1;
  END IF;

  SELECT id, device_token INTO v_device_id, v_existing_token
  FROM devices WHERE device_code = p_device_code;

  IF v_existing_token IS NOT NULL THEN
    v_device_token := v_existing_token;
  ELSE
    v_device_token := gen_random_uuid()::text;
  END IF;

  IF v_device_id IS NOT NULL THEN
    UPDATE devices
    SET name = p_name, store_id = p_store_id, company_id = p_company_id,
        group_id = v_resolved_group_id, status = 'online', is_active = true,
        store_code = COALESCE(p_store_code, store_code),
        device_token = v_device_token,
        current_playlist_id = COALESCE(current_playlist_id, v_default_playlist_id),
        updated_at = now()
    WHERE id = v_device_id;
  ELSE
    INSERT INTO devices (device_code, name, store_id, company_id, group_id, status, is_active, store_code, device_token, current_playlist_id)
    VALUES (p_device_code, p_name, p_store_id, p_company_id, v_resolved_group_id, 'online', true, p_store_code, v_device_token, v_default_playlist_id)
    RETURNING id INTO v_device_id;
  END IF;

  IF v_resolved_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_id, group_id)
    VALUES (v_device_id, v_resolved_group_id)
    ON CONFLICT (device_id, group_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'device_id', v_device_id, 'device_token', v_device_token,
    'group_id', v_resolved_group_id, 'playlist_id', v_default_playlist_id,
    'message', 'Device registered successfully'
  );
END;
$function$;
