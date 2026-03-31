// ─── Supabase Database Types ──────────────────────────────────────────
// Auto-derived from migration files. Keep in sync with SQL schemas.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          calorie_target: number | null
          protein_target: number | null
          carbs_target: number | null
          fat_target: number | null
          step_goal: number | null
          sleep_goal: number | null
          checkin_day: string | null
          training_days_per_week: number | null
          training_since: string | null
          hevy_api_key_encrypted: string | null
          hevy_last_sync_at: string | null
          hevy_sync_status: string | null
          coach_context: string | null
          week_start_day: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          calorie_target?: number | null
          protein_target?: number | null
          carbs_target?: number | null
          fat_target?: number | null
          step_goal?: number | null
          sleep_goal?: number | null
          checkin_day?: string | null
          training_days_per_week?: number | null
          training_since?: string | null
          hevy_api_key_encrypted?: string | null
          hevy_last_sync_at?: string | null
          hevy_sync_status?: string | null
          coach_context?: string | null
          week_start_day?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          calorie_target?: number | null
          protein_target?: number | null
          carbs_target?: number | null
          fat_target?: number | null
          step_goal?: number | null
          sleep_goal?: number | null
          checkin_day?: string | null
          training_days_per_week?: number | null
          training_since?: string | null
          hevy_api_key_encrypted?: string | null
          hevy_last_sync_at?: string | null
          hevy_sync_status?: string | null
          coach_context?: string | null
          week_start_day?: string | null
          updated_at?: string
        }
      }
      exercises: {
        Row: {
          id: string
          name: string
          category: string | null
          equipment: string | null
          is_custom: boolean
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          equipment?: string | null
          is_custom?: boolean
          user_id?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          category?: string | null
          equipment?: string | null
          is_custom?: boolean
          user_id?: string | null
        }
      }
      muscle_groups: {
        Row: {
          id: string
          name: string
          display_name: string | null
          body_region: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name?: string | null
          body_region?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          display_name?: string | null
          body_region?: string | null
        }
      }
      exercise_muscles: {
        Row: {
          id: string
          exercise_id: string
          muscle_group_id: string
          role: string
        }
        Insert: {
          id?: string
          exercise_id: string
          muscle_group_id: string
          role?: string
        }
        Update: {
          exercise_id?: string
          muscle_group_id?: string
          role?: string
        }
      }
      macrocycles: {
        Row: {
          id: string
          user_id: string
          name: string
          year: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          year: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          year?: number
          notes?: string | null
          updated_at?: string
        }
      }
      phases: {
        Row: {
          id: string
          user_id: string
          macrocycle_id: string | null
          name: string
          goal: string
          objective: string | null
          status: string
          duration_weeks: number
          frequency: number
          start_date: string | null
          end_date: string | null
          focus_muscles: string[]
          split_type: string | null
          calorie_target: number | null
          protein_target: number | null
          carbs_target: number | null
          fat_target: number | null
          step_goal: number | null
          sleep_goal: number | null
          entry_criteria: Json
          progress_criteria: Json
          exit_criteria: Json
          custom_exit_notes: string | null
          volume_targets: Json
          notes: string | null
          outcome_notes: string | null
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          macrocycle_id?: string | null
          name: string
          goal?: string
          objective?: string | null
          status?: string
          duration_weeks?: number
          frequency?: number
          start_date?: string | null
          end_date?: string | null
          focus_muscles?: string[]
          split_type?: string | null
          calorie_target?: number | null
          protein_target?: number | null
          carbs_target?: number | null
          fat_target?: number | null
          step_goal?: number | null
          sleep_goal?: number | null
          entry_criteria?: Json
          progress_criteria?: Json
          exit_criteria?: Json
          custom_exit_notes?: string | null
          volume_targets?: Json
          notes?: string | null
          outcome_notes?: string | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          macrocycle_id?: string | null
          name?: string
          goal?: string
          objective?: string | null
          status?: string
          duration_weeks?: number
          frequency?: number
          start_date?: string | null
          end_date?: string | null
          focus_muscles?: string[]
          split_type?: string | null
          calorie_target?: number | null
          protein_target?: number | null
          carbs_target?: number | null
          fat_target?: number | null
          step_goal?: number | null
          sleep_goal?: number | null
          entry_criteria?: Json
          progress_criteria?: Json
          exit_criteria?: Json
          custom_exit_notes?: string | null
          volume_targets?: Json
          notes?: string | null
          outcome_notes?: string | null
          display_order?: number
          updated_at?: string
        }
      }
      routines: {
        Row: {
          id: string
          user_id: string
          phase_id: string
          name: string
          notes: string | null
          display_order: number
          estimated_duration_min: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          phase_id: string
          name: string
          notes?: string | null
          display_order?: number
          estimated_duration_min?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          notes?: string | null
          display_order?: number
          estimated_duration_min?: number | null
          updated_at?: string
        }
      }
      routine_exercises: {
        Row: {
          id: string
          routine_id: string
          exercise_id: string
          display_order: number
          notes: string | null
          rest_seconds: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          routine_id: string
          exercise_id: string
          display_order?: number
          notes?: string | null
          rest_seconds?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          exercise_id?: string
          display_order?: number
          notes?: string | null
          rest_seconds?: number | null
          updated_at?: string
        }
      }
      routine_sets: {
        Row: {
          id: string
          routine_exercise_id: string
          set_number: number
          rep_range_low: number | null
          rep_range_high: number | null
          duration_seconds: number | null
          target_rpe: number | null
          target_weight: number | null
          created_at: string
        }
        Insert: {
          id?: string
          routine_exercise_id: string
          set_number: number
          rep_range_low?: number | null
          rep_range_high?: number | null
          duration_seconds?: number | null
          target_rpe?: number | null
          target_weight?: number | null
          created_at?: string
        }
        Update: {
          set_number?: number
          rep_range_low?: number | null
          rep_range_high?: number | null
          duration_seconds?: number | null
          target_rpe?: number | null
          target_weight?: number | null
        }
      }
      daily_logs: {
        Row: {
          id: string
          user_id: string
          log_date: string
          calories: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          steps: number | null
          sleep_hours: number | null
          energy: number | null
          hunger: number | null
          fatigue_level: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          log_date: string
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          steps?: number | null
          sleep_hours?: number | null
          energy?: number | null
          hunger?: number | null
          fatigue_level?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          log_date?: string
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          steps?: number | null
          sleep_hours?: number | null
          energy?: number | null
          hunger?: number | null
          fatigue_level?: number | null
          notes?: string | null
          updated_at?: string
        }
      }
      fatigue_entries: {
        Row: {
          id: string
          daily_log_id: string
          zone: string
          created_at: string
        }
        Insert: {
          id?: string
          daily_log_id: string
          zone: string
          created_at?: string
        }
        Update: {
          zone?: string
        }
      }
      weekly_checkins: {
        Row: {
          id: string
          user_id: string
          phase_id: string | null
          week_number: number
          checkin_date: string
          weight_kg: number | null
          waist_cm: number | null
          hip_cm: number | null
          thigh_cm: number | null
          performance_trend: string | null
          avg_calories: number | null
          avg_protein: number | null
          avg_steps: number | null
          avg_sleep_hours: number | null
          avg_energy: number | null
          avg_hunger: number | null
          avg_fatigue: number | null
          fatigue_map: Json
          training_sets_planned: number | null
          training_sets_executed: number | null
          training_adherence: number | null
          nutrition_adherence: number | null
          weekly_score: number | null
          score_breakdown: Json
          ai_analysis: string | null
          ai_analysis_raw: Json
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          phase_id?: string | null
          week_number: number
          checkin_date: string
          weight_kg?: number | null
          waist_cm?: number | null
          hip_cm?: number | null
          thigh_cm?: number | null
          performance_trend?: string | null
          avg_calories?: number | null
          avg_protein?: number | null
          avg_steps?: number | null
          avg_sleep_hours?: number | null
          avg_energy?: number | null
          avg_hunger?: number | null
          avg_fatigue?: number | null
          fatigue_map?: Json
          training_sets_planned?: number | null
          training_sets_executed?: number | null
          training_adherence?: number | null
          nutrition_adherence?: number | null
          weekly_score?: number | null
          score_breakdown?: Json
          ai_analysis?: string | null
          ai_analysis_raw?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          phase_id?: string | null
          week_number?: number
          checkin_date?: string
          weight_kg?: number | null
          waist_cm?: number | null
          hip_cm?: number | null
          thigh_cm?: number | null
          performance_trend?: string | null
          avg_calories?: number | null
          avg_protein?: number | null
          avg_steps?: number | null
          avg_sleep_hours?: number | null
          avg_energy?: number | null
          avg_hunger?: number | null
          avg_fatigue?: number | null
          fatigue_map?: Json
          training_sets_planned?: number | null
          training_sets_executed?: number | null
          training_adherence?: number | null
          nutrition_adherence?: number | null
          weekly_score?: number | null
          score_breakdown?: Json
          ai_analysis?: string | null
          ai_analysis_raw?: Json
          notes?: string | null
          updated_at?: string
        }
      }
      weekly_decisions: {
        Row: {
          id: string
          checkin_id: string
          user_id: string
          volume_decisions: string[]
          nutrition_decisions: string[]
          phase_decisions: string[]
          context_snapshot: Json
          ai_recommendation: string | null
          notes: string | null
          outcome: string | null
          created_at: string
        }
        Insert: {
          id?: string
          checkin_id: string
          user_id: string
          volume_decisions?: string[]
          nutrition_decisions?: string[]
          phase_decisions?: string[]
          context_snapshot?: Json
          ai_recommendation?: string | null
          notes?: string | null
          outcome?: string | null
          created_at?: string
        }
        Update: {
          volume_decisions?: string[]
          nutrition_decisions?: string[]
          phase_decisions?: string[]
          context_snapshot?: Json
          ai_recommendation?: string | null
          notes?: string | null
          outcome?: string | null
        }
      }
      insights: {
        Row: {
          id: string
          user_id: string
          phase_id: string | null
          week_number: number | null
          insight_type: string
          severity: string
          title: string
          body: string
          suggestion: string | null
          is_dismissed: boolean
          is_applied: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          phase_id?: string | null
          week_number?: number | null
          insight_type: string
          severity?: string
          title: string
          body: string
          suggestion?: string | null
          is_dismissed?: boolean
          is_applied?: boolean
          created_at?: string
        }
        Update: {
          phase_id?: string | null
          week_number?: number | null
          insight_type?: string
          severity?: string
          title?: string
          body?: string
          suggestion?: string | null
          is_dismissed?: boolean
          is_applied?: boolean
        }
      }
      learn_resources: {
        Row: {
          id: string
          user_id: string
          title: string
          resource_type: string
          source: string | null
          url: string | null
          content: string | null
          tags: string[]
          linked_exercise_ids: string[]
          is_pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          resource_type: string
          source?: string | null
          url?: string | null
          content?: string | null
          tags?: string[]
          linked_exercise_ids?: string[]
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          resource_type?: string
          source?: string | null
          url?: string | null
          content?: string | null
          tags?: string[]
          linked_exercise_ids?: string[]
          is_pinned?: boolean
          updated_at?: string
        }
      }
      exercise_mappings: {
        Row: {
          id: string
          user_id: string
          hevy_exercise_id: string
          hevy_exercise_name: string
          exercise_id: string | null
          is_confirmed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          hevy_exercise_id: string
          hevy_exercise_name: string
          exercise_id?: string | null
          is_confirmed?: boolean
          created_at?: string
        }
        Update: {
          hevy_exercise_name?: string
          exercise_id?: string | null
          is_confirmed?: boolean
        }
      }
      executed_sessions: {
        Row: {
          id: string
          user_id: string
          routine_id: string | null
          phase_id: string | null
          week_number: number | null
          hevy_workout_id: string | null
          session_date: string
          duration_minutes: number | null
          total_volume_kg: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          routine_id?: string | null
          phase_id?: string | null
          week_number?: number | null
          hevy_workout_id?: string | null
          session_date: string
          duration_minutes?: number | null
          total_volume_kg?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          routine_id?: string | null
          phase_id?: string | null
          week_number?: number | null
          hevy_workout_id?: string | null
          session_date?: string
          duration_minutes?: number | null
          total_volume_kg?: number | null
          notes?: string | null
        }
      }
      executed_exercises: {
        Row: {
          id: string
          executed_session_id: string
          exercise_id: string | null
          routine_exercise_id: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          executed_session_id: string
          exercise_id?: string | null
          routine_exercise_id?: string | null
          display_order?: number
          created_at?: string
        }
        Update: {
          exercise_id?: string | null
          routine_exercise_id?: string | null
          display_order?: number
        }
      }
      executed_sets: {
        Row: {
          id: string
          executed_exercise_id: string
          set_number: number
          weight_kg: number | null
          reps: number | null
          rpe: number | null
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          executed_exercise_id: string
          set_number: number
          weight_kg?: number | null
          reps?: number | null
          rpe?: number | null
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          set_number?: number
          weight_kg?: number | null
          reps?: number | null
          rpe?: number | null
          duration_seconds?: number | null
        }
      }
      coach_memories: {
        Row: {
          id: string
          user_id: string
          memory_type: string
          content: string
          context: Json
          relevance_score: number
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          memory_type: string
          content: string
          context?: Json
          relevance_score?: number
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          memory_type?: string
          content?: string
          context?: Json
          relevance_score?: number
          expires_at?: string | null
        }
      }
      coach_analyses: {
        Row: {
          id: string
          user_id: string
          analysis_type: string
          prompt_context: Json
          response: string
          memories_used: string[]
          new_memories: string[]
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          analysis_type: string
          prompt_context?: Json
          response: string
          memories_used?: string[]
          new_memories?: string[]
          created_at?: string
        }
        Update: {
          analysis_type?: string
          prompt_context?: Json
          response?: string
          memories_used?: string[]
          new_memories?: string[]
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─── Convenience aliases ────────────────────────────────────────────
type Tables = Database['public']['Tables']

export type Profile = Tables['profiles']['Row']
export type ProfileUpdate = Tables['profiles']['Update']

export type Exercise = Tables['exercises']['Row']
export type MuscleGroup = Tables['muscle_groups']['Row']
export type ExerciseMuscle = Tables['exercise_muscles']['Row']

export type Macrocycle = Tables['macrocycles']['Row']
export type MacrocycleInsert = Tables['macrocycles']['Insert']

export type Phase = Tables['phases']['Row']
export type PhaseInsert = Tables['phases']['Insert']
export type PhaseUpdate = Tables['phases']['Update']

export type Routine = Tables['routines']['Row']
export type RoutineInsert = Tables['routines']['Insert']

export type RoutineExercise = Tables['routine_exercises']['Row']
export type RoutineExerciseInsert = Tables['routine_exercises']['Insert']

export type RoutineSet = Tables['routine_sets']['Row']
export type RoutineSetInsert = Tables['routine_sets']['Insert']

export type DailyLog = Tables['daily_logs']['Row']
export type DailyLogInsert = Tables['daily_logs']['Insert']

export type FatigueEntry = Tables['fatigue_entries']['Row']

export type WeeklyCheckin = Tables['weekly_checkins']['Row']
export type WeeklyCheckinInsert = Tables['weekly_checkins']['Insert']

export type WeeklyDecision = Tables['weekly_decisions']['Row']
export type WeeklyDecisionInsert = Tables['weekly_decisions']['Insert']

export type Insight = Tables['insights']['Row']
export type InsightInsert = Tables['insights']['Insert']

export type LearnResource = Tables['learn_resources']['Row']
export type LearnResourceInsert = Tables['learn_resources']['Insert']

export type ExerciseMapping = Tables['exercise_mappings']['Row']

export type ExecutedSession = Tables['executed_sessions']['Row']
export type ExecutedExercise = Tables['executed_exercises']['Row']
export type ExecutedSet = Tables['executed_sets']['Row']

export type CoachMemory = Tables['coach_memories']['Row']
export type CoachMemoryInsert = Tables['coach_memories']['Insert']
export type CoachAnalysis = Tables['coach_analyses']['Row']
export type CoachAnalysisInsert = Tables['coach_analyses']['Insert']

// ─── Composite types (with joins) ───────────────────────────────────
export type RoutineExerciseWithSets = RoutineExercise & {
  exercise: Exercise
  routine_sets: RoutineSet[]
}

export type RoutineWithExercises = Routine & {
  routine_exercises: RoutineExerciseWithSets[]
}

export type PhaseWithRoutines = Phase & {
  routines: RoutineWithExercises[]
}

export type ExerciseWithMuscles = Exercise & {
  exercise_muscles: (ExerciseMuscle & { muscle_group: MuscleGroup })[]
}
