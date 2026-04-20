-- Enable realtime for player event tables
DO $$
BEGIN
  -- device_detection_logs
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_detection_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- media_play_logs
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.media_play_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- device_status_logs
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- impression_logs
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.impression_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Ensure REPLICA IDENTITY FULL for complete payloads in change events
ALTER TABLE public.device_detection_logs REPLICA IDENTITY FULL;
ALTER TABLE public.media_play_logs REPLICA IDENTITY FULL;
ALTER TABLE public.device_status_logs REPLICA IDENTITY FULL;
ALTER TABLE public.impression_logs REPLICA IDENTITY FULL;