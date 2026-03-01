import type {
  TrainingProgram,
  ProgramSchedule,
  ProgramWeek,
  ProgramDay,
  ProgramExercise,
  ProgressionRules,
  DeloadConfig,
} from "@/types/database";
import { createClient } from "@/lib/supabase/client";

// ---------- Seed‑data type (no runtime‑generated fields) ----------
export type PrebuiltProgram = Omit<TrainingProgram, "id" | "user_id" | "created_at">;

// ---------- Helper to reduce boilerplate ----------
function ex(
  name: string,
  sets: number,
  reps: number | string,
  rest_seconds = 120,
  opts?: Partial<ProgramExercise>,
): ProgramExercise {
  return { exercise_id: "", exercise_name: name, sets, reps, rest_seconds, ...opts };
}

function day(day_of_week: number, label: string, exercises: ProgramExercise[], overrides?: ProgramDay["overrides"]): ProgramDay {
  return { day_of_week, template_id: null, label, exercises, ...(overrides ? { overrides } : {}) };
}

function week(week_number: number, label: string, days: ProgramDay[], is_deload = false): ProgramWeek {
  return { week_number, label, days, is_deload };
}

// ================================================================
//  PREBUILT PROGRAMS (14 total)
// ================================================================

export const PREBUILT_PROGRAMS: PrebuiltProgram[] = [
  // ──────────────────────────────────────────────
  // STRENGTH (5)
  // ──────────────────────────────────────────────

  // 1 ─ Starting Strength
  {
    name: "Starting Strength",
    description:
      "Mark Rippetoe's classic novice barbell program. Alternating A/B full-body workouts 3 days per week with linear weight progression every session.",
    duration_weeks: 4,
    difficulty: "beginner",
    goal: "strength",
    days_per_week: 3,
    periodization: "linear",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Workout A", [
            ex("Barbell Squat", 3, 5, 180),
            ex("Barbell Bench Press", 3, 5, 180),
            ex("Barbell Deadlift", 1, 5, 180),
          ]),
          day(3, "Workout B", [
            ex("Barbell Squat", 3, 5, 180),
            ex("Overhead Press", 3, 5, 180),
            ex("Barbell Row", 3, 5, 180),
          ]),
          day(5, "Workout A", [
            ex("Barbell Squat", 3, 5, 180),
            ex("Barbell Bench Press", 3, 5, 180),
            ex("Barbell Deadlift", 1, 5, 180),
          ]),
        ]),
        week(2, "Week 2", [
          day(1, "Workout B", [
            ex("Barbell Squat", 3, 5, 180),
            ex("Overhead Press", 3, 5, 180),
            ex("Barbell Row", 3, 5, 180),
          ]),
          day(3, "Workout A", [
            ex("Barbell Squat", 3, 5, 180),
            ex("Barbell Bench Press", 3, 5, 180),
            ex("Barbell Deadlift", 1, 5, 180),
          ]),
          day(5, "Workout B", [
            ex("Barbell Squat", 3, 5, 180),
            ex("Overhead Press", 3, 5, 180),
            ex("Barbell Row", 3, 5, 180),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_weight",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 5,
      failure_protocol: "Repeat weight next session; deload 10% after 3 consecutive failures",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 4, volume_reduction: 0.4, intensity_reduction: 0.1 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 2 ─ GZCLP
  {
    name: "GZCLP",
    description:
      "Cody Lefever's GZCL linear progression. Tiered structure: T1 heavy compound (5x3), T2 moderate secondary (3x10), T3 light accessory (3x15). Great for early‑intermediate lifters.",
    duration_weeks: 4,
    difficulty: "beginner",
    goal: "strength",
    days_per_week: 3,
    periodization: "linear",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Day 1 – Squat / Bench", [
            ex("Barbell Squat", 5, 3, 180, { notes: "T1" }),
            ex("Barbell Bench Press", 3, 10, 120, { notes: "T2" }),
            ex("Lat Pulldown", 3, 15, 60, { notes: "T3" }),
          ]),
          day(3, "Day 2 – OHP / Deadlift", [
            ex("Overhead Press", 5, 3, 180, { notes: "T1" }),
            ex("Barbell Deadlift", 3, 10, 120, { notes: "T2" }),
            ex("Dumbbell Row", 3, 15, 60, { notes: "T3" }),
          ]),
          day(5, "Day 3 – Bench / Squat", [
            ex("Barbell Bench Press", 5, 3, 180, { notes: "T1" }),
            ex("Barbell Squat", 3, 10, 120, { notes: "T2" }),
            ex("Lat Pulldown", 3, 15, 60, { notes: "T3" }),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_weight",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 5,
      failure_protocol: "Move T1 to 6x2, then 10x1; reset and add weight. T2 drops reps, T3 adds reps.",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 4, volume_reduction: 0.4, intensity_reduction: 0.1 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 3 ─ 5/3/1 BBB (Boring But Big)
  {
    name: "5/3/1 BBB",
    description:
      "Jim Wendler's 5/3/1 with Boring But Big assistance. 4‑week mesocycle: week 1 (5s), week 2 (3s), week 3 (5/3/1), week 4 (deload). 5x10 supplemental at 50% TM after main lifts.",
    duration_weeks: 4,
    difficulty: "intermediate",
    goal: "strength",
    days_per_week: 4,
    periodization: "dup",
    schedule: {
      weeks: [
        // Week 1 — 5s week (65/75/85%)
        week(1, "Week 1 – 5s", [
          day(1, "OHP Day", [
            ex("Overhead Press", 3, 5, 180, { notes: "65% x5, 75% x5, 85% x5+" }),
            ex("Overhead Press", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Lat Pulldown", 5, 10, 60),
          ]),
          day(2, "Deadlift Day", [
            ex("Barbell Deadlift", 3, 5, 180, { notes: "65% x5, 75% x5, 85% x5+" }),
            ex("Barbell Deadlift", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Hanging Leg Raise", 5, 15, 60),
          ]),
          day(4, "Bench Day", [
            ex("Barbell Bench Press", 3, 5, 180, { notes: "65% x5, 75% x5, 85% x5+" }),
            ex("Barbell Bench Press", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Dumbbell Row", 5, 10, 60),
          ]),
          day(5, "Squat Day", [
            ex("Barbell Squat", 3, 5, 180, { notes: "65% x5, 75% x5, 85% x5+" }),
            ex("Barbell Squat", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Leg Curl", 5, 10, 60),
          ]),
        ]),
        // Week 2 — 3s week (70/80/90%)
        week(2, "Week 2 – 3s", [
          day(1, "OHP Day", [
            ex("Overhead Press", 3, 3, 180, { notes: "70% x3, 80% x3, 90% x3+" }),
            ex("Overhead Press", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Lat Pulldown", 5, 10, 60),
          ]),
          day(2, "Deadlift Day", [
            ex("Barbell Deadlift", 3, 3, 180, { notes: "70% x3, 80% x3, 90% x3+" }),
            ex("Barbell Deadlift", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Hanging Leg Raise", 5, 15, 60),
          ]),
          day(4, "Bench Day", [
            ex("Barbell Bench Press", 3, 3, 180, { notes: "70% x3, 80% x3, 90% x3+" }),
            ex("Barbell Bench Press", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Dumbbell Row", 5, 10, 60),
          ]),
          day(5, "Squat Day", [
            ex("Barbell Squat", 3, 3, 180, { notes: "70% x3, 80% x3, 90% x3+" }),
            ex("Barbell Squat", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Leg Curl", 5, 10, 60),
          ]),
        ]),
        // Week 3 — 5/3/1 week (75/85/95%)
        week(3, "Week 3 – 5/3/1", [
          day(1, "OHP Day", [
            ex("Overhead Press", 3, "5/3/1", 180, { notes: "75% x5, 85% x3, 95% x1+" }),
            ex("Overhead Press", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Lat Pulldown", 5, 10, 60),
          ]),
          day(2, "Deadlift Day", [
            ex("Barbell Deadlift", 3, "5/3/1", 180, { notes: "75% x5, 85% x3, 95% x1+" }),
            ex("Barbell Deadlift", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Hanging Leg Raise", 5, 15, 60),
          ]),
          day(4, "Bench Day", [
            ex("Barbell Bench Press", 3, "5/3/1", 180, { notes: "75% x5, 85% x3, 95% x1+" }),
            ex("Barbell Bench Press", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Dumbbell Row", 5, 10, 60),
          ]),
          day(5, "Squat Day", [
            ex("Barbell Squat", 3, "5/3/1", 180, { notes: "75% x5, 85% x3, 95% x1+" }),
            ex("Barbell Squat", 5, 10, 90, { notes: "BBB sets @ 50% TM" }),
            ex("Leg Curl", 5, 10, 60),
          ]),
        ]),
        // Week 4 — Deload (40/50/60%)
        week(4, "Week 4 – Deload", [
          day(1, "OHP Day", [
            ex("Overhead Press", 3, 5, 120, { notes: "40% x5, 50% x5, 60% x5" }),
            ex("Lat Pulldown", 3, 10, 60),
          ]),
          day(2, "Deadlift Day", [
            ex("Barbell Deadlift", 3, 5, 120, { notes: "40% x5, 50% x5, 60% x5" }),
            ex("Hanging Leg Raise", 3, 10, 60),
          ]),
          day(4, "Bench Day", [
            ex("Barbell Bench Press", 3, 5, 120, { notes: "40% x5, 50% x5, 60% x5" }),
            ex("Dumbbell Row", 3, 10, 60),
          ]),
          day(5, "Squat Day", [
            ex("Barbell Squat", 3, 5, 120, { notes: "40% x5, 50% x5, 60% x5" }),
            ex("Leg Curl", 3, 10, 60),
          ]),
        ], true),
      ],
    } as ProgramSchedule,
    progression_rules: {
      type: "percentage",
      percentage_increase: 2.5,
      compound_increment_lbs: 5,
      failure_protocol: "Reduce TM by 10% and restart cycle",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 4, volume_reduction: 0.5, intensity_reduction: 0.4 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 4 ─ nSuns 5/3/1 LP
  {
    name: "nSuns 5/3/1 LP",
    description:
      "High‑volume linear progression based on 5/3/1 rep schemes. 5 days per week with a primary and secondary compound each day, 8‑9 working sets on the main lift.",
    duration_weeks: 4,
    difficulty: "intermediate",
    goal: "strength",
    days_per_week: 5,
    periodization: "linear",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Bench + OHP", [
            ex("Barbell Bench Press", 9, "5/3/1", 150, { notes: "T1 – 8-9 sets, varying %TM" }),
            ex("Overhead Press", 8, "5/3/1", 120, { notes: "T2 – complementary sets" }),
            ex("Dumbbell Row", 3, 10, 60),
            ex("Face Pull", 3, 15, 45),
          ]),
          day(2, "Squat + Sumo Deadlift", [
            ex("Barbell Squat", 9, "5/3/1", 180, { notes: "T1 – 8-9 sets, varying %TM" }),
            ex("Sumo Deadlift", 8, "5/3/1", 150, { notes: "T2 – complementary sets" }),
            ex("Leg Press", 3, 10, 90),
            ex("Leg Curl", 3, 12, 60),
          ]),
          day(3, "OHP + Incline Bench", [
            ex("Overhead Press", 9, "5/3/1", 150, { notes: "T1 – 8-9 sets, varying %TM" }),
            ex("Incline Bench Press", 8, "5/3/1", 120, { notes: "T2 – complementary sets" }),
            ex("Lat Pulldown", 3, 10, 60),
            ex("Face Pull", 3, 15, 45),
          ]),
          day(4, "Deadlift + Front Squat", [
            ex("Barbell Deadlift", 9, "5/3/1", 180, { notes: "T1 – 8-9 sets, varying %TM" }),
            ex("Front Squat", 8, "5/3/1", 150, { notes: "T2 – complementary sets" }),
            ex("Barbell Row", 3, 10, 90),
            ex("Hanging Leg Raise", 3, 15, 60),
          ]),
          day(5, "Bench + Close‑Grip Bench", [
            ex("Barbell Bench Press", 9, "5/3/1", 150, { notes: "T1 – 8-9 sets, varying %TM" }),
            ex("Close-Grip Bench Press", 8, "5/3/1", 120, { notes: "T2 – complementary sets" }),
            ex("Dumbbell Row", 3, 10, 60),
            ex("Barbell Curl", 3, 12, 60),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_weight",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 5,
      failure_protocol: "Reduce TM by 10% on missed AMRAP targets",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 6, volume_reduction: 0.4, intensity_reduction: 0.15 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 5 ─ Conjugate Method
  {
    name: "Conjugate Method",
    description:
      "Westside Barbell‑style conjugate periodization. Max Effort and Dynamic Effort upper/lower splits. Rotate ME exercises every 1‑3 weeks to avoid accommodation.",
    duration_weeks: 4,
    difficulty: "advanced",
    goal: "strength",
    days_per_week: 4,
    periodization: "conjugate",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Max Effort Upper", [
            ex("Floor Press", 1, 1, 240, { notes: "Work up to 1RM; rotate exercise each 1‑3 weeks" }),
            ex("Dumbbell Bench Press", 4, 8, 90),
            ex("Barbell Row", 4, 8, 90),
            ex("Tricep Pushdown", 4, 12, 60),
            ex("Face Pull", 3, 15, 45),
          ]),
          day(2, "Max Effort Lower", [
            ex("Box Squat", 1, 1, 240, { notes: "Work up to 1RM; rotate exercise each 1‑3 weeks" }),
            ex("Romanian Deadlift", 4, 8, 120),
            ex("Barbell Hip Thrust", 4, 10, 90),
            ex("Leg Curl", 4, 12, 60),
            ex("Cable Crunch", 3, 15, 60),
          ]),
          day(4, "Dynamic Effort Upper", [
            ex("Barbell Bench Press", 9, 3, 60, { notes: "50‑60% 1RM, max bar speed, 30‑45s rest" }),
            ex("Overhead Press", 3, 8, 90),
            ex("Lat Pulldown", 4, 10, 60),
            ex("Dumbbell Fly", 3, 12, 60),
            ex("Hammer Curl", 3, 12, 45),
          ]),
          day(5, "Dynamic Effort Lower", [
            ex("Barbell Squat", 12, 2, 60, { notes: "50‑60% 1RM, box or free, max bar speed" }),
            ex("Barbell Deadlift", 8, 1, 60, { notes: "60‑70% 1RM, speed pulls" }),
            ex("Reverse Lunge", 3, 10, 90),
            ex("Glute Ham Raise", 4, 10, 60),
            ex("Cable Crunch", 3, 15, 60),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "wave",
      compound_increment_lbs: 5,
      failure_protocol: "Rotate to a different ME variation; re-test in 3 weeks",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 4, volume_reduction: 0.3, intensity_reduction: 0.2 } as DeloadConfig,
    is_prebuilt: true,
  },

  // ──────────────────────────────────────────────
  // HYPERTROPHY (6)
  // ──────────────────────────────────────────────

  // 6 ─ PPL Classic
  {
    name: "PPL Classic",
    description:
      "Push/Pull/Legs split run twice per week (6 days). Ideal for intermediate lifters focused on muscle growth with balanced volume across all muscle groups.",
    duration_weeks: 5,
    difficulty: "intermediate",
    goal: "hypertrophy",
    days_per_week: 6,
    periodization: "linear",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Push A", [
            ex("Barbell Bench Press", 4, 8, 120),
            ex("Overhead Press", 3, 10, 90),
            ex("Incline Dumbbell Press", 3, 12, 90),
            ex("Tricep Pushdown", 3, 12, 60),
            ex("Overhead Tricep Extension", 3, 12, 60),
          ]),
          day(2, "Pull A", [
            ex("Barbell Row", 4, 8, 120),
            ex("Pull-Up", 3, 8, 90),
            ex("Face Pull", 3, 15, 45),
            ex("Barbell Curl", 3, 10, 60),
            ex("Hammer Curl", 3, 12, 60),
          ]),
          day(3, "Legs A", [
            ex("Barbell Squat", 4, 8, 150),
            ex("Romanian Deadlift", 3, 10, 120),
            ex("Leg Press", 3, 12, 90),
            ex("Leg Curl", 3, 12, 60),
            ex("Standing Calf Raise", 4, 15, 45),
          ]),
          day(4, "Push B", [
            ex("Overhead Press", 4, 8, 120),
            ex("Dumbbell Bench Press", 3, 10, 90),
            ex("Cable Fly", 3, 12, 60),
            ex("Lateral Raise", 3, 15, 45),
            ex("Tricep Pushdown", 3, 12, 60),
          ]),
          day(5, "Pull B", [
            ex("Pull-Up", 4, 8, 120),
            ex("Seated Cable Row", 3, 10, 90),
            ex("Face Pull", 3, 15, 45),
            ex("Dumbbell Curl", 3, 10, 60),
            ex("Hammer Curl", 3, 12, 60),
          ]),
          day(6, "Legs B", [
            ex("Front Squat", 4, 8, 150),
            ex("Barbell Hip Thrust", 3, 10, 120),
            ex("Leg Extension", 3, 12, 60),
            ex("Leg Curl", 3, 12, 60),
            ex("Standing Calf Raise", 4, 15, 45),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_reps",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 2.5,
      failure_protocol: "Hit top of rep range for all sets before increasing weight",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 5, volume_reduction: 0.4, intensity_reduction: 0.15 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 7 ─ PHUL
  {
    name: "PHUL",
    description:
      "Power Hypertrophy Upper Lower. 4 days per week combining heavy compound power work (3‑5 reps) with hypertrophy‑focused volume (8‑12 reps).",
    duration_weeks: 6,
    difficulty: "intermediate",
    goal: "hypertrophy",
    days_per_week: 4,
    periodization: "dup",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Upper Power", [
            ex("Barbell Bench Press", 4, 5, 180),
            ex("Barbell Row", 4, 5, 150),
            ex("Overhead Press", 3, 5, 150),
            ex("Pull-Up", 3, 5, 120),
            ex("Barbell Curl", 2, 8, 60),
            ex("Tricep Dip", 2, 8, 90),
          ]),
          day(2, "Lower Power", [
            ex("Barbell Squat", 4, 5, 180),
            ex("Barbell Deadlift", 3, 5, 180),
            ex("Leg Press", 3, 5, 150),
            ex("Leg Curl", 3, 8, 90),
            ex("Standing Calf Raise", 4, 8, 60),
          ]),
          day(4, "Upper Hypertrophy", [
            ex("Incline Dumbbell Press", 4, 10, 90),
            ex("Seated Cable Row", 4, 10, 90),
            ex("Dumbbell Lateral Raise", 3, 12, 60),
            ex("Cable Fly", 3, 12, 60),
            ex("Dumbbell Curl", 3, 12, 60),
            ex("Overhead Tricep Extension", 3, 12, 60),
          ]),
          day(5, "Lower Hypertrophy", [
            ex("Front Squat", 4, 10, 120),
            ex("Romanian Deadlift", 4, 10, 120),
            ex("Leg Extension", 3, 12, 60),
            ex("Leg Curl", 3, 12, 60),
            ex("Standing Calf Raise", 4, 15, 45),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_weight",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 2.5,
      failure_protocol: "Stall on power day: reset 10%. Stall on hypertrophy: add 1 rep per set next session.",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 6, volume_reduction: 0.4, intensity_reduction: 0.15 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 8 ─ PHAT
  {
    name: "PHAT",
    description:
      "Layne Norton's Power Hypertrophy Adaptive Training. 5 days: 2 power days (upper/lower) followed by 3 hypertrophy days (back/shoulders, chest/arms, legs).",
    duration_weeks: 5,
    difficulty: "advanced",
    goal: "hypertrophy",
    days_per_week: 5,
    periodization: "dup",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Upper Power", [
            ex("Barbell Row", 3, 5, 180),
            ex("Pull-Up", 2, 8, 120),
            ex("Barbell Bench Press", 3, 5, 180),
            ex("Dumbbell Bench Press", 2, 8, 120),
            ex("Overhead Press", 3, 8, 120),
            ex("Barbell Curl", 3, 8, 60),
            ex("Tricep Pushdown", 3, 8, 60),
          ]),
          day(2, "Lower Power", [
            ex("Barbell Squat", 3, 5, 180),
            ex("Barbell Deadlift", 2, 5, 180),
            ex("Leg Press", 2, 8, 150),
            ex("Leg Curl", 3, 8, 90),
            ex("Standing Calf Raise", 3, 8, 60),
          ]),
          day(4, "Back & Shoulders Hypertrophy", [
            ex("Barbell Row", 6, 3, 60, { notes: "Speed work @ 65‑70%" }),
            ex("Seated Cable Row", 3, 12, 60),
            ex("Dumbbell Row", 2, 15, 60),
            ex("Lat Pulldown", 3, 12, 60),
            ex("Overhead Press", 3, 12, 90),
            ex("Dumbbell Lateral Raise", 3, 15, 45),
          ]),
          day(5, "Chest & Arms Hypertrophy", [
            ex("Barbell Bench Press", 6, 3, 60, { notes: "Speed work @ 65‑70%" }),
            ex("Incline Dumbbell Press", 3, 12, 90),
            ex("Cable Fly", 3, 15, 60),
            ex("Preacher Curl", 3, 12, 60),
            ex("Overhead Tricep Extension", 3, 12, 60),
            ex("Hammer Curl", 2, 15, 45),
          ]),
          day(6, "Legs Hypertrophy", [
            ex("Barbell Squat", 6, 3, 60, { notes: "Speed work @ 65‑70%" }),
            ex("Leg Press", 3, 12, 90),
            ex("Leg Extension", 3, 15, 60),
            ex("Romanian Deadlift", 3, 12, 90),
            ex("Leg Curl", 3, 15, 60),
            ex("Standing Calf Raise", 4, 12, 45),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_weight",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 2.5,
      failure_protocol: "Reset weight by 10% on power movements; add reps first on hypertrophy days",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 5, volume_reduction: 0.4, intensity_reduction: 0.15 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 9 ─ RP Mesocycle (Renaissance Periodization style)
  {
    name: "RP Mesocycle",
    description:
      "Renaissance Periodization‑style block mesocycle. PPL + Upper + Lower across 5 days. Volume ramps from MEV (~2 working sets) to MRV (~4‑5 sets) over 4 weeks, then a week‑5 deload.",
    duration_weeks: 5,
    difficulty: "intermediate",
    goal: "hypertrophy",
    days_per_week: 5,
    periodization: "block",
    schedule: {
      weeks: [
        // Week 1 — MEV (Minimum Effective Volume)
        week(1, "Week 1 – MEV", [
          day(1, "Push", [
            ex("Barbell Bench Press", 2, 10, 120, { rpe_target: 7 }),
            ex("Overhead Press", 2, 10, 90, { rpe_target: 7 }),
            ex("Cable Fly", 2, 12, 60, { rpe_target: 7 }),
            ex("Lateral Raise", 2, 15, 45, { rpe_target: 7 }),
            ex("Tricep Pushdown", 2, 12, 60, { rpe_target: 7 }),
          ]),
          day(2, "Pull", [
            ex("Barbell Row", 2, 10, 120, { rpe_target: 7 }),
            ex("Pull-Up", 2, 8, 90, { rpe_target: 7 }),
            ex("Face Pull", 2, 15, 45, { rpe_target: 7 }),
            ex("Barbell Curl", 2, 10, 60, { rpe_target: 7 }),
          ]),
          day(3, "Legs", [
            ex("Barbell Squat", 2, 10, 150, { rpe_target: 7 }),
            ex("Romanian Deadlift", 2, 10, 120, { rpe_target: 7 }),
            ex("Leg Press", 2, 12, 90, { rpe_target: 7 }),
            ex("Leg Curl", 2, 12, 60, { rpe_target: 7 }),
            ex("Standing Calf Raise", 2, 15, 45, { rpe_target: 7 }),
          ]),
          day(4, "Upper", [
            ex("Incline Dumbbell Press", 2, 10, 90, { rpe_target: 7 }),
            ex("Seated Cable Row", 2, 10, 90, { rpe_target: 7 }),
            ex("Dumbbell Lateral Raise", 2, 15, 45, { rpe_target: 7 }),
            ex("Dumbbell Curl", 2, 12, 60, { rpe_target: 7 }),
            ex("Overhead Tricep Extension", 2, 12, 60, { rpe_target: 7 }),
          ]),
          day(5, "Lower", [
            ex("Front Squat", 2, 10, 150, { rpe_target: 7 }),
            ex("Barbell Hip Thrust", 2, 10, 120, { rpe_target: 7 }),
            ex("Leg Extension", 2, 12, 60, { rpe_target: 7 }),
            ex("Leg Curl", 2, 12, 60, { rpe_target: 7 }),
            ex("Standing Calf Raise", 2, 15, 45, { rpe_target: 7 }),
          ]),
        ]),
        // Week 2 — Moderate Volume
        week(2, "Week 2 – Moderate Volume", [
          day(1, "Push", [
            ex("Barbell Bench Press", 3, 10, 120, { rpe_target: 8 }),
            ex("Overhead Press", 3, 10, 90, { rpe_target: 8 }),
            ex("Cable Fly", 3, 12, 60, { rpe_target: 8 }),
            ex("Lateral Raise", 3, 15, 45, { rpe_target: 8 }),
            ex("Tricep Pushdown", 3, 12, 60, { rpe_target: 8 }),
          ]),
          day(2, "Pull", [
            ex("Barbell Row", 3, 10, 120, { rpe_target: 8 }),
            ex("Pull-Up", 3, 8, 90, { rpe_target: 8 }),
            ex("Face Pull", 3, 15, 45, { rpe_target: 8 }),
            ex("Barbell Curl", 3, 10, 60, { rpe_target: 8 }),
          ]),
          day(3, "Legs", [
            ex("Barbell Squat", 3, 10, 150, { rpe_target: 8 }),
            ex("Romanian Deadlift", 3, 10, 120, { rpe_target: 8 }),
            ex("Leg Press", 3, 12, 90, { rpe_target: 8 }),
            ex("Leg Curl", 3, 12, 60, { rpe_target: 8 }),
            ex("Standing Calf Raise", 3, 15, 45, { rpe_target: 8 }),
          ]),
          day(4, "Upper", [
            ex("Incline Dumbbell Press", 3, 10, 90, { rpe_target: 8 }),
            ex("Seated Cable Row", 3, 10, 90, { rpe_target: 8 }),
            ex("Dumbbell Lateral Raise", 3, 15, 45, { rpe_target: 8 }),
            ex("Dumbbell Curl", 3, 12, 60, { rpe_target: 8 }),
            ex("Overhead Tricep Extension", 3, 12, 60, { rpe_target: 8 }),
          ]),
          day(5, "Lower", [
            ex("Front Squat", 3, 10, 150, { rpe_target: 8 }),
            ex("Barbell Hip Thrust", 3, 10, 120, { rpe_target: 8 }),
            ex("Leg Extension", 3, 12, 60, { rpe_target: 8 }),
            ex("Leg Curl", 3, 12, 60, { rpe_target: 8 }),
            ex("Standing Calf Raise", 3, 15, 45, { rpe_target: 8 }),
          ]),
        ]),
        // Week 3 — High Volume
        week(3, "Week 3 – High Volume", [
          day(1, "Push", [
            ex("Barbell Bench Press", 4, 10, 120, { rpe_target: 8.5 }),
            ex("Overhead Press", 4, 10, 90, { rpe_target: 8.5 }),
            ex("Cable Fly", 4, 12, 60, { rpe_target: 8.5 }),
            ex("Lateral Raise", 4, 15, 45, { rpe_target: 8.5 }),
            ex("Tricep Pushdown", 3, 12, 60, { rpe_target: 8.5 }),
          ]),
          day(2, "Pull", [
            ex("Barbell Row", 4, 10, 120, { rpe_target: 8.5 }),
            ex("Pull-Up", 4, 8, 90, { rpe_target: 8.5 }),
            ex("Face Pull", 4, 15, 45, { rpe_target: 8.5 }),
            ex("Barbell Curl", 3, 10, 60, { rpe_target: 8.5 }),
          ]),
          day(3, "Legs", [
            ex("Barbell Squat", 4, 10, 150, { rpe_target: 8.5 }),
            ex("Romanian Deadlift", 4, 10, 120, { rpe_target: 8.5 }),
            ex("Leg Press", 3, 12, 90, { rpe_target: 8.5 }),
            ex("Leg Curl", 3, 12, 60, { rpe_target: 8.5 }),
            ex("Standing Calf Raise", 4, 15, 45, { rpe_target: 8.5 }),
          ]),
          day(4, "Upper", [
            ex("Incline Dumbbell Press", 4, 10, 90, { rpe_target: 8.5 }),
            ex("Seated Cable Row", 4, 10, 90, { rpe_target: 8.5 }),
            ex("Dumbbell Lateral Raise", 4, 15, 45, { rpe_target: 8.5 }),
            ex("Dumbbell Curl", 3, 12, 60, { rpe_target: 8.5 }),
            ex("Overhead Tricep Extension", 3, 12, 60, { rpe_target: 8.5 }),
          ]),
          day(5, "Lower", [
            ex("Front Squat", 4, 10, 150, { rpe_target: 8.5 }),
            ex("Barbell Hip Thrust", 4, 10, 120, { rpe_target: 8.5 }),
            ex("Leg Extension", 3, 12, 60, { rpe_target: 8.5 }),
            ex("Leg Curl", 3, 12, 60, { rpe_target: 8.5 }),
            ex("Standing Calf Raise", 4, 15, 45, { rpe_target: 8.5 }),
          ]),
        ]),
        // Week 4 — MRV (Maximum Recoverable Volume)
        week(4, "Week 4 – MRV Overreach", [
          day(1, "Push", [
            ex("Barbell Bench Press", 5, 10, 120, { rpe_target: 9 }),
            ex("Overhead Press", 4, 10, 90, { rpe_target: 9 }),
            ex("Cable Fly", 4, 12, 60, { rpe_target: 9 }),
            ex("Lateral Raise", 4, 15, 45, { rpe_target: 9 }),
            ex("Tricep Pushdown", 4, 12, 60, { rpe_target: 9 }),
          ]),
          day(2, "Pull", [
            ex("Barbell Row", 5, 10, 120, { rpe_target: 9 }),
            ex("Pull-Up", 4, 8, 90, { rpe_target: 9 }),
            ex("Face Pull", 4, 15, 45, { rpe_target: 9 }),
            ex("Barbell Curl", 4, 10, 60, { rpe_target: 9 }),
          ]),
          day(3, "Legs", [
            ex("Barbell Squat", 5, 10, 150, { rpe_target: 9 }),
            ex("Romanian Deadlift", 4, 10, 120, { rpe_target: 9 }),
            ex("Leg Press", 4, 12, 90, { rpe_target: 9 }),
            ex("Leg Curl", 4, 12, 60, { rpe_target: 9 }),
            ex("Standing Calf Raise", 4, 15, 45, { rpe_target: 9 }),
          ]),
          day(4, "Upper", [
            ex("Incline Dumbbell Press", 5, 10, 90, { rpe_target: 9 }),
            ex("Seated Cable Row", 4, 10, 90, { rpe_target: 9 }),
            ex("Dumbbell Lateral Raise", 4, 15, 45, { rpe_target: 9 }),
            ex("Dumbbell Curl", 4, 12, 60, { rpe_target: 9 }),
            ex("Overhead Tricep Extension", 4, 12, 60, { rpe_target: 9 }),
          ]),
          day(5, "Lower", [
            ex("Front Squat", 5, 10, 150, { rpe_target: 9 }),
            ex("Barbell Hip Thrust", 4, 10, 120, { rpe_target: 9 }),
            ex("Leg Extension", 4, 12, 60, { rpe_target: 9 }),
            ex("Leg Curl", 4, 12, 60, { rpe_target: 9 }),
            ex("Standing Calf Raise", 4, 15, 45, { rpe_target: 9 }),
          ]),
        ]),
        // Week 5 — Deload
        week(5, "Week 5 – Deload", [
          day(1, "Push", [
            ex("Barbell Bench Press", 2, 10, 120, { rpe_target: 5 }),
            ex("Overhead Press", 2, 10, 90, { rpe_target: 5 }),
            ex("Cable Fly", 2, 12, 60, { rpe_target: 5 }),
          ]),
          day(2, "Pull", [
            ex("Barbell Row", 2, 10, 120, { rpe_target: 5 }),
            ex("Pull-Up", 2, 8, 90, { rpe_target: 5 }),
            ex("Face Pull", 2, 15, 45, { rpe_target: 5 }),
          ]),
          day(3, "Legs", [
            ex("Barbell Squat", 2, 10, 150, { rpe_target: 5 }),
            ex("Romanian Deadlift", 2, 10, 120, { rpe_target: 5 }),
            ex("Leg Curl", 2, 12, 60, { rpe_target: 5 }),
          ]),
          day(4, "Upper", [
            ex("Incline Dumbbell Press", 2, 10, 90, { rpe_target: 5 }),
            ex("Seated Cable Row", 2, 10, 90, { rpe_target: 5 }),
          ]),
          day(5, "Lower", [
            ex("Front Squat", 2, 10, 150, { rpe_target: 5 }),
            ex("Barbell Hip Thrust", 2, 10, 120, { rpe_target: 5 }),
          ]),
        ], true),
      ],
    } as ProgramSchedule,
    progression_rules: {
      type: "volume_ramp",
      rpe_target: 8,
      failure_protocol: "Reduce sets to previous week; keep weight the same",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 5, volume_reduction: 0.5, intensity_reduction: 0.3 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 10 ─ German Volume Training
  {
    name: "German Volume Training",
    description:
      "Classic 10x10 hypertrophy protocol at 60% 1RM with 60‑second rest periods. Upper/Lower split across 4 days. Brutally effective for muscle growth.",
    duration_weeks: 6,
    difficulty: "intermediate",
    goal: "hypertrophy",
    days_per_week: 4,
    periodization: "linear",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Chest & Back", [
            ex("Barbell Bench Press", 10, 10, 60, { notes: "60% 1RM, strict 60s rest" }),
            ex("Barbell Row", 10, 10, 60, { notes: "60% 1RM, strict 60s rest" }),
            ex("Cable Fly", 3, 12, 60),
            ex("Face Pull", 3, 12, 60),
          ]),
          day(2, "Legs & Abs", [
            ex("Barbell Squat", 10, 10, 60, { notes: "60% 1RM, strict 60s rest" }),
            ex("Leg Curl", 10, 10, 60, { notes: "60% 1RM, strict 60s rest" }),
            ex("Hanging Leg Raise", 3, 15, 60),
            ex("Cable Crunch", 3, 15, 60),
          ]),
          day(4, "Arms & Shoulders", [
            ex("Overhead Press", 10, 10, 60, { notes: "60% 1RM, strict 60s rest" }),
            ex("Barbell Curl", 10, 10, 60, { notes: "60% 1RM, strict 60s rest" }),
            ex("Lateral Raise", 3, 12, 45),
            ex("Tricep Pushdown", 3, 12, 60),
          ]),
          day(5, "Legs Focus", [
            ex("Romanian Deadlift", 10, 10, 60, { notes: "60% 1RM, strict 60s rest" }),
            ex("Leg Press", 10, 10, 60, { notes: "60% 1RM, strict 60s rest" }),
            ex("Standing Calf Raise", 3, 15, 45),
            ex("Leg Extension", 3, 12, 60),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_weight",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 2.5,
      failure_protocol: "Only increase weight once all 10x10 are completed with the target load",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 6, volume_reduction: 0.5, intensity_reduction: 0.2 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 11 ─ Bro Split
  {
    name: "Bro Split",
    description:
      "Classic bodypart split: Chest, Back, Shoulders, Legs, Arms. Each muscle group trained once per week with high per‑session volume. Beginner‑friendly structure.",
    duration_weeks: 4,
    difficulty: "beginner",
    goal: "hypertrophy",
    days_per_week: 5,
    periodization: "linear",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Chest", [
            ex("Barbell Bench Press", 4, 10, 90),
            ex("Incline Dumbbell Press", 3, 12, 90),
            ex("Cable Fly", 3, 12, 60),
            ex("Dumbbell Bench Press", 3, 10, 90),
            ex("Push-Up", 3, 15, 45),
          ]),
          day(2, "Back", [
            ex("Barbell Row", 4, 10, 90),
            ex("Lat Pulldown", 3, 10, 90),
            ex("Seated Cable Row", 3, 12, 60),
            ex("Dumbbell Row", 3, 10, 60),
            ex("Face Pull", 3, 15, 45),
          ]),
          day(3, "Shoulders", [
            ex("Overhead Press", 4, 10, 90),
            ex("Dumbbell Lateral Raise", 4, 15, 45),
            ex("Rear Delt Fly", 3, 15, 45),
            ex("Dumbbell Front Raise", 3, 12, 60),
            ex("Dumbbell Shrug", 3, 12, 60),
          ]),
          day(4, "Legs", [
            ex("Barbell Squat", 4, 10, 120),
            ex("Leg Press", 3, 12, 90),
            ex("Romanian Deadlift", 3, 10, 120),
            ex("Leg Extension", 3, 12, 60),
            ex("Leg Curl", 3, 12, 60),
            ex("Standing Calf Raise", 4, 15, 45),
          ]),
          day(5, "Arms", [
            ex("Barbell Curl", 3, 10, 60),
            ex("Tricep Pushdown", 3, 10, 60),
            ex("Hammer Curl", 3, 12, 60),
            ex("Overhead Tricep Extension", 3, 12, 60),
            ex("Preacher Curl", 3, 12, 60),
            ex("Tricep Dip", 3, 10, 90),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_reps",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 2.5,
      failure_protocol: "Reach top of rep range for all sets before adding weight",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 4, volume_reduction: 0.4, intensity_reduction: 0.15 } as DeloadConfig,
    is_prebuilt: true,
  },

  // ──────────────────────────────────────────────
  // GENERAL (2)
  // ──────────────────────────────────────────────

  // 12 ─ Full Body 3x
  {
    name: "Full Body 3x",
    description:
      "Straightforward full‑body routine 3 days per week. Each session covers all major movement patterns with 3x8‑10 for compounds. Ideal for beginners or those short on time.",
    duration_weeks: 4,
    difficulty: "beginner",
    goal: "general",
    days_per_week: 3,
    periodization: "linear",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Full Body A", [
            ex("Barbell Squat", 3, 10, 120),
            ex("Barbell Bench Press", 3, 10, 90),
            ex("Barbell Row", 3, 10, 90),
            ex("Face Pull", 2, 15, 45),
            ex("Plank", 3, "60s", 60),
          ]),
          day(3, "Full Body B", [
            ex("Barbell Deadlift", 3, 8, 150),
            ex("Overhead Press", 3, 10, 90),
            ex("Pull-Up", 3, 8, 90),
            ex("Dumbbell Curl", 2, 12, 60),
            ex("Tricep Pushdown", 2, 12, 60),
          ]),
          day(5, "Full Body C", [
            ex("Front Squat", 3, 10, 120),
            ex("Incline Bench Press", 3, 10, 90),
            ex("Seated Cable Row", 3, 10, 90),
            ex("Lateral Raise", 2, 15, 45),
            ex("Hanging Leg Raise", 3, 12, 60),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_weight",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 2.5,
      failure_protocol: "Add reps until reaching the top of range, then increase weight and drop to bottom of range",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 4, volume_reduction: 0.4, intensity_reduction: 0.15 } as DeloadConfig,
    is_prebuilt: true,
  },

  // 13 ─ Upper/Lower
  {
    name: "Upper/Lower",
    description:
      "Classic 4‑day upper/lower split. Two distinct upper sessions and two distinct lower sessions per week. Great balance of frequency, volume, and recovery for beginners.",
    duration_weeks: 4,
    difficulty: "beginner",
    goal: "general",
    days_per_week: 4,
    periodization: "linear",
    schedule: {
      weeks: [
        week(1, "Week 1", [
          day(1, "Upper 1", [
            ex("Barbell Bench Press", 3, 10, 90),
            ex("Barbell Row", 3, 10, 90),
            ex("Overhead Press", 3, 10, 90),
            ex("Barbell Curl", 2, 12, 60),
            ex("Tricep Pushdown", 2, 12, 60),
          ]),
          day(2, "Lower 1", [
            ex("Barbell Squat", 3, 10, 120),
            ex("Romanian Deadlift", 3, 10, 120),
            ex("Leg Press", 3, 12, 90),
            ex("Standing Calf Raise", 3, 15, 45),
          ]),
          day(4, "Upper 2", [
            ex("Overhead Press", 3, 10, 90),
            ex("Pull-Up", 3, 8, 90),
            ex("Incline Dumbbell Press", 3, 12, 90),
            ex("Dumbbell Curl", 2, 12, 60),
            ex("Overhead Tricep Extension", 2, 12, 60),
          ]),
          day(5, "Lower 2", [
            ex("Barbell Deadlift", 3, 8, 150),
            ex("Leg Press", 3, 12, 90),
            ex("Leg Curl", 3, 12, 60),
            ex("Standing Calf Raise", 3, 15, 45),
          ]),
        ]),
      ],
      repeat_from_week: 1,
    } as ProgramSchedule,
    progression_rules: {
      type: "linear_weight",
      compound_increment_lbs: 5,
      isolation_increment_lbs: 2.5,
      failure_protocol: "Add reps until reaching the top of range, then increase weight and reset reps",
    } as ProgressionRules,
    deload_config: { every_n_weeks: 4, volume_reduction: 0.4, intensity_reduction: 0.15 } as DeloadConfig,
    is_prebuilt: true,
  },

];

// ================================================================
//  SEED FUNCTION
// ================================================================

/**
 * Seeds the prebuilt training programs into Supabase.
 * Skips insertion if any prebuilt programs already exist.
 */
export async function seedPrebuiltPrograms(): Promise<void> {
  const supabase = createClient();

  // Check if prebuilt programs already exist
  const { count, error: countError } = await supabase
    .from("training_programs")
    .select("*", { count: "exact", head: true })
    .eq("is_prebuilt", true);

  if (countError) {
    console.error("Failed to check existing prebuilt programs:", countError.message);
    return;
  }

  if (count && count > 0) {
    console.log(`Skipping seed: ${count} prebuilt programs already exist.`);
    return;
  }

  // Insert all prebuilt programs
  const rows = PREBUILT_PROGRAMS.map((program) => ({
    ...program,
    user_id: null,
    is_prebuilt: true,
  }));

  const { error: insertError } = await supabase
    .from("training_programs")
    .insert(rows);

  if (insertError) {
    console.error("Failed to seed prebuilt programs:", insertError.message);
    return;
  }

  console.log(`Successfully seeded ${rows.length} prebuilt programs.`);
}
