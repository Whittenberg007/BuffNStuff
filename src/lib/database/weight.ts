import { createClient } from "@/lib/supabase/client";
import type { WeightEntry } from "@/types";

// Upsert a weight entry (one entry per day)
export async function logWeight(
  date: string,
  weight: number
): Promise<WeightEntry> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if an entry already exists for this date
  const { data: existing } = await supabase
    .from("weight_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  if (existing) {
    // Update existing entry
    const { data, error } = await supabase
      .from("weight_entries")
      .update({ weight })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;
    return data as WeightEntry;
  }

  // Insert new entry
  const { data, error } = await supabase
    .from("weight_entries")
    .insert({
      user_id: user.id,
      date,
      weight,
    })
    .select()
    .single();

  if (error) throw error;
  return data as WeightEntry;
}

// Fetch last N days of weight entries
export async function getWeightHistory(
  days: number = 30
): Promise<WeightEntry[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("weight_entries")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDateStr)
    .order("date", { ascending: true });

  if (error) throw error;
  return data as WeightEntry[];
}

// Compute 7-day moving average array
export async function getWeightTrend(
  days: number = 30
): Promise<{ date: string; weight: number; average: number | null }[]> {
  // Fetch extra days so we can calculate the moving average from day 1
  const entries = await getWeightHistory(days + 7);

  if (entries.length === 0) return [];

  // Build a map of date -> weight for quick lookup
  const weightMap = new Map<string, number>();
  for (const entry of entries) {
    weightMap.set(entry.date, entry.weight);
  }

  // Get the sorted list of all dates in the data
  const sortedDates = entries.map((e) => e.date).sort();

  // Calculate moving average for each date
  const result: { date: string; weight: number; average: number | null }[] = [];

  for (let i = 0; i < sortedDates.length; i++) {
    const currentDate = sortedDates[i];
    const currentWeight = weightMap.get(currentDate)!;

    // Collect up to 7 preceding entries (including current) for the moving average
    const windowStart = Math.max(0, i - 6);
    const windowEntries = sortedDates
      .slice(windowStart, i + 1)
      .map((d) => weightMap.get(d)!)
      .filter((w) => w !== undefined);

    const average =
      windowEntries.length >= 2
        ? windowEntries.reduce((sum, w) => sum + w, 0) / windowEntries.length
        : null;

    result.push({
      date: currentDate,
      weight: currentWeight,
      average: average !== null ? Math.round(average * 10) / 10 : null,
    });
  }

  // Trim to only return the requested number of days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split("T")[0];

  return result.filter((r) => r.date >= cutoffStr);
}
