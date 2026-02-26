import { createClient } from "@/lib/supabase/client";
import type { WorkoutTemplate, TemplateExercise } from "@/types";

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("workout_templates")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data as WorkoutTemplate[];
}

export async function getTemplateWithExercises(
  templateId: string
): Promise<{
  template: WorkoutTemplate;
  exercises: TemplateExercise[];
}> {
  const supabase = createClient();

  const { data: template, error: tError } = await supabase
    .from("workout_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (tError) throw tError;

  const { data: exercises, error: eError } = await supabase
    .from("template_exercises")
    .select("*, exercise:exercises(*)")
    .eq("template_id", templateId)
    .order("sort_order");
  if (eError) throw eError;

  return {
    template: template as WorkoutTemplate,
    exercises: exercises as TemplateExercise[],
  };
}

export async function createTemplate(params: {
  name: string;
  splitType: string;
  trainingStyle: string;
  description?: string;
  exercises: Array<{
    exerciseId: string;
    targetSets: number;
    targetReps: number;
    targetWeight?: number;
    setType?: string;
    notes?: string;
  }>;
}): Promise<WorkoutTemplate> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: template, error: tError } = await supabase
    .from("workout_templates")
    .insert({
      user_id: user.id,
      name: params.name,
      split_type: params.splitType,
      training_style: params.trainingStyle,
      description: params.description || null,
    })
    .select()
    .single();
  if (tError) throw tError;

  if (params.exercises.length > 0) {
    const templateExercises = params.exercises.map((ex, index) => ({
      template_id: template.id,
      exercise_id: ex.exerciseId,
      target_sets: ex.targetSets,
      target_reps: ex.targetReps,
      target_weight: ex.targetWeight || null,
      sort_order: index,
      set_type: ex.setType || "working",
      notes: ex.notes || null,
    }));

    const { error: eError } = await supabase
      .from("template_exercises")
      .insert(templateExercises);
    if (eError) throw eError;
  }

  return template as WorkoutTemplate;
}

export async function updateTemplate(
  id: string,
  updates: Partial<
    Pick<
      WorkoutTemplate,
      "name" | "split_type" | "training_style" | "description" | "is_active" | "sort_order"
    >
  >
): Promise<WorkoutTemplate> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as WorkoutTemplate;
}

export async function updateTemplateWithExercises(
  id: string,
  params: {
    name: string;
    splitType: string;
    trainingStyle: string;
    description?: string;
    exercises: Array<{
      exerciseId: string;
      targetSets: number;
      targetReps: number;
      targetWeight?: number;
      setType?: string;
      notes?: string;
    }>;
  }
): Promise<WorkoutTemplate> {
  const supabase = createClient();

  // Update template metadata
  const { data: template, error: tError } = await supabase
    .from("workout_templates")
    .update({
      name: params.name,
      split_type: params.splitType,
      training_style: params.trainingStyle,
      description: params.description || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (tError) throw tError;

  // Delete existing exercises and replace with new list
  const { error: delError } = await supabase
    .from("template_exercises")
    .delete()
    .eq("template_id", id);
  if (delError) throw delError;

  if (params.exercises.length > 0) {
    const templateExercises = params.exercises.map((ex, index) => ({
      template_id: id,
      exercise_id: ex.exerciseId,
      target_sets: ex.targetSets,
      target_reps: ex.targetReps,
      target_weight: ex.targetWeight || null,
      sort_order: index,
      set_type: ex.setType || "working",
      notes: ex.notes || null,
    }));

    const { error: eError } = await supabase
      .from("template_exercises")
      .insert(templateExercises);
    if (eError) throw eError;
  }

  return template as WorkoutTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = createClient();
  // Template exercises cascade delete via FK
  const { error } = await supabase
    .from("workout_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function addExerciseToTemplate(params: {
  templateId: string;
  exerciseId: string;
  targetSets?: number;
  targetReps?: number;
  targetWeight?: number;
  sortOrder?: number;
}): Promise<TemplateExercise> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("template_exercises")
    .insert({
      template_id: params.templateId,
      exercise_id: params.exerciseId,
      target_sets: params.targetSets || 3,
      target_reps: params.targetReps || 10,
      target_weight: params.targetWeight || null,
      sort_order: params.sortOrder || 0,
    })
    .select("*, exercise:exercises(*)")
    .single();
  if (error) throw error;
  return data as TemplateExercise;
}

export async function removeExerciseFromTemplate(
  templateExerciseId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("template_exercises")
    .delete()
    .eq("id", templateExerciseId);
  if (error) throw error;
}
