
-- Create campaign type enum
CREATE TYPE public.campaign_type AS ENUM (
  'satisfaction_survey',
  'product_link',
  'instant_coupon',
  'quick_loyalty',
  'whatsapp_chat',
  'photo_feedback',
  'digital_catalog',
  'daily_raffle',
  'tutorial_recipe',
  'instagram_store',
  'refer_earn',
  'accessibility_info'
);

-- Create qrcode_campaigns table
CREATE TABLE public.qrcode_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  campaign_type public.campaign_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  qr_url TEXT,
  short_url TEXT,
  image_url TEXT,
  media_id UUID REFERENCES public.media_items(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  scans_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create scan logs table
CREATE TABLE public.qrcode_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.qrcode_campaigns(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.qrcode_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qrcode_scan_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaigns
CREATE POLICY "Admins can manage campaigns" ON public.qrcode_campaigns
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

CREATE POLICY "Anyone can read active campaigns" ON public.qrcode_campaigns
  FOR SELECT TO public
  USING (is_active = true);

-- RLS policies for scan logs
CREATE POLICY "Anyone can insert scan logs" ON public.qrcode_scan_logs
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Admins can read scan logs" ON public.qrcode_scan_logs
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

-- Add realtime for scan tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.qrcode_campaigns;

-- Trigger for updated_at
CREATE TRIGGER update_qrcode_campaigns_updated_at
  BEFORE UPDATE ON public.qrcode_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
