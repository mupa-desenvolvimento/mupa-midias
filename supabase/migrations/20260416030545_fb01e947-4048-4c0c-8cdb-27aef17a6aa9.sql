
-- 1. Store internal groups (grupos internos da loja)
CREATE TABLE public.store_internal_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

ALTER TABLE public.store_internal_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant store internal groups"
  ON public.store_internal_groups FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.can_access_tenant_data(auth.uid(), tenant_id));

CREATE POLICY "Users can insert own tenant store internal groups"
  ON public.store_internal_groups FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.can_access_tenant_data(auth.uid(), tenant_id));

CREATE POLICY "Users can update own tenant store internal groups"
  ON public.store_internal_groups FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.can_access_tenant_data(auth.uid(), tenant_id));

CREATE POLICY "Users can delete own tenant store internal groups"
  ON public.store_internal_groups FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.can_access_tenant_data(auth.uid(), tenant_id));

CREATE TRIGGER update_store_internal_groups_updated_at
  BEFORE UPDATE ON public.store_internal_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Store internal group devices (vínculo dispositivo <-> grupo interno)
CREATE TABLE public.store_internal_group_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_group_id UUID NOT NULL REFERENCES public.store_internal_groups(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(internal_group_id, device_id)
);

ALTER TABLE public.store_internal_group_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view store internal group devices"
  ON public.store_internal_group_devices FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.store_internal_groups sig
      WHERE sig.id = internal_group_id
        AND public.can_access_tenant_data(auth.uid(), sig.tenant_id)
    )
  );

CREATE POLICY "Users can insert store internal group devices"
  ON public.store_internal_group_devices FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.store_internal_groups sig
      WHERE sig.id = internal_group_id
        AND public.can_access_tenant_data(auth.uid(), sig.tenant_id)
    )
  );

CREATE POLICY "Users can delete store internal group devices"
  ON public.store_internal_group_devices FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.store_internal_groups sig
      WHERE sig.id = internal_group_id
        AND public.can_access_tenant_data(auth.uid(), sig.tenant_id)
    )
  );

-- 3. Global group targets (vínculo grupo global <-> grupo interno de loja)
CREATE TABLE public.global_group_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  store_internal_group_id UUID NOT NULL REFERENCES public.store_internal_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, store_internal_group_id)
);

ALTER TABLE public.global_group_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view global group targets"
  ON public.global_group_targets FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND public.can_access_tenant_data(auth.uid(), g.tenant_id)
    )
  );

CREATE POLICY "Users can insert global group targets"
  ON public.global_group_targets FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND public.can_access_tenant_data(auth.uid(), g.tenant_id)
    )
  );

CREATE POLICY "Users can delete global group targets"
  ON public.global_group_targets FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND public.can_access_tenant_data(auth.uid(), g.tenant_id)
    )
  );
