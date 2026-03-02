import { createClient } from "@/lib/supabase/client";
import type { BodyMeasurement, MeasurementField } from "@/types";

export type MeasurementInput = Partial<Record<MeasurementField, number | null>> & {
  notes?: string | null;
};

export async function logMeasurements(
  date: string,
  input: MeasurementInput
): Promise<BodyMeasurement> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("body_measurements")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("body_measurements")
      .update(input)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as BodyMeasurement;
  }

  const { data, error } = await supabase
    .from("body_measurements")
    .insert({ user_id: user.id, date, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as BodyMeasurement;
}

export async function getMeasurementHistory(
  days: number = 90
): Promise<BodyMeasurement[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDateStr)
    .order("date", { ascending: true });

  if (error) throw error;
  return data as BodyMeasurement[];
}

export async function getLatestMeasurement(): Promise<BodyMeasurement | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as BodyMeasurement) || null;
}
