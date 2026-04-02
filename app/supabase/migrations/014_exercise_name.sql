-- Add exercise_name to executed_exercises for Hevy sync (denormalized)
alter table executed_exercises add column if not exists exercise_name text;
