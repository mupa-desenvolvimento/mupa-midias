
CREATE TABLE public.lite_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ean TEXT NOT NULL,
  internal_code TEXT,
  description TEXT NOT NULL,
  normal_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  promo_price NUMERIC(10,2),
  de_por_price NUMERIC(10,2),
  club_price NUMERIC(10,2),
  leve_x_pague_y TEXT,
  discount_4th_item NUMERIC(10,2),
  other_price NUMERIC(10,2),
  custom_field_name TEXT,
  custom_field_value TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, ean)
);

ALTER TABLE public.lite_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant products"
  ON public.lite_products FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tenant products"
  ON public.lite_products FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tenant products"
  ON public.lite_products FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own tenant products"
  ON public.lite_products FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_mappings WHERE user_id = auth.uid()
    )
  );
