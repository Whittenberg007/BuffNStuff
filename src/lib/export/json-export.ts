import { createClient } from "@/lib/supabase/client";
import { downloadOrShare } from "./file-utils";

const BACKUP_SCHEMA_VERSION = 1;

interface BackupData {
  schema_version: number;
  exported_at: string;
  exercises: unknown[];
  workout_templates: unknown[];
  template_exercises: unknown[];
  workout_sessions: unknown[];
  workout_sets: unknown[];
  nutrition_entries: unknown[];
  nutrition_favorites: unknown[];
  meal_plans: unknown[];
  meal_plan_items: unknown[];
  weight_entries: unknown[];
  goals: unknown[];
  user_badges: unknown[];
  fasting_settings: unknown[];
  fasting_log: unknown[];
  user_settings: unknown[];
}

async function getAuthUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

async function fetchTable(table: string, userId: string, filters?: { dateField?: string; startDate?: string; endDate?: string }) {
  const supabase = createClient();
  let query = supabase.from(table).select("*").eq("user_id", userId);

  if (filters?.dateField && filters.startDate && filters.endDate) {
    query = query.gte(filters.dateField, filters.startDate).lte(filters.dateField, filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Export a single data type as JSON */
export async function exportJSON(
  dataType: string,
  startDate: string,
  endDate: string
): Promise<void> {
  const userId = await getAuthUserId();

  const dateFilters: Record<string, { table: string; dateField: string }> = {
    workouts: { table: "workout_sessions", dateField: "started_at" },
    nutrition: { table: "nutrition_entries", dateField: "date" },
    weight: { table: "weight_entries", dateField: "date" },
    fasting: { table: "fasting_log", dateField: "date" },
  };

  let data: unknown[];
  const filter = dateFilters[dataType];

  if (filter) {
    data = await fetchTable(filter.table, userId, {
      dateField: filter.dateField,
      startDate: dataType === "workouts" ? `${startDate}T00:00:00` : startDate,
      endDate: dataType === "workouts" ? `${endDate}T23:59:59` : endDate,
    });
  } else if (dataType === "goals") {
    data = await fetchTable("goals", userId);
  } else {
    throw new Error(`Unknown data type: ${dataType}`);
  }

  if (data.length === 0) throw new Error("No data found for the selected range");

  const json = JSON.stringify(data, null, 2);
  const filename = `buffnstuff-${dataType}-${startDate}-to-${endDate}.json`;

  await downloadOrShare({ filename, data: json, mimeType: "application/json" });
}

/** Create a full backup of all user data */
export async function createFullBackup(): Promise<void> {
  const userId = await getAuthUserId();
  const supabase = createClient();

  // Fetch custom exercises (user-created only)
  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId);

  // Fetch all other user-scoped tables
  const [
    templates, templateExercises, sessions, sets,
    nutritionEntries, favorites, mealPlans, mealPlanItems,
    weightEntries, goals, badges,
    fastingSettings, fastingLog, userSettings,
  ] = await Promise.all([
    fetchTable("workout_templates", userId),
    // Template exercises need to be fetched via templates
    (async () => {
      const tmpls = await fetchTable("workout_templates", userId);
      if (!tmpls.length) return [];
      const { data } = await supabase
        .from("template_exercises")
        .select("*")
        .in("template_id", tmpls.map((t: { id: string }) => t.id));
      return data || [];
    })(),
    fetchTable("workout_sessions", userId),
    (async () => {
      const sess = await fetchTable("workout_sessions", userId);
      if (!sess.length) return [];
      const { data } = await supabase
        .from("workout_sets")
        .select("*")
        .in("session_id", sess.map((s: { id: string }) => s.id));
      return data || [];
    })(),
    fetchTable("nutrition_entries", userId),
    fetchTable("nutrition_favorites", userId),
    fetchTable("meal_plans", userId),
    (async () => {
      const plans = await fetchTable("meal_plans", userId);
      if (!plans.length) return [];
      const { data } = await supabase
        .from("meal_plan_items")
        .select("*")
        .in("plan_id", plans.map((p: { id: string }) => p.id));
      return data || [];
    })(),
    fetchTable("weight_entries", userId),
    fetchTable("goals", userId),
    fetchTable("user_badges", userId),
    (async () => {
      const { data } = await supabase.from("fasting_settings").select("*").eq("user_id", userId);
      return data || [];
    })(),
    fetchTable("fasting_log", userId),
    (async () => {
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId);
      return data || [];
    })(),
  ]);

  const backup: BackupData = {
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    exercises: exercises || [],
    workout_templates: templates,
    template_exercises: templateExercises,
    workout_sessions: sessions,
    workout_sets: sets,
    nutrition_entries: nutritionEntries,
    nutrition_favorites: favorites,
    meal_plans: mealPlans,
    meal_plan_items: mealPlanItems,
    weight_entries: weightEntries,
    goals,
    user_badges: badges,
    fasting_settings: fastingSettings,
    fasting_log: fastingLog,
    user_settings: userSettings,
  };

  const date = new Date().toISOString().split("T")[0];
  const json = JSON.stringify(backup, null, 2);
  const filename = `buffnstuff-backup-${date}.json`;

  await downloadOrShare({ filename, data: json, mimeType: "application/json" });
}

/** Restore from a backup JSON file. Returns a summary of what was restored. */
export async function restoreFromBackup(
  jsonString: string
): Promise<{ restored: Record<string, number>; skipped: Record<string, number> }> {
  const backup = JSON.parse(jsonString) as BackupData;

  if (!backup.schema_version || backup.schema_version > BACKUP_SCHEMA_VERSION) {
    throw new Error("Unsupported backup version");
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const restored: Record<string, number> = {};
  const skipped: Record<string, number> = {};

  async function upsertRows(table: string, rows: unknown[]) {
    if (!rows.length) return;
    let restoredCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      // Override user_id to current user
      if ("user_id" in record) record.user_id = user!.id;

      const { error } = await supabase.from(table).upsert(record, { onConflict: "id", ignoreDuplicates: true });
      if (error) {
        skippedCount++;
      } else {
        restoredCount++;
      }
    }

    restored[table] = restoredCount;
    if (skippedCount > 0) skipped[table] = skippedCount;
  }

  // Restore in dependency order
  await upsertRows("exercises", backup.exercises);
  await upsertRows("workout_templates", backup.workout_templates);
  await upsertRows("template_exercises", backup.template_exercises);
  await upsertRows("workout_sessions", backup.workout_sessions);
  await upsertRows("workout_sets", backup.workout_sets);
  await upsertRows("nutrition_entries", backup.nutrition_entries);
  await upsertRows("nutrition_favorites", backup.nutrition_favorites);
  await upsertRows("meal_plans", backup.meal_plans);
  await upsertRows("meal_plan_items", backup.meal_plan_items);
  await upsertRows("weight_entries", backup.weight_entries);
  await upsertRows("goals", backup.goals);
  await upsertRows("user_badges", backup.user_badges);
  await upsertRows("fasting_log", backup.fasting_log);

  return { restored, skipped };
}

export { BACKUP_SCHEMA_VERSION };
export type { BackupData };
