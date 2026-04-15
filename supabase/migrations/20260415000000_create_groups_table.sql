-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view groups in their tenant" 
ON public.groups FOR SELECT 
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert groups in their tenant" 
ON public.groups FOR INSERT 
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can update groups in their tenant" 
ON public.groups FOR UPDATE 
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can delete groups in their tenant" 
ON public.groups FOR DELETE 
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
) OR public.is_super_admin(auth.uid()));
