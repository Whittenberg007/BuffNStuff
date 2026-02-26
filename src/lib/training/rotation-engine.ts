import { differenceInDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { getRotationState, suggestSwap } from "@/lib/database/rotation";
import type { ExerciseRotationState, Exercise, MuscleGroup } from "@/types";

// FSRS-inspired freshness constants
const STALE_THRESHOLD_DAYS = 28; // 4 weeks — score drops below 0.5
const SWAP_THRESHOLD_DAYS = 42; // 6 weeks — score drops below 0.25
const REST_RECOVERY_DAYS = 28; // 4+ weeks of rest resets freshness

/**
 * Calculate freshness score for an exercise.
 * Score starts at 1.0 and decreases linearly over time.
 * - After 4 weeks (28 days): drops below 0.5 ("getting stale")
 * - After 6 weeks (42 days): drops below 0.25 (suggest swap)
 * - Clamped to [0, 1]
 */
export function calculateFreshness(
  introducedAt: string,
  lastPerformedAt: string | null
): number {
  const referenceDate = lastPerformedAt || introducedAt;
  const daysSince = differenceInDays(new Date(), new Date(referenceDate));

  // Linear decay: score = 1.0 - (daysSince / SWAP_THRESHOLD_DAYS * 0.75)
  // At 0 days: 1.0
  // At 28 days (4 weeks): ~0.5
  // At 42 days (6 weeks): ~0.25
  // At 56 days (8 weeks): 0.0
  const decayRate = 1.0 / 56; // Full decay over 56 days
  const score = 1.0 - daysSince * decayRate;

  return Math.max(0, Math.min(1, score));
}

/**
 * Get the freshness status label for a score.
 */
export function getFreshnessStatus(
  score: number
): { label: string; color: string } {
  if (score >= 0.75) {
    return { label: "Fresh", color: "bg-green-500" };
  } else if (score >= 0.5) {
    return { label: "Good", color: "bg-blue-500" };
  } else if (score >= 0.25) {
    return { label: "Getting stale", color: "bg-yellow-500" };
  } else {
    return { label: "Needs rotation", color: "bg-red-500" };
  }
}

/**
 * Check if a resting exercise has recovered enough to be fresh again.
 * After 4+ weeks of rest, freshness resets to 1.0.
 */
export function hasRecoveredFromRest(lastPerformedAt: string | null): boolean {
  if (!lastPerformedAt) return true;
  const daysSinceLastUse = differenceInDays(
    new Date(),
    new Date(lastPerformedAt)
  );
  return daysSinceLastUse >= REST_RECOVERY_DAYS;
}

/**
 * Find all exercises due for rotation and suggest replacements.
 * Scans all active rotation states and flags those with low freshness.
 */
export async function getSwapSuggestions(): Promise<
  Array<{
    rotation: ExerciseRotationState;
    currentExercise: Exercise | null;
    suggestedReplacement: Exercise | null;
    freshness: number;
    reason: string;
  }>
> {
  const rotationStates = await getRotationState();

  if (!rotationStates.length) return [];

  const supabase = createClient();
  const suggestions: Array<{
    rotation: ExerciseRotationState;
    currentExercise: Exercise | null;
    suggestedReplacement: Exercise | null;
    freshness: number;
    reason: string;
  }> = [];

  for (const state of rotationStates) {
    // Skip non-active exercises
    if (state.rotation_status !== "active") continue;

    const freshness = calculateFreshness(
      state.introduced_at,
      state.last_performed_at
    );

    // Only suggest swaps for exercises below the swap threshold
    if (freshness >= 0.25) continue;

    // Fetch the current exercise details
    const { data: currentExercise } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", state.exercise_id)
      .single();

    // Find a replacement
    const replacement = await findReplacement(
      state.exercise_id,
      state.muscle_group
    );

    const daysSince = state.last_performed_at
      ? differenceInDays(new Date(), new Date(state.last_performed_at))
      : differenceInDays(new Date(), new Date(state.introduced_at));

    const reason =
      daysSince >= SWAP_THRESHOLD_DAYS
        ? `This exercise has been in rotation for ${daysSince} days without meaningful variation. Swapping helps prevent accommodation and keeps stimulus novel.`
        : `Freshness score is low (${(freshness * 100).toFixed(0)}%). Consider rotating for continued progress.`;

    // If we found a replacement, mark it as a suggestion in the database
    if (replacement) {
      await suggestSwap(state.exercise_id, replacement.id);
    }

    suggestions.push({
      rotation: { ...state, freshness_score: freshness },
      currentExercise: currentExercise as Exercise | null,
      suggestedReplacement: replacement,
      freshness,
      reason,
    });
  }

  return suggestions;
}

/**
 * Find a replacement exercise for the given exercise.
 * Looks for variations of the same muscle group with different equipment or movement pattern.
 * Prefers exercises that are currently resting and have recovered, or haven't been used recently.
 */
export async function findReplacement(
  exerciseId: string,
  muscleGroup?: MuscleGroup
): Promise<Exercise | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Get the current exercise to know what to vary from
  const { data: currentExercise } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", exerciseId)
    .single();

  if (!currentExercise) return null;

  const current = currentExercise as Exercise;
  const targetMuscle = muscleGroup || current.primary_muscle_group;

  // Find exercises for the same muscle group, excluding the current one
  const { data: candidates } = await supabase
    .from("exercises")
    .select("*")
    .eq("primary_muscle_group", targetMuscle)
    .neq("id", exerciseId)
    .order("name");

  if (!candidates?.length) return null;

  const exerciseList = candidates as Exercise[];

  // Get rotation states for these exercises to check which are resting and recovered
  const { data: rotationStates } = await supabase
    .from("exercise_rotation_state")
    .select("*")
    .eq("user_id", user.id)
    .in(
      "exercise_id",
      exerciseList.map((e) => e.id)
    );

  const stateMap = new Map<string, ExerciseRotationState>();
  if (rotationStates) {
    for (const rs of rotationStates) {
      stateMap.set(rs.exercise_id, rs as ExerciseRotationState);
    }
  }

  // Score each candidate: prefer different equipment, resting+recovered exercises
  const scored = exerciseList.map((exercise) => {
    let score = 0;
    const state = stateMap.get(exercise.id);

    // Prefer different equipment type
    if (exercise.equipment_type !== current.equipment_type) {
      score += 3;
    }

    // Prefer different movement pattern
    if (exercise.movement_pattern !== current.movement_pattern) {
      score += 2;
    }

    // Prefer exercises that are resting and have recovered
    if (state?.rotation_status === "resting") {
      if (hasRecoveredFromRest(state.last_performed_at)) {
        score += 5; // Best option: rested and recovered
      } else {
        score += 1; // Resting but not recovered yet
      }
    }

    // Prefer exercises that have never been used (no rotation state)
    if (!state) {
      score += 4;
    }

    // Prefer exercises that are not currently active
    if (state?.rotation_status === "active") {
      score -= 2;
    }

    return { exercise, score };
  });

  // Sort by score descending, pick the best
  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.exercise || null;
}
