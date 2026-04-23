-- Create audience_detections table
CREATE TABLE public.audience_detections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  age INTEGER,
  gender TEXT,
  emotion TEXT,
  emotion_confidence NUMERIC,
  gender_probability NUMERIC,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  session_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_audience_detections_detected_at ON public.audience_detections(detected_at DESC);
CREATE INDEX idx_audience_detections_tenant_id ON public.audience_detections(tenant_id);
CREATE INDEX idx_audience_detections_device_id ON public.audience_detections(device_id);

-- Enable RLS
ALTER TABLE public.audience_detections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Super admins can view all audience detections"
ON public.audience_detections
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their tenant audience detections"
ON public.audience_detections
FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT NULL 
  AND public.can_access_tenant_data(auth.uid(), tenant_id)
);

CREATE POLICY "Authenticated users can insert audience detections"
ON public.audience_detections
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Super admins can delete audience detections"
ON public.audience_detections
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));