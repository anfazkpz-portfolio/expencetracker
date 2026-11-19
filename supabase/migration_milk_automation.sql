-- ============================================================================
-- Daily Milk Logging & Subscription Automation Migration
-- ============================================================================

-- 1. Ensure status check constraint allows 'delivered', 'pending', 'skipped', and 'paid'
ALTER TABLE public.daily_milk_logs DROP CONSTRAINT IF EXISTS daily_milk_logs_status_check;
ALTER TABLE public.daily_milk_logs ADD CONSTRAINT daily_milk_logs_status_check 
  CHECK (status IN ('paid', 'skipped', 'pending', 'delivered'));

-- 2. Add Unique Index on date so a calendar date cannot have duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_milk_logs_unique_date ON public.daily_milk_logs (date);

-- 3. App Settings Table (Enables Cross-Device Persistent Subscription Sync)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow public all access on app_settings'
  ) THEN
    CREATE POLICY "Allow public all access on app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
