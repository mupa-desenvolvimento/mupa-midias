-- Remove the trigger that automatically assigns a default playlist to new devices
DROP TRIGGER IF EXISTS auto_assign_playlist_on_device_creation ON public.devices;

-- Remove the function that handles the automatic assignment
DROP FUNCTION IF EXISTS public.assign_default_playlist_to_device();