-- Insights
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,
  week_number INTEGER,
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  suggestion TEXT,
  is_dismissed BOOLEAN DEFAULT FALSE,
  is_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_insights_user_phase ON insights(user_id, phase_id);

-- Learn resources
CREATE TABLE IF NOT EXISTS learn_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  source TEXT,
  url TEXT,
  content TEXT,
  tags TEXT[] DEFAULT '{}',
  linked_exercise_ids UUID[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learn_user ON learn_resources(user_id);

-- RLS
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own insights" ON insights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users CRUD own learn_resources" ON learn_resources FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
