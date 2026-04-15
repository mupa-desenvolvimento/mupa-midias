-- Migration to automatically assign new devices to the "Grupo Padrão" in the new groups structure
CREATE OR REPLACE FUNCTION public.assign_device_to_new_default_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
  v_default_group_id UUID;
BEGIN
  -- 1. Identify tenant from company
  IF NEW.company_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM public.companies WHERE id = NEW.company_id;
  END IF;

  -- 2. If not found, try from store
  IF v_tenant_id IS NULL AND NEW.store_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM public.stores WHERE id = NEW.store_id;
  END IF;

  -- 3. If we have a tenant, find the "Grupo Padrão" in the new groups table
  -- Note: This matches the "Grupo Padrão" created during tenant provisioning
  IF v_tenant_id IS NOT NULL THEN
    SELECT id INTO v_default_group_id 
    FROM public.groups 
    WHERE name = 'Grupo Padrão' AND tenant_id = v_tenant_id
    LIMIT 1;

    -- 4. Assign the device to this group in the new junction table (group_devices)
    IF v_default_group_id IS NOT NULL THEN
      INSERT INTO public.group_devices (group_id, device_id)
      VALUES (v_default_group_id, NEW.id)
      ON CONFLICT (group_id, device_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to fire after a new device is inserted
DROP TRIGGER IF EXISTS after_device_insert_assign_group ON public.devices;
CREATE TRIGGER after_device_insert_assign_group
AFTER INSERT ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.assign_device_to_new_default_group();
