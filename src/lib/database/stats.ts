import { createClient } from "@/lib/supabase/client";
import { startOfWeek, endOfWeek, subDays, format } from "date-fns";

// Get weekly summary: days trained, total volume, total sets
export async function getWeeklySummary(): Promise<{
  daysThisWeek: number;
  totalVolume: number;
  totalSets: number;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  // Get sessions this week
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, started_at")
    .eq("user_id", user.id)
    .gte("started_at", weekStart.toISOString())
    .lte("started_at", weekEnd.toISOString())
    .not("ended_at", "is", null);

  if (!sessions?.length)
    return { daysThisWeek: 0, totalVolume: 0, totalSets: 0 };

  // Unique training days
  const uniqueDays = new Set(
    sessions.map((s) => format(new Date(s.started_at), "yyyy-MM-dd"))
  );

  // Get all sets from this week's sessions
  const sessionIds = sessions.map((s) => s.id);
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("weight, reps")
    .in("session_id", sessionIds);

  const totalVolume =
    sets?.reduce((sum, s) => sum + s.weight * s.reps, 0) || 0;

  return {
    daysThisWeek: uniqueDays.size,
    totalVolume,
    totalSets: sets?.length || 0,
  };
}

// Get current workout streak
export async function getCurrentStreak(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("started_at")
    .eq("user_id", user.id)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(90);

  if (!sessions?.length) return 0;

  const workoutDays = new Set(
    sessions.map((s) => format(new Date(s.started_at), "yyyy-MM-dd"))
  );
  let streak = 0;
  let checkDate = new Date();

  // Check if today has a workout, if not start from yesterday
  if (!workoutDays.has(format(checkDate, "yyyy-MM-dd"))) {
    checkDate = subDays(checkDate, 1);
  }

  while (workoutDays.has(format(checkDate, "yyyy-MM-dd"))) {
    streak++;
    checkDate = subDays(checkDate, 1);
  }

  return streak;
}

// Get recent PRs from last N days
export async function getRecentPRs(
  days: number = 7
): Promise<
  Array<{
    exerciseName: string;
    weight: number;
    reps: number;
    date: string;
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
      "weight, reps, logged_at, exercise:exercises(name), session:workout_sessions!inner(user_id)"
    )
    .eq("is_pr", true)
    .eq("workout_sessions.user_id", user.id)
    .gte("logged_at", since)
    .order("logged_at", { ascending: false })
    .limit(10);

  return (data || []).map((s: Record<string, unknown>) => ({
    exerciseName:
      (s.exercise as { name: string } | null)?.name || "Unknown",
    weight: s.weight as number,
    reps: s.reps as number,
    date: s.logged_at as string,
  }));
}
