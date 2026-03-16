
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS price_integration_id uuid REFERENCES public.price_check_integrations(id) ON DELETE SET NULL;
