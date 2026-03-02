import type { StrengthLevel } from "@/types";

// Bodyweight multiplier thresholds for each strength level.
// Source: Symmetric Strength / ExRx standards (male averages).
// Each entry is [beginner, novice, intermediate, advanced, elite].
const STANDARDS: Record<string, [number, number, number, number, number]> = {
  bench:       [0.50, 0.75, 1.00, 1.50, 2.00],
  squat:       [0.75, 1.00, 1.50, 2.00, 2.50],
  deadlift:    [1.00, 1.25, 1.75, 2.50, 3.00],
  ohp:         [0.35, 0.50, 0.65, 1.00, 1.40],
  row:         [0.50, 0.65, 0.85, 1.15, 1.50],
  pullup:      [0.50, 0.75, 1.00, 1.35, 1.75],
  dip:         [0.50, 0.75, 1.00, 1.50, 2.00],
  front_squat: [0.55, 0.80, 1.15, 1.55, 2.00],
};

const LEVEL_ORDER: StrengthLevel[] = ["beginner", "novice", "intermediate", "advanced", "elite"];

/**
 * Match an exercise name to a known standard key.
 * Uses case-insensitive substring matching.
 * Returns null if no match.
 */
export function matchExerciseToStandard(exerciseName: string): string | null {
  const name = exerciseName.toLowerCase();

  if (name.includes("front squat")) return "front_squat";
  if (name.includes("bench") && !name.includes("incline") && !name.includes("decline")) return "bench";
  if (name.includes("squat") && !name.includes("front") && !name.includes("split")) return "squat";
  if (name.includes("deadlift") || name.includes("dead lift")) return "deadlift";
  if (name.includes("overhead press") || name.includes("ohp") || (name.includes("press") && name.includes("shoulder"))) return "ohp";
  if (name.includes("barbell row") || name.includes("bent over row") || name.includes("pendlay")) return "row";
  if (name.includes("pull-up") || name.includes("pullup") || name.includes("chin-up") || name.includes("chinup")) return "pullup";
  if (name.includes("dip")) return "dip";

  return null;
}

/**
 * Determine strength level from an actual 1RM and bodyweight.
 * Returns null if the exercise doesn't match a known standard.
 */
export function getStrengthLevel(
  actual1RM: number,
  bodyweight: number,
  exerciseName: string
): StrengthLevel | null {
  if (bodyweight <= 0 || actual1RM <= 0) return null;

  const key = matchExerciseToStandard(exerciseName);
  if (!key) return null;

  const thresholds = STANDARDS[key];
  const ratio = actual1RM / bodyweight;

  // Find the highest level the user meets
  let level: StrengthLevel = "beginner";
  for (let i = 0; i < thresholds.length; i++) {
    if (ratio >= thresholds[i]) {
      level = LEVEL_ORDER[i];
    }
  }

  return level;
}

/**
 * Color class for each strength level badge.
 */
export function getStrengthLevelColor(level: StrengthLevel): string {
  switch (level) {
    case "beginner": return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    case "novice": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "intermediate": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "advanced": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    case "elite": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
  }
}

/** The Big 4 compound lifts for the summary section. */
export const BIG_FOUR = ["bench", "squat", "deadlift", "ohp"] as const;

/** Human-readable labels for standard keys. */
export const STANDARD_LABELS: Record<string, string> = {
  bench: "Bench Press",
  squat: "Back Squat",
  deadlift: "Deadlift",
  ohp: "Overhead Press",
  row: "Barbell Row",
  pullup: "Pull-up",
  dip: "Dip",
  front_squat: "Front Squat",
};
