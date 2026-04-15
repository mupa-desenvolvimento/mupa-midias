-- Migration to make tenant_id mandatory and automatic for the groups table
-- 1. Make tenant_id NOT NULL
ALTER TABLE public.groups ALTER COLUMN tenant_id SET NOT NULL;

-- 2. Function to automatically set tenant_id if not provided
CREATE OR REPLACE FUNCTION public.set_group_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If tenant_id is already set (e.g. via tenant provisioning trigger), keep it
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Otherwise, try to get it from the current user's session
  NEW.tenant_id := public.get_user_tenant_id_strict(auth.uid());

  -- If still null, raise an error as it's mandatory
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'O tenant_id é obrigatório para criar um grupo e não foi possível determiná-lo.';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_set_group_tenant_id ON public.groups;
CREATE TRIGGER trigger_set_group_tenant_id
BEFORE INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.set_group_tenant_id();
