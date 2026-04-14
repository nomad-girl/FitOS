-- Recovery system: new subjective fields + recovery snapshots

-- New subjective fields in daily_logs
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS mood integer,            -- 1-5 estado de ánimo
  ADD COLUMN IF NOT EXISTS fatigue_upper integer,    -- 1-5 fatiga tren superior
  ADD COLUMN IF NOT EXISTS fatigue_lower integer,    -- 1-5 fatiga tren inferior
  ADD COLUMN IF NOT EXISTS training_stimulus text,   -- recovery | volume | intense | max
  ADD COLUMN IF NOT EXISTS training_name text,       -- nombre del entrenamiento (from Hevy)
  ADD COLUMN IF NOT EXISTS training_rpe_avg numeric(3,1),
  ADD COLUMN IF NOT EXISTS training_rpe_max numeric(3,1),
  ADD COLUMN IF NOT EXISTS training_sets integer,
  ADD COLUMN IF NOT EXISTS training_muscle_groups text[];  -- e.g. {'chest','shoulders','triceps'}

-- Recovery snapshots: daily computed readiness
CREATE TABLE IF NOT EXISTS recovery_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,

  -- Readiness scores (0-100)
  readiness_global integer,
  readiness_upper integer,
  readiness_lower integer,
  energy_score integer,

  -- Detected phase per zone
  phase_global text,   -- accumulation | peak | fatigue | deload
  phase_upper text,
  phase_lower text,

  -- Energy state
  energy_state text,   -- high | sufficient | low | very_low

  -- System reading + recommendation (short text)
  system_reading text,
  recommendation text,

  -- Raw input snapshot for debugging
  input_data jsonb,

  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

-- RLS
ALTER TABLE recovery_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own recovery snapshots"
  ON recovery_snapshots FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recovery snapshots"
  ON recovery_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recovery snapshots"
  ON recovery_snapshots FOR UPDATE USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_recovery_snapshots_user_date
  ON recovery_snapshots(user_id, snapshot_date DESC);
