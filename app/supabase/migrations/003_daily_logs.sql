-- Daily logs (from FAB quick log)
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  calories INTEGER,
  protein_g INTEGER,
  carbs_g INTEGER,
  fat_g INTEGER,
  steps INTEGER,
  sleep_hours NUMERIC(3,1),
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  hunger INTEGER CHECK (hunger BETWEEN 1 AND 5),
  fatigue_level INTEGER CHECK (fatigue_level BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date DESC);

-- Fatigue zones (per daily log)
CREATE TABLE IF NOT EXISTS fatigue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  zone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fatigue_entries_log ON fatigue_entries(daily_log_id);

-- RLS
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatigue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own daily_logs" ON daily_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users CRUD own fatigue_entries" ON fatigue_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM daily_logs WHERE daily_logs.id = fatigue_entries.daily_log_id AND daily_logs.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM daily_logs WHERE daily_logs.id = fatigue_entries.daily_log_id AND daily_logs.user_id = auth.uid())
);
