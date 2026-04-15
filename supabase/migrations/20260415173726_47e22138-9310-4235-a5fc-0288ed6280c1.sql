
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage groups" ON public.groups FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins manage groups" ON public.groups FOR ALL TO authenticated
  USING (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id));

CREATE POLICY "Tenant users read groups" ON public.groups FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR can_access_tenant_data(auth.uid(), tenant_id));

CREATE INDEX idx_groups_tenant_id ON public.groups(tenant_id);
CREATE INDEX idx_groups_parent_id ON public.groups(parent_id);
