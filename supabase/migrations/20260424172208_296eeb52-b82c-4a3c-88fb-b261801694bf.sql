-- Create device_commands table
CREATE TABLE IF NOT EXISTS public.device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

-- Policies for device_commands using project-specific logic
CREATE POLICY "Users can view commands for their devices"
    ON public.device_commands
    FOR SELECT
    USING (
        is_super_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.devices d
            LEFT JOIN public.companies c ON d.company_id = c.id
            LEFT JOIN public.stores s ON d.store_id = s.id
            WHERE d.id = device_commands.device_id
            AND (
                (c.id IS NOT NULL AND can_access_tenant_data(auth.uid(), c.tenant_id))
                OR
                (s.id IS NOT NULL AND can_access_tenant_data(auth.uid(), s.tenant_id))
            )
        )
    );

CREATE POLICY "Users can insert commands for their devices"
    ON public.device_commands
    FOR INSERT
    WITH CHECK (
        is_super_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.devices d
            LEFT JOIN public.companies c ON d.company_id = c.id
            LEFT JOIN public.stores s ON d.store_id = s.id
            WHERE d.id = device_id
            AND (
                (c.id IS NOT NULL AND can_access_tenant_data(auth.uid(), c.tenant_id))
                OR
                (s.id IS NOT NULL AND can_access_tenant_data(auth.uid(), s.tenant_id))
            )
        )
    );

-- Add device_token to devices if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'device_token') THEN
        ALTER TABLE public.devices ADD COLUMN device_token TEXT;
        -- Initialize with a random token for existing devices
        UPDATE public.devices SET device_token = encode(gen_random_bytes(16), 'hex') WHERE device_token IS NULL;
    END IF;
END $$;

-- Allow public read of pending commands if device_token matches (for the device polling)
CREATE OR REPLACE FUNCTION public.get_pending_device_command(p_device_id UUID, p_device_token TEXT)
RETURNS TABLE (
    id UUID,
    device_id UUID,
    command TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
) AS $$
BEGIN
    -- Validate token
    IF EXISTS (SELECT 1 FROM public.devices WHERE id = p_device_id AND device_token = p_device_token) THEN
        RETURN QUERY
        SELECT dc.id, dc.device_id, dc.command, dc.status, dc.created_at, dc.metadata
        FROM public.device_commands dc
        WHERE dc.device_id = p_device_id AND dc.status = 'pending'
        ORDER BY dc.created_at ASC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to mark command as executed
CREATE OR REPLACE FUNCTION public.mark_device_command_executed(p_command_id UUID, p_device_token TEXT, p_status TEXT DEFAULT 'executed', p_error TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_device_id UUID;
BEGIN
    SELECT dc.device_id INTO v_device_id FROM public.device_commands dc WHERE dc.id = p_command_id;
    
    -- Validate token
    IF EXISTS (SELECT 1 FROM public.devices WHERE id = v_device_id AND device_token = p_device_token) THEN
        UPDATE public.device_commands
        SET 
            status = p_status,
            executed_at = timezone('utc'::text, now()),
            error_message = p_error
        WHERE id = p_command_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
