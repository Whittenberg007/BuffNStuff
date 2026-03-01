import { createClient } from "@/lib/supabase/client";
import { addNutritionEntry } from "./nutrition";
import type { MealPlan, MealPlanItem } from "@/types";

/** Get all meal plans for the current user */
export async function getMealPlans(): Promise<MealPlan[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data as MealPlan[];
}

/** Get a single meal plan by ID */
export async function getMealPlan(id: string): Promise<MealPlan | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as MealPlan) || null;
}

/** Create a new meal plan */
export async function createMealPlan(plan: {
  name: string;
  description?: string | null;
  eating_window_start?: string | null;
  eating_window_end?: string | null;
}): Promise<MealPlan> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("meal_plans")
    .insert({
      user_id: user.id,
      name: plan.name,
      description: plan.description || null,
      eating_window_start: plan.eating_window_start || null,
      eating_window_end: plan.eating_window_end || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as MealPlan;
}

/** Update a meal plan */
export async function updateMealPlan(
  id: string,
  updates: Partial<
    Pick<
      MealPlan,
      "name" | "description" | "eating_window_start" | "eating_window_end"
    >
  >
): Promise<MealPlan> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as MealPlan;
}

/** Delete a meal plan and its items */
export async function deleteMealPlan(id: string): Promise<void> {
  const supabase = createClient();

  // Delete items first (FK constraint)
  await supabase.from("meal_plan_items").delete().eq("plan_id", id);

  const { error } = await supabase.from("meal_plans").delete().eq("id", id);
  if (error) throw error;
}

/** Get all items for a meal plan */
export async function getMealPlanItems(
  planId: string
): Promise<MealPlanItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meal_plan_items")
    .select("*")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as MealPlanItem[];
}

/** Add an item to a meal plan */
export async function addMealPlanItem(item: {
  plan_id: string;
  meal_name: string;
  target_time?: string | null;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  serving_size?: string | null;
  sort_order: number;
}): Promise<MealPlanItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meal_plan_items")
    .insert(item)
    .select()
    .single();

  if (error) throw error;
  return data as MealPlanItem;
}

/** Delete a meal plan item */
export async function deleteMealPlanItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("meal_plan_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Apply a meal plan to a specific date — copies all items as nutrition entries */
export async function applyPlanToDay(
  planId: string,
  date: string
): Promise<void> {
  const items = await getMealPlanItems(planId);

  for (const item of items) {
    await addNutritionEntry({
      date,
      meal_name: item.meal_name,
      food_item: item.food_item,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fats_g: item.fats_g,
    });
  }
}

/** Save current day's nutrition entries as a new meal plan */
export async function saveDayAsPlan(
  date: string,
  planName: string
): Promise<MealPlan> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get today's entries
  const { data: entries, error } = await supabase
    .from("nutrition_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!entries || entries.length === 0)
    throw new Error("No entries for this date");

  // Create the plan
  const plan = await createMealPlan({ name: planName });

  // Add each entry as a plan item
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    await addMealPlanItem({
      plan_id: plan.id,
      meal_name: entry.meal_name,
      food_item: entry.food_item,
      calories: entry.calories,
      protein_g: entry.protein_g,
      carbs_g: entry.carbs_g,
      fats_g: entry.fats_g,
      sort_order: i,
    });
  }

  return plan;
}
