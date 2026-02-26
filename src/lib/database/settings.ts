import { createClient } from "@/lib/supabase/client";
import type { UserSettings } from "@/types";

// Fetch settings for current user, creating defaults if none exist
export async function getSettings(): Promise<UserSettings> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Try to fetch existing settings
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (data) return data as UserSettings;

  // If no row exists (PGRST116 = no rows returned), insert defaults
  if (error && error.code === "PGRST116") {
    const { data: newSettings, error: insertError } = await supabase
      .from("user_settings")
      .insert({
        user_id: user.id,
        display_name: null,
        unit_preference: "lbs",
        daily_calorie_target: 2500,
        protein_target_g: 180,
        carbs_target_g: 250,
        fats_target_g: 80,
        tdee_estimate: null,
        training_days_per_week: 5,
        preferred_split: "ppl",
        rotation_mode: "suggested",
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return newSettings as UserSettings;
  }

  // Any other error
  if (error) throw error;

  // Should never reach here, but satisfy TypeScript
  throw new Error("Unexpected state fetching settings");
}

// Update settings for the current user
export async function updateSettings(
  updates: Partial<
    Pick<
      UserSettings,
      | "display_name"
      | "unit_preference"
      | "daily_calorie_target"
      | "protein_target_g"
      | "carbs_target_g"
      | "fats_target_g"
      | "tdee_estimate"
      | "training_days_per_week"
      | "preferred_split"
      | "rotation_mode"
    >
  >
): Promise<UserSettings> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as UserSettings;
}
