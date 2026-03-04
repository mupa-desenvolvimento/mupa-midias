-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the RSS collector to run every hour
-- NOTE: You need to replace <PROJECT_REF> and <SERVICE_ROLE_KEY> with your actual project details
-- This command must be run by a superuser (postgres) or via the Supabase Dashboard SQL Editor

/*
SELECT cron.schedule(
  'rss-collector-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url:='https://<PROJECT_REF>.supabase.co/functions/v1/rss-collector',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
*/

-- Alternatively, you can use the Supabase Dashboard > Edge Functions > rss-collector > Schedule
-- Or add to config.toml if using CLI for local dev:
-- [functions.rss-collector]
-- schedule = "0 * * * *"
