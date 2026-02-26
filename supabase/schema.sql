-- BuffNStuff Database Schema
-- Run this in Supabase SQL Editor to set up all tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- EXERCISES
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_muscle_group TEXT NOT NULL,
  secondary_muscles TEXT[] DEFAULT '{}',
  equipment_type TEXT NOT NULL DEFAULT 'barbell',
  movement_pattern TEXT NOT NULL DEFAULT 'push',
  difficulty TEXT NOT NULL DEFAULT 'intermediate',
  instructions TEXT,
  tags TEXT[] DEFAULT '{}',
  source_credit TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System exercises readable by all authenticated users"
  ON exercises FOR SELECT TO authenticated USING (user_id IS NULL);
CREATE POLICY "Users can read own exercises"
  ON exercises FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own exercises"
  ON exercises FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_custom = true);
CREATE POLICY "Users can update own exercises"
  ON exercises FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own exercises"
  ON exercises FOR DELETE TO authenticated USING (user_id = auth.uid());

-- WORKOUT TEMPLATES
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  split_type TEXT NOT NULL DEFAULT 'custom',
  training_style TEXT NOT NULL DEFAULT 'hypertrophy',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own templates"
  ON workout_templates FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- TEMPLATE EXERCISES
CREATE TABLE template_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  target_sets INTEGER NOT NULL DEFAULT 3,
  target_reps INTEGER NOT NULL DEFAULT 10,
  target_weight DECIMAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  set_type TEXT NOT NULL DEFAULT 'working',
  notes TEXT
);

ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD template exercises via template ownership"
  ON template_exercises FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM workout_templates WHERE workout_templates.id = template_exercises.template_id AND workout_templates.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workout_templates WHERE workout_templates.id = template_exercises.template_id AND workout_templates.user_id = auth.uid()));

-- WORKOUT SESSIONS
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  split_type TEXT,
  training_style TEXT,
  notes TEXT,
  mood_energy INTEGER CHECK (mood_energy >= 1 AND mood_energy <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own sessions"
  ON workout_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- WORKOUT SETS
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  weight DECIMAL NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  set_type TEXT NOT NULL DEFAULT 'working',
  rpe_rir INTEGER CHECK (rpe_rir >= 1 AND rpe_rir <= 10),
  is_pr BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD sets via session ownership"
  ON workout_sets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM workout_sessions WHERE workout_sessions.id = workout_sets.session_id AND workout_sessions.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workout_sessions WHERE workout_sessions.id = workout_sets.session_id AND workout_sessions.user_id = auth.uid()));

-- EXERCISE CLIPS
CREATE TABLE exercise_clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  youtube_url TEXT NOT NULL,
  start_seconds DECIMAL NOT NULL DEFAULT 0,
  end_seconds DECIMAL NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  muscle_groups TEXT[] DEFAULT '{}',
  creator_name TEXT,
  clip_type TEXT NOT NULL DEFAULT 'form',
  thumbnail_url TEXT,
  stored_clip_path TEXT,
  is_downloaded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE exercise_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own clips"
  ON exercise_clips FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- NUTRITION LOG
CREATE TABLE nutrition_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_name TEXT NOT NULL,
  food_item TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein_g DECIMAL NOT NULL DEFAULT 0,
  carbs_g DECIMAL NOT NULL DEFAULT 0,
  fats_g DECIMAL NOT NULL DEFAULT 0,
  quantity_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nutrition_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own nutrition logs"
  ON nutrition_log FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- NUTRITION FAVORITES
CREATE TABLE nutrition_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_item TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein_g DECIMAL NOT NULL DEFAULT 0,
  carbs_g DECIMAL NOT NULL DEFAULT 0,
  fats_g DECIMAL NOT NULL DEFAULT 0,
  default_quantity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nutrition_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own nutrition favorites"
  ON nutrition_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- WEIGHT LOG
CREATE TABLE weight_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight DECIMAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own weight logs"
  ON weight_log FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- GOALS
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'custom',
  title TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL,
  current_value DECIMAL NOT NULL DEFAULT 0,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own goals"
  ON goals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- USER BADGES
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB DEFAULT '{}'
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own badges"
  ON user_badges FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own badges"
  ON user_badges FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- EXERCISE ROTATION STATE
CREATE TABLE exercise_rotation_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_group TEXT NOT NULL,
  introduced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_performed_at TIMESTAMPTZ,
  rotation_status TEXT NOT NULL DEFAULT 'active',
  freshness_score DECIMAL NOT NULL DEFAULT 1.0,
  swap_suggested_at TIMESTAMPTZ,
  replacement_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL
);

ALTER TABLE exercise_rotation_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own rotation state"
  ON exercise_rotation_state FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- USER SETTINGS
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  unit_preference TEXT NOT NULL DEFAULT 'lbs',
  daily_calorie_target INTEGER DEFAULT 2500,
  protein_target_g DECIMAL DEFAULT 180,
  carbs_target_g DECIMAL DEFAULT 250,
  fats_target_g DECIMAL DEFAULT 70,
  tdee_estimate INTEGER,
  training_days_per_week INTEGER DEFAULT 4,
  preferred_split TEXT DEFAULT 'ppl',
  rotation_mode TEXT NOT NULL DEFAULT 'suggested',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own settings"
  ON user_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- INDEXES
CREATE INDEX idx_exercises_muscle_group ON exercises(primary_muscle_group);
CREATE INDEX idx_exercises_user_id ON exercises(user_id);
CREATE INDEX idx_workout_sessions_user_date ON workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_workout_sets_session ON workout_sets(session_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX idx_nutrition_log_user_date ON nutrition_log(user_id, date DESC);
CREATE INDEX idx_weight_log_user_date ON weight_log(user_id, date DESC);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_exercise_clips_user ON exercise_clips(user_id);
CREATE INDEX idx_exercise_clips_exercise ON exercise_clips(exercise_id);
CREATE INDEX idx_exercise_rotation_user ON exercise_rotation_state(user_id, muscle_group);
