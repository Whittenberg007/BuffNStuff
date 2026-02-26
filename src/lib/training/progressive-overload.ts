import { getLastSessionForExercise } from "@/lib/database/workouts";
import type { TrainingStyle } from "@/types";

export interface OverloadSuggestion {
  lastWeight: number;
  lastReps: number;
  lastSets: number;
  suggestedWeight: number;
  suggestedReps: number;
  message: string;
}

export async function getSuggestion(
  exerciseId: string,
  trainingStyle: TrainingStyle = "hypertrophy"
): Promise<OverloadSuggestion | null> {
  const lastSets = await getLastSessionForExercise(exerciseId);
  if (!lastSets.length) return null;

  // Find the best working set (highest weight x reps)
  const workingSets = lastSets.filter((s) => s.set_type === "working");
  if (!workingSets.length) return null;

  const bestSet = workingSets.reduce((best, set) =>
    set.weight * set.reps > best.weight * best.reps ? set : best
  );

  let suggestedWeight = bestSet.weight;
  let suggestedReps = bestSet.reps;
  let message = "";

  if (trainingStyle === "hypertrophy") {
    // Hypertrophy: if hit target reps (8-15), increase weight by 5 lbs
    if (bestSet.reps >= 12) {
      suggestedWeight = bestSet.weight + 5;
      suggestedReps = 8;
      message = `You hit ${bestSet.reps} reps last time -- bump up to ${suggestedWeight} lbs and aim for 8+ reps`;
    } else {
      suggestedReps = bestSet.reps + 1;
      message = `Try to beat ${bestSet.reps} reps at ${bestSet.weight} lbs`;
    }
  } else if (trainingStyle === "strength") {
    // Strength: if hit target reps (3-5), increase weight by 5-10 lbs
    if (bestSet.reps >= 5) {
      suggestedWeight = bestSet.weight + 10;
      suggestedReps = 3;
      message = `You hit ${bestSet.reps} reps -- try ${suggestedWeight} lbs for 3+ reps`;
    } else {
      suggestedReps = bestSet.reps + 1;
      message = `Try to add a rep at ${bestSet.weight} lbs`;
    }
  } else {
    // Mixed: small increments
    if (bestSet.reps >= 10) {
      suggestedWeight = bestSet.weight + 5;
      suggestedReps = bestSet.reps - 2;
      message = `Progress to ${suggestedWeight} lbs, aim for ${suggestedReps}+ reps`;
    } else {
      suggestedReps = bestSet.reps + 1;
      message = `Try ${suggestedReps} reps at ${bestSet.weight} lbs`;
    }
  }

  return {
    lastWeight: bestSet.weight,
    lastReps: bestSet.reps,
    lastSets: workingSets.length,
    suggestedWeight,
    suggestedReps,
    message,
  };
}
