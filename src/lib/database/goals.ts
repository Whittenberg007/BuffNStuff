import { createClient } from "@/lib/supabase/client";
import type { Goal, GoalType } from "@/types";

// Get active goals
export async function getActiveGoals(): Promise<Goal[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Goal[];
}

// Get all goals grouped by status
export async function getAllGoals(): Promise<{
  active: Goal[];
  completed: Goal[];
  abandoned: Goal[];
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const goals = (data || []) as Goal[];
  return {
    active: goals.filter((g) => g.status === "active"),
    completed: goals.filter((g) => g.status === "completed"),
    abandoned: goals.filter((g) => g.status === "abandoned"),
  };
}

// Create a goal
export async function createGoal(
  goal: Omit<
    Goal,
    "id" | "user_id" | "current_value" | "status" | "completed_at" | "created_at"
  >
): Promise<Goal> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      type: goal.type,
      title: goal.title,
      description: goal.description || null,
      target_value: goal.target_value || null,
      current_value: 0,
      target_date: goal.target_date || null,
      status: "active",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Goal;
}

// Update goal progress
export async function updateGoalProgress(
  id: string,
  currentValue: number
): Promise<Goal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ current_value: currentValue })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Goal;
}

// Complete a goal
export async function completeGoal(id: string): Promise<Goal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Goal;
}

// Abandon a goal
export async function abandonGoal(id: string): Promise<Goal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ status: "abandoned" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Goal;
}
