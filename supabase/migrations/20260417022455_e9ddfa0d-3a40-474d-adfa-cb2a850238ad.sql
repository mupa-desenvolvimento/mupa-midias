CREATE TABLE IF NOT EXISTS public.platform_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error','debug')),
  category text NOT NULL DEFAULT 'system' CHECK (category IN ('device','auth','sync','playback','system','price_check','admin','content')),
  message text NOT NULL,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  device_code text,
  user_id uuid,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_logs_created ON public.platform_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_logs_device ON public.platform_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_platform_logs_tenant ON public.platform_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_logs_category ON public.platform_logs(category);

ALTER TABLE public.platform_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view all platform logs" ON public.platform_logs;
CREATE POLICY "Super admins can view all platform logs"
  ON public.platform_logs FOR SELECT
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant users can view their tenant logs" ON public.platform_logs;
CREATE POLICY "Tenant users can view their tenant logs"
  ON public.platform_logs FOR SELECT
  USING (tenant_id IS NOT NULL AND public.can_access_tenant_data(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Anyone can insert platform logs" ON public.platform_logs;
CREATE POLICY "Anyone can insert platform logs"
  ON public.platform_logs FOR INSERT
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.device_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  device_code text,
  device_name text,
  old_status text,
  new_status text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_status_logs_created ON public.device_status_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_status_logs_device ON public.device_status_logs(device_id);

ALTER TABLE public.device_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view all device status logs" ON public.device_status_logs;
CREATE POLICY "Super admins can view all device status logs"
  ON public.device_status_logs FOR SELECT
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant users can view their device status logs" ON public.device_status_logs;
CREATE POLICY "Tenant users can view their device status logs"
  ON public.device_status_logs FOR SELECT
  USING (tenant_id IS NOT NULL AND public.can_access_tenant_data(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.log_device_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COALESCE(s.tenant_id, c.tenant_id) INTO v_tenant_id
    FROM public.devices d
    LEFT JOIN public.stores s ON s.id = d.store_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    WHERE d.id = NEW.id;

    INSERT INTO public.device_status_logs (device_id, device_code, device_name, old_status, new_status, tenant_id)
    VALUES (NEW.id, NEW.device_code, NEW.name, OLD.status, NEW.status, v_tenant_id);

    INSERT INTO public.platform_logs (level, category, message, device_id, device_code, tenant_id, metadata)
    VALUES (
      CASE WHEN NEW.status = 'online' THEN 'info'
           WHEN NEW.status = 'offline' THEN 'warn'
           ELSE 'error' END,
      'device',
      format('Dispositivo "%s" mudou de %s para %s', NEW.name, COALESCE(OLD.status,'—'), NEW.status),
      NEW.id,
      NEW.device_code,
      v_tenant_id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_device_status_change ON public.devices;
CREATE TRIGGER trg_log_device_status_change
  AFTER UPDATE OF status ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_device_status_change();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;