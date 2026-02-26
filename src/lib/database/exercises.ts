import { createClient } from "@/lib/supabase/client";
import type { Exercise, MuscleGroup, EquipmentType } from "@/types";

// Get exercises with optional filters
export async function getExercises(filters?: {
  muscleGroup?: MuscleGroup;
  equipmentType?: EquipmentType;
  search?: string;
}): Promise<Exercise[]> {
  const supabase = createClient();
  let query = supabase.from("exercises").select("*").order("name");

  if (filters?.muscleGroup) {
    query = query.eq("primary_muscle_group", filters.muscleGroup);
  }
  if (filters?.equipmentType) {
    query = query.eq("equipment_type", filters.equipmentType);
  }
  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Exercise[];
}

// Get a single exercise by ID
export async function getExerciseById(
  id: string
): Promise<Exercise | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Exercise;
}

// Get exercise variations grouped by equipment type
export async function getExerciseVariations(
  muscleGroup: MuscleGroup,
  excludeId?: string
): Promise<Record<EquipmentType, Exercise[]>> {
  const supabase = createClient();
  let query = supabase
    .from("exercises")
    .select("*")
    .eq("primary_muscle_group", muscleGroup)
    .order("name");
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw error;

  const grouped: Record<string, Exercise[]> = {};
  for (const exercise of data as Exercise[]) {
    if (!grouped[exercise.equipment_type])
      grouped[exercise.equipment_type] = [];
    grouped[exercise.equipment_type].push(exercise);
  }
  return grouped as Record<EquipmentType, Exercise[]>;
}

// Create a custom exercise
export async function createExercise(
  exercise: Omit<Exercise, "id" | "created_at" | "is_custom" | "user_id">
): Promise<Exercise> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("exercises")
    .insert({ ...exercise, user_id: user.id, is_custom: true })
    .select()
    .single();
  if (error) throw error;
  return data as Exercise;
}

// Update an exercise
export async function updateExercise(
  id: string,
  updates: Partial<Omit<Exercise, "id" | "created_at" | "user_id">>
): Promise<Exercise> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Exercise;
}

// Delete an exercise
export async function deleteExercise(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
