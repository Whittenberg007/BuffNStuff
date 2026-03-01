import { createClient } from "@/lib/supabase/client";
import type { TrainingProgram, ProgramEnrollment } from "@/types";

// Get all prebuilt programs (curated, not user-created)
export async function getPrebuiltPrograms(): Promise<TrainingProgram[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("training_programs")
    .select("*")
    .eq("is_prebuilt", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data as TrainingProgram[];
}

// Get user-created programs for the current user
export async function getUserPrograms(): Promise<TrainingProgram[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("training_programs")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_prebuilt", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as TrainingProgram[];
}

// Get a single program by ID
export async function getProgram(
  programId: string
): Promise<TrainingProgram | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("training_programs")
    .select("*")
    .eq("id", programId)
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data as TrainingProgram;
}

// Create a new user program
export async function createProgram(
  program: Omit<TrainingProgram, "id" | "user_id" | "is_prebuilt" | "created_at">
): Promise<TrainingProgram> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("training_programs")
    .insert({
      user_id: user.id,
      name: program.name,
      description: program.description || null,
      duration_weeks: program.duration_weeks,
      difficulty: program.difficulty,
      goal: program.goal,
      days_per_week: program.days_per_week,
      periodization: program.periodization,
      schedule: program.schedule,
      progression_rules: program.progression_rules,
      deload_config: program.deload_config,
      is_prebuilt: false,
    })
    .select()
    .single();

  if (error) throw error;
  const created = data as TrainingProgram;

  // Create feed event for program creation
  try {
    const { createFeedEvent } = await import("@/lib/database/feed");
    await createFeedEvent("program_started", {
      program_id: created.id,
      program_name: created.name,
    });
  } catch {}

  return created;
}

// Delete a program by ID
export async function deleteProgram(programId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("training_programs")
    .delete()
    .eq("id", programId);

  if (error) throw error;
}

// Enroll in a program: abandon any active enrollment first, then create new one
export async function enrollInProgram(
  programId: string
): Promise<ProgramEnrollment> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Abandon any currently active enrollment
  await supabase
    .from("program_enrollments")
    .update({ status: "abandoned" })
    .eq("user_id", user.id)
    .eq("status", "active");

  // Create new enrollment
  const { data, error } = await supabase
    .from("program_enrollments")
    .insert({
      user_id: user.id,
      program_id: programId,
      current_week: 1,
      current_day_index: 0,
      status: "active",
      progress_log: {},
    })
    .select("*, program:training_programs(*)")
    .single();

  if (error) throw error;
  const enrollment = data as ProgramEnrollment;

  // Create feed event for enrollment
  try {
    const { createFeedEvent } = await import("@/lib/database/feed");
    await createFeedEvent("program_started", {
      program_id: enrollment.program_id,
      program_name: enrollment.program?.name,
    });
  } catch {}

  return enrollment;
}

// Get the currently active enrollment for the user
export async function getActiveEnrollment(): Promise<ProgramEnrollment | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("program_enrollments")
    .select("*, program:training_programs(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data as ProgramEnrollment;
}

// Get full enrollment history for the user
export async function getEnrollmentHistory(): Promise<ProgramEnrollment[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("program_enrollments")
    .select("*, program:training_programs(*)")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  if (error) throw error;
  return data as ProgramEnrollment[];
}

// Advance the program to the next day/week
export async function advanceProgram(
  enrollmentId: string
): Promise<ProgramEnrollment> {
  const supabase = createClient();

  // Fetch enrollment with joined program
  const { data: enrollmentData, error: fetchError } = await supabase
    .from("program_enrollments")
    .select("*, program:training_programs(*)")
    .eq("id", enrollmentId)
    .single();

  if (fetchError) throw fetchError;
  const enrollment = enrollmentData as ProgramEnrollment;
  const program = enrollment.program;
  if (!program) throw new Error("Program not found for enrollment");

  const schedule = program.schedule;
  const currentWeekIndex = enrollment.current_week - 1;
  const currentWeek = schedule.weeks[currentWeekIndex];

  if (!currentWeek) throw new Error("Current week not found in schedule");

  let nextDayIndex = enrollment.current_day_index + 1;
  let nextWeek = enrollment.current_week;
  let completed = false;

  // If next day exceeds days in current week, move to next week
  if (nextDayIndex >= currentWeek.days.length) {
    nextDayIndex = 0;
    nextWeek = enrollment.current_week + 1;

    // If next week exceeds total weeks, check repeat_from_week or mark completed
    if (nextWeek > schedule.weeks.length) {
      if (schedule.repeat_from_week !== undefined) {
        nextWeek = schedule.repeat_from_week;
      } else {
        completed = true;
      }
    }
  }

  // Update progress_log with the completed day
  const progressKey = `w${enrollment.current_week}d${enrollment.current_day_index}`;
  const updatedProgressLog = {
    ...enrollment.progress_log,
    [progressKey]: new Date().toISOString(),
  };

  if (completed) {
    const { data, error } = await supabase
      .from("program_enrollments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        progress_log: updatedProgressLog,
      })
      .eq("id", enrollmentId)
      .select("*, program:training_programs(*)")
      .single();

    if (error) throw error;
    const completedEnrollment = data as ProgramEnrollment;

    // Create feed event for completion
    try {
      const { createFeedEvent } = await import("@/lib/database/feed");
      await createFeedEvent("program_completed", {
        program_id: program.id,
        program_name: program.name,
      });
    } catch {}

    return completedEnrollment;
  }

  const { data, error } = await supabase
    .from("program_enrollments")
    .update({
      current_week: nextWeek,
      current_day_index: nextDayIndex,
      progress_log: updatedProgressLog,
    })
    .eq("id", enrollmentId)
    .select("*, program:training_programs(*)")
    .single();

  if (error) throw error;
  return data as ProgramEnrollment;
}

// Abandon a program enrollment
export async function abandonProgram(
  enrollmentId: string
): Promise<ProgramEnrollment> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("program_enrollments")
    .update({ status: "abandoned" })
    .eq("id", enrollmentId)
    .select()
    .single();

  if (error) throw error;
  return data as ProgramEnrollment;
}
