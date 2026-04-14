-- Add low hip, resting heart rate, and HRV to weekly check-ins
ALTER TABLE weekly_checkins
  ADD COLUMN IF NOT EXISTS low_hip_cm REAL,
  ADD COLUMN IF NOT EXISTS resting_hr INTEGER,
  ADD COLUMN IF NOT EXISTS hrv INTEGER;
