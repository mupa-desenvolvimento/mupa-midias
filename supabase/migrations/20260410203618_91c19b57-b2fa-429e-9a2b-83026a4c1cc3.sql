
-- Add default_playlist_id to companies
ALTER TABLE public.companies
ADD COLUMN default_playlist_id uuid REFERENCES public.playlists(id) ON DELETE SET NULL;

-- Update register_device to set current_playlist_id from company default
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
  -- Resolve tenant from company
  SELECT tenant_id, default_playlist_id
  INTO v_tenant_id, v_default_playlist_id
  FROM companies WHERE id = p_company_id;

  -- Resolve group: use provided or fall back to default
  v_resolved_group_id := p_group_id;
  IF v_resolved_group_id IS NULL AND v_tenant_id IS NOT NULL THEN
    SELECT id INTO v_resolved_group_id
    FROM device_groups
    WHERE tenant_id = v_tenant_id AND is_default = true
    LIMIT 1;
  END IF;

  -- 1. Check if device exists
  SELECT id, device_token INTO v_device_id, v_existing_token
  FROM devices
  WHERE device_code = p_device_code;

  -- 2. Generate token if needed
  IF v_existing_token IS NOT NULL THEN
    v_device_token := v_existing_token;
  ELSE
    v_device_token := gen_random_uuid()::text;
  END IF;

  -- 3. Upsert Device
  IF v_device_id IS NOT NULL THEN
    UPDATE devices
    SET
      name = p_name,
      store_id = p_store_id,
      company_id = p_company_id,
      group_id = v_resolved_group_id,
      status = 'online',
      is_active = true,
      store_code = COALESCE(p_store_code, store_code),
      device_token = v_device_token,
      current_playlist_id = COALESCE(current_playlist_id, v_default_playlist_id),
      updated_at = now()
    WHERE id = v_device_id;
  ELSE
    INSERT INTO devices (
      device_code,
      name,
      store_id,
      company_id,
      group_id,
      status,
      is_active,
      store_code,
      device_token,
      current_playlist_id
    ) VALUES (
      p_device_code,
      p_name,
      p_store_id,
      p_company_id,
      v_resolved_group_id,
      'online',
      true,
      p_store_code,
      v_device_token,
      v_default_playlist_id
    )
    RETURNING id INTO v_device_id;
  END IF;

  -- 4. Link to Group (junction table)
  IF v_resolved_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_id, group_id)
    VALUES (v_device_id, v_resolved_group_id)
    ON CONFLICT (device_id, group_id) DO NOTHING;
  END IF;

  -- 5. Return Result
  RETURN jsonb_build_object(
    'device_id', v_device_id,
    'device_token', v_device_token,
    'group_id', v_resolved_group_id,
    'playlist_id', v_default_playlist_id,
    'message', 'Device registered successfully'
  );
END;
$function$;
