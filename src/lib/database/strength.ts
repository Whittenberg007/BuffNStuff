import { createClient } from "@/lib/supabase/client";
import { format, subDays } from "date-fns";
import type { RepMax } from "@/types";

/**
 * Get rep maxes for a specific exercise.
 * Returns the heaviest weight at rep counts 1, 3, 5, and the overall best set.
 */
export async function getRepMaxes(
  exerciseId: string
): Promise<{
  rm1: RepMax | null;
  rm3: RepMax | null;
  rm5: RepMax | null;
  best: RepMax | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rm1: null, rm3: null, rm5: null, best: null };

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "weight, reps, logged_at, exercise_id, exercise:exercises(id, name), session:workout_sessions!inner(user_id)"
    )
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .eq("set_type", "working")
    .order("weight", { ascending: false });

  if (!data || data.length === 0) {
    return { rm1: null, rm3: null, rm5: null, best: null };
  }

  function toRepMax(row: Record<string, unknown>): RepMax {
    const exercise = Array.isArray(row.exercise)
      ? (row.exercise as { id: string; name: string }[])[0]
      : (row.exercise as { id: string; name: string } | null);
    return {
      exerciseId: (row.exercise_id as string) || exerciseId,
      exerciseName: exercise?.name || "Unknown",
      weight: row.weight as number,
      reps: row.reps as number,
      date: row.logged_at as string,
    };
  }

  // Find heaviest at specific rep counts
  const rm1Row = data.find((r) => (r.reps as number) === 1);
  const rm3Row = data.find((r) => (r.reps as number) === 3);
  const rm5Row = data.find((r) => (r.reps as number) === 5);
  // Best = heaviest weight regardless of reps (already sorted desc)
  const bestRow = data[0];

  return {
    rm1: rm1Row ? toRepMax(rm1Row) : null,
    rm3: rm3Row ? toRepMax(rm3Row) : null,
    rm5: rm5Row ? toRepMax(rm5Row) : null,
    best: bestRow ? toRepMax(bestRow) : null,
  };
}

/**
 * Get the heaviest set (any rep count) per exercise for all exercises the user has logged.
 * Used for the PR board / strength profile overview.
 */
export async function getAllExercisePRs(): Promise<RepMax[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "weight, reps, logged_at, exercise_id, exercise:exercises(id, name), session:workout_sessions!inner(user_id)"
    )
    .eq("workout_sessions.user_id", user.id)
    .eq("set_type", "working")
    .order("weight", { ascending: false });

  if (!data || data.length === 0) return [];

  // Group by exercise_id, keep heaviest
  const best = new Map<string, RepMax>();
  for (const row of data) {
    const exId = row.exercise_id as string;
    if (!best.has(exId)) {
      const exercise = Array.isArray(row.exercise)
        ? (row.exercise as { id: string; name: string }[])[0]
        : (row.exercise as { id: string; name: string } | null);
      best.set(exId, {
        exerciseId: exId,
        exerciseName: exercise?.name || "Unknown",
        weight: row.weight as number,
        reps: row.reps as number,
        date: row.logged_at as string,
      });
    }
  }

  return Array.from(best.values());
}

/**
 * Get actual 1RM history for a specific exercise (heaviest single per day over time).
 * Only returns days where a single (reps=1) was performed.
 */
export async function get1RMHistory(
  exerciseId: string,
  days: number = 365
): Promise<Array<{ date: string; weight: number }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = subDays(new Date(), days).toISOString();

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "weight, logged_at, session:workout_sessions!inner(user_id)"
    )
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .eq("reps", 1)
    .eq("set_type", "working")
    .gte("logged_at", since)
    .order("logged_at", { ascending: true });

  if (!data || data.length === 0) return [];

  // Group by date, keep heaviest single per day
  const byDate = new Map<string, number>();
  for (const row of data) {
    const dateKey = format(new Date(row.logged_at as string), "yyyy-MM-dd");
    const existing = byDate.get(dateKey) || 0;
    if ((row.weight as number) > existing) {
      byDate.set(dateKey, row.weight as number);
    }
  }

  return Array.from(byDate.entries()).map(([date, weight]) => ({
    date,
    weight,
  }));
}
