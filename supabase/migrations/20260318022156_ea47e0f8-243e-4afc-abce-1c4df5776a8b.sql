
-- Add tenant_id to playlists
ALTER TABLE public.playlists ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Add tenant_id to media_items  
ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Add tenant_id to stores (it references via cities hierarchy, but direct is better)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Create indexes for tenant filtering
CREATE INDEX IF NOT EXISTS idx_playlists_tenant_id ON public.playlists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_items_tenant_id ON public.media_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stores_tenant_id ON public.stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_company_id ON public.devices(company_id);
