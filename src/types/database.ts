// Enums / Union Types
export type MuscleGroup = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "quads" | "hamstrings" | "glutes" | "calves" | "core" | "forearms";
export type EquipmentType = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight" | "band" | "other";
export type MovementPattern = "push" | "pull" | "hinge" | "squat" | "lunge" | "carry" | "isolation";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type SplitType = "push" | "pull" | "legs" | "upper" | "lower" | "full_body" | "custom";
export type TrainingStyle = "hypertrophy" | "strength" | "mixed";
export type SetType = "working" | "warmup" | "dropset" | "failure" | "rest_pause" | "giant_set" | "century";
export type ClipType = "form" | "tip" | "motivation" | "workout";
export type GoalType = "strength" | "body_comp" | "consistency" | "volume" | "nutrition" | "custom";
export type GoalStatus = "active" | "completed" | "abandoned";
export type RotationStatus = "active" | "resting" | "suggested_swap";
export type RotationMode = "manual" | "suggested" | "auto";
export type UnitPreference = "lbs" | "kg";

// Interfaces for each table
export interface Exercise {
  id: string;
  user_id: string | null;
  name: string;
  primary_muscle_group: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment_type: EquipmentType;
  movement_pattern: MovementPattern;
  difficulty: Difficulty;
  instructions: string | null;
  tags: string[];
  source_credit: string | null;
  is_custom: boolean;
  created_at: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  split_type: SplitType;
  training_style: TrainingStyle;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  target_weight: number | null;
  sort_order: number;
  set_type: SetType;
  notes: string | null;
  exercise?: Exercise;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  template_id: string | null;
  started_at: string;
  ended_at: string | null;
  split_type: SplitType | null;
  training_style: TrainingStyle | null;
  notes: string | null;
  mood_energy: number | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  set_type: SetType;
  rpe_rir: number | null;
  is_pr: boolean;
  notes: string | null;
  logged_at: string;
  exercise?: Exercise;
}

export interface ExerciseClip {
  id: string;
  user_id: string;
  exercise_id: string | null;
  youtube_url: string;
  start_seconds: number;
  end_seconds: number;
  title: string;
  muscle_groups: MuscleGroup[];
  creator_name: string | null;
  clip_type: ClipType;
  thumbnail_url: string | null;
  stored_clip_path: string | null;
  is_downloaded: boolean;
  created_at: string;
}

export interface NutritionEntry {
  id: string;
  user_id: string;
  date: string;
  meal_name: string;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  quantity_note: string | null;
  created_at: string;
}

export interface NutritionFavorite {
  id: string;
  user_id: string;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  default_quantity: string | null;
  created_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  date: string;
  weight: number;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  type: GoalType;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  target_date: string | null;
  status: GoalStatus;
  completed_at: string | null;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_type: string;
  earned_at: string;
  context: Record<string, unknown>;
}

export interface ExerciseRotationState {
  id: string;
  user_id: string;
  exercise_id: string;
  muscle_group: MuscleGroup;
  introduced_at: string;
  last_performed_at: string | null;
  rotation_status: RotationStatus;
  freshness_score: number;
  swap_suggested_at: string | null;
  replacement_exercise_id: string | null;
}

export interface UserSettings {
  id: string;
  user_id: string;
  display_name: string | null;
  unit_preference: UnitPreference;
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fats_target_g: number;
  tdee_estimate: number | null;
  training_days_per_week: number;
  preferred_split: string;
  rotation_mode: RotationMode;
  updated_at: string;
}
