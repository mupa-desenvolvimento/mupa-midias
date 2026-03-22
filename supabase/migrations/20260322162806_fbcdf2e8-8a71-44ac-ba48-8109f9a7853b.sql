
-- ============================================================
-- ENTERPRISE V2 - FASE 2: SISTEMA DE TAGS E SEGMENTAÇÃO
-- ============================================================

-- 1. TAGS (Tags para segmentação dinâmica)
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  category text DEFAULT 'general',
  color text DEFAULT '#6366f1',
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- 2. DEVICE_TAGS (Associação device <-> tag)
CREATE TABLE public.device_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(device_id, tag_id)
);

-- 3. STORE_TAGS (Associação store <-> tag)
CREATE TABLE public.store_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(store_id, tag_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON public.tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON public.tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_category ON public.tags(category);
CREATE INDEX IF NOT EXISTS idx_device_tags_device_id ON public.device_tags(device_id);
CREATE INDEX IF NOT EXISTS idx_device_tags_tag_id ON public.device_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_store_tags_store_id ON public.store_tags(store_id);
CREATE INDEX IF NOT EXISTS idx_store_tags_tag_id ON public.store_tags(tag_id);

-- RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage tags" ON public.tags
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins manage tags" ON public.tags
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()));

CREATE POLICY "Read tags" ON public.tags
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Super admins manage device_tags" ON public.device_tags
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins manage device_tags" ON public.device_tags
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid()));

CREATE POLICY "Read device_tags" ON public.device_tags
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Super admins manage store_tags" ON public.store_tags
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins manage store_tags" ON public.store_tags
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid()));

CREATE POLICY "Read store_tags" ON public.store_tags
  FOR SELECT TO anon, authenticated USING (true);

-- Trigger
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
