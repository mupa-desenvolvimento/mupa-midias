
-- ============================================================
-- ENTERPRISE V2 - FASE 3: CAMPANHAS, ANUNCIANTES E RETAIL MEDIA
-- ============================================================

-- 1. ADVERTISERS (Anunciantes para Retail Media)
CREATE TABLE public.advertisers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  cnpj text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- 2. CONTRACTS (Contratos de anunciantes)
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_impressions integer,
  total_value numeric(12,2),
  status text DEFAULT 'draft',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. CAMPAIGNS (Engine de campanhas enterprise)
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  advertiser_id uuid REFERENCES public.advertisers(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  campaign_type text DEFAULT 'standard',
  priority integer DEFAULT 5,
  weight integer DEFAULT 1,
  status text DEFAULT 'draft',
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  days_of_week integer[],
  max_impressions integer,
  current_impressions integer DEFAULT 0,
  budget numeric(12,2),
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. CAMPAIGN_CONTENTS (Conteúdos da campanha)
CREATE TABLE public.campaign_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  position integer DEFAULT 0,
  duration_override integer,
  weight integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 5. CAMPAIGN_TARGETS (Targeting multicamada)
CREATE TABLE public.campaign_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  state_id uuid REFERENCES public.states(id) ON DELETE CASCADE,
  region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE,
  device_type_id uuid REFERENCES public.device_types(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  include boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_advertisers_tenant ON public.advertisers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_advertiser ON public.contracts(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON public.contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON public.campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON public.campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON public.campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_priority ON public.campaigns(priority DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_contents_campaign ON public.campaign_contents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON public.campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_type ON public.campaign_targets(target_type);

-- RLS
ALTER TABLE public.advertisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_targets ENABLE ROW LEVEL SECURITY;

-- Advertisers RLS
CREATE POLICY "Super admins manage advertisers" ON public.advertisers
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage advertisers" ON public.advertisers
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()));
CREATE POLICY "Read advertisers" ON public.advertisers
  FOR SELECT TO authenticated USING (true);

-- Contracts RLS
CREATE POLICY "Super admins manage contracts" ON public.contracts
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()));
CREATE POLICY "Read contracts" ON public.contracts
  FOR SELECT TO authenticated USING (true);

-- Campaigns RLS
CREATE POLICY "Super admins manage campaigns" ON public.campaigns
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id_strict(auth.uid()));
CREATE POLICY "Read campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (true);

-- Campaign contents RLS
CREATE POLICY "Super admins manage campaign_contents" ON public.campaign_contents
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage campaign_contents" ON public.campaign_contents
  FOR ALL TO authenticated USING (public.is_tenant_admin(auth.uid()));
CREATE POLICY "Read campaign_contents" ON public.campaign_contents
  FOR SELECT TO authenticated USING (true);

-- Campaign targets RLS
CREATE POLICY "Super admins manage campaign_targets" ON public.campaign_targets
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage campaign_targets" ON public.campaign_targets
  FOR ALL TO authenticated USING (public.is_tenant_admin(auth.uid()));
CREATE POLICY "Read campaign_targets" ON public.campaign_targets
  FOR SELECT TO authenticated USING (true);

-- Triggers
CREATE TRIGGER update_advertisers_updated_at BEFORE UPDATE ON public.advertisers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
