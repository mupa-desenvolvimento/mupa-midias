
-- Add is_default column to device_groups
ALTER TABLE public.device_groups
ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Create trigger to ensure only one default group per tenant
CREATE OR REPLACE FUNCTION public.ensure_single_default_group()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.device_groups
    SET is_default = false
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_single_default_group
BEFORE INSERT OR UPDATE ON public.device_groups
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_group();
