-- Grant permissions to authenticated users on all app tables
GRANT ALL ON TABLE macrocycles TO authenticated;
GRANT ALL ON TABLE phases TO authenticated;
GRANT ALL ON TABLE routines TO authenticated;
GRANT ALL ON TABLE routine_exercises TO authenticated;
GRANT ALL ON TABLE routine_sets TO authenticated;
GRANT ALL ON TABLE daily_logs TO authenticated;
GRANT ALL ON TABLE fatigue_entries TO authenticated;
GRANT ALL ON TABLE weekly_checkins TO authenticated;
GRANT ALL ON TABLE weekly_decisions TO authenticated;
GRANT ALL ON TABLE insights TO authenticated;
GRANT ALL ON TABLE learn_resources TO authenticated;
GRANT ALL ON TABLE exercise_mappings TO authenticated;
GRANT ALL ON TABLE executed_sessions TO authenticated;
GRANT ALL ON TABLE executed_exercises TO authenticated;
GRANT ALL ON TABLE executed_sets TO authenticated;

-- Also grant to service_role for admin operations
GRANT ALL ON TABLE macrocycles TO service_role;
GRANT ALL ON TABLE phases TO service_role;
GRANT ALL ON TABLE routines TO service_role;
GRANT ALL ON TABLE routine_exercises TO service_role;
GRANT ALL ON TABLE routine_sets TO service_role;
GRANT ALL ON TABLE daily_logs TO service_role;
GRANT ALL ON TABLE fatigue_entries TO service_role;
GRANT ALL ON TABLE weekly_checkins TO service_role;
GRANT ALL ON TABLE weekly_decisions TO service_role;
GRANT ALL ON TABLE insights TO service_role;
GRANT ALL ON TABLE learn_resources TO service_role;
GRANT ALL ON TABLE exercise_mappings TO service_role;
GRANT ALL ON TABLE executed_sessions TO service_role;
GRANT ALL ON TABLE executed_exercises TO service_role;
GRANT ALL ON TABLE executed_sets TO service_role;
