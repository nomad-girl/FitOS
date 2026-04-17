-- Store Hevy's secondary_muscle_groups[] alongside the primary so the weekly
-- volume tracker can credit indirect work (biceps on pulls, triceps on presses, …).
-- Secondaries count at 0.5 set in the UI aggregator.

ALTER TABLE executed_exercises
  ADD COLUMN IF NOT EXISTS hevy_secondary_muscle_groups TEXT[];
