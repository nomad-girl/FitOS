-- Add structured criteria columns to phases for AI evaluation
ALTER TABLE phases
  ADD COLUMN IF NOT EXISTS entry_criteria JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS progress_criteria JSONB DEFAULT '{}';

-- entry_criteria example:
-- {
--   "body_comp": { "weight_kg": 55, "body_fat_pct": 22, "waist_cm": 68 },
--   "readiness": { "energy_min": 3, "hunger_max": 3, "performance": "baseline" },
--   "conditions": ["deload_completed", "weight_stable_2w", "metrics_baselined"],
--   "custom_notes": "..."
-- }

-- progress_criteria example:
-- {
--   "weekly_targets": [
--     { "id": "weight_change", "label": "Cambio de peso", "target": "-0.3 a -0.5 kg/sem", "enabled": true },
--     { "id": "strength", "label": "Fuerza", "target": "mantener o subir", "enabled": true }
--   ],
--   "warning_signs": [
--     { "id": "energy_drop", "label": "Energia baja", "threshold": "≤2/5 por 2+ semanas", "enabled": true }
--   ],
--   "custom_notes": "..."
-- }

-- exit_criteria already exists as JSONB, will be enhanced in the app layer

-- Grant permissions
GRANT ALL ON TABLE phases TO authenticated;
GRANT ALL ON TABLE phases TO service_role;
