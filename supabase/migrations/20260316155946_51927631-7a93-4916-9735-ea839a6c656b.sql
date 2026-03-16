
-- Instagram settings per tenant
CREATE TABLE public.instagram_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_token text,
  instagram_user_id text,
  username text,
  is_active boolean NOT NULL DEFAULT false,
  fetch_days integer NOT NULL DEFAULT 10,
  last_fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Instagram posts cache
CREATE TABLE public.instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  instagram_id text NOT NULL,
  media_type text NOT NULL DEFAULT 'IMAGE',
  media_url text,
  thumbnail_url text,
  caption text,
  permalink text,
  posted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage instagram settings" ON public.instagram_settings
  FOR ALL TO public
  USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

CREATE POLICY "Anyone can read instagram posts" ON public.instagram_posts
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage instagram posts" ON public.instagram_posts
  FOR ALL TO public
  USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR is_admin(auth.uid()) OR is_tenant_admin(auth.uid()));

CREATE UNIQUE INDEX instagram_posts_ig_id_unique ON public.instagram_posts (instagram_id);
