-- Add training volume, variant and PR count to daily_logs
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS training_volume_kg numeric,
  ADD COLUMN IF NOT EXISTS training_variant text,
  ADD COLUMN IF NOT EXISTS pr_count integer;
