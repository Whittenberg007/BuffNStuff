import { createClient } from "@/lib/supabase/client";
import type { FastingSettings, FastingLog } from "@/types";

/** Get fasting settings for the current user */
export async function getFastingSettings(): Promise<FastingSettings | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("fasting_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return (data as FastingSettings) || null;
}

/** Create or update fasting settings */
export async function upsertFastingSettings(settings: {
  protocol: string;
  target_fast_hours: number;
  eating_window_start: string;
  eating_window_end: string;
  notifications_enabled: boolean;
}): Promise<FastingSettings> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("fasting_settings")
    .upsert(
      {
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as FastingSettings;
}

/** Get today's fasting log (or a specific date) */
export async function getFastingLog(date: string): Promise<FastingLog | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("fasting_log")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as FastingLog) || null;
}

/** Create or update today's fasting log */
export async function upsertFastingLog(log: {
  date: string;
  eating_start?: string | null;
  eating_end?: string | null;
  target_fast_hours: number;
  achieved_fast_hours?: number | null;
  hit_target?: boolean | null;
  notes?: string | null;
}): Promise<FastingLog> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("fasting_log")
    .upsert(
      {
        user_id: user.id,
        ...log,
      },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as FastingLog;
}

/** Calculate current fasting streak (consecutive days where hit_target = true) */
export async function getFastingStreak(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from("fasting_log")
    .select("date, hit_target")
    .eq("user_id", user.id)
    .eq("hit_target", true)
    .order("date", { ascending: false })
    .limit(365);

  if (error || !data || data.length === 0) return 0;

  // Count consecutive days from today backwards
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < data.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    const expectedStr = expectedDate.toISOString().split("T")[0];

    if (data[i].date === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
