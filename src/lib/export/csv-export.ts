import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { downloadOrShare } from "./file-utils";

type ExportDataType = "workouts" | "nutrition" | "weight" | "fasting" | "goals";

async function getAuthUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

async function fetchWorkoutRows(userId: string, startDate: string, endDate: string) {
  const supabase = createClient();

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, started_at, split_type")
    .eq("user_id", userId)
    .gte("started_at", `${startDate}T00:00:00`)
    .lte("started_at", `${endDate}T23:59:59`)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: true });

  if (!sessions?.length) return [];

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("session_id, exercise_id, set_number, weight, reps, set_type, rpe_rir, is_pr, exercise:exercises(name)")
    .in("session_id", sessions.map((s) => s.id))
    .order("logged_at", { ascending: true });

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  return (sets || []).map((set) => {
    const session = sessionMap.get(set.session_id);
    return {
      date: session?.started_at?.split("T")[0] || "",
      split_type: session?.split_type || "",
      exercise: (set.exercise as { name: string } | null)?.name || "",
      set_number: set.set_number,
      weight: set.weight,
      reps: set.reps,
      set_type: set.set_type,
      rpe: set.rpe_rir ?? "",
      is_pr: set.is_pr ? "Yes" : "No",
    };
  });
}

async function fetchNutritionRows(userId: string, startDate: string, endDate: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("nutrition_entries")
    .select("date, meal_name, food_item, calories, protein_g, carbs_g, fats_g")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  return data || [];
}

async function fetchWeightRows(userId: string, startDate: string, endDate: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("weight_entries")
    .select("date, weight")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  return data || [];
}

async function fetchFastingRows(userId: string, startDate: string, endDate: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("fasting_log")
    .select("date, eating_start, eating_end, target_fast_hours, achieved_fast_hours, hit_target")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  return data || [];
}

async function fetchGoalRows(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("goals")
    .select("title, type, target_value, current_value, status, target_date")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function exportCSV(
  dataType: ExportDataType,
  startDate: string,
  endDate: string
): Promise<void> {
  const userId = await getAuthUserId();

  let rows: Record<string, unknown>[];
  switch (dataType) {
    case "workouts":
      rows = await fetchWorkoutRows(userId, startDate, endDate);
      break;
    case "nutrition":
      rows = await fetchNutritionRows(userId, startDate, endDate);
      break;
    case "weight":
      rows = await fetchWeightRows(userId, startDate, endDate);
      break;
    case "fasting":
      rows = await fetchFastingRows(userId, startDate, endDate);
      break;
    case "goals":
      rows = await fetchGoalRows(userId);
      break;
    default:
      throw new Error(`Unknown data type: ${dataType}`);
  }

  if (rows.length === 0) throw new Error("No data found for the selected range");

  const csv = Papa.unparse(rows);
  const filename = `buffnstuff-${dataType}-${startDate}-to-${endDate}.csv`;

  await downloadOrShare({ filename, data: csv, mimeType: "text/csv;charset=utf-8;" });
}

export type { ExportDataType };
