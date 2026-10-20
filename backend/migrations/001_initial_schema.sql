-- 1. Enable RLS on investigations
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'investigations' 
      AND policyname = 'Users can manage own investigations'
  ) THEN
    CREATE POLICY "Users can manage own investigations"
      ON public.investigations FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Progress Events Table for backend progress reporting
CREATE TABLE IF NOT EXISTS public.progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Register realtime channel pattern
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('investigation:%', 'Investigation progress updates', true)
ON CONFLICT (pattern) DO UPDATE
SET description = EXCLUDED.description,
    enabled = EXCLUDED.enabled;

-- 4. Realtime Broadcast Trigger Function
CREATE OR REPLACE FUNCTION public.notify_progress_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(NEW.channel, NEW.event, NEW.payload);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS progress_event_trigger ON public.progress_events;
CREATE TRIGGER progress_event_trigger
AFTER INSERT ON public.progress_events
FOR EACH ROW EXECUTE FUNCTION public.notify_progress_event();
