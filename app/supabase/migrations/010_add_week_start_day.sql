-- Add week_start_day column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS week_start_day TEXT DEFAULT 'monday';
