
-- Create license plan enum
CREATE TYPE public.license_plan AS ENUM ('lite', 'standard', 'enterprise');

-- Create tenant_licenses table
CREATE TABLE public.tenant_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan public.license_plan NOT NULL DEFAULT 'lite',
  is_active boolean NOT NULL DEFAULT true,
  max_playlists integer NOT NULL DEFAULT 1,
  max_devices integer NOT NULL DEFAULT 3,
  max_media_uploads integer NOT NULL DEFAULT 5,
  max_stores integer NOT NULL DEFAULT 3,
  max_device_groups integer NOT NULL DEFAULT 1,
  allow_video_upload boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  stripe_subscription_id text,
  stripe_customer_id text,
  coupon_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.tenant_licenses ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all licenses
CREATE POLICY "Super admins can manage licenses"
  ON public.tenant_licenses FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Tenant admins can read their own license
CREATE POLICY "Tenant admins can read own license"
  ON public.tenant_licenses FOR SELECT
  USING (can_access_tenant_data(auth.uid(), tenant_id));

-- Function to check if a tenant license is active and not expired
CREATE OR REPLACE FUNCTION public.get_tenant_license(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_license RECORD;
BEGIN
  SELECT * INTO v_license
  FROM public.tenant_licenses
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_license', false);
  END IF;

  RETURN jsonb_build_object(
    'has_license', true,
    'plan', v_license.plan::text,
    'max_playlists', v_license.max_playlists,
    'max_devices', v_license.max_devices,
    'max_media_uploads', v_license.max_media_uploads,
    'max_stores', v_license.max_stores,
    'max_device_groups', v_license.max_device_groups,
    'allow_video_upload', v_license.allow_video_upload,
    'expires_at', v_license.expires_at,
    'starts_at', v_license.starts_at
  );
END;
$$;

-- Function to check a specific limit for enforcement
CREATE OR REPLACE FUNCTION public.check_tenant_limit(
  p_tenant_id uuid,
  p_resource text,
  p_current_count integer
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_license RECORD;
  v_max integer;
BEGIN
  -- Super admins bypass limits
  IF is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  SELECT * INTO v_license
  FROM public.tenant_licenses
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND expires_at > now()
  LIMIT 1;

  -- No license = no active plan = block
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Standard/enterprise have no limits enforced here
  IF v_license.plan != 'lite' THEN
    RETURN true;
  END IF;

  CASE p_resource
    WHEN 'playlists' THEN v_max := v_license.max_playlists;
    WHEN 'devices' THEN v_max := v_license.max_devices;
    WHEN 'media' THEN v_max := v_license.max_media_uploads;
    WHEN 'stores' THEN v_max := v_license.max_stores;
    WHEN 'device_groups' THEN v_max := v_license.max_device_groups;
    ELSE RETURN true;
  END CASE;

  RETURN p_current_count < v_max;
END;
$$;

-- Updated_at trigger
CREATE TRIGGER update_tenant_licenses_updated_at
  BEFORE UPDATE ON public.tenant_licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
