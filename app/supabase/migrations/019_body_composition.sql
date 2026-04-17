-- Body composition: height in profile, body fat % in weekly check-ins
-- Unlocks FFMI, lean mass, body fat trend calculations

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1);

ALTER TABLE weekly_checkins
  ADD COLUMN IF NOT EXISTS body_fat_pct NUMERIC(4,1);
