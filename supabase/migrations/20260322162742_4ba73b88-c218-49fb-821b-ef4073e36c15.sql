
-- ============================================================
-- ENTERPRISE V2 - FASE 1: HIERARQUIA EXPANDIDA
-- Novas camadas: sectors, zones, device_types
-- ============================================================

-- 1. SECTORS (Setores dentro de uma loja)
CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, name)
);

-- 2. ZONES (Zonas dentro de um setor)
CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sector_id, name)
);

-- 3. DEVICE TYPES (Tipos de dispositivo)
CREATE TABLE public.device_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  default_resolution text DEFAULT '1920x1080',
  default_orientation text DEFAULT 'landscape',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- 4. Adicionar referências enterprise na tabela devices
ALTER TABLE public.devices 
  ADD COLUMN IF NOT EXISTS sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS device_type_id uuid REFERENCES public.device_types(id) ON DELETE SET NULL;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_sectors_store_id ON public.sectors(store_id);
CREATE INDEX IF NOT EXISTS idx_sectors_tenant_id ON public.sectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zones_sector_id ON public.zones(sector_id);
CREATE INDEX IF NOT EXISTS idx_zones_tenant_id ON public.zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_types_tenant_id ON public.device_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_sector_id ON public.devices(sector_id);
CREATE INDEX IF NOT EXISTS idx_devices_zone_id ON public.devices(zone_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_type_id ON public.devices(device_type_id);

-- 6. RLS para sectors
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage sectors" ON public.sectors
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage sectors" ON public.sectors
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()));

CREATE POLICY "Public read sectors for device setup" ON public.sectors
  FOR SELECT TO anon, authenticated
  USING (true);

-- 7. RLS para zones
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage zones" ON public.zones
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage zones" ON public.zones
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()));

CREATE POLICY "Public read zones for device setup" ON public.zones
  FOR SELECT TO anon, authenticated
  USING (true);

-- 8. RLS para device_types
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage device_types" ON public.device_types
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage device_types" ON public.device_types
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()));

CREATE POLICY "Public read device_types" ON public.device_types
  FOR SELECT TO anon, authenticated
  USING (true);

-- 9. Triggers updated_at
CREATE TRIGGER update_sectors_updated_at BEFORE UPDATE ON public.sectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_device_types_updated_at BEFORE UPDATE ON public.device_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
