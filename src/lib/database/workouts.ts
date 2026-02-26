import { createClient } from "@/lib/supabase/client";
import type { WorkoutSession, WorkoutSet, SetType } from "@/types";

// Start a new workout session
export async function startWorkoutSession(options?: {
  templateId?: string;
  splitType?: string;
  trainingStyle?: string;
}): Promise<WorkoutSession> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      template_id: options?.templateId || null,
      split_type: options?.splitType || null,
      training_style: options?.trainingStyle || null,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkoutSession;
}

// End a workout session
export async function endWorkoutSession(
  sessionId: string
): Promise<WorkoutSession> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data as WorkoutSession;
}

// Log a single set
export async function logSet(params: {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  setType?: SetType;
  rpeRir?: number;
  notes?: string;
}): Promise<WorkoutSet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_sets")
    .insert({
      session_id: params.sessionId,
      exercise_id: params.exerciseId,
      set_number: params.setNumber,
      weight: params.weight,
      reps: params.reps,
      set_type: params.setType || "working",
      rpe_rir: params.rpeRir || null,
      notes: params.notes || null,
      is_pr: false, // Will be calculated separately
      logged_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as WorkoutSet;
}

// Update a set
export async function updateSet(
  setId: string,
  updates: Partial<
    Pick<WorkoutSet, "weight" | "reps" | "set_type" | "rpe_rir" | "notes" | "is_pr">
  >
): Promise<WorkoutSet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_sets")
    .update(updates)
    .eq("id", setId)
    .select()
    .single();
  if (error) throw error;
  return data as WorkoutSet;
}

// Delete a set
export async function deleteSet(setId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("workout_sets")
    .delete()
    .eq("id", setId);
  if (error) throw error;
}

// Get all sets for a session, with exercise details
export async function getSessionSets(
  sessionId: string
): Promise<WorkoutSet[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_sets")
    .select("*, exercise:exercises(*)")
    .eq("session_id", sessionId)
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return data as WorkoutSet[];
}

// Get recent workout sessions
export async function getRecentSessions(
  limit: number = 10
): Promise<WorkoutSession[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as WorkoutSession[];
}

// Get exercise history — previous sets for progressive overload suggestions
export async function getExerciseHistory(
  exerciseId: string,
  limit: number = 50
): Promise<WorkoutSet[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("workout_sets")
    .select("*, session:workout_sessions!inner(user_id, started_at)")
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as WorkoutSet[];
}

// Get the most recent session's sets for a specific exercise
export async function getLastSessionForExercise(
  exerciseId: string
): Promise<WorkoutSet[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // First find the most recent session that included this exercise
  const { data: recentSets, error: recentError } = await supabase
    .from("workout_sets")
    .select("session_id, session:workout_sessions!inner(user_id, started_at)")
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(1);

  if (recentError || !recentSets?.length) return [];

  const lastSessionId = recentSets[0].session_id;

  // Then get all sets from that session for this exercise
  const { data, error } = await supabase
    .from("workout_sets")
    .select("*")
    .eq("session_id", lastSessionId)
    .eq("exercise_id", exerciseId)
    .order("set_number", { ascending: true });

  if (error) throw error;
  return data as WorkoutSet[];
}

// Check if a set is a new PR for this exercise
export async function checkIfPR(
  exerciseId: string,
  weight: number,
  reps: number
): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // A PR is defined as: highest weight at the same or more reps, OR same weight with more reps
  const { data, error } = await supabase
    .from("workout_sets")
    .select("weight, reps, session:workout_sessions!inner(user_id)")
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .gte("weight", weight)
    .gte("reps", reps);

  if (error) return false;
  // If no existing set matches or exceeds both weight AND reps, this is a PR
  return !data || data.length === 0;
}
