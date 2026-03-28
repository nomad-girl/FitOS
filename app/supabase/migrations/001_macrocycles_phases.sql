-- Macrocycles (yearly plan containers)
CREATE TABLE IF NOT EXISTS macrocycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_macrocycles_user ON macrocycles(user_id);

-- Phases (mesocycles)
CREATE TABLE IF NOT EXISTS phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  macrocycle_id UUID REFERENCES macrocycles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT 'build',
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  duration_weeks INTEGER NOT NULL DEFAULT 6,
  frequency INTEGER NOT NULL DEFAULT 3,
  start_date DATE,
  end_date DATE,
  focus_muscles TEXT[] DEFAULT '{}',
  split_type TEXT,
  calorie_target INTEGER,
  protein_target INTEGER,
  carbs_target INTEGER,
  fat_target INTEGER,
  step_goal INTEGER DEFAULT 10000,
  sleep_goal NUMERIC(3,1) DEFAULT 7.5,
  exit_criteria JSONB DEFAULT '[]',
  custom_exit_notes TEXT,
  volume_targets JSONB DEFAULT '{}',
  notes TEXT,
  outcome_notes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phases_user ON phases(user_id);
CREATE INDEX IF NOT EXISTS idx_phases_status ON phases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_phases_macrocycle ON phases(macrocycle_id);

-- RLS
ALTER TABLE macrocycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own macrocycles" ON macrocycles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users CRUD own phases" ON phases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
