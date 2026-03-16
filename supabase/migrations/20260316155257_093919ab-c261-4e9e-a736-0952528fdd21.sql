
CREATE TABLE public.nutrition_tips (
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

ALTER TABLE public.nutrition_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read nutrition tips" ON public.nutrition_tips
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage nutrition tips" ON public.nutrition_tips
  FOR ALL TO public
  USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

CREATE UNIQUE INDEX nutrition_tips_title_unique ON public.nutrition_tips (md5(title));
