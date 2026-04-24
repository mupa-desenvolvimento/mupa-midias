-- Add column to track company-wide default playlist
ALTER TABLE public.playlists 
ADD COLUMN is_company_default BOOLEAN NOT NULL DEFAULT false;

-- Create a function to handle single default playlist per company
CREATE OR REPLACE FUNCTION public.handle_playlist_default_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new/updated playlist is being set as default
  IF NEW.is_company_default THEN
    -- Unset any other default playlist for the same company/tenant
    UPDATE public.playlists
    SET is_company_default = false
    WHERE tenant_id = NEW.tenant_id
      AND id <> NEW.id
      AND is_company_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to maintain only one default playlist per company
CREATE TRIGGER ensure_single_company_default_playlist
BEFORE INSERT OR UPDATE OF is_company_default
ON public.playlists
FOR EACH ROW
WHEN (NEW.is_company_default = true)
EXECUTE FUNCTION public.handle_playlist_default_status();

-- Create function to automatically assign default playlist to new devices
CREATE OR REPLACE FUNCTION public.assign_default_playlist_to_device()
RETURNS TRIGGER AS $$
DECLARE
    default_playlist_id UUID;
BEGIN
    -- Only proceed if the device doesn't already have a playlist assigned
    IF NEW.playlist_id IS NULL THEN
        -- Find the default playlist for this device's tenant
        SELECT id INTO default_playlist_id
        FROM public.playlists
        WHERE tenant_id = NEW.tenant_id
          AND is_company_default = true
        LIMIT 1;

        -- If found, assign it
        IF default_playlist_id IS NOT NULL THEN
            NEW.playlist_id := default_playlist_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to apply default playlist on device creation
CREATE TRIGGER auto_assign_playlist_on_device_creation
BEFORE INSERT ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_playlist_to_device();
