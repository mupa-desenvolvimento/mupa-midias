
-- Motivational quotes table
CREATE TABLE public.motivational_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote text NOT NULL,
  author text NOT NULL DEFAULT 'Desconhecido',
  image_url text,
  image_orientation text DEFAULT 'landscape',
  is_active boolean NOT NULL DEFAULT true,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  source text DEFAULT 'zenquotes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to avoid duplicates
CREATE UNIQUE INDEX motivational_quotes_quote_tenant_idx ON public.motivational_quotes (tenant_id, md5(quote));

-- Enable RLS
ALTER TABLE public.motivational_quotes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant admins can manage motivational quotes"
  ON public.motivational_quotes FOR ALL
  USING (is_super_admin(auth.uid()) OR (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id)))
  WITH CHECK (is_super_admin(auth.uid()) OR (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id)));

CREATE POLICY "Tenant users can read motivational quotes"
  ON public.motivational_quotes FOR SELECT
  USING (is_super_admin(auth.uid()) OR can_access_tenant_data(auth.uid(), tenant_id));

-- Public read for TV display (devices don't have auth)
CREATE POLICY "Public can read active quotes"
  ON public.motivational_quotes FOR SELECT
  USING (is_active = true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.motivational_quotes;
