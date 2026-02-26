import { createClient } from "@/lib/supabase/client";
import type { NutritionEntry, NutritionFavorite } from "@/types";

// Fetch all nutrition entries for a given date (user-scoped)
export async function getDailyLog(date: string): Promise<NutritionEntry[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("nutrition_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as NutritionEntry[];
}

// Insert a new food entry
export async function addNutritionEntry(entry: {
  date: string;
  meal_name: string;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  quantity_note?: string;
}): Promise<NutritionEntry> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("nutrition_entries")
    .insert({
      user_id: user.id,
      date: entry.date,
      meal_name: entry.meal_name,
      food_item: entry.food_item,
      calories: entry.calories,
      protein_g: entry.protein_g,
      carbs_g: entry.carbs_g,
      fats_g: entry.fats_g,
      quantity_note: entry.quantity_note || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as NutritionEntry;
}

// Update an existing nutrition entry
export async function updateNutritionEntry(
  id: string,
  updates: Partial<
    Pick<
      NutritionEntry,
      | "meal_name"
      | "food_item"
      | "calories"
      | "protein_g"
      | "carbs_g"
      | "fats_g"
      | "quantity_note"
    >
  >
): Promise<NutritionEntry> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("nutrition_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as NutritionEntry;
}

// Delete a nutrition entry
export async function deleteNutritionEntry(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("nutrition_entries")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Compute SUM of calories/protein/carbs/fats for a date
export async function getDailyTotals(date: string): Promise<{
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("nutrition_entries")
    .select("calories, protein_g, carbs_g, fats_g")
    .eq("user_id", user.id)
    .eq("date", date);

  if (error) throw error;

  const entries = data || [];
  return entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + (entry.calories || 0),
      protein_g: acc.protein_g + (entry.protein_g || 0),
      carbs_g: acc.carbs_g + (entry.carbs_g || 0),
      fats_g: acc.fats_g + (entry.fats_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
  );
}

// Fetch all nutrition favorites (user-scoped)
export async function getFavorites(): Promise<NutritionFavorite[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("nutrition_favorites")
    .select("*")
    .eq("user_id", user.id)
    .order("food_item", { ascending: true });

  if (error) throw error;
  return data as NutritionFavorite[];
}

// Save a favorite food
export async function addFavorite(food: {
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  default_quantity?: string;
}): Promise<NutritionFavorite> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("nutrition_favorites")
    .insert({
      user_id: user.id,
      food_item: food.food_item,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fats_g: food.fats_g,
      default_quantity: food.default_quantity || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as NutritionFavorite;
}

// Delete a favorite
export async function deleteFavorite(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("nutrition_favorites")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
