DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'devices'
      AND column_name = 'price_integration_enabled'
  ) THEN
    ALTER TABLE public.devices
      ADD COLUMN price_integration_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;
