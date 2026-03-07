-- BuffNStuff Database Schema
-- Run this in Supabase SQL Editor to set up all tables
-- Last updated: 2026-03-06 (complete schema through Phase 20)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PHASE 1-3: CORE WORKOUT TRACKING
-- ============================================================================

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

-- ============================================================================
-- PHASE 4-5: NUTRITION & WEIGHT
-- ============================================================================

-- NUTRITION ENTRIES (food log)
CREATE TABLE nutrition_entries (
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

ALTER TABLE nutrition_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own nutrition entries"
  ON nutrition_entries FOR ALL TO authenticated
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

-- WEIGHT ENTRIES
CREATE TABLE weight_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight DECIMAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own weight entries"
  ON weight_entries FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PHASE 6: GOALS & BADGES
-- ============================================================================

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

-- ============================================================================
-- PHASE 7: EXERCISE CLIPS
-- ============================================================================

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

-- ============================================================================
-- PHASE 8: TRAINING INTELLIGENCE
-- ============================================================================

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

-- ============================================================================
-- PHASE 9: SETTINGS
-- ============================================================================

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
  auto_rest_timer BOOLEAN DEFAULT false,
  auto_rest_seconds SMALLINT DEFAULT 90,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own settings"
  ON user_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PHASE 12: NUTRITION ENHANCEMENT (Meal Plans & Fasting)
-- ============================================================================

-- MEAL PLANS
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  eating_window_start TIME,
  eating_window_end TIME,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own meal plans"
  ON meal_plans FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- MEAL PLAN ITEMS
CREATE TABLE meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  meal_name TEXT NOT NULL,
  target_time TIME,
  food_item TEXT NOT NULL,
  calories NUMERIC NOT NULL,
  protein_g NUMERIC NOT NULL,
  carbs_g NUMERIC NOT NULL,
  fats_g NUMERIC NOT NULL,
  serving_size TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD meal plan items via plan ownership"
  ON meal_plan_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.plan_id AND meal_plans.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.plan_id AND meal_plans.user_id = auth.uid()));

-- FASTING SETTINGS
CREATE TABLE fasting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol TEXT NOT NULL,
  target_fast_hours NUMERIC NOT NULL,
  eating_window_start TIME NOT NULL,
  eating_window_end TIME NOT NULL,
  notifications_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fasting_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own fasting settings"
  ON fasting_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- FASTING LOG
CREATE TABLE fasting_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  eating_start TIMESTAMPTZ,
  eating_end TIMESTAMPTZ,
  target_fast_hours NUMERIC NOT NULL,
  achieved_fast_hours NUMERIC,
  hit_target BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fasting_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own fasting log"
  ON fasting_log FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PHASE 14: SOCIAL & COMMUNITY
-- ============================================================================

-- USER PROFILES (public profile data)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]+$' AND length(username) BETWEEN 3 AND 20),
  display_name TEXT,
  bio TEXT CHECK (length(bio) <= 160),
  avatar_url TEXT,
  is_public BOOLEAN DEFAULT false,
  friend_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read public profiles"
  ON user_profiles FOR SELECT TO authenticated USING (is_public = true);
CREATE POLICY "Users can read profiles of accepted followers"
  ON user_profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM follows
    WHERE follows.following_id = user_profiles.id
    AND follows.follower_id = (SELECT id FROM user_profiles up WHERE up.user_id = auth.uid())
    AND follows.status = 'accepted'
  ));
CREATE POLICY "Anyone can search by username or friend_code"
  ON user_profiles FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own profile"
  ON user_profiles FOR DELETE TO authenticated USING (user_id = auth.uid());

-- FOLLOWS (follow relationships with approval)
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see follows involving them"
  ON follows FOR SELECT TO authenticated
  USING (
    follower_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    OR following_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can create follow requests"
  ON follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update follows they received"
  ON follows FOR UPDATE TO authenticated
  USING (following_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete their own follows"
  ON follows FOR DELETE TO authenticated
  USING (follower_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid()));

-- ACTIVITY FEED (feed events)
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own feed events"
  ON activity_feed FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can read own feed events"
  ON activity_feed FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read followed users feed events"
  ON activity_feed FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM follows f
    JOIN user_profiles fp ON fp.id = f.follower_id
    JOIN user_profiles tp ON tp.id = f.following_id
    WHERE fp.user_id = auth.uid()
    AND tp.user_id = activity_feed.user_id
    AND f.status = 'accepted'
  ));

-- REACTIONS (emoji reactions on feed items)
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (activity_id, user_id)
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own reactions"
  ON reactions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can read reactions on visible feed items"
  ON reactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM activity_feed af WHERE af.id = reactions.activity_id
  ));

-- ============================================================================
-- PHASE 15: PROGRAMS, CHALLENGES & NOTIFICATIONS
-- ============================================================================

-- TRAINING PROGRAMS
CREATE TABLE training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_weeks INTEGER NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  goal TEXT CHECK (goal IN ('strength', 'hypertrophy', 'endurance', 'recomp', 'general')),
  days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
  periodization TEXT CHECK (periodization IN ('linear', 'dup', 'block', 'conjugate')),
  schedule JSONB NOT NULL,
  progression_rules JSONB,
  deload_config JSONB,
  is_prebuilt BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prebuilt programs readable by all"
  ON training_programs FOR SELECT TO authenticated USING (is_prebuilt = true);
