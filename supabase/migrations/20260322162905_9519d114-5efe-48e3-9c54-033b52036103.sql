
-- ============================================================
-- ENTERPRISE V2 - FASE 4: LOGS DE IMPRESSÃO E RELATÓRIOS
-- ============================================================

-- 1. IMPRESSION_LOGS (Log completo de cada exibição)
CREATE TABLE public.impression_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  state_id uuid REFERENCES public.states(id) ON DELETE SET NULL,
  region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,
  content_id uuid REFERENCES public.media_items(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  advertiser_id uuid REFERENCES public.advertisers(id) ON DELETE SET NULL,
  device_type_id uuid REFERENCES public.device_types(id) ON DELETE SET NULL,
  played_at timestamptz NOT NULL DEFAULT now(),
  duration integer,
  status text DEFAULT 'completed',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. Índices otimizados para relatórios em escala
CREATE INDEX IF NOT EXISTS idx_impressions_tenant ON public.impression_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_impressions_device ON public.impression_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_impressions_campaign ON public.impression_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_impressions_advertiser ON public.impression_logs(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_impressions_store ON public.impression_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_impressions_played_at ON public.impression_logs(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_impressions_content ON public.impression_logs(content_id);
CREATE INDEX IF NOT EXISTS idx_impressions_state ON public.impression_logs(state_id);
CREATE INDEX IF NOT EXISTS idx_impressions_city ON public.impression_logs(city_id);

-- Índice composto para relatórios por campanha + data
CREATE INDEX IF NOT EXISTS idx_impressions_campaign_date ON public.impression_logs(campaign_id, played_at DESC);
-- Índice composto para relatórios por anunciante + data
CREATE INDEX IF NOT EXISTS idx_impressions_advertiser_date ON public.impression_logs(advertiser_id, played_at DESC);

-- 3. RLS
ALTER TABLE public.impression_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read impressions" ON public.impression_logs
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins read impressions" ON public.impression_logs
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()));

-- Insert via edge function (service role) ou device API
CREATE POLICY "Devices can insert impressions" ON public.impression_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 4. Função para registrar impressão com contexto completo
CREATE OR REPLACE FUNCTION public.register_impression(
  p_device_token text,
  p_content_id uuid,
  p_campaign_id uuid DEFAULT NULL,
  p_duration integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_device RECORD;
  v_store RECORD;
  v_sector RECORD;
  v_advertiser_id uuid;
BEGIN
  -- Buscar device com contexto
  SELECT d.id, d.store_id, d.sector_id, d.zone_id, d.device_type_id,
         d.company_id, s.city_id, c.state_id, st.region_id
  INTO v_device
  FROM devices d
  LEFT JOIN stores s ON s.id = d.store_id
  LEFT JOIN cities c ON c.id = s.city_id
  LEFT JOIN states st ON st.id = c.state_id
  WHERE d.device_token = p_device_token;

  IF v_device.id IS NULL THEN
    RAISE EXCEPTION 'Invalid device token';
  END IF;

  -- Buscar advertiser da campanha
  IF p_campaign_id IS NOT NULL THEN
    SELECT advertiser_id INTO v_advertiser_id
    FROM campaigns WHERE id = p_campaign_id;
  END IF;

  -- Registrar impressão
  INSERT INTO impression_logs (
    tenant_id, device_id, store_id, sector_id, zone_id,
    city_id, state_id, region_id, content_id, campaign_id,
    advertiser_id, device_type_id, duration, played_at
  )
  SELECT
    COALESCE(
      (SELECT tenant_id FROM stores WHERE id = v_device.store_id),
      (SELECT tenant_id FROM companies WHERE id = v_device.company_id)
    ),
    v_device.id, v_device.store_id, v_device.sector_id, v_device.zone_id,
    v_device.city_id, v_device.state_id, v_device.region_id,
    p_content_id, p_campaign_id, v_advertiser_id, v_device.device_type_id,
    p_duration, now();

  -- Incrementar contador de impressões da campanha
  IF p_campaign_id IS NOT NULL THEN
    UPDATE campaigns
    SET current_impressions = COALESCE(current_impressions, 0) + 1
    WHERE id = p_campaign_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
