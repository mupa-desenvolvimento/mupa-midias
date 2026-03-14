
CREATE TABLE public.birthday_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  birth_date date NOT NULL,
  department text,
  role text,
  email text,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.birthday_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage birthday people"
  ON public.birthday_people FOR ALL
  USING (is_super_admin(auth.uid()) OR (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id)))
  WITH CHECK (is_super_admin(auth.uid()) OR (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id)));

CREATE POLICY "Tenant users can read birthday people"
  ON public.birthday_people FOR SELECT
  USING (is_super_admin(auth.uid()) OR can_access_tenant_data(auth.uid(), tenant_id));

CREATE INDEX idx_birthday_people_tenant ON public.birthday_people(tenant_id);
CREATE INDEX idx_birthday_people_birth_date ON public.birthday_people(birth_date);
