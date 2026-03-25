-- ============================================================
-- ENTERPRISE V2 - CAMPANHAS: SEGMENTOS (hierarquia + tags + AND/OR)
-- ============================================================
-- Objetivo:
-- - CRUD de segmentos (campaign_segments)
-- - Alvos normalizados por cláusula (campaign_segment_targets)
-- - Vinculação por cópia para campaign_targets via segment_id + clause_id
-- - RPC para pré-visualização: resolve_segment_device_ids / resolve_segment_device_stats
-- ============================================================
 
-- 1) Tabelas
CREATE TABLE IF NOT EXISTS public.campaign_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);
 
CREATE TABLE IF NOT EXISTS public.campaign_segment_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL REFERENCES public.campaign_segments(id) ON DELETE CASCADE,
  clause_id uuid NOT NULL DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  state_id uuid REFERENCES public.states(id) ON DELETE CASCADE,
  region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE,
  device_type_id uuid REFERENCES public.device_types(id) ON DELETE CASCADE,
  device_group_id uuid REFERENCES public.device_groups(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  include boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
 
-- 2) Extensões na campaign_targets (vinculação de campanhas a segmentos)
ALTER TABLE public.campaign_targets
  ADD COLUMN IF NOT EXISTS segment_id uuid REFERENCES public.campaign_segments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clause_id uuid,
  ADD COLUMN IF NOT EXISTS device_group_id uuid REFERENCES public.device_groups(id) ON DELETE CASCADE;
 
-- 3) Índices
CREATE INDEX IF NOT EXISTS idx_campaign_segments_tenant_id ON public.campaign_segments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_segment_targets_segment_id ON public.campaign_segment_targets(segment_id);
CREATE INDEX IF NOT EXISTS idx_campaign_segment_targets_clause_id ON public.campaign_segment_targets(clause_id);
CREATE INDEX IF NOT EXISTS idx_campaign_segment_targets_type ON public.campaign_segment_targets(target_type);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_segment_id ON public.campaign_targets(segment_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_clause_id ON public.campaign_targets(clause_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_device_group_id ON public.campaign_targets(device_group_id);
 
-- 4) RLS
ALTER TABLE public.campaign_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_segment_targets ENABLE ROW LEVEL SECURITY;
 
DROP POLICY IF EXISTS "Super admins manage campaign_segments" ON public.campaign_segments;
DROP POLICY IF EXISTS "Tenant admins manage campaign_segments" ON public.campaign_segments;
DROP POLICY IF EXISTS "Read campaign_segments" ON public.campaign_segments;
 
CREATE POLICY "Super admins manage campaign_segments"
ON public.campaign_segments
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
 
CREATE POLICY "Tenant admins manage campaign_segments"
ON public.campaign_segments
FOR ALL TO authenticated
USING (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()))
WITH CHECK (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()));
 
CREATE POLICY "Read campaign_segments"
ON public.campaign_segments
FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR tenant_id = public.get_user_tenant_id_strict(auth.uid()));
 
DROP POLICY IF EXISTS "Super admins manage campaign_segment_targets" ON public.campaign_segment_targets;
DROP POLICY IF EXISTS "Tenant admins manage campaign_segment_targets" ON public.campaign_segment_targets;
DROP POLICY IF EXISTS "Read campaign_segment_targets" ON public.campaign_segment_targets;
 
CREATE POLICY "Super admins manage campaign_segment_targets"
ON public.campaign_segment_targets
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
 
CREATE POLICY "Tenant admins manage campaign_segment_targets"
ON public.campaign_segment_targets
FOR ALL TO authenticated
USING (
  public.is_tenant_admin(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.campaign_segments s
    WHERE s.id = campaign_segment_targets.segment_id
      AND s.tenant_id = public.get_user_tenant_id_strict(auth.uid())
  )
)
WITH CHECK (
  public.is_tenant_admin(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.campaign_segments s
    WHERE s.id = campaign_segment_targets.segment_id
      AND s.tenant_id = public.get_user_tenant_id_strict(auth.uid())
  )
);
 
CREATE POLICY "Read campaign_segment_targets"
ON public.campaign_segment_targets
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.campaign_segments s
    WHERE s.id = campaign_segment_targets.segment_id
      AND s.tenant_id = public.get_user_tenant_id_strict(auth.uid())
  )
);
 
-- 5) Trigger updated_at
DROP TRIGGER IF EXISTS update_campaign_segments_updated_at ON public.campaign_segments;
CREATE TRIGGER update_campaign_segments_updated_at
BEFORE UPDATE ON public.campaign_segments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
 
-- 6) RPCs de resolução (pré-visualização / auditoria)
-- Semântica:
-- - OR dentro de uma cláusula (clause_id)
-- - AND entre cláusulas
-- - Excludes removem dispositivos (include=false)
 
