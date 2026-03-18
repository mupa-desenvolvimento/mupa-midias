
-- Link company to tenant
UPDATE public.companies 
SET tenant_id = '6fb1ddb9-f804-4c96-82ff-182334a81127'
WHERE id = '3c11f254-54b6-466f-a961-06be38053517';

-- Seed defaults
SELECT public.seed_tenant_defaults(
  '6fb1ddb9-f804-4c96-82ff-182334a81127'::uuid,
  '3c11f254-54b6-466f-a961-06be38053517'::uuid
);
