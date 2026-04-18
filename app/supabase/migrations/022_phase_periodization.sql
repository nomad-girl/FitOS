-- Per-mesocycle periodization. Each phase can override the global Sistema template
-- with its own week-by-week structure (RPE, RIR, reps, %1RM, volume multiplier).
--
-- Shape (when set):
-- {
--   "blockLength": 4,
--   "weeks": [
--     { "week": 1, "type": "accumulation", "rpe": 7, "rir": 3,
--       "repRange": [10, 15], "pct1rm": [60, 67], "volumeMultiplier": 0.6,
--       "sensation": "Podría más", "note": "" },
--     ...
--   ]
-- }
--
-- When NULL: code falls back to the global template in lib/mesocycle.ts (current behavior).

ALTER TABLE phases
  ADD COLUMN IF NOT EXISTS periodization JSONB DEFAULT NULL;
