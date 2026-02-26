import { createClient } from "@/lib/supabase/client";
import { subDays, format, startOfWeek } from "date-fns";
import type { MuscleGroup } from "@/types";

// Helper to extract muscle group from a Supabase join result
function extractMuscleGroup(
  exercise: unknown
): string | null {
  if (!exercise) return null;
  // Supabase may return object or array depending on relationship
  const ex = Array.isArray(exercise) ? exercise[0] : exercise;
  if (ex && typeof ex === "object" && "primary_muscle_group" in ex) {
    return (ex as { primary_muscle_group: string }).primary_muscle_group;
  }
  return null;
}

// Exercise progression: weight over time for a specific exercise
export async function getExerciseProgression(
  exerciseId: string,
  days: number = 90
): Promise<Array<{ date: string; weight: number; reps: number }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = subDays(new Date(), days).toISOString();

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "weight, reps, logged_at, session:workout_sessions!inner(user_id)"
    )
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .gte("logged_at", since)
    .eq("set_type", "working")
    .order("logged_at", { ascending: true });

  if (!data?.length) return [];

  // Group by date, take the heaviest working set per day
  const byDate = new Map<string, { weight: number; reps: number }>();
  for (const set of data) {
    const dateKey = format(new Date(set.logged_at), "yyyy-MM-dd");
    const existing = byDate.get(dateKey);
    if (!existing || set.weight > existing.weight) {
      byDate.set(dateKey, { weight: set.weight, reps: set.reps });
    }
  }

  return Array.from(byDate.entries()).map(([date, vals]) => ({
    date,
    weight: vals.weight,
    reps: vals.reps,
  }));
}

// Volume by muscle group over time (weekly buckets)
export async function getVolumeByMuscleGroup(
  days: number = 90
): Promise<Array<Record<string, number | string>>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = subDays(new Date(), days).toISOString();

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "logged_at, exercise:exercises(primary_muscle_group), session:workout_sessions!inner(user_id)"
    )
    .eq("workout_sessions.user_id", user.id)
    .gte("logged_at", since)
    .order("logged_at", { ascending: true });

  if (!data?.length) return [];

  // Group sets by week and muscle group
  const weekMap = new Map<string, Map<string, number>>();

  for (const set of data) {
    const muscle = extractMuscleGroup(set.exercise);
    if (!muscle) continue;

    const weekStart = format(
      startOfWeek(new Date(set.logged_at), { weekStartsOn: 1 }),
      "MMM d"
    );

    if (!weekMap.has(weekStart)) {
      weekMap.set(weekStart, new Map());
    }
    const muscleMap = weekMap.get(weekStart)!;
    muscleMap.set(muscle, (muscleMap.get(muscle) || 0) + 1);
  }

  return Array.from(weekMap.entries()).map(([week, muscleMap]) => {
    const entry: Record<string, number | string> = { week };
    for (const [muscle, count] of muscleMap.entries()) {
      entry[muscle] = count;
    }
    return entry;
  });
}

// Training frequency: which days had workouts
export async function getTrainingFrequency(
  days: number = 90
): Promise<
  Array<{
    date: string;
    muscleGroupCount: number;
    muscleGroups: string[];
  }>
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = subDays(new Date(), days).toISOString();

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "logged_at, exercise:exercises(primary_muscle_group), session:workout_sessions!inner(user_id)"
    )
    .eq("workout_sessions.user_id", user.id)
    .gte("logged_at", since);

  if (!data?.length) return [];

  // Group by date, collect unique muscle groups per day
  const dayMap = new Map<string, Set<string>>();

  for (const set of data) {
    const muscle = extractMuscleGroup(set.exercise);
    if (!muscle) continue;

    const dateKey = format(new Date(set.logged_at), "yyyy-MM-dd");
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, new Set());
    }
    dayMap.get(dateKey)!.add(muscle);
  }

  return Array.from(dayMap.entries()).map(([date, muscles]) => ({
    date,
    muscleGroupCount: muscles.size,
    muscleGroups: Array.from(muscles),
  }));
}

// Muscle group balance: relative set count per muscle group (for radar chart)
export async function getMuscleGroupBalance(
  days: number = 30
): Promise<Array<{ muscleGroup: MuscleGroup; sets: number }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = subDays(new Date(), days).toISOString();

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "exercise:exercises(primary_muscle_group), session:workout_sessions!inner(user_id)"
    )
    .eq("workout_sessions.user_id", user.id)
    .gte("logged_at", since);

  if (!data?.length) return [];

  const muscleMap = new Map<string, number>();

  for (const set of data) {
    const muscle = extractMuscleGroup(set.exercise);
    if (!muscle) continue;

    muscleMap.set(muscle, (muscleMap.get(muscle) || 0) + 1);
  }

  return Array.from(muscleMap.entries())
    .map(([muscleGroup, sets]) => ({
      muscleGroup: muscleGroup as MuscleGroup,
      sets,
    }))
    .sort((a, b) => b.sets - a.sets);
}
