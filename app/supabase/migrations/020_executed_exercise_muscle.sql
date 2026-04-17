-- Store Hevy's primary_muscle_group directly on each executed_exercise.
-- Avoids fuzzy name matching against the local exercises table, which fails
-- cross-language (Hevy imports arrive with Spanish names, local table mixes
-- English/Spanish names from seed).

ALTER TABLE executed_exercises
  ADD COLUMN IF NOT EXISTS hevy_muscle_group TEXT;

CREATE INDEX IF NOT EXISTS idx_executed_exercises_muscle
  ON executed_exercises(hevy_muscle_group)
  WHERE hevy_muscle_group IS NOT NULL;
