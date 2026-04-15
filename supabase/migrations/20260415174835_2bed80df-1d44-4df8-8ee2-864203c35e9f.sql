
CREATE TABLE public.group_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, device_id)
);

ALTER TABLE public.group_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage group_devices" ON public.group_devices FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins manage group_devices" ON public.group_devices FOR ALL TO authenticated
  USING (is_tenant_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_devices.group_id AND can_access_tenant_data(auth.uid(), g.tenant_id)
  ))
  WITH CHECK (is_tenant_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_devices.group_id AND can_access_tenant_data(auth.uid(), g.tenant_id)
  ));

CREATE POLICY "Tenant users read group_devices" ON public.group_devices FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_devices.group_id AND can_access_tenant_data(auth.uid(), g.tenant_id)
  ));

CREATE INDEX idx_group_devices_group_id ON public.group_devices(group_id);
CREATE INDEX idx_group_devices_device_id ON public.group_devices(device_id);
