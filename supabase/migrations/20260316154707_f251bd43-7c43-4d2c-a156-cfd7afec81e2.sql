
-- Curiosities table
CREATE TABLE public.curiosities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'geral',
  title text NOT NULL,
  content text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Processing jobs table for background tasks
CREATE TABLE public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  progress integer NOT NULL DEFAULT 0,
  result text,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for curiosities
ALTER TABLE public.curiosities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read curiosities" ON public.curiosities
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage curiosities" ON public.curiosities
  FOR ALL TO public
  USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

-- RLS for processing_jobs
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read jobs" ON public.processing_jobs
  FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can insert jobs" ON public.processing_jobs
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update jobs" ON public.processing_jobs
  FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Index for deduplication
CREATE UNIQUE INDEX curiosities_title_unique ON public.curiosities (md5(title));
