import { createClient } from "@/lib/supabase/client";
import type { ExerciseClip, MuscleGroup, ClipType } from "@/types";

export async function getClips(filters?: {
  muscleGroup?: MuscleGroup;
  exerciseId?: string;
  creatorName?: string;
  clipType?: ClipType;
  search?: string;
}): Promise<ExerciseClip[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("exercise_clips")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (filters?.muscleGroup)
    query = query.contains("muscle_groups", [filters.muscleGroup]);
  if (filters?.exerciseId)
    query = query.eq("exercise_id", filters.exerciseId);
  if (filters?.creatorName)
    query = query.ilike("creator_name", `%${filters.creatorName}%`);
  if (filters?.clipType) query = query.eq("clip_type", filters.clipType);
  if (filters?.search) query = query.ilike("title", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data as ExerciseClip[];
}

export async function getClipsForExercise(
  exerciseId: string
): Promise<ExerciseClip[]> {
  return getClips({ exerciseId });
}

export async function createClip(
  clip: Omit<
    ExerciseClip,
    "id" | "user_id" | "created_at" | "is_downloaded" | "stored_clip_path"
  >
): Promise<ExerciseClip> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("exercise_clips")
    .insert({
      ...clip,
      user_id: user.id,
      is_downloaded: false,
      stored_clip_path: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ExerciseClip;
}

export async function updateClip(
  id: string,
  updates: Partial<ExerciseClip>
): Promise<ExerciseClip> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercise_clips")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ExerciseClip;
}

export async function deleteClip(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("exercise_clips")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
