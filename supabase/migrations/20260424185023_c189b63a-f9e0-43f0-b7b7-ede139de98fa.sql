-- Drop existing policies
DROP POLICY IF EXISTS "Users can view commands for their devices" ON public.device_commands;
DROP POLICY IF EXISTS "Users can insert commands for their devices" ON public.device_commands;

-- Create more robust SELECT policy
CREATE POLICY "Users can view commands for their devices" 
ON public.device_commands 
FOR SELECT 
USING (
  is_super_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.devices d
    LEFT JOIN public.companies c ON d.company_id = c.id
    LEFT JOIN public.stores s ON d.store_id = s.id
    WHERE d.id = device_commands.device_id
    AND (
      -- If linked to company/store, check tenant access
      (c.tenant_id IS NOT NULL AND can_access_tenant_data(auth.uid(), c.tenant_id))
      OR (s.tenant_id IS NOT NULL AND can_access_tenant_data(auth.uid(), s.tenant_id))
      -- If not linked to anything yet, allow if user is authenticated (common for setup phase)
      -- or you can add more specific logic here if needed
      OR (c.id IS NULL AND s.id IS NULL AND auth.role() = 'authenticated')
    )
  )
);

-- Create more robust INSERT policy
CREATE POLICY "Users can insert commands for their devices" 
ON public.device_commands 
FOR INSERT 
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.devices d
    LEFT JOIN public.companies c ON d.company_id = c.id
    LEFT JOIN public.stores s ON d.store_id = s.id
    WHERE d.id = device_commands.device_id
    AND (
      (c.tenant_id IS NOT NULL AND can_access_tenant_data(auth.uid(), c.tenant_id))
      OR (s.tenant_id IS NOT NULL AND can_access_tenant_data(auth.uid(), s.tenant_id))
      OR (c.id IS NULL AND s.id IS NULL AND auth.role() = 'authenticated')
    )
  )
);