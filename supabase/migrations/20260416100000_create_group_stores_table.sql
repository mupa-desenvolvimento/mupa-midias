-- Migration to add group_stores table for linking groups to stores
CREATE TABLE IF NOT EXISTS public.group_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, store_id)
);

ALTER TABLE public.group_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view group stores"
  ON public.group_stores FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND (g.tenant_id IN (
          SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
        ) OR public.is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can insert group stores"
  ON public.group_stores FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND (g.tenant_id IN (
          SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
        ) OR public.is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can delete group stores"
  ON public.group_stores FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND (g.tenant_id IN (
          SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
        ) OR public.is_super_admin(auth.uid()))
    )
  );
