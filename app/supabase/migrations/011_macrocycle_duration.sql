-- Add duration_months to macrocycles (default 12 for yearly plans)
ALTER TABLE macrocycles ADD COLUMN IF NOT EXISTS duration_months INTEGER DEFAULT 12;
-- Add week_start_day to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS week_start_day TEXT DEFAULT 'monday';
