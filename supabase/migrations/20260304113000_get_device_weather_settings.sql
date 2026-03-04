CREATE OR REPLACE FUNCTION public.get_device_weather_settings(p_device_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  -- Get tenant_id from device_code
  SELECT tenant_id INTO v_tenant_id
  FROM public.devices
  WHERE code = p_device_code;

  IF v_tenant_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Get active weather locations
  SELECT jsonb_agg(to_jsonb(w))
  INTO v_result
  FROM public.weather_locations w
  WHERE w.tenant_id = v_tenant_id
  AND w.is_active = true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_device_weather_settings(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_device_weather_settings(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_device_weather_settings(text) TO service_role;