CREATE POLICY "Users can read own programs"
  ON training_programs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own programs"
  ON training_programs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own programs"
  ON training_programs FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own programs"
  ON training_programs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- PROGRAM ENROLLMENTS
CREATE TABLE program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_week INTEGER DEFAULT 1,
  current_day_index INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  progress_log JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE program_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own enrollments"
  ON program_enrollments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CHALLENGES
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) <= 80),
  description TEXT CHECK (length(description) <= 280),
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('total_volume', 'total_workouts', 'streak', 'total_sets', 'total_reps')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (end_date > start_date),
  CHECK (end_date - start_date <= 90)
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read challenges they participate in or created"
  ON challenges FOR SELECT TO authenticated
  USING (
    creator_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM challenge_participants cp WHERE cp.challenge_id = challenges.id AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own challenges"
  ON challenges FOR INSERT TO authenticated
  WITH CHECK (creator_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Creators can update own challenges"
  ON challenges FOR UPDATE TO authenticated
  USING (creator_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Creators can delete own challenges"
  ON challenges FOR DELETE TO authenticated
  USING (creator_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid()));

-- CHALLENGE PARTICIPANTS
CREATE TABLE challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_score NUMERIC DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can see challenge participants"
  ON challenge_participants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM challenge_participants cp2 WHERE cp2.challenge_id = challenge_participants.challenge_id AND cp2.user_id = auth.uid()
  ));
CREATE POLICY "Users can join challenges"
  ON challenge_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can leave challenges"
  ON challenge_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own participation"
  ON challenge_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- NOTIFICATION PREFERENCES
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_reminders BOOLEAN DEFAULT true,
  social_notifications BOOLEAN DEFAULT true,
  achievement_alerts BOOLEAN DEFAULT true,
  reminder_time TEXT DEFAULT '09:00',
  reminder_days JSONB DEFAULT '[1,3,5]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own notification preferences"
  ON notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- PHASE 18: BODY MEASUREMENTS & PHOTOS
-- ============================================================================

-- BODY MEASUREMENTS
CREATE TABLE body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  neck FLOAT,
  chest FLOAT,
  waist FLOAT,
  hips FLOAT,
  left_bicep FLOAT,
  right_bicep FLOAT,
  left_thigh FLOAT,
  right_thigh FLOAT,
  left_calf FLOAT,
  right_calf FLOAT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own measurements"
  ON body_measurements FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- PROGRESS PHOTOS
CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pose TEXT NOT NULL CHECK (pose IN ('front', 'side', 'back')),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own photos"
  ON progress_photos FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PHASE 19: WORKOUT UX & RECOVERY
-- ============================================================================

-- READINESS CHECK-INS
CREATE TABLE readiness_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES workout_sessions(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_quality SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  soreness SMALLINT CHECK (soreness BETWEEN 1 AND 5),
  energy SMALLINT CHECK (energy BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE readiness_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own readiness checkins"
  ON readiness_checkins FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PHASE 20: CARDIO
-- ============================================================================

CREATE TABLE cardio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('run', 'bike', 'row', 'swim', 'walk')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  distance DECIMAL,
  avg_pace DECIMAL,
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cardio_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own cardio sessions"
  ON cardio_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Core tables
CREATE INDEX idx_exercises_muscle_group ON exercises(primary_muscle_group);
CREATE INDEX idx_exercises_user_id ON exercises(user_id);
CREATE INDEX idx_workout_sessions_user_date ON workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_workout_sets_session ON workout_sets(session_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX idx_nutrition_entries_user_date ON nutrition_entries(user_id, date DESC);
CREATE INDEX idx_weight_entries_user_date ON weight_entries(user_id, date DESC);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_exercise_clips_user ON exercise_clips(user_id);
CREATE INDEX idx_exercise_clips_exercise ON exercise_clips(exercise_id);
CREATE INDEX idx_exercise_rotation_user ON exercise_rotation_state(user_id, muscle_group);

-- Nutrition enhancement
CREATE INDEX idx_meal_plans_user ON meal_plans(user_id);
CREATE INDEX idx_meal_plan_items_plan ON meal_plan_items(plan_id);
CREATE INDEX idx_fasting_settings_user ON fasting_settings(user_id);
CREATE INDEX idx_fasting_log_user_date ON fasting_log(user_id, date DESC);

-- Social
CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_friend_code ON user_profiles(friend_code);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_activity_feed_user_date ON activity_feed(user_id, created_at DESC);
CREATE INDEX idx_reactions_activity ON reactions(activity_id);

-- Programs & challenges
CREATE INDEX idx_training_programs_prebuilt ON training_programs(is_prebuilt) WHERE is_prebuilt = true;
CREATE INDEX idx_training_programs_user ON training_programs(user_id);
CREATE INDEX idx_program_enrollments_user ON program_enrollments(user_id);
CREATE INDEX idx_program_enrollments_status ON program_enrollments(user_id, status);
CREATE INDEX idx_challenges_status ON challenges(status);
CREATE INDEX idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_user ON challenge_participants(user_id);

-- Notifications
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

-- Body measurements & photos
CREATE INDEX idx_body_measurements_user_date ON body_measurements(user_id, date DESC);
CREATE INDEX idx_progress_photos_user_date ON progress_photos(user_id, date DESC);

-- Recovery & cardio
CREATE INDEX idx_readiness_user_date ON readiness_checkins(user_id, date DESC);
CREATE INDEX idx_cardio_user_date ON cardio_sessions(user_id, completed_at DESC);
