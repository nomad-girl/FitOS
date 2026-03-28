-- Routines (workout templates within a phase)
CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  estimated_duration_min INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_routines_phase ON routines(phase_id);

-- Routine exercises
CREATE TABLE IF NOT EXISTS routine_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  rest_seconds INTEGER DEFAULT 90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises(routine_id);

-- Routine sets (planned)
CREATE TABLE IF NOT EXISTS routine_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_exercise_id UUID NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  rep_range_low INTEGER,
  rep_range_high INTEGER,
  duration_seconds INTEGER,
  target_rpe NUMERIC(3,1),
  target_weight NUMERIC(6,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_routine_sets_exercise ON routine_sets(routine_exercise_id);

-- RLS
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own routines" ON routines FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users CRUD own routine_exercises" ON routine_exercises FOR ALL USING (
  EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_exercises.routine_id AND routines.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_exercises.routine_id AND routines.user_id = auth.uid())
);
CREATE POLICY "Users CRUD own routine_sets" ON routine_sets FOR ALL USING (
  EXISTS (SELECT 1 FROM routine_exercises re JOIN routines r ON r.id = re.routine_id WHERE re.id = routine_sets.routine_exercise_id AND r.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM routine_exercises re JOIN routines r ON r.id = re.routine_id WHERE re.id = routine_sets.routine_exercise_id AND r.user_id = auth.uid())
);
