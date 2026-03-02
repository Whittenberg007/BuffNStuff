import { createClient } from "@/lib/supabase/client";
import { subDays } from "date-fns";
import type { CardioSession } from "@/types";

/**
 * Log a cardio session.
 * Auto-computes avg_pace (seconds per unit) when distance is provided.
 */
export async function logCardioSession(params: {
  activity_type: string;
  duration_seconds: number;
  distance?: number;
  notes?: string;
}): Promise<CardioSession> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const avg_pace =
    params.distance && params.distance > 0
      ? Math.round(params.duration_seconds / params.distance)
      : null;

  const { data, error } = await supabase
    .from("cardio_sessions")
    .insert({
      user_id: user.id,
      activity_type: params.activity_type,
      duration_seconds: params.duration_seconds,
      distance: params.distance || null,
      avg_pace,
      notes: params.notes || null,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as CardioSession;
}

/**
 * Get recent cardio sessions.
 */
export async function getCardioHistory(
  days: number = 30
): Promise<CardioSession[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = subDays(new Date(), days).toISOString();

  const { data, error } = await supabase
    .from("cardio_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gte("completed_at", since)
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return (data || []) as CardioSession[];
}

/**
 * Get aggregate cardio stats for a time range.
 */
export async function getCardioStats(
  days: number = 30
): Promise<{
  totalSessions: number;
  totalDurationSeconds: number;
  totalDistance: number;
  avgPace: number | null;
}> {
  const sessions = await getCardioHistory(days);

  const totalSessions = sessions.length;
  const totalDurationSeconds = sessions.reduce(
    (sum, s) => sum + s.duration_seconds,
    0
  );
  const totalDistance = sessions.reduce(
    (sum, s) => sum + (s.distance || 0),
    0
  );
  const avgPace =
    totalDistance > 0
      ? Math.round(totalDurationSeconds / totalDistance)
      : null;

  return { totalSessions, totalDurationSeconds, totalDistance, avgPace };
}
