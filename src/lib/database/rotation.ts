import { createClient } from "@/lib/supabase/client";
import type { ExerciseRotationState, MuscleGroup } from "@/types";

// Fetch current rotation state for all or a specific muscle group
export async function getRotationState(
  muscleGroup?: MuscleGroup
): Promise<ExerciseRotationState[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("exercise_rotation_state")
    .select("*")
    .eq("user_id", user.id)
    .order("last_performed_at", { ascending: false, nullsFirst: false });

  if (muscleGroup) {
    query = query.eq("muscle_group", muscleGroup);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ExerciseRotationState[];
}

// Create initial rotation state when an exercise is first used
export async function initializeRotation(
  exerciseId: string,
  muscleGroup: MuscleGroup
): Promise<ExerciseRotationState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("exercise_rotation_state")
    .insert({
      user_id: user.id,
      exercise_id: exerciseId,
      muscle_group: muscleGroup,
      introduced_at: now,
      last_performed_at: now,
      rotation_status: "active",
      freshness_score: 1.0,
      swap_suggested_at: null,
      replacement_exercise_id: null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ExerciseRotationState;
}

// Update last_performed_at and recalculate freshness_score after a workout
export async function updateRotationAfterWorkout(
  exerciseId: string
): Promise<ExerciseRotationState | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("exercise_rotation_state")
    .update({
      last_performed_at: now,
      freshness_score: 1.0, // Reset to fresh on workout
    })
    .eq("exercise_id", exerciseId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return null;
  return data as ExerciseRotationState;
}

// Mark an exercise as suggested_swap with a replacement
export async function suggestSwap(
  exerciseId: string,
  replacementId: string
): Promise<ExerciseRotationState | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("exercise_rotation_state")
    .update({
      rotation_status: "suggested_swap",
      swap_suggested_at: new Date().toISOString(),
      replacement_exercise_id: replacementId,
    })
    .eq("exercise_id", exerciseId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return null;
  return data as ExerciseRotationState;
}

// Accept a swap: set old exercise to resting, activate replacement
export async function acceptSwap(
  rotationId: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get the current rotation state to find the replacement
  const { data: current, error: fetchError } = await supabase
    .from("exercise_rotation_state")
    .select("*")
    .eq("id", rotationId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !current) throw new Error("Rotation state not found");

  const rotation = current as ExerciseRotationState;
  if (!rotation.replacement_exercise_id) {
    throw new Error("No replacement exercise set");
  }

  // Set old exercise to resting
  const { error: restError } = await supabase
    .from("exercise_rotation_state")
    .update({
      rotation_status: "resting",
      swap_suggested_at: null,
      replacement_exercise_id: null,
    })
    .eq("id", rotationId)
    .eq("user_id", user.id);

  if (restError) throw restError;

  // Check if replacement already has a rotation state
  const { data: existing } = await supabase
    .from("exercise_rotation_state")
    .select("id")
    .eq("exercise_id", rotation.replacement_exercise_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    // Reactivate existing rotation state
    const { error: activateError } = await supabase
      .from("exercise_rotation_state")
      .update({
        rotation_status: "active",
        last_performed_at: now,
        freshness_score: 1.0,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);

    if (activateError) throw activateError;
  } else {
    // Create new rotation state for the replacement
    const { error: insertError } = await supabase
      .from("exercise_rotation_state")
      .insert({
        user_id: user.id,
        exercise_id: rotation.replacement_exercise_id,
        muscle_group: rotation.muscle_group,
        introduced_at: now,
        last_performed_at: now,
        rotation_status: "active",
        freshness_score: 1.0,
        swap_suggested_at: null,
        replacement_exercise_id: null,
      });

    if (insertError) throw insertError;
  }
}

// Dismiss a swap suggestion: reset to active, clear freshness timer
export async function dismissSwap(
  rotationId: string
): Promise<ExerciseRotationState | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("exercise_rotation_state")
    .update({
      rotation_status: "active",
      swap_suggested_at: null,
      replacement_exercise_id: null,
      freshness_score: 1.0,
      last_performed_at: new Date().toISOString(),
    })
    .eq("id", rotationId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return null;
  return data as ExerciseRotationState;
}
