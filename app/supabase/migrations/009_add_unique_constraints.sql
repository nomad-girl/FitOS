-- Add unique constraint for weekly_checkins upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_checkins_user_phase_week_unique'
  ) THEN
    ALTER TABLE weekly_checkins ADD CONSTRAINT weekly_checkins_user_phase_week_unique UNIQUE (user_id, phase_id, week_number);
  END IF;
END $$;

-- Add unique constraint for daily_logs upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_logs_user_date_unique'
  ) THEN
    ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_user_date_unique UNIQUE (user_id, log_date);
  END IF;
END $$;
