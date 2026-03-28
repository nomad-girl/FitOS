-- Exercise mappings (Hevy sync)
CREATE TABLE IF NOT EXISTS exercise_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hevy_exercise_id TEXT NOT NULL,
  hevy_exercise_name TEXT NOT NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, hevy_exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_exercise_mappings_user ON exercise_mappings(user_id);

-- Executed sessions
CREATE TABLE IF NOT EXISTS executed_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES routines(id) ON DELETE SET NULL,
  phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,
  week_number INTEGER,
  hevy_workout_id TEXT,
  session_date DATE NOT NULL,
  duration_minutes INTEGER,
  total_volume_kg NUMERIC(8,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, hevy_workout_id)
);
CREATE INDEX IF NOT EXISTS idx_executed_sessions_user ON executed_sessions(user_id);

-- Executed exercises
CREATE TABLE IF NOT EXISTS executed_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_session_id UUID NOT NULL REFERENCES executed_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  routine_exercise_id UUID REFERENCES routine_exercises(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_executed_exercises_session ON executed_exercises(executed_session_id);

-- Executed sets
CREATE TABLE IF NOT EXISTS executed_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_exercise_id UUID NOT NULL REFERENCES executed_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  weight_kg NUMERIC(6,1),
  reps INTEGER,
  rpe NUMERIC(3,1),
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_executed_sets_exercise ON executed_sets(executed_exercise_id);

-- RLS
ALTER TABLE exercise_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE executed_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE executed_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE executed_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own exercise_mappings" ON exercise_mappings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users CRUD own executed_sessions" ON executed_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users CRUD own executed_exercises" ON executed_exercises FOR ALL USING (
  EXISTS (SELECT 1 FROM executed_sessions WHERE executed_sessions.id = executed_exercises.executed_session_id AND executed_sessions.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM executed_sessions WHERE executed_sessions.id = executed_exercises.executed_session_id AND executed_sessions.user_id = auth.uid())
);
CREATE POLICY "Users CRUD own executed_sets" ON executed_sets FOR ALL USING (
  EXISTS (SELECT 1 FROM executed_exercises ee JOIN executed_sessions es ON es.id = ee.executed_session_id WHERE ee.id = executed_sets.executed_exercise_id AND es.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM executed_exercises ee JOIN executed_sessions es ON es.id = ee.executed_session_id WHERE ee.id = executed_sets.executed_exercise_id AND es.user_id = auth.uid())
);
