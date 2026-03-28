-- Weekly check-ins
CREATE TABLE IF NOT EXISTS weekly_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,
  week_number INTEGER NOT NULL,
  checkin_date DATE NOT NULL,
  weight_kg NUMERIC(5,1),
  waist_cm NUMERIC(5,1),
  hip_cm NUMERIC(5,1),
  thigh_cm NUMERIC(5,1),
  performance_trend TEXT CHECK (performance_trend IN ('declining','stable','improving')),
  avg_calories INTEGER,
  avg_protein INTEGER,
  avg_steps INTEGER,
  avg_sleep_hours NUMERIC(3,1),
  avg_energy NUMERIC(3,1),
  avg_hunger NUMERIC(3,1),
  avg_fatigue NUMERIC(3,1),
  fatigue_map JSONB DEFAULT '{}',
  training_sets_planned INTEGER,
  training_sets_executed INTEGER,
  training_adherence NUMERIC(5,1),
  nutrition_adherence NUMERIC(5,1),
  weekly_score INTEGER CHECK (weekly_score BETWEEN 0 AND 100),
  score_breakdown JSONB DEFAULT '{}',
  ai_analysis TEXT,
  ai_analysis_raw JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, phase_id, week_number)
);
CREATE INDEX IF NOT EXISTS idx_checkins_user_phase ON weekly_checkins(user_id, phase_id);

-- Weekly decisions
CREATE TABLE IF NOT EXISTS weekly_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES weekly_checkins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume_decisions TEXT[] DEFAULT '{}',
  nutrition_decisions TEXT[] DEFAULT '{}',
  phase_decisions TEXT[] DEFAULT '{}',
  context_snapshot JSONB DEFAULT '{}',
  ai_recommendation TEXT,
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_decisions_user ON weekly_decisions(user_id);

-- RLS
ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own checkins" ON weekly_checkins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users CRUD own decisions" ON weekly_decisions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
