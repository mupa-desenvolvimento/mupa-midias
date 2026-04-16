-- Add playlist_id to stores and store_internal_groups
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL;
ALTER TABLE public.store_internal_groups ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL;

-- Function to get effective playlist for a group (handles inheritance)
CREATE OR REPLACE FUNCTION public.get_group_effective_playlist(p_group_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_playlist_id UUID;
  v_parent_id UUID;
BEGIN
  SELECT playlist_id, parent_id INTO v_playlist_id, v_parent_id FROM public.groups WHERE id = p_group_id;
  
  IF v_playlist_id IS NOT NULL THEN
    RETURN v_playlist_id;
  ELSIF v_parent_id IS NOT NULL THEN
    RETURN public.get_group_effective_playlist(v_parent_id);
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Function to calculate and update a device's current_playlist_id
CREATE OR REPLACE FUNCTION public.sync_device_playlist(p_device_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_playlist_id UUID;
  v_store_id UUID;
  v_sector_playlist_id UUID;
  v_store_playlist_id UUID;
  v_group_playlist_id UUID;
BEGIN
  -- 1. Get Sector Playlist (if device is in a sector)
  SELECT sig.playlist_id INTO v_sector_playlist_id
  FROM public.store_internal_group_devices sigd
  JOIN public.store_internal_groups sig ON sig.id = sigd.internal_group_id
  WHERE sigd.device_id = p_device_id
  LIMIT 1;

  -- 2. Get Store Playlist
  SELECT d.store_id, s.playlist_id INTO v_store_id, v_store_playlist_id
  FROM public.devices d
  JOIN public.stores s ON s.id = d.store_id
  WHERE d.id = p_device_id;

  -- 3. Get Group Playlist (Direct link)
  SELECT public.get_group_effective_playlist(gd.group_id) INTO v_group_playlist_id
  FROM public.group_devices gd
  WHERE gd.device_id = p_device_id
  LIMIT 1;

  -- 4. Get Group Playlist (Via Store link) if direct group not found
  IF v_group_playlist_id IS NULL AND v_store_id IS NOT NULL THEN
    SELECT public.get_group_effective_playlist(gs.group_id) INTO v_group_playlist_id
    FROM public.group_stores gs
    WHERE gs.store_id = v_store_id
    LIMIT 1;
  END IF;

  -- Priority: Sector > Store > Group
  v_playlist_id := COALESCE(v_sector_playlist_id, v_store_playlist_id, v_group_playlist_id);

  -- Update device
  UPDATE public.devices
  SET current_playlist_id = v_playlist_id
  WHERE id = p_device_id;
END;
$$;

-- Trigger Functions
CREATE OR REPLACE FUNCTION public.on_playlist_owner_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If a group playlist changed, sync all devices in that group or in stores of that group
  IF TG_TABLE_NAME = 'groups' THEN
    PERFORM public.sync_device_playlist(gd.device_id) FROM public.group_devices gd WHERE gd.group_id = NEW.id;
    PERFORM public.sync_device_playlist(d.id) FROM public.devices d JOIN public.group_stores gs ON gs.store_id = d.store_id WHERE gs.group_id = NEW.id;
  
  -- If a store playlist changed, sync all devices in that store
  ELSIF TG_TABLE_NAME = 'stores' THEN
    PERFORM public.sync_device_playlist(id) FROM public.devices WHERE store_id = NEW.id;
    
  -- If a sector playlist changed, sync all devices in that sector
  ELSIF TG_TABLE_NAME = 'store_internal_groups' THEN
    PERFORM public.sync_device_playlist(device_id) FROM public.store_internal_group_devices WHERE internal_group_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.on_device_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_device_playlist(OLD.device_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_device_playlist(NEW.device_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.on_device_store_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_device_playlist(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for Playlist updates
DROP TRIGGER IF EXISTS tr_sync_group_playlist ON public.groups;
CREATE TRIGGER tr_sync_group_playlist AFTER UPDATE OF playlist_id ON public.groups FOR EACH ROW EXECUTE FUNCTION public.on_playlist_owner_change();

DROP TRIGGER IF EXISTS tr_sync_store_playlist ON public.stores;
CREATE TRIGGER tr_sync_store_playlist AFTER UPDATE OF playlist_id ON public.stores FOR EACH ROW EXECUTE FUNCTION public.on_playlist_owner_change();

DROP TRIGGER IF EXISTS tr_sync_sector_playlist ON public.store_internal_groups;
CREATE TRIGGER tr_sync_sector_playlist AFTER UPDATE OF playlist_id ON public.store_internal_groups FOR EACH ROW EXECUTE FUNCTION public.on_playlist_owner_change();

-- Triggers for Assignment changes
DROP TRIGGER IF EXISTS tr_sync_device_group_change ON public.group_devices;
CREATE TRIGGER tr_sync_device_group_change AFTER INSERT OR DELETE OR UPDATE ON public.group_devices FOR EACH ROW EXECUTE FUNCTION public.on_device_assignment_change();

DROP TRIGGER IF EXISTS tr_sync_device_sector_change ON public.store_internal_group_devices;
CREATE TRIGGER tr_sync_device_sector_change AFTER INSERT OR DELETE OR UPDATE ON public.store_internal_group_devices FOR EACH ROW EXECUTE FUNCTION public.on_device_assignment_change();

DROP TRIGGER IF EXISTS tr_sync_device_store_update ON public.devices;
CREATE TRIGGER tr_sync_device_store_update AFTER UPDATE OF store_id ON public.devices FOR EACH ROW EXECUTE FUNCTION public.on_device_store_change();