CREATE OR REPLACE FUNCTION public.resolve_segment_device_ids(
  p_segment_id uuid,
  p_limit integer DEFAULT 1000,
  p_only_online boolean DEFAULT false
)
RETURNS TABLE(device_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH seg AS (
    SELECT s.id, s.tenant_id
    FROM public.campaign_segments s
    WHERE s.id = p_segment_id
    LIMIT 1
  ),
  access_ok AS (
    SELECT 1
    FROM seg
    WHERE public.is_super_admin(auth.uid())
       OR (public.is_tenant_admin(auth.uid()) AND public.can_access_tenant_data(auth.uid(), seg.tenant_id))
  ),
  device_ctx AS (
    SELECT
      d.id AS device_id,
      d.company_id,
      d.store_id,
      st.city_id,
      ct.state_id,
      stt.region_id,
      d.sector_id,
      d.zone_id,
      d.device_type_id,
      d.status,
      (
        SELECT COALESCE(array_agg(DISTINCT x.tag_id), '{}'::uuid[])
        FROM (
          SELECT dt.tag_id
          FROM public.device_tags dt
          WHERE dt.device_id = d.id
          UNION
          SELECT stg.tag_id
          FROM public.store_tags stg
          WHERE stg.store_id = d.store_id
        ) x
      ) AS tag_ids,
      (
        SELECT COALESCE(array_agg(DISTINCT x.group_id), '{}'::uuid[])
        FROM (
          SELECT d.group_id AS group_id
          UNION
          SELECT m.group_id
          FROM public.device_group_members m
          WHERE m.device_id = d.id
        ) x
        WHERE x.group_id IS NOT NULL
      ) AS group_ids
    FROM public.devices d
    JOIN public.stores st ON st.id = d.store_id
    JOIN public.cities ct ON ct.id = st.city_id
    JOIN public.states stt ON stt.id = ct.state_id
    JOIN seg ON seg.tenant_id = st.tenant_id
    WHERE d.is_active = true
      AND st.is_active = true
      AND (NOT p_only_online OR d.status = 'online')
  ),
  include_clauses AS (
    SELECT DISTINCT t.clause_id
    FROM public.campaign_segment_targets t
    JOIN seg ON seg.id = t.segment_id
    WHERE t.include = true
  ),
  clause_count AS (
    SELECT COUNT(*)::int AS n
    FROM include_clauses
  ),
  include_matches AS (
    SELECT DISTINCT
      dc.device_id,
      t.clause_id
    FROM device_ctx dc
    JOIN public.campaign_segment_targets t
      ON t.segment_id = p_segment_id
     AND t.include = true
    WHERE (
      (t.target_type = 'device' AND t.device_id IS NOT NULL AND t.device_id = dc.device_id)
      OR (t.target_type = 'device_type' AND t.device_type_id IS NOT NULL AND t.device_type_id = dc.device_type_id)
      OR (t.target_type = 'zone' AND t.zone_id IS NOT NULL AND t.zone_id = dc.zone_id)
      OR (t.target_type = 'sector' AND t.sector_id IS NOT NULL AND t.sector_id = dc.sector_id)
      OR (t.target_type = 'device_group' AND t.device_group_id IS NOT NULL AND t.device_group_id = ANY(dc.group_ids))
      OR (t.target_type = 'store' AND t.store_id IS NOT NULL AND t.store_id = dc.store_id)
      OR (t.target_type = 'city' AND t.city_id IS NOT NULL AND t.city_id = dc.city_id)
      OR (t.target_type = 'state' AND t.state_id IS NOT NULL AND t.state_id = dc.state_id)
      OR (t.target_type = 'region' AND t.region_id IS NOT NULL AND t.region_id = dc.region_id)
      OR (t.target_type = 'company' AND t.company_id IS NOT NULL AND t.company_id = dc.company_id)
      OR (t.target_type = 'tag' AND t.tag_id IS NOT NULL AND t.tag_id = ANY(dc.tag_ids))
    )
  ),
  qualified AS (
    SELECT im.device_id
    FROM include_matches im
    GROUP BY im.device_id
    HAVING (SELECT n FROM clause_count) > 0
       AND COUNT(DISTINCT im.clause_id)::int = (SELECT n FROM clause_count)
  ),
  excluded AS (
    SELECT DISTINCT dc.device_id
    FROM device_ctx dc
    JOIN public.campaign_segment_targets t
      ON t.segment_id = p_segment_id
     AND t.include = false
    WHERE (
      (t.target_type = 'device' AND t.device_id IS NOT NULL AND t.device_id = dc.device_id)
      OR (t.target_type = 'device_type' AND t.device_type_id IS NOT NULL AND t.device_type_id = dc.device_type_id)
      OR (t.target_type = 'zone' AND t.zone_id IS NOT NULL AND t.zone_id = dc.zone_id)
      OR (t.target_type = 'sector' AND t.sector_id IS NOT NULL AND t.sector_id = dc.sector_id)
      OR (t.target_type = 'device_group' AND t.device_group_id IS NOT NULL AND t.device_group_id = ANY(dc.group_ids))
      OR (t.target_type = 'store' AND t.store_id IS NOT NULL AND t.store_id = dc.store_id)
      OR (t.target_type = 'city' AND t.city_id IS NOT NULL AND t.city_id = dc.city_id)
      OR (t.target_type = 'state' AND t.state_id IS NOT NULL AND t.state_id = dc.state_id)
      OR (t.target_type = 'region' AND t.region_id IS NOT NULL AND t.region_id = dc.region_id)
      OR (t.target_type = 'company' AND t.company_id IS NOT NULL AND t.company_id = dc.company_id)
      OR (t.target_type = 'tag' AND t.tag_id IS NOT NULL AND t.tag_id = ANY(dc.tag_ids))
    )
  )
  SELECT q.device_id
  FROM qualified q
  JOIN access_ok a ON true
  LEFT JOIN excluded e ON e.device_id = q.device_id
  WHERE e.device_id IS NULL
  LIMIT LEAST(GREATEST(p_limit, 0), 5000);
$$;
 
CREATE OR REPLACE FUNCTION public.resolve_segment_device_stats(
  p_segment_id uuid,
  p_limit integer DEFAULT 1000,
  p_only_online boolean DEFAULT false
)
RETURNS TABLE(device_count integer, store_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ids AS (
    SELECT device_id
    FROM public.resolve_segment_device_ids(p_segment_id, p_limit, p_only_online)
  )
  SELECT
    COUNT(*)::int AS device_count,
    COUNT(DISTINCT d.store_id)::int AS store_count
  FROM ids
  JOIN public.devices d ON d.id = ids.device_id;
$$;
 
