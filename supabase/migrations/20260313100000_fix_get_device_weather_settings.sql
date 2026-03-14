CREATE OR REPLACE FUNCTION public.get_device_weather_settings(p_device_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  SELECT COALESCE(s.tenant_id, c.tenant_id)
  INTO v_tenant_id
  FROM public.devices d
  LEFT JOIN public.stores s ON s.id = d.store_id
  LEFT JOIN public.companies c ON c.id = d.company_id
  WHERE d.device_code = p_device_code;

  IF v_tenant_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

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
